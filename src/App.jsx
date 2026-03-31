import React, { useState } from 'react';
import {
  Github,
  Mail,
  ExternalLink,
  Award,
  Server,
  Database,
  Code,
  Youtube,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle,
  Cloud,
  Shield,
  Workflow,
  TrendingUp,
  Image as ImageIcon
} from 'lucide-react';

// --- 데이터 정의 ---

const SKILLS = [
  {
    title: 'Language & Framework',
    icon: <Code size={20} />,
    skills: ['Java 21', 'Spring Boot 3.x', 'Spring WebFlux', 'Spring Cloud', 'React'],
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  {
    title: 'Database & ORM',
    icon: <Database size={20} />,
    skills: ['PostgreSQL', 'MySQL', 'Redis', 'MongoDB', 'Spring Data JPA', 'Spring Data R2DBC'],
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10'
  },
  {
    title: 'Architecture & MQ',
    icon: <Workflow size={20} />,
    skills: ['MSA (Microservices)', 'Event-Driven (EDA)', 'Apache Kafka', 'Outbox Pattern'],
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10'
  },
  {
    title: 'Infra & DevOps',
    icon: <Cloud size={20} />,
    skills: ['Docker / Compose', 'AWS EC2', 'GitHub Actions (CI/CD)'],
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10'
  },
  {
    title: 'Testing & Monitoring',
    icon: <Activity size={20} />,
    skills: ['Gatling (Load Testing)', 'Prometheus', 'Grafana', 'JUnit'],
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10'
  },
  {
    title: 'Security & Auth',
    icon: <Shield size={20} />,
    skills: ['Spring Security', 'OAuth2', 'JWT'],
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10'
  }
];

const PROJECTS = [
  {
    title: '토론하는아이들 (교육 홍보 및 관리자 App 서비스)',
    period: '2026.02 - 현재 라이브 운영 중',
    team: '1명 (개인 프로젝트)',
    role: '풀스택 개발 및 앱 패키징',
    contribution: '기획 100% / 프론트엔드 100% / 백엔드 100%',
    image: null, // 실제 사이트 캡쳐 이미지가 있다면 여기에 경로 추가 (예: '/images/thinkmen.png')
    links: {
      url: 'https://www.thinkmentutor.com/',
    },
    techStack: ['Java', 'Spring Boot', 'Spring Security', 'JWT', 'React', 'Tailwind CSS', 'Capacitor', 'FCM'],
    features: [
      'Tailwind CSS를 활용한 반응형 학원 랜딩 페이지 및 상담 문의 접수 폼 구현',
      'Capacitor를 활용하여 단일 React 코드베이스를 안드로이드 네이티브 앱으로 패키징 및 분기 라우팅 처리',
      'Firebase Cloud Messaging을 연동하여 새로운 상담 문의 접수 시 관리자 앱으로 실시간 푸시 알림 전송 로직 구현',
      'JWT 기반 관리자 인증 구현',
      'Token 만료 시 401 에러를 캐치하여 백그라운드에서 토큰을 재발급하는 인터셉터 로직 적용'
    ],
    learnings: [
      '단일 React 코드베이스 내에서 Capacitor.isNativePlatform() 분기를 통해 웹 환경과 모바일 앱 환경을 효율적으로 분리하고 하이브리드 앱을 구축하는 경험을 했습니다.',
      'Capacitor를 도입해 웹 프론트엔드 기술만으로 안드로이드 네이티브 기능을 제어하고, 단일 코드베이스로 크로스 플랫폼을 지원하는 효율적인 아키텍처를 경험했습니다.',
      '새로운 문의가 등록되는 트랜잭션 내에서 백엔드의 FCM API를 호출하여 모바일 기기로 푸시 알림을 발송하는 End-to-End 알림 아키텍처를 체득했습니다.',
      '푸시 알림 수신 시 Custom Event를 발생시켜 관리자 대시보드의 데이터를 자동으로 갱신하게 함으로써 앱 사용성을 크게 개선했습니다.',
      'HttpOnly 설정과 SameSite 속성을 활용한 쿠키 기반 Refresh Token 관리 전략을 직접 세우며, XSS 공격을 방어하는 안전한 인증/인가 플로우를 체득했습니다.'
    ]
  },
  {
    title: 'Bidket (MSA 기반 대규모 C2C 경매 이커머스)',
    period: '2026.01 - 2026.03',
    team: '4명 (팀장)',
    role: '팀장, 대기열(Queue) 시스템 설계 및 최적화',
    contribution: '백엔드 40% / 아키텍처 설계 40% / 기획 20%',
    links: {
      github: 'https://github.com/Bidket',
      youtube: 'https://youtu.be/_knYIgr7G8c',
      notion: 'https://www.notion.so/Bidket-2df2dc8f74fd81beb86aefdef217ddc9?source=copy_link'
    },
    techStack: ['Java', 'Spring Boot', 'Spring Cloud', 'Spring WebFlux', 'Spring Data R2DBC', 'Kafka', 'PostgreSQL', 'Redis', 'Docker'],
    features: [
      'Spring Cloud Gateway와 WebFlux를 도입해 블로킹 없는 비동기 처리로 고성능 트래픽 수용 환경을 구축',
      'Redis ZSet을 활용하여 대기열 진입 순서를 정확히 보장하고, 유동적인 최대 수용 인원 및 초당 진입 허용 수 조절 기능 구현',
      'Heartbeat API를 통한 비활동 유저 자동 퇴출 및 대기자 입장 로직 구현으로 경매 서버 회전율 극대화',
      'Outbox Pattern과 DLT를 도입하여 MSA 분산 환경에서의 데이터 정합성 보장'
    ],
    learnings: [
      'Redis 자료구조의 특성을 깊이 분석하여, Heartbeat 갱신 시 Hash 전체의 만료 시간이 연장되던 문제를 ZSet의 Score 기반으로 변경해 만료 세션을 정확히 제어하는 트러블슈팅을 경험했습니다.',
      'Spring WebFlux와 R2DBC를 활용한 Non-Blocking 아키텍처를 직접 설계하며, 적은 리소스로도 대규모 트래픽을 효율적으로 제어하는 방법을 체득했습니다.',
      '부하 테스트를 주도하며 기존 Polling 방식의 한계인 소켓 고갈을 인지하고, SSE로 통신 방식을 개선하여 서버 부하를 극적으로 낮추는 최적화 사이클을 완수했습니다.'
    ]
  },
  {
    title: 'Sparta Logistics (MSA 기반 물류 배송 및 주문 관리 플랫폼)',
    period: '2025.11 - 2025.11',
    team: '5명 (팀원)',
    role: '백엔드 개발, MSA 아키텍처 설계 및 비동기 트랜잭션 최적화',
    contribution: '백엔드 40% / 아키텍처 설계 40% / 기획 20%',
    links: {
      github: 'https://github.com/sparta-logitics/sparta_logistics/tree/dev/order-service',
      notion: 'https://www.notion.so/13-Code-Cargo-2df2dc8f74fd81ab80f2d6e175ea1b74?pvs=12'
    },
    techStack: ['Java', 'Spring Boot', 'Spring Data JPA', 'QueryDSL', 'RabbitMQ', 'Redis', 'MySQL'],
    features: [
      'CQRS 패턴을 도입하여 상태를 변경하는 Command와 데이터를 조회하는 Query 로직을 명확히 분리하고, QueryDSL을 활용해 사용자 권한에 따른 동적 주문 목록 조회 API를 구축',
      'RabbitMQ를 활용한 Event Driven Architecture 및 Saga 패턴을 적용하여, 주문-배송-허브로 이어지는 분산 트랜잭션 환경에서 시스템 간 강한 결합을 끊어내고 장애 전파를 방지',
      'Redis를 활용해 주문 생성 API에 멱등성을 보장하여 중복 요청을 방지하고, 단건 조회에만 선택적으로 캐시를 적용하여 데이터 일관성과 조회 성능을 동시 확보'
    ],
    learnings: [
      'MSA 환경에서 물리적 데이터 분리로 인해 HUB_MANAGER의 주문 조회가 불가능했던 문제를 겪었으나, 비동기 응답 메시지를 통해 검색에 필요한 소속 ID를 Order 엔티티에 복제하고 인덱싱하는 비정규화를 수용하여 조회 성능을 극대화하는 트러블슈팅을 경험했습니다.',
      '주문 생성 시 배송 및 허브 계산까지 모두 동기적으로 처리하려던 초기 구조의 한계(를 인지하고, 큐를 활용한 최종 일관성 구조로 재설계하여 클라이언트가 폴링으로 최종 상태를 확인하도록 API를 개선했습니다.',
      '주문 서비스와 배송 서비스의 책임을 DDD 관점에서 명확히 분리하며, 서비스 간 독립성을 지키고 보상 트랜잭션의 복잡도를 낮추는 이상적인 MSA 설계 방식을 체득했습니다.'
    ]
  },
  {
    title: '공간 예약 공지 자동화 프로그램',
    period: '2025.10 - 2025.12',
    team: '1명 (개인 프로젝트)',
    role: '아키텍처 설계, API 연동 및 데스크톱 앱(GUI) 개발',
    contribution: '기획 100% / 개발 100%',
    links: {}, // 깃허브 링크가 있다면 여기에 추가
    techStack: ['Java 8', 'Swing', 'Jackson', 'Gemini API', 'Power Automate', 'Discord Webhook'],
    features: [
      'PowerAutomate를 활용하여 MS Planner의 일정 데이터를 정기적으로 추출하고 JSON 형식으로 변환하는 자동화 파이프라인 구축',
      'Gemini 2.5 Flash API를 연동하여, 비정형적인 일정 설명 텍스트에서 명확한 장소와 목적을 JSON 형태로 추론 및 추출하는 프롬프트 엔지니어링 적용',
      '기존 예약과의 기간 중복 여부를 검증하고, 우선순위에 따라 공간을 유동적으로 자동 할당하는 PlaceAllocator 알고리즘 구현',
      'Java Swing을 활용하여 AI가 가공한 데이터를 최종 전송 전 사용자가 직접 확인하고 수정할 수 있는 GUI 검증 도구 개발로 데이터 무결성 확보',
      'Discord Webhook API를 연동하여 날짜/요일별로 포맷팅된 공지 메시지를 다중 채널로 일괄 전송하는 기능 구현'
    ],
    learnings: [
      '단순한 스크립트 기반의 자동화를 넘어, Gemini API를 통해 비정형 텍스트를 정형 데이터로 가공하는 지능형 파이프라인 설계 경험을 쌓았습니다.',
      'AI 추론에서 발생할 수 있는 환각이나 데이터 오류 리스크에 대비해, Swing 기반의 검증용 UI를 추가함으로써 시스템의 안정성과 회복력을 확보하는 아키텍처를 체득했습니다.',
      '이기종 플랫폼(MS Planner, Google Gemini, Discord)의 API를 연동하고 Jackson 모듈을 활용하여 복잡한 JSON 데이터를 안전하게 직렬화/역직렬화하는 능력을 길렀습니다.',
      '수동으로 매주 1시간 이상 소요되던 취합 및 공지 업무와 휴먼 에러를 10분 이내의 프로세스로 단축시켜 실질적인 업무 효율성 개선 성과를 경험했습니다.'
    ]
  },
  {
    title: '우리 동네 병원 (위치기반 병원 탐색 및 실시간 상담 서비스)',
    period: '2025.01 - 2025.02',
    team: '3명 (팀장)',
    role: '일정/이슈 관리, API 개발 및 페이지 구현 (회원/QnA게시판)',
    contribution: '백엔드 30% / 프론트엔드 30% / 기획 50%',
    links: {
      github: 'https://github.com/qqqqq7666/UriDongneHostpital',
      youtube: 'https://youtu.be/M2rdB4fV2Io',
      notion: 'https://www.notion.so/1a72dc8f74fd80998765c7c1c7f17484?source=copy_link'
    },
    techStack: ['Java', 'Spring Boot', 'Spring Security', 'JWT', 'OAuth2', 'Kafka', 'MySQL', 'Redis', 'MongoDB', 'AWS EC2'],
    features: [
      'DataHub 의료인 면허 인증 API 연동 및 주민번호 등 민감정보 Base64 암호화 처리',
      'OAuth2 (카카오, 네이버, 구글) 간편 로그인 및 회원가입, JWT(HttpOnly 쿠키 + Redis) 기반 인증 구현',
      'Google SMTP를 활용한 이메일 인증 구현 (URL 전송 방식 및 Redis를 통한 만료 시간 관리)',
      '인증된 의료인과 일반 사용자 간의 QnA 및 실시간 채팅 상담 기능 구현',
      'Axios 인터셉터 로직 모듈화를 통한 인증 토큰 처리 및 에러 핸들링 중앙화'
    ],
    learnings: [
      '세션 인증이 아닌 JWT 토큰 인증 방식을 적용하고, AccessToken은 HttpOnly 쿠키에, RefreshToken은 Redis에 저장하여 보안성과 동시성을 제어하는 방법을 깊이 있게 학습했습니다.',
      'OAuth2LoginAuthenticationFilter 및 OAuth2LoginHandler를 직접 구현하여 로그인 성공/실패에 따른 세밀한 로직 제어를 경험했습니다.',
      'Facade 패턴을 적용하여 여러 Repository가 주입되는 서비스의 복잡도를 낮추고 테스트 코드 작성의 용이성과 가독성을 크게 향상시켰습니다.'
    ]
  },
  {
    title: 'Eclipse (의류 쇼핑몰 웹 서비스)',
    period: '2024.12 - 2025.01',
    team: '5명 (팀장)',
    role: '일정/이슈 관리, 주문/결제/장바구니/포인트 API 및 페이지 개발',
    contribution: '백엔드 40% / 프론트엔드 30% / 기획 20%',
    image: '/src/images/eclipse2.png',
    links: {
      github: 'https://github.com/qqqqq7666/Eclipse',
      youtube: 'https://www.youtube.com/watch?v=NAT9cQk_lrc',
      notion: 'https://www.notion.so/Eclipse-1742dc8f74fd80d2a0d1ddff49d08bd5?source=copy_link'
    },
    techStack: ['Java 21', 'Spring Boot', 'Spring Security', 'JWT', 'OAuth2', 'MySQL', 'Redis', 'AWS EC2'],
    features: [
      'PortOne 통합 결제 API 연동 및 결제 정보 데이터 가공, 카카오 우편번호 찾기 API 연동',
      '주문 상태/사용자 이메일 별 주문 조회 및 구매 확정 시 1% 포인트 자동 적립 로직 구현',
      '포인트 내역(전체/적립/사용) 조회 및 관리자 권한의 포인트 지급/회수 기능 구현',
      '장바구니 상품 정보를 LocalStorage에 저장하고 내부에서 옵션 변경이 가능하도록 구현'
    ],
    learnings: [
      '외부 API(PortOne, 카카오)를 활용해 클라이언트와 백엔드 API 간의 데이터 흐름과 RestController의 실질적인 활용법을 깊이 이해했습니다.',
      '직접 RDB를 설계하고 테이블 간의 관계를 설정하며 여러 시행착오를 통해 효율적인 데이터베이스 구조를 도출했습니다.',
      '프로그램 전반의 테스트 코드를 작성하며 코드 아키텍처 설계의 중요성을 체감했습니다.',
      'GitLab을 활용한 협업과 팀장으로서의 일정/이슈 관리 경험을 통해 프로젝트 최우수상을 수상하는 성과를 이뤘습니다.'
    ]
  }
];

const AWARDS = [
  {
    title: '엘리스 트랙 리더스파크상 (리더십 부문 수상)',
    date: '2025.03.21',
    issuer: '(주)엘리스',
    description: '명확한 비전과 목표로 팀을 이끌어 프로젝트를 성공적으로 완수한 리더십을 인정받아 수상'
  },
  {
    title: '웹서비스 프로젝트 III 대상',
    date: '2025.03',
    issuer: '(주)엘리스',
    description: '엘리스 클라우드 트랙 웹서비스 프로젝트 III 우수 성적 완수'
  },
  {
    title: '웹서비스 프로젝트 II 최우수상',
    date: '2025.01.21',
    issuer: '(주)엘리스',
    description: 'Eclipse 팀 프로젝트의 성공적인 구축 및 우수 성적 달성'
  }
];

// --- 컴포넌트 ---

const ProjectCard = ({ project }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/30">

      {/* 썸네일 이미지 영역
      <div className="w-full h-48 md:h-64 bg-slate-900 border-b border-slate-700 relative group overflow-hidden">
        {project.image ? (
          <img 
            src={project.image} 
            alt={`${project.title} 썸네일`} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 group-hover:scale-105 transform"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-800/50">
            <ImageIcon size={48} className="mb-3 opacity-50" />
            <span className="text-sm font-medium">프로젝트 썸네일 이미지를 등록해주세요</span>
          </div>
        )}
      </div> */}

      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-100">{project.title}</h3>
            <p className="text-slate-400 mt-1">{project.period} | {project.team}</p>
          </div>
          <div className="flex space-x-3">
            {/* Live URL Link 버튼 추가 */}
            {project.links.url && (
              <a href={project.links.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white shadow-lg shadow-indigo-500/20 transition-all tooltip" title="Live Website">
                <ExternalLink size={20} />
              </a>
            )}
            {project.links.github && (
              <a href={project.links.github} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors tooltip" title="GitHub">
                <Github size={20} />
              </a>
            )}
            {project.links.youtube && (
              <a href={project.links.youtube} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors" title="YouTube Demo">
                <Youtube size={20} />
              </a>
            )}
            {project.links.notion && (
              <a href={project.links.notion} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors" title="Trouble Shooting">
                <BookOpen size={20} />
              </a>
            )}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-slate-300 font-medium">담당 역할: <span className="text-indigo-400">{project.role}</span></p>
          <p className="text-slate-400 text-sm mt-1">기여도: {project.contribution}</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {project.techStack.map((tech, idx) => (
            <span key={idx} className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full text-xs font-medium">
              {tech}
            </span>
          ))}
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors w-full justify-between border-t border-slate-700 pt-4"
        >
          <span>프로젝트 상세 내용 보기</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isOpen && (
          <div className="mt-6 space-y-6 animate-in slide-in-from-top-4 fade-in duration-300">
            <div>
              <h4 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
                <CheckCircle size={18} className="mr-2 text-indigo-400" />
                주요 구현 기능
              </h4>
              <ul className="space-y-2">
                {project.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-slate-300 text-sm">
                    <span className="mr-2 mt-1 w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0"></span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
                <Code size={18} className="mr-2 text-indigo-400" />
                프로젝트를 통해 체득한 점
              </h4>
              <ul className="space-y-2">
                {project.learnings.map((learning, idx) => (
                  <li key={idx} className="flex items-start text-slate-300 text-sm bg-slate-700/30 p-3 rounded-lg border border-slate-700/50">
                    <span>{learning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-indigo-500/30">

      {/* Header / Hero Section */}
      <header className="relative pt-24 pb-16 md:pt-32 md:pb-24 px-6 md:px-12 max-w-6xl mx-auto border-b border-slate-800">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
            진경천 <span className="text-2xl md:text-3xl font-bold text-indigo-400 tracking-wide">
              WEB BACKEND DEVELOPER
            </span><br />
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 leading-relaxed mb-8 max-w-2xl">
            일관된 설계 규약으로 팀의 코드 통일성을 확보하고,<br className="hidden md:block" />
            탄탄한 구조 위에서 건강하게 동작하는 서비스를 만듭니다.
          </p>

          <div className="flex flex-wrap gap-4">
            <a href="mailto:rudcjs335@gmail.com" className="flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20">
              <Mail size={18} className="mr-2" />
              Email
            </a>
            <a href="https://github.com/qqqqq7666" target="_blank" rel="noopener noreferrer" className="flex items-center px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium border border-slate-700 transition-all">
              <Github size={18} className="mr-2" />
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-24 space-y-24">

        {/* Skills Section */}
        <section>
          <div className="flex items-center mb-8">
            <Server className="text-indigo-400 mr-3" size={28} />
            <h2 className="text-3xl font-bold text-white">Tech Stack</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SKILLS.map((category, idx) => (
              <div key={idx} className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
                <h3 className={`text-lg font-bold mb-5 flex items-center gap-3 ${category.color}`}>
                  <div className={`p-2 rounded-xl ${category.bgColor}`}>
                    {category.icon}
                  </div>
                  {category.title}
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {category.skills.map((skill, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Projects Section */}
        <section>
          <div className="flex items-center mb-8">
            <Code className="text-indigo-400 mr-3" size={28} />
            <h2 className="text-3xl font-bold text-white">Projects</h2>
          </div>

          <div className="space-y-8">
            {PROJECTS.map((project, idx) => (
              <ProjectCard key={idx} project={project} />
            ))}
          </div>
        </section>

        {/* Load Testing / Performance Section */}
        <section className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-3xl blur-xl -z-10"></div>
          <div className="bg-slate-900/80 p-8 rounded-2xl border border-indigo-500/20 shadow-2xl">
            <div className="flex items-center mb-6">
              <Activity className="text-indigo-400 mr-3" size={28} />
              <h2 className="text-2xl font-bold text-white">대기열 서버 성능 최적화 (Bidket 프로젝트)</h2>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">
              경매 진입 시 발생하는 대규모 트래픽을 제어하기 위해 WebFlux와 Redis 기반의 대기열 시스템을 구축하고,
              Gatling을 활용해 Polling 방식과 SSE 방식의 성능을 비교 검증 및 최적화했습니다.
            </p>

            <div className="mb-8 flex flex-col md:flex-row items-start md:items-center p-5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
              <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-5 p-3 bg-indigo-500/20 rounded-xl">
                <TrendingUp className="text-indigo-400" size={32} />
              </div>
              <div>
                <h4 className="text-xl font-bold text-indigo-300 mb-1">🚀 서버 처리량 80% 이상 증가</h4>
                <p className="text-slate-300 text-sm leading-relaxed">
                  동일한 인프라 환경에서 지속적인 HTTP 요청 병목을 <b>SSE 단방향 스트림</b>과 <b>Lua-Script</b>를 활용하여,
                  <br /><strong className="text-white"> 안정적인 동시 처리 요청 수를 10,000건에서 18,000건으로 80% 이상 향상</strong>시켰으며 에러율을 <strong className="text-emerald-400">0%</strong>로 완벽히 개선했습니다.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800/80 p-6 rounded-xl border border-rose-500/20 flex flex-col">
                <h3 className="text-lg font-semibold text-rose-300 mb-2">기존 방식: Polling (12,000 Requests - 실패 지점)</h3>
                <p className="text-sm text-slate-400 mb-4">지속적인 HTTP 요청으로 인한 서버 리소스 낭비 및 에러 발생</p>
                <div className="mb-5 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                  <img src="/src/images/polling_12000.png" alt="Polling 부하 테스트 결과" className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" />
                </div>
                <ul className="text-sm text-slate-300 space-y-2 mt-auto">
                  <li>• Total Requests: 703,479건</li>
                  <li>• KO (실패): <span className="text-rose-400 font-bold">1,590건 발생</span></li>
                  <li>• 이슈: <code className="bg-slate-900 px-1 py-0.5 rounded text-rose-300">Address already in use</code> 소켓 고갈 에러</li>
                  <li>• 평균 응답 시간: 264ms</li>
                </ul>
              </div>

              <div className="bg-slate-800/80 p-6 rounded-xl border border-emerald-500/20 flex flex-col">
                <h3 className="text-lg font-semibold text-emerald-300 mb-2">개선 방식: SSE 도입 (18,000 Requests)</h3>
                <p className="text-sm text-slate-400 mb-4">단방향 이벤트 스트림(Server-Sent Events)으로 트래픽 최적화</p>
                <div className="mb-5 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                  <img src="/src/images/sse_18000.png" alt="SSE 부하 테스트 결과" className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" />
                </div>
                <ul className="text-sm text-slate-300 space-y-2 mt-auto">
                  <li>• SSE Connect: 18,000건 성공 <span className="inline-block ml-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full">↑ 80% 성능 증가</span></li>
                  <li>• KO (실패): <span className="text-emerald-400 font-bold">0건</span></li>
                  <li>• 개선점: 불필요한 HTTP Handshake 제거로 서버 부하 극적 감소</li>
                  <li>• 평균 응답 시간: <span className="text-emerald-400 font-bold">15ms ~ 34ms</span> 이내로 단축</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Awards Section */}
        <section>
          <div className="flex items-center mb-8">
            <Award className="text-indigo-400 mr-3" size={28} />
            <h2 className="text-3xl font-bold text-white">Awards</h2>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {AWARDS.map((award, idx) => (
              <div key={idx} className={`p-6 flex flex-col md:flex-row md:items-center justify-between ${idx !== AWARDS.length - 1 ? 'border-b border-slate-700' : ''}`}>
                <div className="mb-4 md:mb-0">
                  <h3 className="text-lg font-bold text-slate-200 flex items-center">
                    {idx === 0 && <Award size={18} className="text-yellow-500 mr-2" />}
                    {award.title}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{award.description}</p>
                </div>
                <div className="text-left md:text-right shrink-0">
                  <div className="text-indigo-400 font-medium">{award.date}</div>
                  <div className="text-slate-500 text-sm">{award.issuer}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}