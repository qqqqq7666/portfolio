# ECLIPSE (의류 쇼핑몰) API 활동 다이어그램

> 분석 대상: `Eclipse/src/main/java/com/example/shop_project` (Spring Boot)
> 구성: MySQL(JPA), Redis(상품 조회수), JWT(쿠키: `accessToken` / `refreshToken`), Google OAuth2, PortOne(아임포트) 결제, STOMP WebSocket(상담 채팅), 로컬 파일 저장소(`C:/webserver_storage/`)

## 목차
- [API 엔드포인트 요약](#api-엔드포인트-요약)
- [0. 공통 요청 처리 흐름 (JwtFilter + 인가)](#0-공통-요청-처리-흐름-jwtfilter--인가)
- [1. 회원가입 (일반 / Google OAuth2)](#1-회원가입-일반--google-oauth2)
- [2. 로그인 / 토큰 재발급 / 로그아웃](#2-로그인--토큰-재발급--로그아웃)
- [3. 회원 정보 관리 (중복확인, 정보수정, 비밀번호 재설정, 탈퇴)](#3-회원-정보-관리)
- [4. 상품 (등록 / 수정 / 삭제 / 조회수)](#4-상품)
- [5. 카테고리 (관리자)](#5-카테고리-관리자)
- [6. 주문 + 결제 (Checkout)](#6-주문--결제-checkout)
- [7. 주문 취소 · 환불 · 배송상태 관리](#7-주문-취소--환불--배송상태-관리)
- [8. 포인트 · 멤버십](#8-포인트--멤버십)
- [9. 찜 · 리뷰 · 문의/답글](#9-찜--리뷰--문의답글)
- [10. 챗봇 · 상담원 채팅](#10-챗봇--상담원-채팅)

---

## API 엔드포인트 요약

| 도메인 | Method | URL | 설명 | Controller |
|---|---|---|---|---|
| 인증 | POST | `/jwt-login` | 이메일/비밀번호 로그인, 토큰 쿠키 발급 | `jwt/controller/JwtController` |
| 인증 | POST | `/jwt-refresh` | refreshToken으로 accessToken 재발급 | 〃 |
| 인증 | POST | `/jwt-logout` | 토큰 쿠키 삭제 | 〃 |
| 인증 | POST | `/logout` | Spring Security 로그아웃 | `security/CustomLogoutSuccessHandler` |
| 인증 | GET | `/oauth2/authorization/google` | 구글 로그인 | `security/CustomAuthenticationSuccessHandler` |
| 회원 | POST | `/join` | 일반 회원가입 (+ 포인트 계정 생성) | `member/controller/MemberViewController` |
| 회원 | GET / POST | `/signup/confirm`, `/signup/extra` | OAuth2 신규회원 추가정보 입력 | `oauth2/ExtraSignupViewController` |
| 회원 | GET | `/api/v1/members/check-email` | 이메일 중복 (중복 시 409) | `member/controller/MemberAPIController` |
| 회원 | GET | `/api/v1/members/check-nickname` | 닉네임 중복 (중복 시 409) | 〃 |
| 회원 | POST | `/api/v1/members/verify-password` | 현재 비밀번호 확인 (불일치 401) | 〃 |
| 회원 | POST | `/mypage/edit` | 회원 정보 수정 | `MemberViewController` |
| 회원 | POST | `/mypage/withdraw` | 회원 탈퇴 (soft delete) | 〃 |
| 회원 | POST | `/password-reset` | 임시 비밀번호 발급 | 〃 |
| 상품 | POST | `/api/products` | 상품 등록 (multipart) | `product/controller/ProductAPIController` |
| 상품 | PATCH | `/api/products/{productId}` | 상품 부분 수정 | 〃 |
| 상품 | DELETE | `/api/products/{productId}` | 상품 삭제 | 〃 |
| 상품 | GET | `/api/products/available-sizes` | 색상별 재고 있는 사이즈 | 〃 |
| 상품 | POST | `/products/detail/{productId}/confirm-view` | Redis 조회수 DB 반영 | `product/controller/productViewController` |
| 상품 | GET | `/products/edit/{productId}/images` | 상품 이미지 URL 목록 | 〃 |
| 상품 | GET | `/upload/products/{filename}` | 이미지 파일 서빙 | `product/controller/ImageController` |
| 카테고리 | GET | `/api/v1/categories/categoryList`, `/list`, `/main`, `/{mainId}/sub` | 카테고리 조회 | `category/controller/CategoryAPIController` |
| 카테고리 | POST | `/api/v1/categories/create` | 메인/서브 카테고리 추가 | 〃 |
| 카테고리 | PATCH | `/api/v1/categories/update` | 카테고리 수정 | 〃 |
| 카테고리 | DELETE | `/api/v1/categories/delete` | 카테고리 삭제 | 〃 |
| 주문 | POST | `/api/v1/orders/create` | 주문 생성 | `order/controller/OrderAPIController` |
| 주문 | GET | `/api/v1/orders/{orderNo}`, `/{orderNo}/order-detail` | 주문/주문상세 조회 | 〃 |
| 주문 | PATCH | `/api/v1/orders/{orderNo}/update-status` | 주문 상태 변경 | 〃 |
| 주문 | DELETE | `/api/v1/orders/{orderNo}/delete` | 주문 삭제 | 〃 |
| 주문 | GET | `/api/v1/orders/member-info` | 주문자 정보 | 〃 |
| 주문 | GET | `/api/v1/orders/recent-order-no` | 최근 주문번호 | 〃 |
| 주문 | POST | `/api/v1/orders/{orderNo}/canceled-order` | 취소/환불 요청 | 〃 |
| 주문 | DELETE | `/api/v1/orders/canceled-order` | 취소 요청 철회 | 〃 |
| 주문 | PATCH | `/api/v1/orders/address` | 배송지 변경 | 〃 |
| 주문 | GET | `/api/v1/orders/product-option/{productId}`, `/product-image` | 장바구니용 상품 정보 | 〃 |
| 주문 | POST | `/api/v1/orders/{orderNo}/payment-fail` | 결제 이탈 시 FAIL 처리 | 〃 |
| 결제 | POST | `/api/v1/payments/create` | 결제 정보 저장 + 판매량 증가 | `order/controller/PaymentAPIController` |
| 결제 | PATCH | `/api/v1/payments/decrease-product-stock` | 재고 차감 (부족 시 307) | 〃 |
| 결제 | PATCH | `/api/v1/payments/restore-product-stock` | 재고 복구 | 〃 |
| 포인트 | GET | `/api/v1/points` | 내 포인트 | `point/controller/PointAPIController` |
| 포인트 | POST | `/api/v1/points/save-point`, `/use-point` | 포인트 적립 / 사용 | 〃 |
| 찜 | POST / DELETE | `/api/favorites/{productId}` | 찜 추가 / 해제 | `favorite/controller/FavoriteAPIController` |
| 리뷰 | POST | `/review/create` | 리뷰 작성 (+500P) | `review/controller/ReviewViewController` |
| 문의 | POST | `/products/{productId}/inquiries` | 문의 작성 | `inquiry/controller/InquiryViewController` |
| 문의 | DELETE | `/api/v1/products/{productId}/inquiries/{inquiryId}` | 문의 삭제 | `inquiry/controller/InquiryAPIController` |
| 답글 | POST / DELETE | `/products/{pId}/inquiries/{iId}/comment[/{commentId}]` | 관리자 답글 작성 / 삭제 | `comment/controller/CommentController` |
| 관리자 | PUT | `/api/v1/admin/members/role/{id}` | 회원 권한 변경 | `admin/controller/AdminMemberAPIController` |
| 관리자 | PUT | `/api/v1/admin/members/withdraw/{id}` | 회원 탈퇴 처리 | 〃 |
| 관리자 | PATCH | `/api/v1/admin/orders/{orderNo}/update-status` | 배송 상태 변경 | `admin/controller/AdminOrderAPIController` |
| 관리자 | PATCH | `/api/v1/admin/orders/refund?orderNo=` | 환불 승인 | 〃 |
| 관리자 | DELETE / GET | `/api/v1/admin/orders/{orderNo}[/delete]` | 주문 삭제 / 상세 | 〃 |
| 관리자 | DELETE | `/api/v1/admin/points/savedpoint`, `/usedpoint` | 포인트 적립/사용 취소 | `admin/controller/AdminPointAPIController` |
| 챗봇 | POST | `/api/v1/chatbot?message=` | FAQ 챗봇 응답 | `chatbot/controller/ChatbotAPIController` |
| 채팅 | POST | `/api/v1/chat/connection` | 상담 채팅방 생성 (WAITING) | `chatbot/controller/ChatRoomAPIController` |
| 채팅 | GET | `/api/v1/chat/room-status?roomId=` | 방 상태 폴링 | 〃 |
| 채팅 | GET / POST | `/api/v1/chat/admin/assign`, `/end` | 상담원 배정 / 상담 종료 | `chatbot/controller/AdminChatAPIController` |
| 채팅 | STOMP | `/chat/send` → `/topic/messages`, `/chat/end` → `/topic/chat/end` | 실시간 메시지 / 종료 이벤트 | `chatbot/controller/ChatMessageController` |

---

## 0. 공통 요청 처리 흐름 (JwtFilter + 인가)

`jwt/JwtFilter.java`, `jwt/JwtProviderImpl.java`, `security/SecurityConfig.java`

```mermaid
flowchart TD
    S((시작)) --> A["HTTP 요청 수신"]
    A --> B{"경로 == /chatbot ?"}
    B -- 예 --> AUTHZ
    B -- 아니오 --> C{"accessToken 쿠키 존재?"}
    C -- 아니오 --> AUTHZ
    C -- 예 --> D["convertAuthToken()"]
    D --> E{"토큰 validate() 통과?"}
    E -- 아니오 --> E1["SecurityContext 초기화<br/>(비인증 상태로 진행)"] --> AUTHZ
    E -- 예 --> F["getAuthentication()"]
    F --> G{"예외 발생?"}
    G -- 예 --> G1["Context 초기화 + 401"] --> END((종료))
    G -- 아니오 --> G2["SecurityContext에 인증 저장"] --> AUTHZ

    AUTHZ{"SecurityConfig 인가 규칙"}
    AUTHZ -- "/login, /join, /jwt-login, /api/**, /products/**,<br/>/order/**, /oauth2/**, /signup/**, /upload/** 등" --> OK["permitAll → Controller"]
    AUTHZ -- "/admin/**" --> ADM{"ROLE_ADMIN?"}
    ADM -- 예 --> OK
    ADM -- 아니오 --> F403["403 Forbidden"] --> END
    AUTHZ -- "/mypage 및 그 외" --> AU{"인증됨?"}
    AU -- 예 --> OK
    AU -- 아니오 --> L["로그인 페이지로 이동"] --> END
    OK --> H{"예외 발생?"}
    H -- 예 --> H1["도메인별 ExceptionHandler<br/>(Category / Order / Member / Product)"] --> END
    H -- 아니오 --> R["정상 응답"] --> END
```

---

## 1. 회원가입 (일반 / Google OAuth2)

`member/controller/MemberViewController.java`, `member/service/MemberService.java`, `security/CustomAuthenticationSuccessHandler.java`, `oauth2/ExtraSignupViewController.java`, `point/service/PointService.java`

```mermaid
flowchart TD
    S((시작)) --> T{"가입 방식"}

    T -- 일반 --> J1["회원가입 폼 입력"]
    J1 --> J2["GET /api/v1/members/check-email"]
    J2 --> J3{"409 중복?"}
    J3 -- 예 --> J1
    J3 -- 아니오 --> J4["GET /api/v1/members/check-nickname"]
    J4 --> J5{"409 중복?"}
    J5 -- 예 --> J1
    J5 -- 아니오 --> J6["POST /join (@Validated)"]
    J6 --> J7{"유효성 오류?"}
    J7 -- 예 --> J8["join 페이지 + 에러 메시지"] --> J1
    J7 -- 아니오 --> J9{"이메일/닉네임 DB 중복?"}
    J9 -- 예 --> J10["IllegalArgumentException"] --> END((종료))
    J9 -- 아니오 --> J11["비밀번호 BCrypt 인코딩<br/>Member 저장"]
    J11 --> PT["PointService.createPointByEmail<br/>포인트 계정 생성"] --> HOME["redirect: /"] --> END

    T -- Google --> O1["/oauth2/authorization/google"]
    O1 --> O2["CustomOAuth2UserService.loadUser"]
    O2 --> O3["CustomAuthenticationSuccessHandler"]
    O3 --> O4{"email로 기존 회원 존재?"}
    O4 -- 예 --> O5["access/refresh 토큰 생성<br/>HttpOnly 쿠키 저장"] --> HOME
    O4 -- 아니오 --> O6["redirect: /signup/confirm"]
    O6 --> O7["GET /signup/extra<br/>추가정보 입력 폼"]
    O7 --> O8["POST /signup/extra<br/>닉네임·전화·주소·우편번호"]
    O8 --> O9["Member 저장<br/>(provider=GOOGLE, role=USER)"]
    O9 --> O10["토큰 생성 + 쿠키 저장"] --> PT
```

---

## 2. 로그인 / 토큰 재발급 / 로그아웃

`jwt/controller/JwtController.java`, `member/service/MemberService#login`, `security/CustomLogoutSuccessHandler.java`

```mermaid
flowchart TD
    S((로그인)) --> A["POST /jwt-login<br/>email, password"]
    A --> B{"이메일로 회원 조회"}
    B -- 없음 --> E1["IllegalArgumentException<br/>사용자를 찾을 수 없음"] --> END((종료))
    B -- 있음 --> C{"비밀번호 일치?"}
    C -- 아니오 --> E2["IllegalArgumentException<br/>비밀번호 불일치"] --> END
    C -- 예 --> D["Access(10분) / Refresh(2주) 토큰 생성"]
    D --> D1["Set-Cookie: HttpOnly, SameSite=Lax"]
    D1 --> D2["200 + accessToken JSON"] --> END

    S2((토큰 재발급)) --> R1["POST /jwt-refresh"]
    R1 --> R2{"refreshToken 쿠키 존재?"}
    R2 -- 아니오 --> R0["401"] --> END
    R2 -- 예 --> R3{"refresh 토큰 유효?"}
    R3 -- 아니오 --> R0
    R3 -- 예 --> R4["subject(email)로 회원 조회"]
    R4 --> R5["새 accessToken 생성 + 쿠키 저장"] --> R6["200 + accessToken JSON"] --> END

    S3((로그아웃)) --> L0{"방식"}
    L0 -- "POST /jwt-logout" --> L1["accessToken/refreshToken 쿠키 MaxAge=0<br/>SecurityContext 초기화"] --> L2["200 로그아웃 성공"] --> END
    L0 -- "POST /logout" --> L3["세션 무효화<br/>CustomLogoutSuccessHandler"]
    L3 --> L4["accessToken·refreshToken·JSESSIONID 쿠키 삭제"] --> L5["redirect: /login"] --> END
```

---

## 3. 회원 정보 관리

`MemberAPIController`, `MemberViewController`, `member/service/MemberCleanupService.java`, `admin/controller/AdminMemberAPIController.java`

```mermaid
flowchart TD
    S((시작)) --> B{"요청 종류"}

    B -- 정보 수정 --> P1["POST /api/v1/members/verify-password"]
    P1 --> P2{"현재 비밀번호 일치?"}
    P2 -- 아니오 --> P3["401 UNAUTHORIZED"] --> END((종료))
    P2 -- 예 --> P4["수정 폼 진입 /mypage/edit"]
    P4 --> P5["닉네임 변경 시<br/>GET check-nickname (currentNickname 제외)"]
    P5 --> P6{"409 중복?"}
    P6 -- 예 --> P4
    P6 -- 아니오 --> P7["POST /mypage/edit<br/>닉네임·전화·비밀번호·주소 갱신"] --> P8["redirect: /mypage"] --> END

    B -- 비밀번호 찾기 --> F1["POST /password-reset?email="]
    F1 --> F2{"회원 존재?"}
    F2 -- 아니오 --> F3["해당 이메일 사용자 없음"] --> END
    F2 -- 예 --> F4["UUID 8자리 임시 비밀번호 생성<br/>인코딩 후 저장"] --> F5["화면에 임시 비밀번호 표시"] --> END

    B -- 회원 탈퇴 --> W1["POST /mypage/withdraw"]
    W1 --> W2["withdraw = true, withdrawDate = now"]
    W2 --> W3["SecurityContext 초기화 + 세션 무효화"] --> W4["200 탈퇴 완료"] --> END

    B -- "관리자: 권한 변경" --> A1["PUT /api/v1/admin/members/role/{id}"] --> A2["Role 변경 저장"] --> END
    B -- "관리자: 탈퇴 처리" --> A3["PUT /api/v1/admin/members/withdraw/{id}"]
    A3 --> A4{"이미 탈퇴?"}
    A4 -- 예 --> A5["400 이미 탈퇴된 회원"] --> END
    A4 -- 아니오 --> A6["withdraw = true"] --> END

    SCH((매일 02:00 스케줄)) --> C1["MemberCleanupService"] --> C2["탈퇴 후 30일 경과 회원 영구 삭제"] --> END
```

---

## 4. 상품

`product/controller/ProductAPIController.java`, `product/controller/productViewController.java`, `product/service/ProductService.java`, `product/service/ImageService.java`

```mermaid
flowchart TD
    S((시작)) --> B{"요청 종류"}

    B -- "POST /api/products" --> C1{"BindingResult 오류?"}
    C1 -- 예 --> C0["400 + 필드별 에러 Map"] --> END((종료))
    C1 -- 아니오 --> C2["로그인 이메일 → 닉네임 조회<br/>DTO에 nickname 설정"]
    C2 --> C3{"validateProductRequest<br/>이름(≤50)·카테고리·설명(≤500)·옵션≥1·재고≥1"}
    C3 -- 실패 --> C4["InvalidProductException"] --> END
    C3 -- 통과 --> C5["Product + ProductOption 생성"]
    C5 --> C6["이미지별 ImageService.uploadImage<br/>C:/webserver_storage/products 저장"]
    C6 --> C7["ProductImage(sortOrder) 연결 후 저장"] --> C8["200 상품 등록 성공"] --> END

    B -- "PATCH /api/products/{id}" --> U1["updates JSON 파싱"]
    U1 --> U2{"JSON 형식 정상?"}
    U2 -- 아니오 --> U0["IllegalArgumentException"] --> END
    U2 -- 예 --> U3["필드별 부분 수정<br/>(이름·가격·설명·카테고리·옵션)"]
    U3 --> U4{"새 이미지 있음?"}
    U4 -- 예 --> U5["이미지 업로드/교체"] --> U6["200 수정된 상품"] --> END
    U4 -- 아니오 --> U6

    B -- "DELETE /api/products/{id}" --> D1["deleteById"] --> END

    B -- "상세 페이지 GET /products/detail/{id}" --> V1["상품 상세 조회"]
    V1 --> V2{"Redis key view:{id}:{ip} 존재?"}
    V2 -- 아니오 --> V3["key 저장 (TTL 1시간)<br/>view:total:{id} INCR"] --> V4
    V2 -- 예 --> V4["페이지 렌더링"]
    V4 --> V5["POST /products/detail/{id}/confirm-view"]
    V5 --> V6{"view:total 값 존재 & 숫자?"}
    V6 -- 아니오 --> V7["400"] --> END
    V6 -- 예 --> V8["DB 조회수 += total<br/>Redis total 키 삭제"] --> END

    B -- "GET /api/products/available-sizes" --> S1["productId + color로<br/>재고 있는 옵션 조회"] --> END
```

---

## 5. 카테고리 (관리자)

`category/controller/CategoryAPIController.java`, `category/service/CategoryService.java`, `category/exception/*`

```mermaid
flowchart TD
    S((시작)) --> B{"요청 종류"}

    B -- "POST /create" --> C1{"메인 카테고리 생성?"}
    C1 -- 예 --> C2{"메인 이름 중복?"}
    C2 -- 예 --> DUP["CategoryCustomException<br/>DUPLICATE_RESOURCE (409)"] --> END((종료))
    C2 -- 아니오 --> C3["메인 카테고리 저장<br/>+ 첫 서브 카테고리 저장"] --> OK["200 CategoryResDto"] --> END
    C1 -- 아니오 --> C4{"같은 메인 아래 서브 이름 중복?"}
    C4 -- 예 --> DUP
    C4 -- 아니오 --> C5["서브 카테고리 저장"] --> OK

    B -- "PATCH /update" --> U1{"depth == 0 (메인)?"}
    U1 -- 예 --> U2["메인 카테고리 목록과 비교"]
    U1 -- 아니오 --> U3["형제 서브 카테고리와 비교"]
    U2 --> U4{"이름 중복?"}
    U3 --> U4
    U4 -- 예 --> DUP
    U4 -- 아니오 --> U5["이름 변경 저장"] --> OK

    B -- "DELETE /delete" --> D1{"해당 카테고리에 상품 존재?"}
    D1 -- 예 --> D2["CONFLICT_WITH_PRODUCTS"] --> END
    D1 -- 아니오 --> D3["서브 카테고리 삭제"]
    D3 --> D4{"메인에 남은 서브 없음?"}
    D4 -- 예 --> D5["메인 카테고리도 삭제<br/>existMainCategory=false"] --> OK2["200 CategoryDeleteResDto"] --> END
    D4 -- 아니오 --> D6["existMainCategory=true"] --> OK2

    B -- "GET 조회" --> G1["categoryList / list / main / {mainId}/sub"] --> END
```

---

## 6. 주문 + 결제 (Checkout)

`static/order/js/checkout.js` (클라이언트 오케스트레이션), `OrderAPIController`, `PaymentAPIController`, `order/service/OrderService.java`, `order/service/PaymentService.java`, `PointAPIController`

```mermaid
flowchart TD
    S((시작)) --> A0

    subgraph BROWSER["브라우저 (checkout.js)"]
        A0["장바구니(localStorage) → /order/checkout"]
        A1["배송정보·포인트 입력 후 결제 클릭<br/>(5만원 미만 배송비 3,000원)"]
        A2["pagehide 리스너 등록<br/>(이탈 시 payment-fail beacon)"]
        A5["IMP.request_pay"]
        A9["주문 완료 모달<br/>장바구니 비우기"]
        A10["결제 실패 알림<br/>/order/cart 이동"]
    end

    subgraph SERVER["Spring 서버"]
        B1["PATCH /api/v1/payments/decrease-product-stock"]
        B2{"옵션별 재고 충분?"}
        B3["GET /api/v1/orders/member-info"]
        B4["POST /api/v1/orders/create<br/>Order + OrderDetail 저장 (NEW)"]
        C1["POST /api/v1/payments/create<br/>최근 주문에 Payment 연결<br/>상품 salesCount 증가"]
        C2{"포인트 사용?"}
        C3["POST /api/v1/points/use-point<br/>UsedPoint 생성, 잔액 차감"]
        F1["GET /recent-order-no →<br/>PATCH update-status = FAIL"]
        F2["PATCH /api/v1/payments/restore-product-stock<br/>재고 복구"]
    end

    subgraph PG["PortOne (아임포트)"]
        P1{"결제 성공?"}
    end

    A0 --> A1 --> A2 --> B1 --> B2
    B2 -- 아니오 --> B2x["307 → 재고 부족 알림"] --> END((종료))
    B2 -- 예 --> B3
    B3 --> B3a{"로그인 유효?"}
    B3a -- 아니오 --> B3b["로그인 만료 알림 → /"] --> END
    B3a -- 예 --> B4
    B4 --> B4a{"주문 생성 성공?"}
    B4a -- 아니오 --> B4b["주문 실패 알림"] --> END
    B4a -- 예 --> A5 --> P1
    P1 -- 예 --> C1 --> C2
    C2 -- 예 --> C3 --> A9
    C2 -- 아니오 --> A9
    A9 --> END
    P1 -- 아니오 --> F1 --> F2 --> A10 --> END
```

---

## 7. 주문 취소 · 환불 · 배송상태 관리

`OrderAPIController`, `OrderViewController`, `admin/controller/AdminOrderAPIController.java`, `OrderService#refund`, `PaymentService#cancelPay`

```mermaid
flowchart TD
    S((시작)) --> V["GET /order/{orderNo} 주문 상세"]
    V --> V1{"주문자 == 로그인 회원?"}
    V1 -- 아니오 --> V0["403 잘못된 접근"] --> END((종료))
    V1 -- 예 --> B{"사용자 액션"}

    B -- 배송지 변경 --> AD["PATCH /api/v1/orders/address"] --> END
    B -- 구매 확정 등 --> ST["PATCH /api/v1/orders/{no}/update-status"] --> END
    B -- 취소/환불 요청 --> R1["POST /api/v1/orders/{no}/canceled-order<br/>reason"]
    R1 --> R2["CanceledOrder 생성<br/>주문 상태 → REFUND_REQUIRE"] --> R3["redirect: /order/{no}"]
    R3 --> R4{"요청 철회?"}
    R4 -- 예 --> R5["DELETE /api/v1/orders/canceled-order<br/>상태 → NEW, CanceledOrder 삭제"] --> END
    R4 -- 아니오 --> ADM

    ADM["관리자: /admin/orders 목록<br/>(이메일·상태 필터)"] --> AB{"관리자 액션"}
    AB -- 배송상태 변경 --> AS["PATCH /api/v1/admin/orders/{no}/update-status<br/>NEW → PREPARING → IN_SHIPPING → ARRIVE"] --> END
    AB -- 환불 승인 --> RF1["PATCH /api/v1/admin/orders/refund?orderNo="]
    RF1 --> RF2["CanceledOrder.confirmRequire()"]
    RF2 --> RF3{"포인트로 결제했나?"}
    RF3 -- 예 --> RF4["UsedPoint 금액 잔액 복구<br/>UsedPoint 삭제"] --> RF5
    RF3 -- 아니오 --> RF5["주문 상태 → REFUND"]
    RF5 --> RF6["Payment.cancelPay()"] --> RF7["redirect: /admin/orders/{no}"] --> END
    AB -- 주문 삭제 --> DL["DELETE /api/v1/admin/orders/{no}/delete"] --> END
```

---

## 8. 포인트 · 멤버십

`point/controller/PointAPIController.java`, `point/service/PointService.java`, `point/entity/Point.java`, `admin/controller/AdminPointAPIController.java`

```mermaid
flowchart TD
    S((시작)) --> B{"요청 종류"}
    B -- "GET /api/v1/points" --> G1["email → Point 조회"] --> G2["PointDto (잔액)"] --> END((종료))

    B -- "POST /save-point" --> SV1["email로 회원·Point 조회"]
    SV1 --> SV2{"존재?"}
    SV2 -- 아니오 --> EX["IllegalArgumentException"] --> END
    SV2 -- 예 --> SV3["SavedPoint 추가<br/>balance += 금액"] --> SV4["201 PointDto"] --> END

    B -- "POST /use-point" --> US1["email로 Point 조회 + 주문 연결"]
    US1 --> US2["UsedPoint 추가<br/>balance -= 금액"] --> SV4

    B -- "관리자 DELETE /savedpoint" --> AC1["SavedPoint 조회"] --> AC2["balance -= 적립액<br/>SavedPoint 삭제"] --> AC3["204"] --> END
    B -- "관리자 DELETE /usedpoint" --> AC4["UsedPoint 조회"] --> AC5["balance += 사용액<br/>UsedPoint 삭제"] --> AC3

    SCH((매월 1일 00:00 스케줄)) --> M1["monthlyPointSave()"]
    M1 --> M2["DIAMOND 회원 +50,000P"]
    M2 --> M3["GOLD 회원 +10,000P"]
    M3 --> M4["SILVER 회원 +5,000P"] --> END

    RV((리뷰 작성)) --> RV1["POST /review/create"] --> RV2["Review 저장"] --> RV3["리뷰 작성 혜택 +500P 적립"] --> RV4["redirect: /order"] --> END
```

---

## 9. 찜 · 리뷰 · 문의/답글

`favorite/*`, `review/*`, `inquiry/*`, `comment/*`

```mermaid
flowchart TD
    S((시작)) --> B{"기능"}

    B -- "찜 POST /api/favorites/{id}" --> F1["email → memberId"]
    F1 --> F2{"이미 찜한 상품?"}
    F2 -- 예 --> F3["IllegalStateException → 500 업데이트 실패"] --> END((종료))
    F2 -- 아니오 --> F4["Favorite 저장<br/>200 찜 목록 추가"] --> END
    B -- "찜 해제 DELETE /api/favorites/{id}" --> F5["deleteByMemberAndProduct"] --> END

    B -- "리뷰 목록 GET /products/{id}/reviews" --> RV1{"정렬"}
    RV1 -- highRating --> RV2["별점 높은순"]
    RV1 -- lowRating --> RV3["별점 낮은순"]
    RV1 -- date --> RV4["최신순"]
    RV2 --> RV5["평균 별점 계산 후 렌더링"]
    RV3 --> RV5
    RV4 --> RV5 --> END

    B -- "문의 작성 POST /products/{id}/inquiries" --> Q1["@Valid InquiryRequestDto<br/>(비밀글 여부 포함)"] --> Q2["Inquiry 저장"] --> Q3["redirect: 문의 목록"] --> END
    B -- "문의 목록 GET" --> QL1{"비밀글?"}
    QL1 -- 아니오 --> QL2["열람 가능"] --> END
    QL1 -- 예 --> QL3{"관리자 또는 작성자?"}
    QL3 -- 예 --> QL2
    QL3 -- 아니오 --> QL4["열람 불가 표시"] --> END
    B -- "문의 삭제 DELETE /api/v1/.../inquiries/{iid}" --> QD1{"문의 존재?"}
    QD1 -- 아니오 --> QD2["IllegalArgumentException"] --> END
    QD1 -- 예 --> QD3["삭제 → 204"] --> END

    B -- "답글 작성 POST .../comment" --> C1{"ROLE_ADMIN?"}
    C1 -- 아니오 --> C2["IllegalStateException<br/>작성 권한 없음"] --> END
    C1 -- 예 --> C3{"내용 ≤ 500자?"}
    C3 -- 아니오 --> C4["IllegalArgumentException"] --> END
    C3 -- 예 --> C5["Comment 저장<br/>redirect: 문의 상세"] --> END
    B -- "답글 삭제 DELETE .../comment/{cid}" --> C6{"작성자 == 로그인 사용자?"}
    C6 -- 아니오 --> C7["IllegalStateException<br/>삭제 권한 없음"] --> END
    C6 -- 예 --> C8["Comment 삭제"] --> END
```

---

## 10. 챗봇 · 상담원 채팅

`chatbot/controller/*`, `chatbot/service/ChatbotService.java`, `chatbot/service/ChatService.java` (채팅방은 메모리 `ConcurrentHashMap`에 보관)

```mermaid
flowchart TD
    S((시작)) --> A["POST /api/v1/chatbot?message="]
    A --> B{"질문 매칭"}
    B -- 배송 기간 --> B1["3-5일 이내 배송 안내"] --> R
    B -- 환불 정책 --> B2["수령 후 7일 이내 환불 안내"] --> R
    B -- 결제 수단 --> B3["신용카드·카카오페이·네이버페이 안내"] --> R
    B -- 기타 --> B4["답변 준비되지 않음"] --> R
    R["JSON 응답 {response}"] --> END((종료))
    B -- 상담사 연결 --> C1["POST /api/v1/chat/connection<br/>userId"]

    subgraph USER["사용자"]
        C1
        C3["GET /api/v1/chat/room-status 폴링"]
        C4{"status == IN_PROGRESS?"}
    end

    subgraph ADMIN["관리자 (/admin)"]
        D1["WAITING / IN_PROGRESS 방 목록 확인"]
        D2["GET /api/v1/chat/admin/assign<br/>roomId, adminId"]
    end

    C1 --> C2["UUID roomId 생성<br/>status = WAITING"] --> C3 --> C4
    C2 --> D1 --> D2 --> D3["adminId 설정<br/>status = IN_PROGRESS"]
    C4 -- 아니오 --> C3
    C4 -- 예 --> M1["STOMP /chat/send"]
    M1 --> M2["ChatService.saveMessage"] --> M3["/topic/messages 브로드캐스트"]
    M3 --> M4{"상담 종료?"}
    M4 -- 아니오 --> M1
    M4 -- 예 --> E1["STOMP /chat/end 또는<br/>POST /api/v1/chat/admin/end"]
    E1 --> E2["status = CLOSED"] --> E3["/topic/chat/end 알림"] --> END
```
