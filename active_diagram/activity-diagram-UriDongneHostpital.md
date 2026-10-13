# 우리동네병원 (UriDongneHostpital) API 활동 다이어그램

> 분석 대상: `UriDongneHostpital/src/main/java/com/example/elice_3rd` (Spring Boot)
> 저장소: MySQL(JPA), MongoDB(채팅 메시지), Redis(Refresh Token / 인증코드), Kafka(채팅·알림), SMTP(메일), SSE(실시간 알림), STOMP WebSocket(채팅)

## 목차
- [API 엔드포인트 요약](#api-엔드포인트-요약)
- [0. 공통 요청 처리 흐름 (JWT 필터)](#0-공통-요청-처리-흐름-jwt-필터)
- [1. 회원가입 + 이메일 인증](#1-회원가입--이메일-인증)
- [2. 로그인 / 로그아웃](#2-로그인--로그아웃)
- [3. 회원 정보 관리](#3-회원-정보-관리)
- [4. 상담 게시글 (Counsel)](#4-상담-게시글-counsel)
- [5. 답변 (Comment)](#5-답변-comment)
- [6. 병원 검색](#6-병원-검색)
- [7. 채팅방 연결 / 조회 / 나가기](#7-채팅방-연결--조회--나가기)
- [8. 실시간 채팅 메시지 + 알림 파이프라인](#8-실시간-채팅-메시지--알림-파이프라인)
- [9. 알림 API](#9-알림-api)
- [10. 기타 (면허 암호화, 배치)](#10-기타-면허-암호화-배치)

---

## API 엔드포인트 요약

| 도메인 | Method | URL | 설명 | Controller |
|---|---|---|---|---|
| 회원 | POST | `/api/v1/members` | 회원가입 (중복 시 409) | `member/controller/MemberAPIController` |
| 회원 | GET | `/api/v1/members/info` | 내 정보 조회 | 〃 |
| 회원 | PATCH | `/api/v1/members/password` | 비밀번호 변경 | 〃 |
| 회원 | PATCH | `/api/v1/members/info` | 회원 정보 수정 | 〃 |
| 회원 | PATCH | `/api/v1/members/quit` | 회원 탈퇴(soft delete) | 〃 |
| 회원 | PATCH | `/api/v1/members/role` | 의사 권한으로 변경 | 〃 |
| 회원 | GET | `/api/v1/members/counsels` | 내 상담글 목록 | 〃 |
| 회원 | GET | `/api/v1/members/exist?email=` | 이메일 중복 확인 | 〃 |
| 인증 | POST | `/login` | 폼 로그인 (LoginFilter) | `security/LoginFilter` |
| 인증 | GET | `/oauth2/authorization/{provider}` | 소셜 로그인 (Google/Kakao/Naver) | `security/oauth2/*` |
| 인증 | POST | `/logout` | 로그아웃 (CustomLogoutFilter) | `security/CustomLogoutFilter` |
| 메일 | POST | `/api/v1/mail` | 인증 메일 발송 | `mail/controller/MailAPIController` |
| 메일 | GET | `/api/v1/mail/verification?code=` | 인증 코드 검증 | 〃 |
| 메일 | GET | `/api/v1/mail/verification-success?code=` | 인증 완료 여부 확인 | 〃 |
| 상담 | POST | `/api/v1/counsels` | 상담글 작성 | `counsel/controller/CounselAPIController` |
| 상담 | PATCH | `/api/v1/counsels` | 상담글 수정 | 〃 |
| 상담 | DELETE | `/api/v1/counsels?id=` | 상담글 삭제 | 〃 |
| 상담 | GET | `/api/v1/counsels/detail?id=` | 상담글 상세 | 〃 |
| 상담 | GET | `/api/v1/counsels?keyword=` | 상담글 목록/검색 | 〃 |
| 상담 | GET | `/api/v1/counsels/my-counsels` | 내 상담글 | 〃 |
| 답변 | POST | `/api/v1/comments` | 답변 작성 | `comment/controller/CommentAPIController` |
| 답변 | GET | `/api/v1/comments?counselId=` | 상담글 답변 목록 | 〃 |
| 답변 | GET | `/api/v1/comments/my-comments` | 내 답변 목록 | 〃 |
| 카테고리 | GET | `/api/v1/category` | 진료과 카테고리 전체 | `category/controller/CategoryAPIController` |
| 병원 | GET | `/api/hospitals/{categoryName}` | 카테고리별 병원 (무한스크롤) | `hospital/controller/HospitalSearchController` |
| 병원 | GET | `/api/hospitals/emergency` | 야간 응급 병원 | 〃 |
| 병원 | GET | `/api/hospitals/search` | 키워드 병원 검색 | 〃 |
| 채팅 | POST | `/api/chat/check-chat-room` | 채팅방 연결/생성 | `chat/controller/ChatAPIController` |
| 채팅 | GET | `/api/chat/chat-rooms` | 내 채팅방 목록 | 〃 |
| 채팅 | GET | `/api/chat/{chatRoomId}` | 채팅방 메시지 조회 | 〃 |
| 채팅 | DELETE | `/api/chat/{chatMessageId}` | 메시지 삭제 | 〃 |
| 채팅 | POST | `/api/chat/leave-room` | 채팅방 나가기 | 〃 |
| 채팅 | STOMP | `/send-message/{chatRoomId}` → `/topic/{chatRoomId}` | 실시간 메시지 | 〃 |
| 알림 | GET | `/api/notification` (text/event-stream) | SSE 구독 | `notification/controller/NotificationAPIController` |
| 알림 | GET | `/api/notification/unread` | 미확인 알림 | 〃 |
| 알림 | GET | `/api/notification/is-login` | 로그인 여부 | 〃 |
| 알림 | PUT | `/api/notification/read/{notificationId}` | 알림 읽음 처리 | 〃 |
| 면허 | POST | `/api/v1/licenses/encrypt` | AES256 암호화 | `license/controller/LicenseAPIController` |
| 면허 | POST | `/api/v1/licenses/decrypt` | AES256 복호화 | 〃 |
| 배치 | POST | `/batch` | 병원 데이터 배치 Job 실행 | `hospital/controller/TestController` |

> `diagnosisSubject/api/MedicalDepartmentApiController` (`/api/department`)는 전체 주석 처리되어 비활성 상태이므로 제외.

---

## 0. 공통 요청 처리 흐름 (JWT 필터)

`security/jwt/JwtFilter.java`, `security/jwt/JwtUtil.java`, `common/handler/GlobalExceptionHandler.java`
(`SecurityConfig`는 `anyRequest().permitAll()` — 인증 여부는 컨트롤러에서 `Principal` null 체크로 판단)

```mermaid
flowchart TD
    S((시작)) --> A["HTTP 요청 수신"]
    A --> B{"정적 리소스?<br/>.js / .css / /images / .map"}
    B -- 예 --> Z1["필터 건너뜀"] --> CTRL
    B -- 아니오 --> C{"access 쿠키 존재?"}
    C -- 아니오 --> ANON["비인증 상태로 통과"] --> CTRL
    C -- 예 --> D{"access 토큰 만료?"}
    D -- 예 --> R1["JwtUtil.reissue()<br/>Redis에서 refresh 토큰 조회"]
    R1 --> R2{"refresh 존재 & 미만료 &<br/>category == refresh?"}
    R2 -- 아니오 --> E401["401 / 400 응답"] --> END((종료))
    R2 -- 예 --> R3["새 access / refresh 발급<br/>Redis 갱신 + access 쿠키 재설정"] --> END
    D -- 아니오 --> F{"category == access?"}
    F -- 아니오 --> E401B["401 invalid access token"] --> END
    F -- 예 --> G["email·role·name·isOauth 추출<br/>SecurityContext에 인증 저장"]
    G --> CTRL["Controller 실행"]
    CTRL --> H{"예외 발생?"}
    H -- 예 --> I["GlobalExceptionHandler<br/>ErrorResponse 반환"] --> END
    H -- 아니오 --> J["정상 응답"] --> END
```

---

## 1. 회원가입 + 이메일 인증

`MemberAPIController`, `MailAPIController`, `mail/service/MailService.java`, `member/service/MemberManagementService.java`

```mermaid
flowchart TD
    S((시작)) --> A["회원가입 폼 입력"]
    A --> B["GET /api/v1/members/exist?email="]
    B --> C{"이메일 이미 존재?"}
    C -- 예 --> C1["중복 안내"] --> A
    C -- 아니오 --> D["POST /api/v1/mail<br/>address, content, code"]
    D --> D1["Thymeleaf email-template 렌더링<br/>(로고 Base64 첨부)"]
    D1 --> D2["SMTP 메일 발송"]
    D2 --> D3["VerificationCode 저장<br/>isVerify = false"]
    D3 --> E["사용자: 메일 내 인증 링크/코드 입력"]
    E --> F["GET /api/v1/mail/verification?code="]
    F --> G{"코드 존재?"}
    G -- 아니오 --> G1["NoSuchDataException<br/>인증 실패"] --> END((종료))
    G -- 예 --> H["isVerify = true 저장"]
    H --> I["GET /api/v1/mail/verification-success?code="]
    I --> J{"isVerify == true?"}
    J -- 아니오 --> E
    J -- 예 --> K["POST /api/v1/members<br/>@Validated MemberRequestDto"]
    K --> L{"existsByEmail?"}
    L -- 예 --> L1["409 CONFLICT"] --> END
    L -- 아니오 --> M["비밀번호 BCrypt 인코딩<br/>Member 저장"]
    M --> N["201 Created<br/>Location: /login"] --> END
```

---

## 2. 로그인 / 로그아웃

`security/LoginFilter.java`, `security/oauth2/OAuth2LoginSuccessHandler.java`, `security/oauth2/CustomOAuth2UserService.java`, `security/CustomLogoutFilter.java`

```mermaid
flowchart TD
    S((시작)) --> T{"로그인 방식"}

    T -- 이메일/비밀번호 --> A["POST /login<br/>email, password"]
    A --> B["AuthenticationManager.authenticate<br/>CustomUserDetailsService"]
    B --> C{"인증 성공?"}
    C -- 아니오 --> C1["401"] --> END((종료))
    C -- 예 --> D{"탈퇴 회원?"}
    D -- 예 --> D1["BadRequestException<br/>탈퇴한 회원입니다"] --> END
    D -- 아니오 --> TK

    T -- 소셜 --> O1["/oauth2/authorization/{google|kakao|naver}"]
    O1 --> O2["CustomOAuth2UserService<br/>사용자 정보 조회 / 신규면 회원 저장"]
    O2 --> O3["OAuth2LoginSuccessHandler<br/>kakao_account / response 속성에서 email 추출"]
    O3 --> O4{"email로 회원 조회"}
    O4 -- 없음 --> O5["NoSuchDataException"] --> END
    O4 -- 있음 --> TK

    TK["access / refresh 토큰 생성"] --> TK2["refresh 토큰 Redis 저장"]
    TK2 --> TK3["access 쿠키 설정<br/>redirect: /"] --> END

    S2((로그아웃)) --> L1["POST /logout"]
    L1 --> L2{"access 쿠키 존재?"}
    L2 -- 아니오 --> L9["400"] --> END
    L2 -- 예 --> L3{"만료 아님 & category==access<br/>& Redis에 refresh 존재?"}
    L3 -- 아니오 --> L9
    L3 -- 예 --> L4["Redis refresh 토큰 삭제"]
    L4 --> L5["access 쿠키 MaxAge=0<br/>redirect: /"] --> END
```

---

## 3. 회원 정보 관리

`MemberAPIController`, `member/service/MemberService.java` → `MemberManagementService` / `MemberRetrieveService`

```mermaid
flowchart TD
    S((시작)) --> A["로그인 사용자 요청<br/>Principal.getName() = email"]
    A --> B{"요청 종류"}
    B -- "GET /info" --> R1["이메일로 회원 조회"] --> R2["MemberResponseDto 반환"] --> END((종료))
    B -- "GET /counsels" --> Q1["내 상담글 Page 조회<br/>createdDate DESC"] --> END

    B -- "PATCH /password" --> P1["회원 조회"]
    P1 --> P2{"현재 비밀번호 일치?"}
    P2 -- 아니오 --> P3["IllegalArgumentException<br/>현재 비밀번호가 잘못됨"] --> END
    P2 -- 예 --> P4["새 비밀번호 인코딩 후 변경"] --> OK["200 OK<br/>Location: my-page"] --> END

    B -- "PATCH /info" --> U1["회원 조회"] --> U2["member.updateInfo()"] --> OK
    B -- "PATCH /quit" --> Q2["회원 조회"] --> Q3["member.quit()<br/>탈퇴 처리 (soft delete)"] --> Q4["200 OK<br/>Location: /"] --> END
    B -- "PATCH /role" --> RO1["회원 조회"] --> RO2["member.updateRoleDoctor()<br/>의사 권한 부여"] --> OK
```

---

## 4. 상담 게시글 (Counsel)

`CounselAPIController`, `counsel/service/CounselManagementService.java`, `CounselRetrieveService.java`

```mermaid
flowchart TD
    S((시작)) --> B{"요청 종류"}

    B -- "POST /api/v1/counsels" --> C1["@Validated CounselRequestDto"]
    C1 --> C2["email로 회원 조회"]
    C2 --> C3{"카테고리명 존재?"}
    C3 -- 아니오 --> EX1["NoSuchDataException"] --> END((종료))
    C3 -- 예 --> C4["Counsel 저장"] --> C5["201 Created<br/>Location: /counsels"] --> END

    B -- "PATCH / DELETE" --> M1["상담글 조회 (+ 수정 시 카테고리 조회)"]
    M1 --> M2{"존재?"}
    M2 -- 아니오 --> EX1
    M2 -- 예 --> M3{"작성자 == 로그인 사용자?"}
    M3 -- 아니오 --> EX2["IllegalArgumentException<br/>작성자 불일치"] --> END
    M3 -- 예 --> M4{"답변(Comment) 존재?"}
    M4 -- 예 --> EX3["IllegalArgumentException<br/>답변 존재 시 수정/삭제 불가"] --> END
    M4 -- 아니오 --> M5{"PATCH?"}
    M5 -- 예 --> M6["counsel.update()<br/>200 Location: /counsels/{id}"] --> END
    M5 -- 아니오 --> M7["counsel 삭제<br/>204 No Content"] --> END

    B -- "GET (목록/상세/내 글)" --> G1{"종류"}
    G1 -- "?keyword" --> G2["키워드 검색 Page<br/>createdDate DESC"] --> END
    G1 -- "detail?id" --> G3["상담글 상세 DTO"] --> END
    G1 -- "my-counsels" --> G4["내 상담글 Page"] --> END
```

---

## 5. 답변 (Comment)

`CommentAPIController`, `comment/service/CommentManagementService.java`, `CommentRetrieveService.java`

```mermaid
flowchart TD
    S((시작)) --> B{"요청 종류"}
    B -- "POST /api/v1/comments" --> A1["email로 회원 조회"]
    A1 --> A2{"회원 존재?"}
    A2 -- 아니오 --> EX["NoSuchDataException"] --> END((종료))
    A2 -- 예 --> A3{"counselId 상담글 존재?"}
    A3 -- 아니오 --> EX
    A3 -- 예 --> A4["Comment 저장"] --> A5["201 Created"] --> END
    B -- "GET ?counselId=" --> R1["상담글별 답변 Page<br/>createdDate DESC"] --> END
    B -- "GET /my-comments?keyword=" --> R2["내 답변 키워드 검색 Page"] --> END
```

---

## 6. 병원 검색

`hospital/controller/HospitalSearchController.java`, `hospital/service/HospitalSearchService.java`, `hospital/repository/HospitalQueryRepository.java`

```mermaid
flowchart TD
    S((시작)) --> A["메인 페이지 GET /<br/>카테고리·증상 Top10 로드"]
    A --> B{"검색 방식"}
    B --> P0

    P0["위도/경도 null이면<br/>서울(37.5665, 126.9780) 기본값"] --> P1["Pageable(size=20, page) 생성"]
    P1 --> T{"엔드포인트"}

    T -- "GET /api/hospitals/{categoryName}" --> C1{"categoryId == 7 (소아과)?"}
    C1 -- 예 --> C2["hospitalName='소아과'<br/>findAllByHospitalName"]
    C1 -- 아니오 --> C3["findAllByCategoryId<br/>(isOpen / 야간 / 일요일·공휴일 필터)"]
    C2 --> SL
    C3 --> SL

    T -- "GET /api/hospitals/emergency" --> E1["hasNightEmergency = true"] --> E2["findAllWithEmergency"] --> SL
    T -- "GET /api/hospitals/search" --> K1["findAllByKeyword"] --> SL

    SL["Slice#lt;HospitalResponse#gt; (거리순)"] --> R1["응답 Map 구성<br/>hospitals = content (비어있으면 [])"]
    R1 --> R2{"hasNext?"}
    R2 -- 예 --> R3["nextPage = page + 1"] --> OUT
    R2 -- 아니오 --> R4["nextPage = null"] --> OUT
    OUT["JSON 응답 → 프론트 무한스크롤"] --> END((종료))

    D0["병원 상세 GET /hospital/{name}?ykiho="] --> D1["ykiho로 병원 조회<br/>진료과목명 조회 + Kakao API Key"] --> END
```

---

## 7. 채팅방 연결 / 조회 / 나가기

`chat/controller/ChatAPIController.java`, `chat/service/ChatService.java`

```mermaid
flowchart TD
    S((시작)) --> P{"Principal 존재?"}
    P -- 아니오 --> E401["401 UNAUTHORIZED"] --> END((종료))
    P -- 예 --> B{"요청 종류"}

    B -- "POST /check-chat-room" --> A1["로그인 사용자 ID + 의사 ID로<br/>memberIds 재구성"]
    A1 --> A2{"memberIds 2명 (1:1)?"}
    A2 -- 아니오 --> NEW
    A2 -- 예 --> A3{"동일 멤버 구성의<br/>기존 채팅방 존재?"}
    A3 -- 아니오 --> NEW["새 ChatRoom 생성 (ACTIVE)<br/>각 멤버 MemberStatus = OFFLINE"]
    A3 -- 예 --> A4{"RoomStatus == INACTIVE?"}
    A4 -- 예 --> NEW
    A4 -- 아니오 --> A5{"내 상태 == LEFT?"}
    A5 -- 예 --> A6["MemberStatus → ONLINE"] --> A7["ChatRoomResponseDto 반환"]
    A5 -- 아니오 --> A7
    NEW --> A7 --> END

    B -- "GET /chat-rooms" --> L1["LEFT가 아닌 MemberStatus 조회"]
    L1 --> L2["방별 최근 메시지 + 안 읽은 수<br/>(MongoDB + ChatReadStatus)"] --> L3["ChatRoomListDto 목록"] --> END

    B -- "GET /{chatRoomId}" --> M1{"채팅방 존재?"}
    M1 -- 아니오 --> M0["404"] --> END
    M1 -- 예 --> M2{"내 상태 == OFFLINE?"}
    M2 -- 예 --> M3["상태 → ONLINE"] --> M4
    M2 -- 아니오 --> M4["입장 시각(또는 LEFT 변경 시각) 이후<br/>메시지 MongoDB 조회"]
    M4 --> M5["이전 메시지 ChatReadStatus 읽음 처리"] --> M6["Flux#lt;ChatMessageDto#gt; 반환"] --> END

    B -- "POST /leave-room" --> X1{"chatRoomId, memberId 유효?"}
    X1 -- 아니오 --> X0["400"] --> END
    X1 -- 예 --> X2["MemberStatus → LEFT"]
    X2 --> X3{"모든 멤버 LEFT?"}
    X3 -- 예 --> X4["RoomStatus → INACTIVE 저장"] --> X5["200 OK"] --> END
    X3 -- 아니오 --> X5

    B -- "DELETE /{chatMessageId}" --> D1["ChatReadStatus 삭제"]
    D1 --> D2["관련 Notification 메시지<br/>'삭제된 메시지입니다.' 로 변경"]
    D2 --> D3["MongoDB 메시지 삭제"] --> D4["204 No Content"] --> END
```

---

## 8. 실시간 채팅 메시지 + 알림 파이프라인

`ChatAPIController#sendMessageToChatRoom`, `ChatService#sendMessageToKafka`, `chat/service/KafkaProducer.java`, `chat/service/KafkaConsumer.java`, `notification/service/NotificationService.java`, `chat/config/WebSocketEventListener.java`

```mermaid
flowchart TD
    S((시작)) --> W1

    subgraph CLIENT["보내는 사용자 (브라우저)"]
        W1["STOMP SEND<br/>/send-message/{chatRoomId}"]
    end

    subgraph SERVER["Spring 서버 - ChatService"]
        V1{"chatRoomId 유효? (> 0)"}
        V2["MongoDB에 ChatMessage 저장"]
        V3["채팅방 멤버별 ChatReadStatus 생성"]
        V4{"수신자 상태 ONLINE?"}
        V5["즉시 읽음 처리"]
        V6["KafkaProducer → chatTopic<br/>(최대 3회, 1초 간격 재시도)"]
        V7{"전송 성공?"}
        V8["@SendTo /topic/{chatRoomId}<br/>방에 있는 사용자에게 브로드캐스트"]
    end

    subgraph KAFKA1["Kafka Consumer - chatTopic"]
        K1["NotificationService.sendNotificationToKafka"]
        K2{"수신자(보낸 사람 제외)<br/>상태 OFFLINE?"}
        K3["Notification 저장 (MySQL)"]
        K4["KafkaProducer → notificationTopic"]
    end

    subgraph KAFKA2["Kafka Consumer - notificationTopic"]
        N1["NotificationService.sendNotification"]
        N2{"수신자 SseEmitter 존재?"}
        N3["SSE 이벤트 전송"]
    end

    W1 --> V1
    V1 -- 아니오 --> ERR["RuntimeException<br/>Invalid chat room ID"] --> END((종료))
    V1 -- 예 --> V2 --> V3 --> V4
    V4 -- 예 --> V5 --> V6
    V4 -- 아니오 --> V6
    V6 --> V7
    V7 -- 아니오 --> ERR2["예외 → 트랜잭션 롤백"] --> END
    V7 -- 예 --> V8 --> END
    V7 -- 예 --> K1
    K1 --> K2
    K2 -- 아니오 --> SKIP["알림 생략"] --> END
    K2 -- 예 --> K3 --> K4 --> N1 --> N2
    N2 -- 아니오 --> N4["미확인 알림으로 DB에 남음<br/>(다음 접속 시 /unread 로 조회)"] --> END
    N2 -- 예 --> N3 --> END

    DC((WebSocket 연결 해제)) --> DC1["WebSocketEventListener"] --> DC2["해당 회원 모든 MemberStatus → OFFLINE"] --> END
```

---

## 9. 알림 API

`notification/controller/NotificationAPIController.java`, `notification/service/NotificationService.java`

```mermaid
flowchart TD
    S((시작)) --> P{"Principal 존재?"}
    B0{"요청 종류"}
    P -- 아니오 --> E401["401 UNAUTHORIZED"] --> END((종료))
    P -- 예 --> B0

    B0 -- "GET /api/notification (SSE)" --> S1["email → memberId 조회"]
    S1 --> S2["SseEmitter 생성 (timeout 60s)<br/>emitters Map에 등록"]
    S2 --> S3["onCompletion / onTimeout 시<br/>emitter 제거"] --> S4["text/event-stream 연결 유지"] --> END

    B0 -- "GET /unread" --> U1["memberId의 읽지 않은 알림 조회"] --> U2["List#lt;NotificationResponseDto#gt;"] --> END
    B0 -- "GET /is-login" --> I1["회원 조회 → isLogin"] --> END

    R0["PUT /read/{notificationId}"] --> R1["알림 읽음 상태로 변경"]
    R1 --> R2{"성공?"}
    R2 -- 예 --> R3["200 OK"] --> END
    R2 -- 아니오 --> R4["500"] --> END

    S1 -. 예외 .-> E500["500 INTERNAL_SERVER_ERROR"] --> END
```

---

## 10. 기타 (면허 암호화, 배치)

`license/controller/LicenseAPIController.java`, `license/util/AES256Util.java`, `hospital/controller/TestController.java`, `hospital/batch/config/HospitalBatchJobConfig.java`

```mermaid
flowchart TD
    S((의사 면허 등록)) --> L1["/license 페이지에서 주민번호 입력"]
    L1 --> L2["POST /api/v1/licenses/encrypt"]
    L2 --> L3["AES256Util.encrypt → 암호문 반환"]
    L3 --> L4["(필요 시) POST /api/v1/licenses/decrypt"]
    L4 --> L5["면허 확인 진행 /license/progress"]
    L5 --> L6["PATCH /api/v1/members/role<br/>의사 권한 부여"] --> END((종료))

    B((배치 실행)) --> B1["POST /batch<br/>또는 HospitalBatchScheduler<br/>(cron: 2·5·8·11월 1일 0시)"]
    B1 --> B2["JobParameters(time) 생성"]
    B2 --> B3["hospitalBatchJob 실행"]
    B3 --> B4["truncateHospitalTablesStep<br/>병원 관련 테이블 초기화"]
    B4 --> B5["saveHospitalTempStep → updateHospitalTempDetailsStep<br/>병원 기본/상세 정보 임시 적재"]
    B5 --> B5a["saveHospitalStep<br/>Hospital 저장"]
    B5a --> B6["saveHospitalDiagnosisSubjectStep → saveHospitalCategoryStep<br/>→ deduplicateHospitalCategoryStep"]
    B6 --> B7{"실행 성공?"}
    B7 -- 예 --> B8["200 Batch job started successfully"] --> END
    B7 -- 아니오 --> B9["500 Failed to start batch job"] --> END
```
