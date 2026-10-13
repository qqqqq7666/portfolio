# sparta_logitics 활동 다이어그램 (API 분석 기반)

> 분석 대상: `sparta_logitics/` (Java 17, Spring Boot 3.5.7, Spring Cloud 2025.0.0)
> 다이어그램은 **현재 코드가 실제로 동작하는 방식**을 기준으로 그렸습니다. 설계 의도와 구현이 어긋나는 곳은 `⚠` 노드와 점선으로 표시했고, 문서 끝 [구현 갭](#10-구현-갭-정리)에 따로 모았습니다.

## 서비스 개요

| 모듈 | 포트 | 역할 |
|---|---|---|
| common | - | `BaseEntity`, `BusinessException`/`ErrorCode`, `UserRoleEnum {MASTER, HUB_MANAGER, DELIVERY_MANAGER, SUPPLIER_MANAGER}` |
| eureka-server | 8761 | 서비스 디스커버리 |
| config-server | 8888 | Native config (`config-server/src/main/resources/config-repo/*-local.yml`) |
| api-gateway | 8000 | 라우팅 + JWT GlobalFilter → `X-USERID`, `X-USERNAME`, `X-USER-ROLE` 주입 |
| auth-service | - | 로그인, JWT 발급 (Feign → user-service) |
| user-service | 9006 | 사용자 CRUD, 승인, 역할 |
| hub-service | - | 허브, 허브 연결, 최단 경로(Dijkstra), Redis 캐시 |
| company-service | - | 업체 CRUD |
| product-service | - | 상품 CRUD (Feign으로 업체·허브 검증) |
| order-service | 9001 | 주문, 클레임, RabbitMQ 발행/구독, Redis 캐시 |
| delivery-service | 8088 | 배송과 구간(route leg) 상태 머신, Feign(hub, ai), RabbitMQ 발행 |
| ai-service | - | 애플리케이션 클래스만 있음 (엔드포인트 없음) |

### 주요 API 요약

| 서비스 | 엔드포인트 |
|---|---|
| auth | `POST /v1/auth/login` |
| user | `POST /v1/users`, `PATCH /v1/users/{id}`, `DELETE /v1/users/{id}`, `PATCH /v1/users/{id}/status`, `PATCH /v1/users/{id}/role`, `GET /v1/users`, `GET /v1/internal/users/by-username` |
| hub | `POST/GET /hubs`, `GET/PUT/DELETE /hubs/{id}`, `GET /hubs/search`, `GET/POST /hub-connections`, `GET/PUT/DELETE /hub-connections/{id}`, `GET /hub-routes` |
| company | `GET/POST /companies`, `GET/PUT/DELETE /companies/{id}` |
| product | `GET/POST /products`, `GET/PUT/DELETE /products/{id}` |
| order | `POST/GET /v1/orders`, `GET/PUT/DELETE /v1/orders/{id}`, `POST/GET /v1/orders/{orderId}/claim` |
| delivery | `POST /v1/delivery/deliveries`, `PUT .../deliveries/{id}/assign-company-driver·start-company-delivery·complete-delivery`, `PUT /v1/delivery/delivery-routes/{routeHistoryId}/assign-driver·start·complete` |

### 전체 흐름 한눈에 보기

```mermaid
flowchart LR
    U([사용자]) --> GW["api-gateway"]
    GW --> AU["auth-service"]
    GW --> US["user-service"]
    GW --> OS["order-service"]
    GW --> DS["delivery-service"]
    GW -. "⚠ 라우트 없음/불일치" .-> HS["hub-service"]
    GW -. "⚠ 라우트 없음" .-> CS["company-service"]
    GW -. "⚠ 라우트 없음" .-> PS["product-service"]
    AU -->|"Feign by-username"| US
    PS -->|"Feign GET /companies/{id}"| CS
    PS -->|"Feign GET /hubs/{id}"| HS
    DS -->|"Feign GET /internal/routes ⚠ WireMock만 존재"| HS
    DS -->|"Feign POST /internal/predict/eta ⚠ WireMock만 존재"| AI["ai-service"]
    OS -. "RabbitMQ delivery.order.created ⚠ 소비자 없음" .-> DS
    DS -. "RabbitMQ delivery.completed.key ⚠ 키 불일치" .-> OS
```

---

## 1. Gateway JWT 필터 (`JwtAuthenticationFilter`)

```mermaid
flowchart TD
    S([요청 수신]) --> A{"path가 /v1/auth 로 시작?"}
    A -- 예 --> PASS["JWT 검사 생략"]
    A -- 아니오 --> B{"Authorization: Bearer 헤더 존재?"}
    B -- 아니오 --> E1(["401 Unauthorized"])
    B -- 예 --> C{"HS256 서명 검증 & 만료 확인 OK?"}
    C -- 아니오 --> E1
    C -- 예 --> D["claims user_id, username, role 추출<br/>X-USERID, X-USERNAME, X-USER-ROLE 헤더 추가"]
    D --> R{"라우트 매칭"}
    PASS --> R
    R -- "/v1/orders/**" --> OS["order-service"]
    R -- "/v1/users/**" --> US["user-service (Cookie 헤더 제거)"]
    R -- "/v1/delivery/**" --> DS["delivery-service"]
    R -- "/v1/auth/ (정확히 일치)" --> AU["auth-service"]
    R -- "/v1/hub/**" --> HS["hub-service"]
    R -- "/{service-id}/**" --> DIS["discovery locator 라우트"]
    AU -.-> W1["⚠ /v1/auth/login 은 매칭되지 않음 (** 없음)"]
    HS -.-> W2["⚠ hub 컨트롤러는 /hubs, /hub-connections, /hub-routes"]
    OS --> F([서비스에서 역할 검사])
    US --> F
    DS --> F
    DIS --> F
```

> 게이트웨이는 역할 검사를 하지 않습니다. 각 서비스가 `X-USER-ROLE` 헤더 값으로 `if` 분기를 해서 검사합니다.

---

## 2. 로그인 (auth-service `AuthServiceV1`)

```mermaid
flowchart TD
    subgraph Auth["auth-service"]
        S(["POST /v1/auth/login {username, password}"]) --> F1["Feign UserClient 호출"]
        R1{"응답 결과"}
        R1 -- 404 --> E1(["USER_NOT_FOUND"])
        R1 -- "3초 초과" --> E0(["REQUEST_TIMEOUT"])
        R1 -- 성공 --> P{"BCrypt 비밀번호 일치?"}
        P -- 아니오 --> E2(["INVALID_CREDENTIALS"])
        P -- 예 --> AP{"approved? (status == APPROVED)"}
        AP -- 아니오 --> E3(["UNAUTHORIZED"])
        AP -- 예 --> J["JWT 생성 (HS256)<br/>claims: user_id, username, role<br/>exp: jwt.expiration"]
        J --> F(["{userId, username, role, token, valid} 반환"])
    end

    subgraph User["user-service"]
        U1["GET /v1/internal/users/by-username"] --> U2{"사용자 존재?"}
        U2 -- 아니오 --> U3["404"]
        U2 -- 예 --> U4["{userId, username, password(hash), role, approved}"]
    end

    F1 --> U1
    U3 --> R1
    U4 --> R1
```

---

## 3. 사용자 관리 (user-service `UserServiceV1`)

자체 회원가입은 없습니다. MASTER가 사용자를 만들고, MASTER나 HUB_MANAGER가 승인합니다.

```mermaid
flowchart TD
    S([요청]) --> T{"API"}

    T -- "POST /v1/users" --> C1{"role == MASTER?"}
    C1 -- 아니오 --> EU(["UNAUTHORIZED"])
    C1 -- 예 --> C2{"username 중복?"}
    C2 -- 예 --> EC(["DUPLICATED_USER"])
    C2 -- 아니오 --> C3(["BCrypt 해시 → 저장, status = PENDING"])

    T -- "PATCH /{id}/status" --> S1{"role ∈ MASTER, HUB_MANAGER?"}
    S1 -- 아니오 --> EU
    S1 -- 예 --> S2{"사용자 존재?"}
    S2 -- 아니오 --> EN(["USER_NOT_FOUND"])
    S2 -- 예 --> S3{"현재 상태와 동일?"}
    S3 -- 예 --> ES(["INVALID_STATUS_CHANGE"])
    S3 -- 아니오 --> S4(["APPROVED / REJECTED 로 변경"])

    T -- "PATCH /{id}/role" --> R1{"role ∈ MASTER, HUB_MANAGER?"}
    R1 -- 아니오 --> EU
    R1 -- 예 --> R2{"사용자 존재?"}
    R2 -- 아니오 --> EN
    R2 -- 예 --> R3{"현재 역할과 동일?"}
    R3 -- 예 --> ER(["INVALID_ROLE_CHANGE"])
    R3 -- 아니오 --> R4(["역할 변경"])

    T -- "PATCH /{id}" --> P1{"role == MASTER?"}
    P1 -- 아니오 --> EU
    P1 -- 예 --> P2(["name, slackId 수정"])

    T -- "DELETE /{id}" --> D1{"role == MASTER?"}
    D1 -- 아니오 --> EU
    D1 -- 예 --> D2{"사용자 존재?"}
    D2 -- 아니오 --> EN
    D2 -- 예 --> D3{"이미 삭제됨?"}
    D3 -- 예 --> ED(["ALREADY_DELETED_USER"])
    D3 -- 아니오 --> D4(["soft delete"])

    T -- "GET /v1/users" --> G1{"role == MASTER?"}
    G1 -- 예 --> G2(["필터 검색 (name, slackId, role, status)<br/>page size 10/30/50로 보정"])
    G1 -- 아니오 --> G3(["X-USERID 본인 정보만 반환"])
```

---

## 4. 허브 / 허브 연결 / 최단 경로 (hub-service)

### 4-1. 허브 · 연결 CRUD

```mermaid
flowchart TD
    S([요청]) --> T{"API"}
    T -- "POST /hubs" --> H1{"code 중복?"}
    H1 -- 예 --> EH1(["HUB_CODE_ALREADY_EXISTS"])
    H1 -- 아니오 --> H2["값 객체 검증 (HubCode, HubAddress, Location)"]
    H2 --> H3(["저장 + hub 캐시 무효화"])

    T -- "PUT /hubs/{id}" --> U1{"허브 존재?"}
    U1 -- 아니오 --> EH2(["HUB_NOT_FOUND"])
    U1 -- 예 --> U2{"다른 허브와 code 중복?"}
    U2 -- 예 --> EH1
    U2 -- 아니오 --> U3(["수정 (status ACTIVE/CLOSED 포함)<br/>hub, hubList 캐시 무효화"])

    T -- "DELETE /hubs/{id}" --> D1{"허브 존재?"}
    D1 -- 아니오 --> EH2
    D1 -- 예 --> D2(["soft delete (userId 하드코딩 1L)"])

    T -- "POST/PUT /hub-connections" --> C1{"출발·도착 허브 모두 존재?"}
    C1 -- 아니오 --> EH2
    C1 -- 예 --> C2{"PUT인 경우 연결 존재?"}
    C2 -- 아니오 --> EC(["HUB_CONNECTION_NOT_FOUND"])
    C2 -- 예 --> C3(["저장 (distanceKm, estimatedMinutes)<br/>hubConnections, hubRoute 캐시 무효화"])
```

### 4-2. 최단 경로 조회 `GET /hub-routes?departureHubId&arrivalHubId`

```mermaid
flowchart TD
    S([요청]) --> A{"Redis 캐시 hubRoute 'dep-arr' 존재?"}
    A -- 예 --> R1([캐시 반환])
    A -- 아니오 --> B{"DB에 HubRoute 저장돼 있음?"}
    B -- 예 --> R2([DB 결과 반환 + 캐시])
    B -- 아니오 --> C["활성 HubConnection 전체 로드<br/>방향 그래프 구성"]
    C --> D["Dijkstra (가중치: 거리)"]
    D --> E{"경로 존재?"}
    E -- 아니오 --> X(["IllegalStateException<br/>유효한 경로를 찾을 수 없습니다."])
    E -- 예 --> F["총 거리·시간 합산<br/>순번을 매긴 HubRouteSegment 생성"]
    F --> G["HubRoute 저장"]
    G --> R3([경로 반환 + 캐시])
```

---

## 5. 업체 관리 (company-service `CompanyService`)

필수 헤더는 `X-User-Id`, `X-Username`, `X-User-Role`입니다. 역할 검사는 구현되어 있지 않습니다.

```mermaid
flowchart TD
    S([요청]) --> T{"API"}
    T -- "POST /companies" --> C1{"요청 유효 & hub_id 존재?"}
    C1 -- 아니오 --> EI(["INVALID_INPUT_VALUE"])
    C1 -- 예 --> C1W["⚠ 허브 실존 여부 검증 없음 (TODO)"]
    C1W --> C2{"활성 업체 중 이름 중복?"}
    C2 -- 예 --> EI
    C2 -- 아니오 --> C3(["저장: type PRODUCTION/RECEPTION, status ACTIVE"])

    T -- "PUT /companies/{id}" --> U0{"변경할 값 존재?"}
    U0 -- 아니오 --> EI
    U0 -- 예 --> U1{"업체 존재?"}
    U1 -- 아니오 --> EN(["CompanyNotFoundException 404"])
    U1 -- 예 --> U2{"이름 변경 시 중복?"}
    U2 -- 예 --> EI
    U2 -- 아니오 --> U3(["name / address 수정"])

    T -- "DELETE /companies/{id}" --> D1{"업체 존재?"}
    D1 -- 아니오 --> EN
    D1 -- 예 --> D2{"이미 삭제됨?"}
    D2 -- 예 --> ED([오류])
    D2 -- 아니오 --> D3(["softDelete"])

    T -- "GET /companies" --> G1{"page >= 0 & size <= 100?"}
    G1 -- 아니오 --> EI
    G1 -- 예 --> G2(["name, hub_id, status 필터 조회"])
```

---

## 6. 상품 등록 (product-service `ProductService`)

```mermaid
flowchart TD
    subgraph Product["product-service"]
        S(["POST /products"]) --> V{"요청 DTO 유효?"}
        V -- 아니오 --> EV([400])
        V -- 예 --> C1["Feign CompanyClient GET /companies/{id}"]
        CR{"응답"}
        CR -- 404 --> EC1(["존재하지 않는 업체"])
        CR -- "status != ACTIVE" --> EC2(["비활성 상태의 업체"])
        CR -- "기타 Feign 오류" --> E5([500])
        CR -- OK --> H1["Feign HubClient GET /hubs/{id}"]
        HR{"응답"}
        HR -- 404 --> EH1(["존재하지 않는 허브"])
        HR -- "status != ACTIVE" --> EH2(["비활성 허브"])
        HR -- "기타 Feign 오류" --> E5
        HR -- OK --> D{"상품명 중복?"}
        D -- 예 --> ED(["PRODUCT_ALREADY_EXISTS"])
        D -- 아니오 --> F(["저장, status ACTIVE"])
    end
    subgraph Company["company-service"]
        CC["GET /companies/{id}"]
    end
    subgraph Hub["hub-service"]
        HH["GET /hubs/{id}"]
    end
    C1 --> CC --> CR
    H1 --> HH --> HR
```

> 수정(`PUT`)도 이름 중복을 똑같이 확인합니다. 삭제(`DELETE`)는 status를 `INACTIVE`로 바꿉니다.

---

## 7. 주문 (order-service)

### 7-1. 주문 생성 · 조회 · 수정 · 삭제

```mermaid
flowchart TD
    S([요청]) --> T{"API"}

    T -- "POST /v1/orders" --> C1{"role ∈ MASTER, SUPPLIER_MANAGER?"}
    C1 -- 아니오 --> EC(["ORDER_CREATE_DENIED"])
    C1 -- 예 --> C2["Order 생성 status = PAYMENT_PENDING<br/>username, userId 설정 후 저장"]
    C2 --> C3["RabbitMQ 발행<br/>exchange delivery.exchange<br/>key delivery.order.created<br/>OrderCreatedMessage"]
    C3 --> C4(["201 Created"])
    C3 -.-> CW["⚠ 이 키를 구독하는 consumer 없음 → 배송이 생성되지 않음"]

    T -- "GET /v1/orders" --> Q1{"page/size >= 0?"}
    Q1 -- 아니오 --> EQ(["INVALID_INPUT_VALUE"])
    Q1 -- 예 --> Q2{"role"}
    Q2 -- MASTER --> QA(["searchForAdmin"])
    Q2 -- HUB_MANAGER --> QH(["searchForHubManager"])
    Q2 -- DELIVERY_MANAGER --> QD(["searchForDelivery"])
    Q2 -- SUPPLIER_MANAGER --> QS(["searchForSupplier"])
    Q2 -- 기타 --> ER(["INVALID_USER_ROLE"])

    T -- "GET /v1/orders/{id} (캐시 orders)" --> G1{"role"}
    G1 -.-> GW["⚠ 컨트롤러와 서비스의 username/role 인자 순서가 뒤바뀜"]
    G1 -- "MASTER, SUPPLIER_MANAGER" --> G2["findById"]
    G1 -- HUB_MANAGER --> G3["findByCurrentHubId"]
    G1 -- DELIVERY_MANAGER --> G4["findByDeliveryId"]
    G2 --> G5{"존재?"}
    G3 --> G5
    G4 --> G5
    G5 -- 아니오 --> EN(["ORDER_NOT_FOUND"])
    G5 -- 예 --> G6([상세 반환])

    T -- "PUT /v1/orders/{id}" --> U1{"role ∈ MASTER, HUB_MANAGER?"}
    U1 -- 아니오 --> EU(["ORDER_MODIFICATION_DENIED"])
    U1 -- 예 --> U2{"주문 존재?"}
    U2 -- 아니오 --> EN
    U2 -- 예 --> U3{"status ∈ PAYMENT_PENDING, PREPARING_FOR_SHIPMENT?"}
    U3 -- 아니오 --> EU2(["ORDER_MODIFICATION_NOT_ALLOWED"])
    U3 -- 예 --> U4(["수정 (status 직접 변경 가능) + 캐시 무효화"])

    T -- "DELETE /v1/orders/{id}" --> D1{"role ∈ MASTER, HUB_MANAGER?"}
    D1 -- 아니오 --> EDD(["ORDER_DELETE_DENIED"])
    D1 -- 예 --> D2{"주문 존재?"}
    D2 -- 아니오 --> EN
    D2 -- 예 --> D3{"출고 전?"}
    D3 -- 아니오 --> EU2
    D3 -- 예 --> D4{"이미 삭제됨?"}
    D4 -- 예 --> EAD(["ORDER_ALREADY_DELETED"])
    D4 -- 아니오 --> D5(["soft delete"])
    D5 -.-> DW["⚠ userId = Long.getLong(header) → 항상 null"]
```

### 7-2. 클레임 · 이벤트 리스너

```mermaid
flowchart TD
    S(["POST /v1/orders/{orderId}/claim"]) --> A{"주문 존재?"}
    A -- 아니오 --> E(["ORDER_NOT_FOUND"])
    A -- 예 --> B["OrderClaim 저장 (status REQUESTED)<br/>claimType: CANCEL, RETURN, EXCHANGE, CHANGE_INFO, DELIVERY_ISSUE, ADMIN_CANCEL"]
    B --> C(["OrderHistory 추가 (claimType, reasonType)"])

    L1(["RabbitMQ order.queue.delivery.created"]) --> L2["order.assignDeliveryId(deliveryId)"]
    L3(["RabbitMQ order.queue.delivery.completed"]) --> L4["order status → COMPLETED"]
    L2 --> LX{"예외?"}
    L4 --> LX
    LX -- 예 --> LR(["AmqpRejectAndDontRequeueException"])
    LX -- 아니오 --> LOK([ACK])
```

**주문 상태:** `PAYMENT_PENDING → PREPARING_FOR_SHIPMENT → SHIPPED → DELIVERED → COMPLETED` (그 밖에 `CANCELED`, `FAIL`, `RETURNED`)

---

## 8. 배송 생성 및 진행 (delivery-service)

```mermaid
flowchart TD
    subgraph Create["POST /v1/delivery/deliveries"]
        S([배송 생성 요청]) --> A["Feign hub GET /internal/routes<br/>(originHubId, destinationHubId)"]
        A --> B{"경로 응답이 null/빈 값?"}
        B -- 예 --> EB(["IllegalArgumentException"])
        B -- 아니오 --> C["Feign ai POST /internal/predict/eta<br/>→ estimatedArrivalTime"]
        C --> D["Delivery 생성 status WAITING_AT_HUB<br/>구간마다 DeliveryRouteHistory 생성<br/>(sequence, 예상 거리·시간, WAITING_FOR_TRANSIT)"]
        D --> D2([저장])
    end

    subgraph Leg["허브 간 구간 (구간마다 반복)"]
        L1["PUT /delivery-routes/{id}/assign-driver"] --> L1a{"구간 존재?"}
        L1a -- 아니오 --> EL1(["EntityNotFoundException"])
        L1a -- 예 --> L1b["driverId 설정"]
        L1b --> L2["PUT .../start"]
        L2 --> L2a{"driver 배정됨 & WAITING_FOR_TRANSIT?"}
        L2a -- 아니오 --> EL2(["IllegalStateException"])
        L2a -- 예 --> L2b["구간 IN_TRANSIT, 배송 HUB_TO_HUB"]
        L2b --> L3["PUT .../complete {actualDistance, actualDuration}"]
        L3 --> L3a{"구간 IN_TRANSIT?"}
        L3a -- 아니오 --> EL2
        L3a -- 예 --> L3b["구간 ARRIVED_AT_HUB, 실측값 기록"]
        L3b --> L4{"모든 구간 ARRIVED_AT_HUB?"}
        L4 -- 아니오 --> L1
        L4 -- 예 --> L5["배송 ARRIVED_AT_DEST_HUB"]
    end

    subgraph Last["최종 배송 (업체 배송기사)"]
        M1["PUT /deliveries/{id}/assign-company-driver"] --> M1a{"모든 구간 도착 & ARRIVED_AT_DEST_HUB?"}
        M1a -- 아니오 --> EM(["IllegalStateException"])
        M1a -- 예 --> M1b["companyDriverId 설정"]
        M1b --> M2["PUT .../start-company-delivery"]
        M2 --> M2a{"companyDriver 배정됨 & ARRIVED_AT_DEST_HUB?"}
        M2a -- 아니오 --> EM
        M2a -- 예 --> M2b["COMPANY_DELIVERING"]
        M2b --> M3["PUT .../complete-delivery"]
        M3 --> M3a{"COMPANY_DELIVERING?"}
        M3a -- 아니오 --> EM
        M3a -- 예 --> M3b["COMPLETED, actualDeliveryTime = now"]
        M3b --> M3c(["RabbitMQ 발행 delivery.exchange<br/>key delivery.completed.key<br/>DeliveryCompletedEvent"])
    end

    D2 --> L1
    L5 --> M1
```

**배송 상태:** `WAITING_AT_HUB → HUB_TO_HUB → ARRIVED_AT_DEST_HUB → COMPANY_DELIVERING → COMPLETED` (`FAILED`는 정의돼 있지만 설정하는 코드가 없음)
**구간 상태:** `WAITING_FOR_TRANSIT → IN_TRANSIT → ARRIVED_AT_HUB`

---

## 9. 주문 → 배송 연계 (의도 vs 실제)

```mermaid
flowchart TD
    subgraph Order["order-service"]
        O1(["주문 생성"]) --> O2["publish delivery.order.created"]
        O5["listen order.delivery.created<br/>→ assignDeliveryId"]
        O6["listen order.delivery.completed<br/>→ COMPLETED"]
    end
    subgraph Delivery["delivery-service"]
        D1["배송 생성"]
        D2["deliveryId 회신"]
        D3["배송 완료"] --> D4["publish delivery.completed.key"]
    end
    Manual(["관리자가 POST /v1/delivery/deliveries 직접 호출"]) --> D1

    O2 -. "⚠ ① @RabbitListener 없음" .-> D1
    D1 -. "⚠ ② order.delivery.created 발행 코드 없음" .-> D2
    D2 -.-> O5
    D1 --> D3
    D4 -. "⚠ ③ 라우팅 키 불일치 (delivery.completed.key ≠ order.delivery.completed)<br/>④ payload 형식 불일치" .-> O6
```

> 지금은 주문을 만들어도 배송이 자동으로 생기지 않습니다. 배송은 API를 직접 호출해야 만들어지고, 배송이 끝나도 주문 상태는 `COMPLETED`로 바뀌지 않습니다.

---

## 10. 구현 갭 정리

| # | 위치 | 내용 | 영향 |
|---|---|---|---|
| 1 | gateway `api-gateway-local.yml` | auth 라우트가 `/v1/auth/`(정확히 일치)라서 `/v1/auth/login`이 매칭되지 않음 | 게이트웨이를 통한 로그인 불가 (discovery 경로로만 가능) |
| 2 | gateway | hub 라우트 `/v1/hub/**`가 실제 경로 `/hubs`, `/hub-connections`, `/hub-routes`와 다름 | hub API 라우팅 불가 |
| 3 | gateway | company-service, product-service 라우트 없음 | discovery 경로로만 접근 가능 |
| 4 | gateway ↔ company/product | 게이트웨이는 `X-USERID`/`X-USERNAME`을 넣지만, 두 서비스는 `X-User-Id`/`X-Username`을 요구함 | 필수 헤더 누락으로 400 |
| 5 | company/product | 역할 검사 없음, 업체 생성 시 허브 존재 검증 없음 | 권한 없는 사용자도 등록 가능 |
| 6 | hub-service | 인증·역할 검사 없음, 삭제 시 `userId = 1L` 하드코딩 | 감사 정보 부정확 |
| 7 | order `OrderController.getOrderDetail` | `(id, username, userRole)`를 `(id, userRole, username)` 시그니처에 전달 | 역할 분기가 username 값으로 평가됨 |
| 8 | order `delete` | `Long.getLong(header)` 사용 (시스템 프로퍼티를 읽음) | deletedBy가 항상 null |
| 9 | order → delivery | `delivery.order.created` consumer 없음, `order.delivery.created` 발행 없음 | 주문해도 배송이 생성되지 않고 deliveryId도 연결되지 않음 |
| 10 | delivery → order | 라우팅 키 `delivery.completed.key`와 `order.delivery.completed` 불일치, payload도 다름 | 배송 완료가 주문에 반영되지 않음 |
| 11 | delivery → hub/ai | `/internal/routes`, `/internal/predict/eta`는 WireMock에만 있음 (실제 hub는 `/hub-routes`, ai-service는 빈 모듈) | 실제 서비스로 배포하면 배송 생성 실패 |
| 12 | order Feign | `DeliveryApiClient`(미사용, 대상 엔드포인트 없음), `HubApiClient`(빈 인터페이스) | 죽은 코드 |
| 13 | delivery-service | `getDeliveryDetails`, `searchDeliveries`, `deleteDelivery`가 엔드포인트로 노출되지 않음 | 배송 조회 API 없음 |
| 14 | 전반 | Slack 알림 미구현 (`slackId`, `recipientSlackId`는 저장만 함), AI 서비스 미구현 | - |
