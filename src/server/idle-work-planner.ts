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
    title: "Main · ops-console/alpha-terminal 운영 상태 triage",
    summary: "Company active scope를 ops-console/alpha-terminal로만 한정해 최근 이벤트/프로젝트/승인/큐를 점검한다. 다른 작업 라인은 조회·보고·생성하지 않는다."
  },
  {
    agentSlug: "research-agent",
    department: "research",
    title: "Research · ops-console/alpha-terminal 내부 근거 점검",
    summary: "ops-console/alpha-terminal 관련 내부 제품·운영 근거만 점검한다. 다른 작업 라인의 리서치·후보·승인팩은 조회·생성하지 않는다."
  },
  {
    agentSlug: "projects-agent",
    department: "projects",
    title: "Projects · active project blocker/다음 액션 갱신",
    summary: "active project는 ops-console/alpha-terminal만 대상으로 blocker, 다음 액션, 우선순위를 점검하고 콘솔 산출물로 남긴다."
  },
  {
    agentSlug: "dev-agent",
    department: "dev",
    title: "Dev · ops-console/alpha-terminal 안전 내부 개선",
    summary: "ops-console/alpha-terminal workflow에서 안전하게 개선 가능한 자동화, 테스트, 관측성 작업을 구현 또는 제안한다. 배포/외부 실행은 하지 않는다."
  },
  {
    agentSlug: "docs-agent",
    department: "docs",
    title: "Docs · 운영 로그/결정사항 정리",
    summary: "ops-console/alpha-terminal 범위의 산출물, 의사결정, 다음 액션만 dom-company식 운영 지식으로 정리한다. Auth/Crypto Signal은 별도 시스템으로 기록한다."
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
