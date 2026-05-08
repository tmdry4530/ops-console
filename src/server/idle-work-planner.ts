import type { RiskLevel, TaskStatus } from "@prisma/client";

export type IdleCompanyWorkPlannerInput = {
  activeAutonomousTasks: number;
  existingRunSlugs: string[];
};

export type PlannedStandingTask = {
  slug: string;
  title: string;
  status: TaskStatus;
  riskLevel: RiskLevel;
  summary: string;
  nextAction: string;
  agentSlug: string;
};

export type IdleCompanyWorkPlan = {
  runSlug: string;
  parentTask: Omit<PlannedStandingTask, "agentSlug"> & { agentSlug: "hq-agent" };
  childTasks: PlannedStandingTask[];
};

type StandingDepartment = {
  agentSlug: string;
  department: string;
  title: string;
  summary: string;
};

const STANDING_DEPARTMENTS: StandingDepartment[] = [
  {
    agentSlug: "main-agent",
    department: "main",
    title: "Main · 회사 운영 상태 triage",
    summary: "최근 이벤트/프로젝트/승인/큐를 점검하고 오늘 바로 진행 가능한 내부 작업을 정리한다."
  },
  {
    agentSlug: "research-agent",
    department: "research",
    title: "Research · 새 기회/리스크 후보 탐색",
    summary: "공개 정보와 기존 Company 지식 기준으로 수익/제품/보안 리서치 후보를 갱신한다. 외부 접촉은 하지 않는다."
  },
  {
    agentSlug: "projects-agent",
    department: "projects",
    title: "Projects · blocker/다음 액션 갱신",
    summary: "진행 중 프로젝트의 blocker, 다음 액션, 우선순위를 점검하고 콘솔 산출물로 남긴다."
  },
  {
    agentSlug: "dev-agent",
    department: "dev",
    title: "Dev · 자동화/검증 개선 후보 구현",
    summary: "Ops Console/Company workflow에서 안전하게 개선 가능한 자동화, 테스트, 관측성 작업을 찾아 구현 또는 제안한다."
  },
  {
    agentSlug: "content-agent",
    department: "content",
    title: "Content · 승인팩/카피 초안 보강",
    summary: "수익 파이프라인/제품 설명/아웃리치 승인팩을 내부 초안 수준으로 보강한다. 외부 발송은 하지 않는다."
  },
  {
    agentSlug: "trading-agent",
    department: "trading",
    title: "Trading · 오를만한 알트 후보 선별",
    summary: "거래소 공개 데이터의 가격/거래량/OI/펀딩비/롱숏/상대강도를 기준으로 오를만한 알트 후보를 점수화한다. 실거래/주문은 하지 않는다."
  },
  {
    agentSlug: "docs-agent",
    department: "docs",
    title: "Docs · 운영 로그/결정사항 정리",
    summary: "오늘 생성된 산출물, 의사결정, 다음 액션을 dom-company식 운영 지식으로 정리한다."
  }
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function standingWorkRunSlug(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = pad2(now.getUTCMonth() + 1);
  const day = pad2(now.getUTCDate());
  const hour = pad2(now.getUTCHours());
  const minute = pad2(now.getUTCMinutes());
  const second = pad2(now.getUTCSeconds());
  return `company-standing-work-${year}${month}${day}-${hour}${minute}${second}`;
}

function standingWorkTitleTime(now: Date): string {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())} ${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:${pad2(now.getUTCSeconds())}Z`;
}

export function planIdleCompanyWork(input: IdleCompanyWorkPlannerInput, now = new Date()): IdleCompanyWorkPlan | null {
  const runSlug = standingWorkRunSlug(now);
  if (input.activeAutonomousTasks > 0) return null;
  if (input.existingRunSlugs.includes(runSlug)) return null;

  const titleTime = standingWorkTitleTime(now);
  return {
    runSlug,
    parentTask: {
      slug: runSlug,
      title: `Company 자동 업무 생성 · ${titleTime}`,
      status: "running",
      riskLevel: "low",
      summary: "Company 에이전트가 idle 상태라 안전한 내부 standing work를 자동 생성했다.",
      nextAction: "자동 생성된 부서별 내부 업무 진행 중",
      agentSlug: "hq-agent"
    },
    childTasks: STANDING_DEPARTMENTS.map((department) => ({
      slug: `${runSlug}-${department.department}`,
      title: department.title,
      status: "running",
      riskLevel: "low",
      summary: department.summary,
      nextAction: "자율 worker가 산출물/진행 이벤트 생성 대기",
      agentSlug: department.agentSlug
    }))
  };
}
