# Bidket 활동 다이어그램 (API 분석 기반)

> 분석 대상: `Bidket/bidket-project/backend/` (Spring Cloud MSA)
> 다이어그램은 **현재 코드가 실제로 동작하는 방식**을 기준으로 그렸습니다. 설계 의도와 구현이 어긋나는 곳은 `⚠` 노드와 점선으로 표시했고, 문서 끝 [구현 갭](#10-구현-갭-정리)에 따로 모았습니다.

## 서비스 개요

| 서비스 | 포트 | 역할 |
|---|---|---|
| gateway-service | 8000 | 라우팅, JWT → `X-User-Id`/`X-User-Role` 헤더 주입, 대기열 토큰 필터 |
| eureka-server | - | 서비스 디스커버리 |
| user-service | 8100 | 회원, 인증(JWT), 블랙리스트, 포인트 |
| product-service | 8200 | 상품, 브랜드, 카테고리, SKU (관리자 등록) |
| auction-service | 8300 | 경매, 입찰, 경매 종료 Saga, 결제 타임아웃 Saga |
| queue-service | 8400 | 경매 대기열(Redis ZSET), 활성 토큰 발급 (WebFlux) |
| order-service | 8500 | 주문, 결제, 환불, 결제 기한 스케줄러 |
| notification-service | 8600 | Kafka 이벤트 알림(IN_APP/EMAIL), Slack |

### 주요 API 요약

| 서비스 | 엔드포인트 |
|---|---|
| user | `POST /v1/members/signup·login·social-login·token/refresh·logout`, `GET/PATCH/DELETE /v1/members/me·profile·password`, `GET /v1/members/check-email·check-nickname·bid-eligibility·points·points/history`, `POST/DELETE /v1/members/{id}/blacklist`, `GET /api/v1/users/{id}/email` (내부) |
| product | `GET /v1/products`, `/v1/products/{id}`, `/v1/products/{id}/page`, `/v1/products/search`, `/v1/products/skus`, `/v1/brands`, `/v1/categories(/tree)`, `POST /v1/admin/{product-types, brands, categories, size-types, sizes, products, products/with-shoes, products/{id}/skus ...}` |
| auction | `POST/GET /api/v1/auctions`, `GET/PUT/DELETE /api/v1/auctions/{id}`, `POST /api/v1/auctions/{id}/confirm`, `GET /api/v1/auctions/seller/{sellerId}` |
| auction (bid) | `POST /api/v1/bids`, `POST /api/v1/bids/auction/{auctionId}/buy-now`, `GET /api/v1/bids/auction/{auctionId}·my·{bidId}`, `DELETE /api/v1/bids/{bidId}` |
| queue | `POST/DELETE/GET /v1/queues/{auctionId}`, `GET /v1/queues/{auctionId}/status`, `POST /v1/queues/{auctionId}/heartbeat`, `PATCH /v1/admin/queues/{id}`, `GET /v1/admin/queues/{id}/metrics`, `POST/DELETE /v1/internal/queues` |
| order | `POST/GET /v1/orders`, `POST /v1/payments`, `POST /v1/payments/confirm`, `PATCH /v1/payments/fail`, `GET /v1/payments`, `POST /v1/refunds/{paymentId}`, `GET /v1/refunds` |
| notification | `POST /api/v1/notifications/send`, `PATCH /api/v1/notifications/{id}/read`, `DELETE /api/v1/notifications/{id}` |

### 전체 흐름 한눈에 보기

```mermaid
flowchart LR
    U([사용자]) --> GW["gateway-service"]
    GW --> US["user-service"]
    GW --> PS["product-service"]
    GW --> QS["queue-service"]
    GW --> AS["auction-service"]
    GW --> OS["order-service"]
    GW --> NS["notification-service"]
    AS -. "order.auction (CREATE/CANCEL_ORDER_REQUESTED)" .-> OS
    OS -. "auction.order (ORDER_CREATED, PAYMENT_TIMEOUT ...)" .-> AS
    AS -. "notification.auction (outbid, closed, AUCTION_REOPENED)" .-> NS
    QS -. "notification.queue.admitted ⚠ 소비자 없음" .-> NS
    NS -->|"REST: 이메일 조회"| US
    NS -->|"REST: 경매 제목 조회"| AS
    OS -->|"REST: 경매 조회"| AS
```

---

## 1. Gateway 요청 처리

필터 순서: Security(전부 permitAll) → `RequestHeaderFilter`(-2) → `ResponseHeaderFilter`(-1) → (bid 라우트만) `QueueActiveTokenFilter`

```mermaid
flowchart TD
    S([요청 수신]) --> SEC["Spring Security: anyExchange permitAll"]
    SEC --> H1{"Authorization: Bearer 토큰 존재?"}
    H1 -- 아니오 --> PASS["헤더 추가 없이 그대로 전달"]
    H1 -- 예 --> H2{"JwtTokenProvider.validateToken 성공?"}
    H2 -- 아니오 --> PASS
    H2 -- 예 --> ADD["subject→X-User-Id, role→X-User-Role 추가<br/>(role 기본값 ROLE_USER)"]
    ADD --> R{"bid-service-route 매칭?<br/>(**/v1/bids/**, heartbeat)"}
    PASS --> R
    R -- 아니오 --> D["discovery 라우트 /{service-id}/** 로 전달"]
    R -- 예 --> Q1{"X-Q-ACTIVE-TOKEN 헤더 존재?"}
    Q1 -- 아니오 --> E1(["401 Missing Token"])
    Q1 -- 예 --> Q2{"queue 토큰 서명 검증 OK?<br/>auctionId, userId 추출"}
    Q2 -- 아니오 --> E2(["401 Invalid Token"])
    Q2 -- 예 --> Q3{"Redis HGET queue:token:{auctionId} {userId}<br/>== 요청 토큰?"}
    Q3 -- 아니오 --> E2
    Q3 -- 예 --> LB["lb://bid-service 로 전달"]
    LB -.-> W1["⚠ bid-service로 등록된 서비스 없음<br/>(입찰은 auction-service에 있음)"]
    D --> RESP["ResponseHeaderFilter:<br/>응답 body의 data.memberId/role → X-User-Id/Role 응답 헤더"]
    RESP --> F([응답 반환])
```

---

## 2. 인증 (user-service)

### 2-1. 회원가입 `POST /v1/members/signup`

```mermaid
flowchart TD
    S([Start]) --> A{"약관 동의?"}
    A -- 아니오 --> E1(["TERMS_NOT_AGREED"])
    A -- 예 --> B{"이메일 중복?"}
    B -- 예 --> E2(["EMAIL_DUPLICATE"])
    B -- 아니오 --> C{"loginId 중복?"}
    C -- 예 --> E3(["LOGIN_ID_DUPLICATE"])
    C -- 아니오 --> D{"닉네임 입력 & 중복?"}
    D -- 예 --> E4(["NICKNAME_DUPLICATE"])
    D -- 아니오 --> P{"PasswordValidator 통과?"}
    P -- 아니오 --> E5(["WEAK_PASSWORD"])
    P -- 예 --> SAVE["BCrypt 해시 → User 저장 (LOCAL, ACTIVE)"]
    SAVE --> PA["PointAccount 생성 (잔액 0)"]
    PA --> NSET["NotificationSetting 생성"]
    NSET --> TK["Access/Refresh 토큰 발급<br/>기존 Refresh 삭제 후 저장"]
    TK --> F(["memberId + 토큰 반환"])
```

### 2-2. 로그인 / 소셜 로그인

```mermaid
flowchart TD
    S([Start]) --> T{"로그인 방식"}
    T -- "POST /login" --> L1{"loginId 존재?"}
    L1 -- 아니오 --> EC(["INVALID_CREDENTIALS"])
    L1 -- 예 --> L2{"provider == LOCAL?"}
    L2 -- 아니오 --> EC
    L2 -- 예 --> L3{"BCrypt 비밀번호 일치?"}
    L3 -- 아니오 --> EC
    L3 -- 예 --> ST

    T -- "POST /social-login" --> G1{"provider == GOOGLE<br/>& idToken 존재?"}
    G1 -- 아니오 --> EI(["INVALID_REQUEST"])
    G1 -- 예 --> G2{"GoogleTokenVerifier 검증 OK?"}
    G2 -- 아니오 --> ES(["SOCIAL_TOKEN_INVALID"])
    G2 -- 예 --> G3{"provider+providerId 회원 존재?"}
    G3 -- 아니오 --> G4["자동 가입: User + PointAccount + NotificationSetting<br/>isNewMember = true"]
    G3 -- 예 --> ST
    G4 --> ST

    ST{"status == ACTIVE?"}
    ST -- 아니오 --> EA(["INACTIVE_MEMBER"])
    ST -- 예 --> BL{"활성 블랙리스트?"}
    BL -- 예 --> EB(["BLACKLISTED_MEMBER"])
    BL -- 아니오 --> TK["토큰 발급, Refresh 토큰 교체/업서트<br/>lastLoginAt 갱신"]
    TK --> F(["accessToken, refreshToken, memberId, role 반환"])
```

### 2-3. 토큰 재발급 / 로그아웃

```mermaid
flowchart TD
    S([POST /token/refresh]) --> A{"JWT 서명 유효?"}
    A -- 아니오 --> E(["INVALID_TOKEN"])
    A -- 예 --> B{"DB에 해당 Refresh 토큰 존재?"}
    B -- 아니오 --> E
    B -- 예 --> C{"DB userId == JWT userId?"}
    C -- 아니오 --> E
    C -- 예 --> D{"만료됨?"}
    D -- 예 --> DEL["토큰 삭제"] --> E
    D -- 아니오 --> R["사용자 Refresh 전체 삭제<br/>새 Access/Refresh 발급 및 저장 (rotation)"]
    R --> F([새 토큰 반환])

    S2([POST /logout]) --> L1["SecurityContext에서 userId 획득"]
    L1 --> L2["사용자 Refresh 토큰 전체 삭제 (멱등)"]
    L2 --> F2([200 OK])
```

---

## 3. 대기열 (queue-service)

### 3-1. 대기열 설정 생성

```mermaid
flowchart TD
    S1(["POST /v1/internal/queues"]) --> C
    S2(["Kafka queue.auction ⚠ 생산자 없음"]) -.-> C
    C["createConfigQueue"] --> A{"config hash 저장 성공?<br/>(maxActive, permitsPerSec, openAt, closeAt)"}
    A -- 아니오 --> E1(["REDIS_SAVE_FAILED"])
    A -- 예 --> B{"만료 설정 (closeAt + 1일) 성공?"}
    B -- 아니오 --> RB["config 삭제"] --> E2(["REDIS_EXPIRE_SET_FAILED"])
    B -- 예 --> D{"활성 경매 Set 등록 성공?"}
    D -- 아니오 --> E3(["AUCTION_REGISTER_FAIL"])
    D -- 예 --> F([대기열 RUNNING])
```

### 3-2. 입장 → 대기 → 활성 토큰 발급

모든 트래픽 API는 `@CheckQueueConfig`(config 존재, openAt ≤ now ≤ closeAt)를 먼저 통과해야 합니다.

```mermaid
flowchart TD
    subgraph Client["사용자"]
        S([경매 대기열 진입])
    end

    subgraph Aspect["@CheckQueueConfig"]
        K1{"config 존재?"}
        K2{"now >= openAt?"}
        K3{"now <= closeAt?"}
    end

    subgraph Queue["queue-service"]
        EN["POST /v1/queues/{id}<br/>ZADD waiting userId score=now<br/>TTL 1h, 순번 반환"]
        PO["GET /v1/queues/{id}/status (폴링)"]
        T1{"queue:token 에 토큰 존재?"}
        T2{"validateToken OK?"}
        ACT(["ACTIVE + X-Q-ACTIVE-TOKEN 헤더<br/>Location /v1/auctions/{id}"])
        RK{"waiting 순번 존재?"}
        WT["WAITING: rank, retryAfter 3s<br/>waiting TTL 5분"]
        NT{"rank <= 10?"}
        NO["outbox QUEUE_NEAR_TURN 저장"]
    end

    subgraph Scheduler["QueueScheduler (1초마다, 경매별 병렬)"]
        SC1["만료된 active 사용자 정리"]
        SC2{"config 만료?"}
        SC3["활성 경매 Set에서 제거"]
        SC4["limit = min(maxActive - 현재 active, permitsPerSec)"]
        SC5{"limit > 0?"}
        SC6["ZPOPMIN waiting limit명"]
        SC7["사용자별 JWT(userId, auctionId) 생성<br/>active 등록 + HSET queue:token"]
        SC8["outbox QUEUE_ENTERED 저장"]
    end

    S --> K1
    K1 -- 아니오 --> EK1(["CONFIG_NOT_FOUND"])
    K1 -- 예 --> K2
    K2 -- 아니오 --> EK2(["AUCTION_NOT_OPENED"])
    K2 -- 예 --> K3
    K3 -- 아니오 --> EK3(["AUCTION_CLOSED"])
    K3 -- 예 --> EN
    EN --> PO
    PO --> T1
    T1 -- 예 --> T2
    T2 -- 아니오 --> ET(["INVALID_TOKEN"])
    T2 -- 예 --> ACT
    T1 -- 아니오 --> RK
    RK -- 아니오 --> EW(["WAITING_USER_NOT_FOUND"])
    RK -- 예 --> WT --> NT
    NT -- 예 --> NO --> PO
    NT -- 아니오 --> PO

    SC1 --> SC2
    SC2 -- 예 --> SC3
    SC2 -- 아니오 --> SC4 --> SC5
    SC5 -- 아니오 --> SCX([이번 tick 종료])
    SC5 -- 예 --> SC6 --> SC7 --> SC8
    SC7 -. "토큰 생성" .-> T1
```

### 3-3. Heartbeat / 취소 / Outbox 발행

```mermaid
flowchart TD
    H(["POST /{id}/heartbeat"]) --> H1{"저장 토큰 == 헤더 토큰<br/>& validateToken OK?"}
    H1 -- 아니오 --> HE(["INVALID_TOKEN"])
    H1 -- 예 --> H2{"active 갱신 결과 존재?"}
    H2 -- 아니오 --> HE2(["TOKEN_NOT_FOUND"])
    H2 -- 예 --> H3(["만료시각 = now + heartbeat.frequency + 1분<br/>ACTIVE"])

    C(["DELETE /v1/queues/{id}"]) --> C1(["ZREM waiting userId"])

    O([OutboxScheduler 1초마다]) --> O1["PENDING & retryCount < 5 조회"]
    O1 --> O2["Kafka notification.queue.admitted 발행"]
    O2 --> O3{"성공?"}
    O3 -- 예 --> O4([PUBLISHED])
    O3 -- 아니오 --> O5["retryCount++ (한도 도달 시 FAILED)"]
    O2 -.-> W["⚠ notification-service는 notification.queue 구독<br/>→ 수신되지 않음"]
```

---

## 4. 경매 생성 · 시작 · 종료 (auction-service)

```mermaid
flowchart TD
    S(["POST /api/v1/auctions"]) --> V1{"startTime >= now+1h<br/>& endTime >= start+1h?"}
    V1 -- 아니오 --> E1(["INVALID_TIME_RANGE"])
    V1 -- 예 --> V2{"endTime <= start+7일?"}
    V2 -- 아니오 --> E2(["INVALID_AUCTION_PERIOD"])
    V2 -- 예 --> V3{"buyNowPrice > startPrice?"}
    V3 -- 아니오 --> E3(["INVALID_BUY_NOW_PRICE"])
    V3 -- 예 --> C1["Auction 저장 status=CREATING<br/>outbox AUCTION_CREATED → auction.events<br/>캐시 무효화"]
    C1 --> CF["POST /{id}/confirm"]
    CF --> CF1{"status == CREATING?"}
    CF1 -- 아니오 --> E4(["INVALID_AUCTION_STATUS"])
    CF1 -- 예 --> P["PENDING"]

    P --> SCH1["AuctionScheduler.startPendingAuctions (60초)<br/>startTime <= now 인 PENDING, productSizeId별 그룹"]
    SCH1 --> SCH2{"같은 productSizeId에 ACTIVE 경매 존재?"}
    SCH2 -- 예 --> SKIP["건너뜀 (다음 주기)"] --> SCH1
    SCH2 -- 아니오 --> A["그룹의 첫 경매 start() → ACTIVE"]

    A --> SCH3["endActiveAuctions (30초)<br/>endTime <= now 인 ACTIVE"]
    SCH3 --> B{"totalBidsCount > 0?"}
    B -- 아니오 --> EXP(["end(false) → EXPIRED"])
    B -- 예 --> SAGA(["AuctionEndSaga 시작 (6장)"])

    P --> UP{"PUT /{id}: PENDING & 시작 전?"}
    UP -- 예 --> UPD["시간/즉시구매가 재검증 후 수정"]
    UP -- 아니오 --> E5(["INVALID_AUCTION_STATUS"])

    P --> CN["DELETE /{id}"]
    A --> CN
    CN --> CN1{"상태"}
    CN1 -- PENDING --> CC(["CANCELLED"])
    CN1 -- "ACTIVE & 입찰 0건" --> CC
    CN1 -- "ACTIVE & 입찰 있음" --> E6(["CANNOT_CANCEL_WITH_BIDS"])
    CN1 -- 기타 --> E5
```

---

## 5. 입찰 / 즉시구매 (auction-service `BidService`)

```mermaid
flowchart TD
    S([POST /api/v1/bids]) --> Q{"X-Queue-Verified == true?"}
    Q -- 아니오 --> EQ(["QUEUE_ACCESS_DENIED"])
    Q -.-> WQ["⚠ 이 헤더를 설정하는 컴포넌트 없음"]
    Q -- 예 --> TX["@Transactional + @RetryOnOptimisticLock<br/>(최대 3회, 50ms × 시도 backoff)"]
    TX --> A1{"경매 존재?"}
    A1 -- 아니오 --> E1(["AUCTION_NOT_FOUND"])
    A1 -- 예 --> A2{"status == ACTIVE?"}
    A2 -- 아니오 --> E2(["AUCTION_NOT_ACTIVE"])
    A2 -- 예 --> A3{"seller == bidder?"}
    A3 -- 예 --> E3(["SELF_BID_NOT_ALLOWED"])
    A3 -- 아니오 --> A4{"amount >= currentPrice + bidIncrement?"}
    A4 -- 아니오 --> E4(["BID_AMOUNT_TOO_LOW"])
    A4 -- 예 --> A5{"이전 최고 입찰 존재?"}
    A5 -- 예 --> OB["이전 입찰 OUTBID<br/>outbox outbid → notification.auction"]
    A5 -- 아니오 --> SV
    OB --> SV["새 Bid 저장 (highest)"]
    SV --> UPD["auction.updateCurrentPrice + bidCount++"]
    UPD --> VER{"@Version 충돌?"}
    VER -- 예 --> RT{"재시도 남음?"}
    RT -- 예 --> TX
    RT -- 아니오 --> EOL(["낙관적 락 실패"])
    VER -- 아니오 --> EV["auctions 캐시 무효화 (실패는 로그만)"]
    EV --> F([입찰 성공])

    BN(["POST /bids/auction/{id}/buy-now"]) --> BN0["큐 검증, ACTIVE, 본인 입찰 검사 (동일)"]
    BN0 --> BN1{"buyNowPrice 존재?"}
    BN1 -- 아니오 --> EB1(["INVALID_BUY_NOW_PRICE"])
    BN1 -- 예 --> BN2{"currentPrice < buyNowPrice?"}
    BN2 -- 아니오 --> EB2(["BUY_NOW_NOT_AVAILABLE"])
    BN2 -- 예 --> BN3["이전 최고 OUTBID → buyNowPrice로 Bid 저장<br/>auction.end(true) → SUCCESS"]
    BN3 --> BN4(["AuctionEndSaga 시작 (예외는 로그만)"])
    BN4 -.-> WB["⚠ Saga FINALIZE 단계에서 end(true) 재호출 → 예외"]

    CB(["DELETE /api/v1/bids/{bidId}"]) --> CB1{"입찰 존재?"}
    CB1 -- 아니오 --> EC1(["BID_NOT_FOUND"])
    CB1 -- 예 --> CB2{"본인 입찰?"}
    CB2 -- 아니오 --> EC2(["NOT_BID_OWNER"])
    CB2 -- 예 --> CB3{"현재 최고 입찰?"}
    CB3 -- 예 --> EC3(["CANNOT_CANCEL_HIGHEST_BID"])
    CB3 -- 아니오 --> CB4([CANCELLED])
```

> 입찰 경로에는 user-service 입찰 자격(`/bid-eligibility`) 확인, 포인트 잔액 확인, Redis 분산락(`RedisLockService`) 호출이 **없습니다.** 동시성은 낙관적 락과 재시도로만 처리합니다.

---

## 6. 경매 종료 Saga (`AuctionEndSagaOrchestrator`)

단계: `CREATE_ORDER → MARK_WINNING_BID → FINALIZE_AUCTION → PUBLISH_END_EVENT`
(Bulkhead `sagaOrchestrator`, CircuitBreaker `orderService`, Retry `sagaStep`)

```mermaid
flowchart TD
    subgraph Auction["auction-service"]
        S([startAuctionEndSaga]) --> A1{"경매 존재?"}
        A1 -- 아니오 --> E1(["AUCTION_NOT_FOUND"])
        A1 -- 예 --> A2{"최고 입찰 존재?"}
        A2 -- 아니오 --> E2(["NO_BIDS_FOUND"])
        A2 -- 예 --> A3{"Bulkhead 여유?"}
        A3 -- 아니오 --> E3(["SAGA_BULKHEAD_FULL"])
        A3 -- 예 --> A4["SagaContext 저장 PENDING → IN_PROGRESS"]
        A4 --> ST1["Step1 CREATE_ORDER<br/>outbox CREATE_ORDER_REQUESTED<br/>(sagaId, auctionId, price, paymentDeadline=+30분)"]
        ST1 --> X1{"예외?"}
        X1 -- 예 --> COMP
        X1 -- 아니오 --> WAIT["주문 결과 이벤트 대기"]

        R{"eventType"}
        R -- ORDER_CREATED --> ST2["orderId 기록<br/>Step2 MARK_WINNING_BID: 낙찰 입찰 → WON"]
        ST2 --> ST3["Step3 FINALIZE_AUCTION: end(true) → SUCCESS, setWinner"]
        ST3 --> ST4["Step4 PUBLISH_END_EVENT<br/>outbox closed(WON) 낙찰자, closed(LOST) 나머지<br/>→ notification.auction"]
        ST4 --> DONE([Saga COMPLETED])
        R -- ORDER_CREATION_FAILED --> COMP

        COMP["compensate(): COMPENSATING<br/>진행 단계별 보상 로그 생성"]
        COMP --> C3{"step >= FINALIZE?"}
        C3 -- 예 --> CA3["REOPEN_AUCTION: SUCCESS → ACTIVE<br/>end = now+1일, winner 제거"]
        C3 -- 아니오 --> C2
        CA3 --> C2{"step >= MARK_WINNING_BID?"}
        C2 -- 예 --> CA2["REVERT_BID_STATUS: WON → highest"]
        C2 -- 아니오 --> C1
        CA2 --> C1{"orderId 기록됨?"}
        C1 -- 예 --> CA1["CANCEL_ORDER: outbox CANCEL_ORDER_REQUESTED"]
        C1 -- 아니오 --> CR
        CA1 --> CR{"모든 보상 성공? (각 @Retryable 3회)"}
        CR -- 예 --> CPD([COMPENSATED])
        CR -- 아니오 --> CF(["FAILED / SAGA_COMPENSATION_FAILED"])
    end

    subgraph Order["order-service OrderEventConsumer"]
        O1{"이미 처리한 이벤트? (ProcessedEvent)"}
        O1 -- 예 --> OSK([무시])
        O1 -- 아니오 --> O2{"필수 필드 존재?"}
        O2 -- 아니오 --> OF["ORDER_CREATION_FAILED"]
        O2 -- 예 --> O3["createOrderFromAuction<br/>status PAYMENT, paymentExpiredAt=deadline"]
        O3 --> O4{"예외?"}
        O4 -- 예 --> OF
        O4 -- 아니오 --> OC["ORDER_CREATED"]
        OCX{"CANCEL_ORDER_REQUESTED"} --> OW(["⚠ unknown event type 경고만 남김"])
    end

    ST1 -. "Kafka order.auction (5초 outbox polling)" .-> O1
    CA1 -. "Kafka order.auction" .-> OCX
    OC -. "Kafka auction.order" .-> R
    OF -. "Kafka auction.order" .-> R
```

### Saga 복구 (`SagaRecoveryService`, ApplicationReadyEvent)

```mermaid
flowchart TD
    S([애플리케이션 기동]) --> A["PENDING / IN_PROGRESS Saga 조회"]
    A --> B{"10분 넘게 갱신 없음? (좀비)"}
    B -- 예 --> C["fail → 보상 실행"]
    B -- 아니오 --> D["currentStep부터 재개"]
    C --> E["발행 대기 outbox 재발행 (최대 3회)"]
    D --> E
    E --> F([복구 완료])
```

---

## 7. 결제 타임아웃 Saga

```mermaid
flowchart TD
    subgraph Order["order-service"]
        S(["PaymentTimeoutScheduler (60초)"]) --> O1["PAYMENT 상태 & paymentExpiredAt 경과 주문 조회"]
        O1 --> O2["markExpired → EXPIRED"]
        O2 --> O3["outbox PAYMENT_TIMEOUT"]
    end

    subgraph Auction["auction-service PaymentTimeoutEventProcessor"]
        P0{"orderId, auctionId 존재?"}
        P0 -- 아니오 --> PL([로그 후 종료])
        P0 -- 예 --> P1{"해당 주문의 Saga 이미 존재?"}
        P1 -- 예 --> PE1(["SAGA_ALREADY_EXISTS"])
        P1 -- 아니오 --> P2{"winnerInfo로 낙찰 입찰 조회 성공?"}
        P2 -- 아니오 --> PE2(["NO_BIDS_FOUND"])
        P2 -- 예 --> P3["Saga PENDING → 시작"]
        P3 --> T1["REOPEN_AUCTION: reopen() SUCCESS → ACTIVE, end=now+1일"]
        T1 --> T2["REVERT_BID_STATUS: bid.revertFromWon()"]
        T2 --> T3["CANCEL_ORDER: outbox CANCEL_ORDER_REQUESTED<br/>(reason PAYMENT_TIMEOUT)"]
        T3 --> T4["PUBLISH_REOPEN_EVENT: outbox AUCTION_REOPENED"]
        T4 --> TX{"예외 발생?"}
        TX -- 아니오 --> DONE([COMPLETED])
        TX -- 예 --> CMP(["fail → compensate() (보상 없음, 로그만) → COMPENSATED/FAILED"])
    end

    O3 -. "Kafka auction.order" .-> P0
    T3 -. "order.auction ⚠ order-service 미처리" .-> X1["order-service"]
    T4 -. "notification.auction" .-> X2["notification-service"]
    OC(["ORDER_CANCELED 이벤트 ⚠ 발행 엔드포인트 없음"]) -.-> P0
```

---

## 8. 주문 / 결제 / 환불 (order-service)

```mermaid
flowchart TD
    subgraph Pay["POST /v1/payments?userId="]
        S([결제 요청]) --> A{"주문 존재?"}
        A -- 아니오 --> E1([오류: 주문 없음])
        A -- 예 --> B{"주문 소유자 == userId?"}
        B -- 아니오 --> E2([오류: 소유자 불일치])
        B -- 예 --> C{"결제 기한 경과?"}
        C -- 예 --> CX["주문 EXPIRED 처리 (이벤트 없음)"] --> E3([오류: 만료])
        C -- 아니오 --> D{"주문 status == PAYMENT?"}
        D -- 아니오 --> E4([오류: 결제 불가 상태])
        D -- 예 --> F{"금액 == 주문 금액?"}
        F -- 아니오 --> E5([오류: 금액 불일치])
        F -- 예 --> G{"PENDING 결제 이미 존재?"}
        G -- 예 --> E6([오류: 중복 결제])
        G -- 아니오 --> H["Payment.create → 즉시 approve() (PG 미연동)<br/>Payment SUCCESS"]
        H --> I["주문 → PAID<br/>outbox PAYMENT_COMPLETED → auction.order"]
        I --> OK([결제 완료])
    end

    subgraph Confirm["POST /v1/payments/confirm, PATCH /v1/payments/fail"]
        CF([confirm]) --> CF1{"paymentKey 존재 & 주문·금액 검증 OK<br/>& Payment PENDING?"}
        CF1 -- 아니오 --> CFE([오류])
        CF1 -- 예 --> CF2(["Payment SUCCESS, 주문 PAID (이벤트 없음)"])
        FL([fail]) --> FL1{"주문 검증 OK & Payment PENDING?"}
        FL1 -- 아니오 --> FLE([오류])
        FL1 -- 예 --> FL2(["Payment FAILED, 주문 CANCELED (이벤트 없음)"])
    end

    subgraph Refund["POST /v1/refunds/{paymentId}"]
        R([환불 요청]) --> R1{"진행 중/완료된 환불 존재?"}
        R1 -- 예 --> RE([오류])
        R1 -- 아니오 --> R2{"결제 소유자 일치 & Payment SUCCESS<br/>& 금액 전액 & 주문 PAID?"}
        R2 -- 아니오 --> RE
        R2 -- 예 --> R3["Refund REQUESTED<br/>Payment, 주문 → REFUND_REQUESTED"]
        R3 -.-> R4["⚠ approveRefund(→ REFUNDED)는 호출 엔드포인트 없음"]
    end
```

**상태 전이**
- 주문: `PAYMENT → PAID | CANCELED | EXPIRED`, `PAID → REFUND_REQUESTED → REFUNDED`
- 결제: `PENDING → SUCCESS | FAILED`, `SUCCESS → REFUND_REQUESTED → REFUNDED`

---

## 9. 알림 처리 (notification-service)

```mermaid
flowchart TD
    subgraph Kafka["Kafka Consumer (notification.queue / auction / order)"]
        S([이벤트 수신, userId=record key]) --> A{"payload 존재 & eventType 존재?"}
        A -- 아니오 --> EA([에러 처리 → DLT])
        A -- 예 --> B{"eventId, userId, eventType 유효?"}
        B -- 아니오 --> EB(["IllegalArgumentException → 재시도"])
        B -- 예 --> C{"토픽 prefix로 카테고리 결정<br/>QUEUE / AUCTION / ORDER?"}
        C -- 알 수 없음 --> EB
        C -- 예 --> D{"eventType"}
        D -- "near_turn / admitted / outbid" --> IN["채널: IN_APP"]
        D -- "closed (result WON/LOST)" --> IN
        D -- "payment_required / paid" --> IE["채널: IN_APP + EMAIL"]
        IN --> EN["auction-service에서 경매 제목 조회 (REST)"]
        IE --> EN
        EN --> SS{"eventId + channel 이미 처리?"}
        SS -- 예 --> SKIP([건너뜀])
        SS -- 아니오 --> CH{"채널 == EMAIL?"}
        CH -- 예 --> EM1["user-service에서 이메일 조회<br/>GET /api/v1/users/{id}/email"]
        EM1 --> EM2{"JavaMailSender 발송 성공?"}
        EM2 -- 아니오 --> EMF(["markAsFailed → 예외 (재시도)"])
        EM2 -- 예 --> SAVE
        CH -- 아니오 --> SAVE["Notification 저장"]
        SAVE --> ACK([수동 ACK])
    end

    subgraph Rest["POST /api/v1/notifications/send"]
        R([REST 요청]) --> R1{"type"}
        R1 -- SLACK --> RS["SlackSender 웹훅 POST<br/>(userId 기본값: 시스템 UUID)"]
        R1 -- EMAIL --> RE{"target & userId 존재?"}
        R1 -- IN_APP --> RI{"userId 존재?"}
        R1 -- 기타 --> RX(["INVALID_NOTIFICATION_TYPE"])
        RE -- 예 --> RSEND["발송"]
        RI -- 예 --> RSEND
        RS --> RR
        RSEND --> RR(["저장 후 SENT / FAILED 표시"])
    end

    subgraph Manage["읽음 / 삭제"]
        M([PATCH read, DELETE]) --> M1{"채널 == IN_APP?"}
        M1 -- 아니오 --> ME1(["NOTIFICATION_CHANNEL_NOT_SUPPORTED"])
        M1 -- 예 --> M2{"소유자?"}
        M2 -- 아니오 --> ME2(["FORBIDDEN"])
        M2 -- 예 --> M3(["읽음 처리 / soft delete (이미 삭제됐으면 NOT_FOUND)"])
    end
```

---

## 10. 구현 갭 정리

| # | 위치 | 내용 | 영향 |
|---|---|---|---|
| 1 | gateway `application.yml` | `bid-service-route`가 `lb://bid-service`를 가리키지만 그런 서비스가 없음 (입찰은 auction-service) | 대기열 토큰 필터를 거치는 입찰 경로가 동작하지 않음 |
| 2 | gateway ↔ auction | `X-Queue-Verified` 헤더를 설정하는 곳이 없음 | `createBid`/`buyNow`가 항상 `QUEUE_ACCESS_DENIED` |
| 3 | queue `TokenProvider` ↔ gateway `QueueTokenProvider` | 시크릿 디코딩 방식이 다름 (BASE64URL vs UTF-8 bytes) | 활성 토큰 서명 검증 실패 가능 |
| 4 | auction `BidService` | 입찰 자격·포인트 확인과 분산락 호출이 없음 (`RedisLockService` 미사용) | 블랙리스트 회원도 입찰 가능 |
| 5 | auction Saga | 즉시구매 후 Saga FINALIZE 단계에서 `end(true)`를 다시 호출 | 즉시구매 Saga 실패 |
| 6 | order `OrderEventConsumer` | `CANCEL_ORDER_REQUESTED`를 처리하지 않음 | 보상·타임아웃 취소가 주문에 반영되지 않음 |
| 7 | order | `cancelOrder`, `approveRefund`를 호출하는 엔드포인트 없음 | ORDER_CANCELED 이벤트 없음, 환불 완료 불가 |
| 8 | Kafka payload | order envelope의 `payload.data` 구조와 auction 파싱 위치가 다르고, CREATE_ORDER_REQUESTED의 userId 위치도 다름 | ORDER_CREATION_FAILED 발생 가능 |
| 9 | queue → notification | `notification.queue.admitted`로 발행하지만 `notification.queue`를 구독. 이벤트 타입명도 다름 (`QUEUE_ENTERED` vs `admitted`) | 대기열 알림 미전달 |
| 10 | notification | `notification.order`, `payment_required`/`paid` 생산자가 없음. auction outbox envelope 형식도 `EventTemplate`과 다름 | 결제 관련 이메일 알림 미동작 |
| 11 | user-service | 블랙리스트 등록·해제에 역할 검사가 없음 | 일반 사용자도 호출 가능 |
