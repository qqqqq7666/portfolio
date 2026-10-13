# Trinione API 활동 다이어그램 (landing-hono)

> 분석 대상: `landing-hono/src` (Cloudflare Workers + Hono, 배포 경로 `www.trinione.com/api/v1/*`)
> 저장소: Cloudflare **D1** (`trinione_db`), **R2** (`trinione_bucket`) · 외부 연동: **Resend**(메일), **Google Analytics 4**

## 목차
0. [개요 - 엔드포인트 목록](#0-개요---엔드포인트-목록)
1. [전체 요청 흐름](#1-전체-요청-흐름)
2. [ADMIN 인증 미들웨어](#2-admin-인증-미들웨어)
3. [인증 (Auth)](#3-인증-auth)
4. [매물 - 사용자용](#4-매물---사용자용)
5. [상담 문의](#5-상담-문의)
6. [매물 - 관리자용](#6-매물---관리자용)
7. [관리자 대시보드](#7-관리자-대시보드)
8. [원장 (Ledger)](#8-원장-ledger)
9. [이미지 · RSS · Sitemap](#9-이미지--rss--sitemap)
10. [업무 시나리오: 문의 접수부터 처리까지](#10-업무-시나리오-문의-접수부터-처리까지)

---

## 0. 개요 - 엔드포인트 목록

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/v1/auth/login` | - | 로그인 (Access Token 응답, Refresh Token 쿠키) |
| POST | `/api/v1/auth/reissue` | Refresh 쿠키 | 토큰 재발급 |
| POST | `/api/v1/auth/logout` | - | Refresh 쿠키 삭제 |
| GET | `/api/v1/properties` | - | 공개 매물 목록 (필터, 페이징, 엣지 캐시) |
| GET | `/api/v1/properties/:id` | - | 공개 매물 상세 (조회수 +1) |
| POST | `/api/v1/inquiries` | - | 상담 문의 등록 + 관리자 메일 알림 |
| GET | `/api/v1/inquiries` | ADMIN | 문의 목록 |
| PATCH | `/api/v1/inquiries/:id/memo` | ADMIN | 관리자 메모 수정 |
| PATCH | `/api/v1/inquiries/:id/status` | ADMIN | 처리 상태 변경 |
| POST | `/api/v1/admin/properties` | ADMIN | 매물 등록 (multipart, 이미지 업로드) |
| GET | `/api/v1/admin/properties` | ADMIN | 관리자 매물 목록 |
| GET | `/api/v1/admin/properties/:id` | ADMIN | 관리자 매물 상세 |
| PUT | `/api/v1/admin/properties/:id` | ADMIN | 매물 수정 (부분 수정, 이미지 교체) |
| DELETE | `/api/v1/admin/properties/:id` | ADMIN | 매물 삭제 (연관 데이터 + R2 이미지) |
| GET | `/api/v1/admin/dashboard/traffic` | ADMIN | GA4 최근 30일 방문자 |
| GET | `/api/v1/admin/dashboard/meta` | ADMIN | 문의·매물 통계 |
| GET | `/api/v1/admin/ledger` | ADMIN | 전체 세대 원장 상태 |
| PATCH | `/api/v1/admin/ledger/:unitId` | ADMIN | 세대 상태 수정 (낙관적 잠금) |
| POST | `/api/v1/admin/ledger/import` | ADMIN | JSON 백업 일괄 복원 |
| GET | `/api/v1/images/*` | - | R2 이미지 서빙 |
| GET | `/api/v1/rss` | - | 매물 RSS 피드 |
| GET | `/api/v1/sitemap` | - | 사이트맵 XML |

**공통 응답 형식** (`utils/response.ts`)

```json
// 성공
{ "success": true,  "message": "...", "data": { } }
// 실패
{ "success": false, "message": "...", "code": "ERROR_CODE" }
```

---

## 1. 전체 요청 흐름

```mermaid
flowchart TD
    A(["클라이언트 요청"]) --> B{"경로가 /api/* 인가?"}
    B -- 예 --> C["CORS 미들웨어<br/>허용 Origin: localhost:5173,<br/>trinione.com, www.trinione.com"]
    B -- 아니오 --> R0["GET / → 'Hello Hono API!'"]
    C --> D{"라우터 분기"}

    D -- "/auth, /properties,<br/>/images, /rss, /sitemap" --> P["공개 핸들러"]
    D -- "POST /inquiries" --> P
    D -- "/inquiries 그 외" --> M["authMiddleware('ADMIN')"]
    D -- "/admin/properties<br/>/admin/dashboard<br/>/admin/ledger" --> M

    M --> MV{"토큰·권한 검증 통과?"}
    MV -- 아니오 --> E401(["401 / 403 응답"])
    MV -- 예 --> H["관리자 핸들러"]

    P --> S["비즈니스 로직"]
    H --> S
    S <--> DB[("D1 Database")]
    S <--> R2[("R2 Bucket")]
    S <--> EXT["외부 API<br/>Resend · Google"]
    S --> RES(["JSON / XML / 바이너리 응답"])

    classDef ext fill:#fff3e0,stroke:#ef6c00
    classDef store fill:#e3f2fd,stroke:#1565c0
    classDef err fill:#ffebee,stroke:#c62828
    class EXT ext
    class DB,R2 store
    class E401 err
```

---

## 2. ADMIN 인증 미들웨어

`middlewares/auth.ts` — 관리자 API 전체에 적용됩니다.

```mermaid
flowchart TD
    A(["요청 수신"]) --> B{"Authorization 헤더가<br/>'Bearer '로 시작?"}
    B -- 아니오 --> E1(["401 UNAUTHORIZED<br/>인증 토큰이 없습니다"])
    B -- 예 --> C["'Bearer ' 제거 후 토큰 추출"]
    C --> D{"토큰이 비어 있는가?"}
    D -- 예 --> E2(["401 UNAUTHORIZED<br/>비어있는 토큰"])
    D -- 아니오 --> F["JWT_SECRET으로 HS256 검증"]
    F --> G{"검증 결과"}
    G -- 만료 --> E3(["401 EXPIRED_TOKEN"])
    G -- "서명 불일치/변조" --> E4(["401 INVALID_TOKEN"])
    G -- "지원하지 않는 알고리즘" --> E5(["401 UNSUPPORTED_TOKEN"])
    G -- 성공 --> H["c.set('user', decoded)"]
    H --> I{"role이 ADMIN 인가?"}
    I -- 아니오 --> E6(["403 FORBIDDEN"])
    I -- 예 --> J(["next() → 핸들러 실행"])

    classDef err fill:#ffebee,stroke:#c62828
    class E1,E2,E3,E4,E5,E6 err
```

---

## 3. 인증 (Auth)

### 3.1 로그인 — `POST /auth/login`

```mermaid
flowchart TD
    A(["username, password 수신"]) --> B[("D1: members에서<br/>username 조회")]
    B --> C{"사용자 존재?"}
    C -- 아니오 --> E1(["401 AUTH_FAILED"])
    C -- 예 --> D["bcrypt.compare로<br/>비밀번호 비교"]
    D --> F{"일치?"}
    F -- 아니오 --> E1
    F -- 예 --> G["Access Token 생성<br/>sub, role, name / 1시간"]
    G --> H["Refresh Token 생성<br/>sub / 7일"]
    H --> I["Set-Cookie: refreshToken<br/>HttpOnly, Secure, SameSite=None,<br/>Path=/api/v1/auth"]
    I --> J(["200 { accessToken }"])

    classDef err fill:#ffebee,stroke:#c62828
    class E1 err
```

### 3.2 토큰 재발급 — `POST /auth/reissue`

```mermaid
flowchart TD
    A(["요청 수신"]) --> B{"refreshToken 쿠키 존재?"}
    B -- 아니오 --> E1(["401 TOKEN_NOT_FOUND"])
    B -- 예 --> C["HS256 검증"]
    C --> D{"유효?"}
    D -- 아니오 --> E2(["401 INVALID_TOKEN"])
    D -- 예 --> F[("D1: members에서<br/>sub로 최신 사용자 조회")]
    F --> G{"사용자 존재?"}
    G -- 아니오 --> E3(["401 USER_NOT_FOUND"])
    G -- 예 --> H["새 Access Token 발급<br/>최신 role 반영"]
    H --> I["새 Refresh Token 발급<br/>쿠키 갱신 (Rotation)"]
    I --> J(["200 { accessToken }"])

    classDef err fill:#ffebee,stroke:#c62828
    class E1,E2,E3 err
```

### 3.3 로그아웃 — `POST /auth/logout`

```mermaid
flowchart LR
    A(["요청 수신"]) --> B["refreshToken 쿠키 삭제<br/>Path=/api/v1/auth"] --> C(["200 로그아웃 성공"])
```

### 3.4 클라이언트 관점의 토큰 갱신 흐름

```mermaid
flowchart TD
    A(["관리자 API 호출<br/>Authorization: Bearer accessToken"]) --> B{"응답 코드"}
    B -- 200 --> OK(["정상 처리"])
    B -- 401 --> C["POST /auth/reissue<br/>쿠키 자동 전송"]
    C --> D{"재발급 성공?"}
    D -- 예 --> E["새 accessToken 저장"] --> A
    D -- 아니오 --> F(["로그인 페이지로 이동"])
```

---

## 4. 매물 - 사용자용

### 4.1 매물 목록 — `GET /properties`

```mermaid
flowchart TD
    A(["요청 수신<br/>page, size, keyword, propertyType,<br/>dealType, floorPlanType, min/maxPrice,<br/>min/maxMonthlyRent, rooms"]) --> B{"엣지 캐시 HIT?<br/>max-age=60, SWR=30"}
    B -- 예 --> Z(["캐시된 응답 반환"])
    B -- 아니오 --> C["기본 조건: isVisible = true"]
    C --> D{"keyword 있음?"}
    D -- 예 --> D1["title LIKE %keyword%<br/>OR 태그 LIKE %keyword%"]
    D -- 아니오 --> E
    D1 --> E["나머지 필터 조건 추가<br/>(유형 일치, 평면 접두 LIKE,<br/>가격·월세 범위, 방 개수)"]
    E --> F[("D1: 매물 조회<br/>createdAt DESC, limit/offset<br/>+ images, tags 조인")]
    F --> G["대표 이미지 1장, 태그 배열로 매핑"]
    G --> H[("D1: 같은 조건으로 count(*)")]
    H --> I(["200 { content, page: {size, number, totalElements} }"])
```

### 4.2 매물 상세 — `GET /properties/:id`

```mermaid
flowchart TD
    A(["id 수신"]) --> B{"엣지 캐시 HIT?"}
    B -- 예 --> Z(["캐시된 응답 반환"])
    B -- 아니오 --> C[("D1: id 일치 AND isVisible = true<br/>+ images 정렬, tags")]
    C --> D{"매물 존재?"}
    D -- 아니오 --> E1(["404 NOT_FOUND"])
    D -- 예 --> F[("D1: viewCount + 1")]
    F --> G["imageUrls, tags 배열로 변환"]
    G --> H(["200 매물 상세"])

    classDef err fill:#ffebee,stroke:#c62828
    class E1 err
```

---

## 5. 상담 문의

### 5.1 문의 등록 — `POST /inquiries` (공개)

```mermaid
flowchart TD
    A(["name, phone, content, privacyAgreedAt,<br/>floorPlan, expectedVisitDate 수신"]) --> B["Zod 검증<br/>InquiryCreateRequestDto"]
    B --> C{"검증 통과?"}
    C -- 아니오 --> E1(["500 CREATE_FAILED"])
    C -- 예 --> D[("D1: inquiries INSERT<br/>status = PENDING")]
    D --> F{"RESEND_API_KEY와<br/>ADMIN_EMAIL 설정됨?"}
    F -- 아니오 --> J
    F -- 예 --> G["ADMIN_EMAIL을 쉼표로 분리"]
    G --> H["Resend로 관리자 알림 메일 발송"]
    H --> I{"발송 성공?"}
    I -- 예 --> I1["성공 로그"] --> J
    I -- 아니오 --> I2["에러 로그만 남김<br/>(문의 접수는 유지)"] --> J
    J(["201 생성된 문의"])

    classDef ext fill:#fff3e0,stroke:#ef6c00
    classDef err fill:#ffebee,stroke:#c62828
    class H ext
    class E1 err
```

### 5.2 문의 관리 (ADMIN)

```mermaid
flowchart TD
    A(["관리자 요청"]) --> M["authMiddleware('ADMIN')"]
    M --> B{"요청 종류"}

    B -- "GET /inquiries" --> L1[("D1: createdAt DESC<br/>limit/offset 조회")]
    L1 --> L2[("D1: count(*)")]
    L2 --> L3(["200 { content, page }"])

    B -- "PATCH /:id/memo" --> M1["Zod 검증: adminMemo"]
    M1 --> M2{"통과?"}
    M2 -- 아니오 --> ME(["400 UPDATE_FAILED"])
    M2 -- 예 --> M3[("D1: adminMemo UPDATE")]
    M3 --> M4(["200 { id, adminMemo }"])

    B -- "PATCH /:id/status" --> S1["Zod 검증: status"]
    S1 --> S2{"통과?"}
    S2 -- 아니오 --> SE(["400 UPDATE_FAILED"])
    S2 -- 예 --> S3[("D1: status UPDATE")]
    S3 --> S4(["200 { id, status }"])

    classDef err fill:#ffebee,stroke:#c62828
    class ME,SE err
```

---

## 6. 매물 - 관리자용

모든 경로에 `authMiddleware('ADMIN')`가 적용됩니다. (아래 다이어그램에서는 생략)

### 6.1 매물 등록 — `POST /admin/properties` (multipart/form-data)

```mermaid
flowchart TD
    A(["multipart 수신<br/>request(JSON), images[]"]) --> B["parseBody({ all: true })"]
    B --> C{"request 타입"}
    C -- File --> C1["text() 후 JSON.parse"]
    C -- string --> C2["JSON.parse"]
    C1 --> D
    C2 --> D["Zod 검증<br/>PropertyCreateRequestDto"]
    D --> E[("D1: properties INSERT<br/>→ propertyId 확보")]
    E --> F{"업로드할 이미지 남음?"}
    F -- 예 --> G{"파일 크기 > 0 ?"}
    G -- 아니오 --> F
    G -- 예 --> H[("R2 PUT<br/>properties/{id}_{ts}_{i}.{ext}")]
    H --> I[("D1: property_images INSERT<br/>imageUrl=/api/v1/images/..., sortOrder=i")]
    I --> F
    F -- 아니오 --> J{"tags 있음?"}
    J -- 예 --> K[("D1: property_tags INSERT<br/>태그별 반복")]
    J -- 아니오 --> L
    K --> L(["201 { propertyId }"])
    D -. 예외 .-> ERR(["500 등록 실패"])
    E -. 예외 .-> ERR

    classDef store fill:#e3f2fd,stroke:#1565c0
    classDef err fill:#ffebee,stroke:#c62828
    class H store
    class ERR err
```

### 6.2 관리자 매물 목록 / 상세 — `GET /admin/properties`, `GET /admin/properties/:id`

```mermaid
flowchart TD
    A(["요청 수신"]) --> B{"경로"}

    B -- "목록" --> L1["필터 조건 구성<br/>사용자용 필터 + isVisible, subjectProperty<br/>(공개 여부 제한 없음)"]
    L1 --> L2[("D1: 매물 조회<br/>createdAt DESC, limit/offset")]
    L2 --> L3[("D1: count(*) → totalPages 계산")]
    L3 --> L4{"조회된 매물 있음?"}
    L4 -- 예 --> L5[("D1: 매물 ID 목록으로<br/>태그·이미지 일괄 조회 (N+1 방지)")]
    L4 -- 아니오 --> L6
    L5 --> L6["DTO 매핑<br/>null 값은 기본값으로 대체"]
    L6 --> L7(["200 { content, totalElements,<br/>totalPages, pageable }"])

    B -- "상세" --> D1[("D1: id로 매물 조회<br/>공개 여부 무관")]
    D1 --> D2{"존재?"}
    D2 -- 아니오 --> DE(["404 NOT_FOUND"])
    D2 -- 예 --> D3[("D1: 태그, 이미지 조회")]
    D3 --> D4(["200 매물 + tags + imageUrls"])

    classDef err fill:#ffebee,stroke:#c62828
    class DE err
```

### 6.3 매물 수정 — `PUT /admin/properties/:id`

```mermaid
flowchart TD
    A(["id + multipart 수신<br/>request(JSON), images[]"]) --> B[("D1: 매물 존재 확인")]
    B --> C{"존재?"}
    C -- 아니오 --> E1(["404 매물을 찾을 수 없습니다"])
    C -- 예 --> D["request JSON 파싱<br/>Zod 검증 (PropertyUpdateRequestDto, 부분 수정)"]
    D --> F["전달된 필드만 updateData에 담기<br/>+ updatedAt = KST now"]
    F --> G{"updatedAt 외 변경 필드 있음?"}
    G -- 예 --> G1[("D1: properties UPDATE")]
    G -- 아니오 --> H
    G1 --> H[("D1: 기존 이미지 조회")]
    H --> I["keptImageUrls에 없는 이미지 선별"]
    I --> J{"삭제할 이미지 남음?"}
    J -- 예 --> J1[("D1: 이미지 행 DELETE")]
    J1 --> J2[("R2 DELETE<br/>(실패 시 로그만)")]
    J2 --> J
    J -- 아니오 --> K["nextSortOrder =<br/>유지 이미지 최대 sortOrder + 1"]
    K --> L{"새 이미지 남음?"}
    L -- 예 --> L1[("R2 PUT")]
    L1 --> L2[("D1: 이미지 행 INSERT<br/>sortOrder 증가")]
    L2 --> L
    L -- 아니오 --> M{"tags 필드가 전달됨?"}
    M -- 예 --> M1[("D1: 기존 태그 전체 DELETE")]
    M1 --> M2[("D1: 새 태그 INSERT")]
    M2 --> N
    M -- 아니오 --> N(["200 { propertyId }"])
    D -. 예외 .-> E2(["500 수정 실패"])

    classDef store fill:#e3f2fd,stroke:#1565c0
    classDef err fill:#ffebee,stroke:#c62828
    class J2,L1 store
    class E1,E2 err
```

### 6.4 매물 삭제 — `DELETE /admin/properties/:id`

```mermaid
flowchart TD
    A(["id 수신"]) --> B[("D1: property_tags DELETE")]
    B --> C[("D1: favorites DELETE")]
    C --> D[("D1: property_images 조회")]
    D --> E{"남은 이미지?"}
    E -- 예 --> F["imageUrl → R2 키 변환"]
    F --> G[("R2 DELETE<br/>(실패 시 로그만)")]
    G --> E
    E -- 아니오 --> H[("D1: property_images DELETE")]
    H --> I[("D1: properties DELETE")]
    I --> J(["200 매물 삭제 성공<br/>(Workers 제약으로 204 대신 200)"])

    classDef store fill:#e3f2fd,stroke:#1565c0
    class G store
```

---

## 7. 관리자 대시보드

### 7.1 방문자 트래픽 — `GET /admin/dashboard/traffic`

```mermaid
flowchart TD
    A(["요청 수신"]) --> B{"GOOGLE_SERVICE_ACCOUNT_JSON<br/>설정됨?"}
    B -- 아니오 --> E1(["500 GA_ERROR"])
    B -- 예 --> C["서비스 계정 JSON 파싱"]
    C --> D["jose: private_key로<br/>RS256 JWT 서명<br/>scope=analytics.readonly"]
    D --> F["Google OAuth2 토큰 엔드포인트 호출<br/>grant_type=jwt-bearer"]
    F --> G{"토큰 발급 성공?"}
    G -- 아니오 --> E1
    G -- 예 --> H["GA4 runReport 호출<br/>dimension=date, metric=totalUsers,<br/>최근 30일"]
    H --> I{"GA 응답 OK?"}
    I -- 아니오 --> E2(["500 트래픽 데이터를<br/>불러오지 못했습니다"])
    I -- 예 --> J["YYYYMMDD → YYYY-MM-DD 변환<br/>{ date, visitorCount } 배열"]
    J --> K(["200 트래픽 목록"])

    classDef ext fill:#fff3e0,stroke:#ef6c00
    classDef err fill:#ffebee,stroke:#c62828
    class F,H ext
    class E1,E2 err
```

### 7.2 통계 — `GET /admin/dashboard/meta`

```mermaid
flowchart TD
    A(["요청 수신"]) --> B[("D1: 전체 매물 수")]
    B --> C[("D1: PENDING 문의 수")]
    C --> D["KST 기준 오늘·어제 00:00 계산"]
    D --> E[("D1: 오늘 문의 수")]
    E --> F[("D1: 어제 문의 수")]
    F --> G{"어제 문의 수 = 0 ?"}
    G -- 예 --> G1["증감률 = 오늘 × 100"]
    G -- 아니오 --> G2["증감률 = (오늘 - 어제) / 어제 × 100"]
    G1 --> H
    G2 --> H["소수 첫째 자리 반올림"]
    H --> I[("D1: floorPlan별 GROUP BY count")]
    I --> J["비율(%) 계산, 빈 값은 '미선택'<br/>비율 내림차순 정렬"]
    J --> K(["200 todayInquiryCount, yesterdayInquiryCount,<br/>todayInquiryChange, inProgressInquiryCount,<br/>totalPropertyCount, inquiryDistributions"])
    B -. 예외 .-> ERR(["500 DB_ERROR"])

    classDef err fill:#ffebee,stroke:#c62828
    class ERR err
```

---

## 8. 원장 (Ledger)

모든 경로에 `authMiddleware('ADMIN')`가 적용되고, 응답에는 `Cache-Control: no-store`가 붙습니다.

### 8.1 전체 조회 — `GET /admin/ledger`

```mermaid
flowchart LR
    A(["요청 수신"]) --> B[("D1: ledger_statuses 전체 조회")]
    B --> C["LEDGER_UNIT_MAP에 없는 세대 제외"]
    C --> D["{ unitId: { status, updatedAt, revision } } 형태로 변환"]
    D --> E(["200 { records }"])
```

### 8.2 세대 상태 수정 — `PATCH /admin/ledger/:unitId` (낙관적 동시성 제어)

```mermaid
flowchart TD
    A(["unitId + { status, revision } 수신"]) --> B{"LEDGER_UNIT_MAP에<br/>unitId 존재?"}
    B -- 아니오 --> E1(["404 NOT_FOUND"])
    B -- 예 --> C["Zod 검증<br/>LedgerStatusUpdateRequestDto"]
    C --> D{"통과?"}
    D -- 아니오 --> E2(["400 INVALID_INPUT"])
    D -- 예 --> F["새 updatedAt(ISO), 새 revision(UUID) 생성"]
    F --> G{"요청 revision이 null?"}
    G -- "예 (처음 저장)" --> H[("D1: INSERT<br/>ON CONFLICT DO NOTHING")]
    G -- "아니오 (기존 세대)" --> I[("D1: UPDATE<br/>WHERE unitId AND revision 일치")]
    H --> J{"반영된 행 수 = 0 ?"}
    I --> J
    J -- 예 --> E3(["409 CONFLICT<br/>다른 관리자가 먼저 수정했습니다"])
    J -- 아니오 --> K(["200 { status, updatedAt, revision }"])

    classDef err fill:#ffebee,stroke:#c62828
    class E1,E2,E3 err
```

### 8.3 백업 일괄 복원 — `POST /admin/ledger/import`

```mermaid
flowchart TD
    A(["JSON 백업 수신"]) --> B{"본문 크기 ≤ 1MB?"}
    B -- 아니오 --> E1(["413 PAYLOAD_TOO_LARGE"])
    B -- 예 --> C["Zod 검증<br/>LedgerImportRequestDto"]
    C --> D{"통과?"}
    D -- 아니오 --> E2(["400 INVALID_INPUT"])
    D -- 예 --> F["records → 행 목록 변환<br/>세대마다 revision 새로 발급"]
    F --> G["25행 단위로 분할<br/>(D1 바인딩 변수 100개 제한)"]
    G --> H["청크마다 INSERT ... ON CONFLICT DO UPDATE"]
    H --> I[("D1 batch 실행<br/>(하나의 트랜잭션)")]
    I --> J(["200 { count }"])
    I -. 예외 .-> E3(["500 원장 복원 실패"])

    classDef err fill:#ffebee,stroke:#c62828
    class E1,E2,E3 err
```

---

## 9. 이미지 · RSS · Sitemap

```mermaid
flowchart TD
    subgraph IMG["GET /images/*"]
        I1(["요청 경로"]) --> I2["'/api/v1/images/' 제거 → R2 키"]
        I2 --> I3[("R2 GET")]
        I3 --> I4{"객체 존재?"}
        I4 -- 아니오 --> I5(["404 Not Found"])
        I4 -- 예 --> I6(["200 이미지 스트림<br/>etag, Cache-Control 1년"])
    end

    subgraph RSS["GET /rss"]
        R1(["요청"]) --> R2[("D1: 공개 매물 최신 50개 + 태그")]
        R2 --> R3["가격을 억/만 단위로 표기<br/>RFC-822 날짜, XML 이스케이프"]
        R3 --> R4(["200 RSS 2.0 XML"])
    end

    subgraph SM["GET /sitemap"]
        S1(["요청"]) --> S2[("D1: 공개 매물 최신 1000개")]
        S2 --> S3["메인, /properties, 매물별 URL 생성<br/>lastmod, changefreq, priority"]
        S3 --> S4(["200 Sitemap XML"])
    end
```

---

## 10. 업무 시나리오: 문의 접수부터 처리까지

방문자, 시스템(API), 관리자가 어떻게 이어지는지 보여주는 swimlane 형태의 활동 다이어그램입니다.

```mermaid
flowchart TD
    subgraph V["방문자"]
        V1(["사이트 접속"]) --> V2["매물 목록 탐색 / 필터 검색"]
        V2 --> V3["매물 상세 확인"]
        V3 --> V4["상담 문의 작성<br/>개인정보 동의"]
        V4 --> V5(["접수 완료 확인"])
    end

    subgraph S["시스템 (landing-hono)"]
        S1["GET /properties<br/>엣지 캐시 + D1"]
        S2["GET /properties/:id<br/>조회수 증가"]
        S3["POST /inquiries<br/>status = PENDING 저장"]
        S4["Resend로 관리자 메일 발송"]
        S5["토큰 발급 / 검증"]
        S6["문의 목록 · 통계 응답"]
        S7["상태 / 메모 저장"]
    end

    subgraph A["관리자"]
        A1["알림 메일 수신"] --> A2["POST /auth/login"]
        A2 --> A3["대시보드 확인<br/>GET /admin/dashboard/meta"]
        A3 --> A4["문의 목록 확인<br/>GET /inquiries"]
        A4 --> A5["고객 연락 후<br/>메모·상태 변경"]
        A5 --> A6(["처리 완료"])
    end

    V2 --> S1 --> V2
    V3 --> S2 --> V3
    V4 --> S3 --> V5
    S3 --> S4 --> A1
    A2 --> S5 --> A3
    A3 --> S6
    A4 --> S6
    A5 --> S7 --> A6
```
