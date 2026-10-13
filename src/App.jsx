import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Github, Mail, ExternalLink, Youtube, BookOpen, ChevronDown } from 'lucide-react';

// PDF 링크는 절대 URL이어야 열리므로 GitHub raw 주소를 사용
const IMG_BASE = import.meta.env.VITE_IMG_BASE ?? 'https://raw.githubusercontent.com/qqqqq7666/portfolio/main/public';

// 인쇄(PDF 저장) 중에는 접힌 카드/details를 모두 펼침
const usePrinting = () => {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => flushSync(() => setPrinting(true));
    const off = () => setPrinting(false);
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    return () => {
      window.removeEventListener('beforeprint', on);
      window.removeEventListener('afterprint', off);
    };
  }, []);
  return printing;
};

const ZoomableImage = ({ src, alt, className = '' }) => (
  <a href={IMG_BASE + src} target="_blank" rel="noopener noreferrer" title="클릭하면 원본 이미지가 열립니다" className="block cursor-zoom-in">
    <img src={src} alt={alt} loading="lazy" className={className} />
  </a>
);

// --- 데이터 정의 ---

// 프로젝트 전반에서 실제로 반복 사용한 핵심 스택만 유지
const SKILLS = [
  { title: 'Backend', color: 'text-blue-400', skills: ['Java 21', 'Spring Boot 3', 'Spring Security', 'Spring Data JPA', 'WebFlux'] },
  { title: 'Data', color: 'text-emerald-400', skills: ['Redis', 'PostgreSQL', 'MySQL'] },
  { title: 'Architecture', color: 'text-purple-400', skills: ['MSA', 'Event-Driven', 'Kafka', 'RabbitMQ'] },
  { title: 'Infra & Test', color: 'text-orange-400', skills: ['Docker', 'AWS EC2', 'Gatling'] }
];

// 대표 프로젝트: 접힌 상태에서도 summary 한 줄로 핵심이 읽히도록 구성
const MAIN_PROJECTS = [
  {
    title: 'TRINIONE',
    desc: '부동산 매물 홍보 랜딩 및 관리자 대시보드',
    period: '2026.04 - 2026.06',
    team: '1명 (개인)',
    role: '풀스택 개발',
    summary: 'Spring Boot로 1차 구축 후 Hono + Cloudflare Workers 서버리스로 마이그레이션, 상시 서버·DB 운영비 0원 (무료 티어 내 운영)',
    links: { url: 'https://trinione.com/' },
    diagram: '/images/active_diagram/Trinione_API_activity.png',
    techStack: ['TypeScript', 'React 19', 'Tailwind CSS 4', 'Hono', 'Cloudflare Workers', 'D1', 'R2', 'Drizzle ORM'],
    features: [
      'React 19 + Tailwind 4 반응형 랜딩 및 문의 접수 폼',
      'Hono + Cloudflare Workers 엣지 API, D1/R2를 Drizzle ORM으로 연동',
      'JWT 관리자 대시보드(/admin)에서 매물·문의 CRUD',
      'Zod 유효성 검사, Resend API 이메일 알림'
    ],
    points: [
      '도메인 규칙과 API 명세를 익숙한 Spring Boot로 먼저 확정한 뒤, 이를 기준으로 TypeScript/Hono로 이전. 코드 변환에는 AI 도구(Claude, GPT 등)를 활용해 새 스택 적응 기간 단축',
      '24시간 상시 서버 대신 요청 시에만 실행되는 엣지 런타임으로 서버·DB 상시 운영비 제거',
      'D1 Rows Read 폭증 원인을 실행 계획 분석으로 찾아 인덱스 추가로 해결 (하단 Troubleshooting 참고)'
    ]
  },
  {
    title: 'Bidket',
    desc: 'MSA 기반 C2C 경매 이커머스',
    period: '2026.01 - 2026.03',
    team: '4명 (팀장)',
    role: 'Gateway·대기열 시스템 설계 및 최적화, 이벤트 정합성 처리',
    summary: 'Redis ZSet 대기열, Polling → SSE 전환으로 동시 처리 10,000 → 18,000건 (+80%), 에러율 0%',
    links: {
      github: 'https://github.com/Bidket',
      youtube: 'https://youtu.be/_knYIgr7G8c',
      notion: 'https://www.notion.so/Bidket-2df2dc8f74fd81beb86aefdef217ddc9?source=copy_link'
    },
    diagram: '/images/active_diagram/Bidket_activity.png',
    techStack: ['Java', 'Spring Boot', 'Spring Cloud', 'WebFlux', 'R2DBC', 'Kafka', 'PostgreSQL', 'Redis', 'Docker'],
    features: [
      'Spring Cloud Gateway + WebFlux 기반 논블로킹 트래픽 처리',
      'Redis ZSet 대기열: 진입 순서 보장, 최대 수용 인원 및 초당 진입 수 동적 조절',
      'Heartbeat API로 비활동 유저 자동 퇴출 후 대기자 입장',
      'Outbox Pattern + DLT로 분산 환경 데이터 정합성 보장'
    ],
    points: [
      'Heartbeat 갱신 시 Hash 전체 만료 시간이 연장되던 문제를 ZSet Score 기반으로 변경해 해결',
      'Gatling 부하 테스트로 Polling의 소켓 고갈을 확인하고 SSE로 전환 (하단 Troubleshooting 참고)'
    ]
  },
  {
    title: 'Sparta Logistics',
    desc: 'MSA 기반 물류 배송 및 주문 관리 플랫폼',
    period: '2025.11',
    team: '5명 (팀원)',
    role: '주문 시스템 개발, 비동기 트랜잭션 설계',
    summary: 'CQRS, RabbitMQ 이벤트 기반 Saga, Redis 멱등성. 동기 처리 구조를 최종 일관성으로 재설계',
    links: {
      github: 'https://github.com/sparta-logitics/sparta_logistics/tree/dev/order-service',
      notion: 'https://www.notion.so/13-Code-Cargo-2df2dc8f74fd81ab80f2d6e175ea1b74?pvs=12'
    },
    diagram: '/images/active_diagram/sparta_logitics_activity.png',
    techStack: ['Java', 'Spring Boot', 'JPA', 'QueryDSL', 'RabbitMQ', 'Redis', 'PostgreSQL'],
    features: [
      'CQRS 분리 + QueryDSL로 사용자 권한별 동적 주문 목록 조회 API',
      'RabbitMQ EDA + Saga로 주문-배송-허브 분산 트랜잭션 처리, 서비스 간 결합 및 장애 전파 차단',
      'Redis로 주문 생성 멱등성 보장, 단건 조회에만 선택적 캐시 적용'
    ],
    points: [
      '허브 정보가 다른 서비스 DB에 있어 HUB_MANAGER가 주문을 조회하지 못하던 문제를, 비동기 응답으로 받은 소속 허브 ID를 Order에 복제·인덱싱해 해결',
      '배송·허브 계산까지 동기 처리하던 주문 생성을 큐 기반 최종 일관성으로 재설계. 생성 직후 1회성 결과 확인이라 SSE 연결 유지 대신 폴링으로 충분하다고 판단'
    ]
  }
];

// 그 외 프로젝트: 한 줄 요약 위주
const OTHER_PROJECTS = [
  {
    title: '공간 예약 공지 자동화',
    desc: 'Java 데스크톱 앱',
    period: '2025.10 - 2025.12',
    team: '1명 (개인)',
    role: '설계 및 개발',
    summary: 'Gemini로 일정 텍스트를 정형화하고 검증 GUI를 거쳐 Discord 공지. 주 1시간 이상 수작업을 10분 이내로 단축',
    links: {},
    techStack: ['Java 8', 'Swing', 'Jackson', 'Gemini API', 'Power Automate', 'Discord Webhook'],
    features: [
      'Power Automate로 MS Planner 일정 추출, JSON 파이프라인 구축',
      'Gemini 2.5 Flash로 비정형 설명에서 장소·목적 추출, 중복 검증 후 PlaceAllocator로 우선순위 기반 자동 배정',
      'AI 환각에 대비한 Swing 검증 GUI, Discord Webhook 다채널 일괄 공지'
    ],
    points: []
  },
  {
    title: '우리 동네 병원',
    desc: '위치기반 병원 탐색 및 의료인 상담',
    period: '2025.01 - 2025.02',
    team: '3명 (팀장)',
    role: '팀 리더(일정·이슈 관리), 회원·인증·QnA 상담·면허 인증 개발',
    summary: 'OAuth2 + JWT(HttpOnly 쿠키, Redis) 인증, 의료인 QnA 상담 (웹서비스 프로젝트 III 대상)',
    links: {
      github: 'https://github.com/qqqqq7666/UriDongneHostpital',
      youtube: 'https://youtu.be/M2rdB4fV2Io',
      notion: 'https://www.notion.so/1a72dc8f74fd80998765c7c1c7f17484?source=copy_link'
    },
    diagram: '/images/active_diagram/UriDongneHospital_activity.png',
    techStack: ['Java', 'Spring Boot', 'Spring Security', 'JWT', 'OAuth2', 'MySQL', 'Redis', 'AWS EC2'],
    features: [
      'Spring Security + JWT(Access Token은 HttpOnly 쿠키, Refresh Token은 Redis 저장), OAuth2(카카오/네이버/구글) 로그인',
      'DataHub 의료인 면허 인증 API 연동, 민감정보 AES-256(CBC) 암호화 후 전송',
      'Google SMTP + Thymeleaf 템플릿 이메일 인증, 인증 코드는 Redis TTL 5분으로 만료 관리',
      'QnA(상담-의료인 답변) API: 작성자 검증, 답변이 달린 상담은 수정·삭제 차단'
    ],
    points: [
      'OAuth2 로그인 필터·핸들러 직접 구현으로 성공/실패 로직 제어',
      '서비스를 조회(Retrieve)·변경(Management)으로 분리하고 Facade로 묶어 다중 Repository 의존에 따른 복잡도와 테스트 부담 완화'
    ]
  },
  {
    title: 'Eclipse',
    desc: '의류 쇼핑몰 웹 서비스',
    period: '2024.12 - 2025.01',
    team: '5명 (팀장)',
    role: '일정/이슈 관리, 주문·결제·장바구니·포인트 개발',
    summary: 'PortOne 결제, 주문, 포인트 API 개발. (웹서비스 프로젝트 II 최우수상)',
    links: {
      github: 'https://github.com/qqqqq7666/Eclipse',
      youtube: 'https://www.youtube.com/watch?v=NAT9cQk_lrc',
      notion: 'https://www.notion.so/Eclipse-1742dc8f74fd80d2a0d1ddff49d08bd5?source=copy_link'
    },
    diagram: '/images/active_diagram/Eclipse_activity.png',
    techStack: ['Java 21', 'Spring Boot', 'Spring Security', 'JWT', 'OAuth2', 'MySQL', 'Redis', 'AWS EC2'],
    features: [
      'PortOne 통합 결제 및 카카오 우편번호 API 연동',
      '주문 조회, 구매 확정 시 1% 포인트 자동 적립, 관리자 포인트 지급/회수',
      '장바구니 LocalStorage 저장 및 옵션 변경',
      'Google OAuth2 로그인 및 추가 정보 입력 가입 연동'
    ],
    points: [
      'PortOne, 카카오 외부 API 연동으로 클라이언트-백엔드 간 데이터 흐름 설계',
      '주문·결제·포인트 테이블 관계를 직접 설계',
      'GitLab에서 협업(현재 GitHub로 이관), 팀장으로서 일정·이슈 관리'
    ]
  }
];

const AWARDS = [
  { title: '리더스파크상 (리더십)', date: '2025.03' },
  { title: '웹서비스 프로젝트 III 대상 (우리 동네 병원)', date: '2025.03' },
  { title: '웹서비스 프로젝트 II 최우수상 (Eclipse)', date: '2025.01' }
];

// --- 컴포넌트 ---

const IconLink = ({ href, title, primary, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    title={title}
    className={`p-1.5 rounded-md transition-colors ${
      primary ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
    }`}
  >
    {children}
  </a>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-xl font-bold text-white mb-4">{children}</h2>
);

const ProjectCard = ({ project, sub = false }) => {
  const [openState, setOpen] = useState(false);
  const printing = usePrinting();
  const open = openState || printing;
  const { links } = project;

  return (
    <div className="bg-slate-900/60 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen(!openState)}
          aria-expanded={open}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className={`font-bold text-slate-100 ${sub ? 'text-base' : 'text-lg'}`}>{project.title}</h3>
            <span className="text-sm text-slate-500">{project.desc}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {project.period} | {project.team} | {project.role}
          </p>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">{project.summary}</p>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {links.url && (
            <IconLink href={links.url} title="라이브 사이트" primary>
              <ExternalLink size={16} />
            </IconLink>
          )}
          {links.github && (
            <IconLink href={links.github} title="GitHub">
              <Github size={16} />
            </IconLink>
          )}
          {links.youtube && (
            <IconLink href={links.youtube} title="YouTube 시연">
              <Youtube size={16} />
            </IconLink>
          )}
          {links.notion && (
            <IconLink href={links.notion} title="Notion 문서">
              <BookOpen size={16} />
            </IconLink>
          )}
          <button
            type="button"
            onClick={() => setOpen(!openState)}
            aria-label={open ? '상세 접기' : '상세 보기'}
            className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
          >
            <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {project.techStack.map((tech) => (
              <span key={tech} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[11px]">
                {tech}
              </span>
            ))}
          </div>

          <ul className="space-y-1 text-sm text-slate-300">
            {project.features.map((f) => (
              <li key={f} className="flex items-start">
                <span className="mr-2 mt-2 w-1 h-1 bg-indigo-400 rounded-full shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {project.points.length > 0 && (
            <div className="bg-slate-800/50 rounded-md p-3">
              <p className="text-xs font-semibold text-slate-400 mb-1">핵심 포인트</p>
              <ul className="space-y-1 text-sm text-slate-300">
                {project.points.map((p) => (
                  <li key={p} className="flex items-start">
                    <span className="mr-2 mt-2 w-1 h-1 bg-slate-500 rounded-full shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project.diagram && (
            <details open={printing || undefined}>
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors">
                활동 다이어그램 보기 <span className="text-slate-600">(클릭하면 원본)</span>
              </summary>
              <div className="mt-3">
                <ZoomableImage
                  src={project.diagram}
                  alt={`${project.title} 활동 다이어그램`}
                  className="w-full h-auto rounded-md border border-slate-800"
                />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

const PollingVsSse = () => {
  const printing = usePrinting();
  return (
  <div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-slate-500 text-xs">
          <tr>
            <th className="py-1.5 pr-4 font-medium"></th>
            <th className="py-1.5 pr-4 font-medium">Polling (12,000명)</th>
            <th className="py-1.5 font-medium">SSE (18,000명)</th>
          </tr>
        </thead>
        <tbody className="text-slate-300 divide-y divide-slate-800">
          <tr>
            <td className="py-1.5 pr-4 text-slate-500">요청 결과</td>
            <td className="py-1.5 pr-4">Total 703,479건</td>
            <td className="py-1.5">Connect 18,000건 성공</td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-500">실패 (KO)</td>
            <td className="py-1.5 pr-4 text-rose-400">1,590건 (Address already in use)</td>
            <td className="py-1.5 text-emerald-400">0건</td>
          </tr>
          <tr>
            <td className="py-1.5 pr-4 text-slate-500">평균 응답 시간</td>
            <td className="py-1.5 pr-4">264ms</td>
            <td className="py-1.5 text-emerald-400">15 ~ 34ms</td>
          </tr>
        </tbody>
      </table>
    </div>
    <details className="mt-3" open={printing || undefined}>
      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors">
        부하 테스트 캡처 보기 <span className="text-slate-600">(클릭하면 원본)</span>
      </summary>
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <figure className="rounded-md border border-rose-500/30 overflow-hidden">
          <figcaption className="px-3 py-1.5 bg-rose-500/10 text-xs text-rose-300">
            <span className="font-semibold">Before: Polling</span> (12,000명, KO 1,590건)
          </figcaption>
          <ZoomableImage src="/images/polling_12000.png" alt="Polling 부하 테스트 결과" className="w-full h-auto" />
        </figure>
        <figure className="rounded-md border border-emerald-500/30 overflow-hidden">
          <figcaption className="px-3 py-1.5 bg-emerald-500/10 text-xs text-emerald-300">
            <span className="font-semibold">After: SSE</span> (18,000명, KO 0건)
          </figcaption>
          <ZoomableImage src="/images/sse_18000.png" alt="SSE 부하 테스트 결과" className="w-full h-auto" />
        </figure>
      </div>
    </details>
  </div>
  );
};

const INDEX_SQL = `CREATE INDEX idx_property_search
ON p_property (is_visible, property_type, created_at DESC);

CREATE INDEX idx_property_image_pid_sort
ON p_property_image (property_id, sort_order);

CREATE INDEX idx_property_tag_pid
ON p_property_tag (property_id);`;

const ISSUES = [
  {
    title: 'Polling → SSE 전환, 대기열 처리량 개선',
    project: 'Bidket',
    summary: '동시 처리 10,000 → 18,000건 (+80%), 에러율 0%. Gatling 부하 테스트로 Polling의 한계를 확인하고 SSE로 전환',
    rows: [
      { label: '문제', content: '폴링 방식은 10,000명까지 KO 0건이었으나 12,000명 부하 테스트에서 상태 조회 요청이 전체의 94%(65만 건)를 차지했고, 잦은 커넥션 생성으로 KO 1,590건(Address already in use) 발생' },
      { label: '해결', content: 'SSE 단방향 스트림으로 전환해 반복 요청과 연결 생성·해제 제거, Redis Lua Script로 대기열 연산의 원자성 보장' }
    ],
    extra: <PollingVsSse />
  },
  {
    title: 'D1 Rows Read 폭증, 인덱스 튜닝',
    project: 'TRINIONE',
    summary: '매물 200건인데 Rows read 4.7억. 실행 계획 분석 후 인덱스 3개로 풀 스캔과 Temp B-Tree 제거',
    rows: [
      {
        label: '문제',
        content: 'D1 무료 한도(일 5M Rows Read) 초과 경고. 데이터 200여 건인데 Rows read는 472.58M, 매물 목록 쿼리는 54회 실행에 14.67M 발생'
      },
      {
        label: '원인',
        content: [
          '매물 조회 조건(is_visible, property_type)에 인덱스가 없어 풀 스캔',
          '이미지·태그 상관 서브쿼리가 property_id 인덱스 없이 매물 수만큼 반복 풀 스캔',
          'ORDER BY 인덱스 부재로 Temp B-Tree 정렬 발생'
        ]
      },
      { label: '해결', content: '조건, 정렬, 서브쿼리 컬럼 기준 인덱스 3개 생성', code: INDEX_SQL },
      {
        label: '결과',
        content: '실행 계획이 SCAN에서 SEARCH로 전환, 스캔량이 반환 건수 수준으로 감소 (99.9% 이상 절감)'
      },
      {
        label: '배운 점',
        content: '쿼리 패턴과 인덱스 전략은 세트로 설계. 상관 서브쿼리도 DB 내부 N+1이라 인덱스가 없으면 I/O가 급증'
      }
    ]
  }
];

const IssueCard = ({ issue }) => {
  const [openState, setOpen] = useState(false);
  const printing = usePrinting();
  const open = openState || printing;

  return (
    <div className="bg-slate-900/60 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
      <button
        type="button"
        onClick={() => setOpen(!openState)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-base font-bold text-slate-100">{issue.title}</h3>
            <span className="text-sm text-slate-500">{issue.project}</span>
          </div>
          <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{issue.summary}</p>
        </div>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
          <dl className="space-y-2 text-sm">
            {issue.rows.map((r) => (
              <div key={r.label} className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="w-14 shrink-0 text-slate-500">{r.label}</dt>
                <dd className="min-w-0 flex-1 text-slate-300 leading-relaxed">
                  {Array.isArray(r.content) ? (
                    <ul className="space-y-1">
                      {r.content.map((c) => (
                        <li key={c} className="flex items-start">
                          <span className="mr-2 mt-2 w-1 h-1 bg-slate-500 rounded-full shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    r.content
                  )}
                  {r.code && (
                    <pre className="mt-2 overflow-x-auto bg-slate-950 border border-slate-800 rounded-md p-3 text-xs text-slate-300 leading-relaxed">
                      <code>{r.code}</code>
                    </pre>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {issue.extra}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-indigo-500/30">
      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 border-b border-slate-800">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          진경천{' '}
          <span className="text-lg md:text-xl font-bold text-indigo-400 tracking-wide">WEB BACKEND DEVELOPER</span>
        </h1>
        <p className="text-base md:text-lg text-slate-400 leading-relaxed mt-4 max-w-2xl">
          문제의 원인을 끝까지 파고들어 해결하는 백엔드 개발자입니다.
          <br className="hidden md:block" />
          성능과 운영 비용, 팀의 협업까지 함께 생각합니다.
        </p>
        <div className="flex gap-3 mt-5">
          <a
            href="mailto:rudcjs335@gmail.com"
            className="flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Mail size={16} className="mr-2" />
            Email
          </a>
          <a
            href="https://github.com/qqqqq7666"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-sm font-medium border border-slate-700 transition-colors"
          >
            <Github size={16} className="mr-2" />
            GitHub
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        {/* Tech Stack */}
        <section>
          <SectionTitle>Tech Stack</SectionTitle>
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg divide-y divide-slate-800">
            {SKILLS.map((cat) => (
              <div key={cat.title} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 px-4 py-2.5">
                <span className={`w-32 shrink-0 text-sm font-semibold ${cat.color}`}>{cat.title}</span>
                <div className="flex flex-wrap gap-1.5">
                  {cat.skills.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section>
          <SectionTitle>Projects</SectionTitle>
          <div className="space-y-3">
            {MAIN_PROJECTS.map((p) => (
              <ProjectCard key={p.title} project={p} />
            ))}
          </div>

          <h3 className="text-sm font-semibold text-slate-400 mt-8 mb-3">Other Projects</h3>
          <div className="space-y-2">
            {OTHER_PROJECTS.map((p) => (
              <ProjectCard key={p.title} project={p} sub />
            ))}
          </div>
        </section>

        {/* Troubleshooting */}
        <section>
          <SectionTitle>Troubleshooting</SectionTitle>
          <div className="space-y-3">
            {ISSUES.map((issue) => (
              <IssueCard key={issue.title} issue={issue} />
            ))}
          </div>
        </section>

        {/* Awards */}
        <section>
          <SectionTitle>Awards</SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-slate-500">(주)엘리스 SW 트랙 수상</p>
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg divide-y divide-slate-800">
            {AWARDS.map((a) => (
              <div key={a.title} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-200">{a.title}</span>
                <span className="text-slate-500 shrink-0 ml-4">{a.date}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}