import type { RiskLevel, TaskStatus } from "@prisma/client";
import { buildConversationMetadata } from "./project-conversations";

type DepartmentAgent = {
  slug: string;
  name: string;
  department: string;
  role: string;
  channel: string;
  keywords: string[];
};

export type HqDelegationTaskPlan = {
  agentSlug: string;
  department: string;
  title: string;
  summary: string;
  nextAction: string;
  status: TaskStatus;
  riskLevel: RiskLevel;
  metadata: Record<string, string>;
};

export type HqDiscordReportPlan = {
  channel: string;
  message: string;
  metadata: Record<string, string>;
};

export type HqOrchestrationPlan = {
  runId: string;
  parentSummary: string;
  delegations: HqDelegationTaskPlan[];
  discordReports: HqDiscordReportPlan[];
};

export const HQ_DEPARTMENT_AGENTS: DepartmentAgent[] = [
  { slug: "main-agent", name: "Main Ops Agent", department: "main", role: "공통 운영/라우팅/동기화", channel: "main", keywords: ["운영", "라우팅", "동기화", "정리", "handoff", "핸드오프"] },
  { slug: "research-agent", name: "Research Agent", department: "research", role: "조사/근거/후보/스코프", channel: "research", keywords: ["조사", "리서치", "research", "분석", "근거", "후보", "scope", "스코프", "시장", "자료"] },
  { slug: "projects-agent", name: "Projects Agent", department: "projects", role: "프로젝트 보드/마일스톤/blocker", channel: "projects", keywords: ["프로젝트", "일정", "마일스톤", "milestone", "blocker", "블로커", "보드", "관리"] },
  { slug: "dev-agent", name: "Dev Agent", department: "dev", role: "구현/자동화/검증", channel: "dev", keywords: ["구현", "코드", "개발", "dev", "자동화", "테스트", "검증", "배포", "앱", "콘솔"] },
  { slug: "content-agent", name: "Content Agent", department: "content", role: "카피/랜딩/아웃리치", channel: "content", keywords: ["콘텐츠", "content", "카피", "랜딩", "아웃리치", "메일", "글", "포스트", "홍보"] },
  { slug: "design-agent", name: "Design Agent", department: "design", role: "UI/UX/DESIGN.md/FE handoff", channel: "design", keywords: ["design", "디자인", "ui", "ux", "화면", "와이어", "wireframe", "handoff", "핸드오프", "접근성", "컴포넌트"] },
  { slug: "docs-agent", name: "Docs Agent", department: "docs", role: "문서/로그/최종 보고", channel: "docs", keywords: ["문서", "docs", "가이드", "로그", "보고", "리포트", "정리", "아카이브"] }
];

function slugStamp(now: Date) {
  return now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function selectDepartmentsForInstruction(instruction: string): DepartmentAgent[] {
  const lowered = instruction.toLowerCase();
  if (["전체", "모든", "전부", "컴퍼니", "company"].some((word) => lowered.includes(word))) {
    return HQ_DEPARTMENT_AGENTS;
  }

  const selected = HQ_DEPARTMENT_AGENTS.filter((agent) => includesAny(lowered, agent.keywords));
  if (selected.length > 0) {
    if (!selected.some((agent) => agent.slug === "docs-agent")) {
      selected.push(HQ_DEPARTMENT_AGENTS.find((agent) => agent.slug === "docs-agent")!);
    }
    return selected;
  }

  return HQ_DEPARTMENT_AGENTS.filter((agent) => ["research-agent", "dev-agent", "docs-agent"].includes(agent.slug));
}

export function planHqOrchestration(instruction: string, actorEmail: string, now = new Date(), projectSlug = "ops-console"): HqOrchestrationPlan {
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error("instruction_required");

  const runId = `hq-${slugStamp(now)}`;
  const selected = selectDepartmentsForInstruction(trimmed);
  const parentSummary = `HQ 오케스트레이션: ${trimmed}`;

  const delegations = selected.map((agent) => ({
    agentSlug: agent.slug,
    department: agent.department,
    title: `HQ 위임 · ${agent.name}`,
    summary: `${agent.role} 관점에서 처리: ${trimmed}`,
    nextAction: `${agent.department} 채널/에이전트에서 작업 착수 후 산출물 또는 진행 이벤트 기록`,
    status: "queued" as TaskStatus,
    riskLevel: "low" as RiskLevel,
    metadata: {
      type: "hq_delegation_subtask",
      orchestrationRunId: runId,
      parentAgent: "hq-agent",
      department: agent.department,
      discordChannel: agent.channel,
      requestedBy: actorEmail,
      ...buildConversationMetadata({ projectSlug, agentSlug: agent.slug, workstream: runId })
    }
  }));

  const startedMessage = [
    "상태: HQ 오케스트레이션 등록",
    `작업: ${trimmed}`,
    `분배: ${selected.map((agent) => agent.department).join(", ")}`,
    "게이트: 외부 제출/지갑/결제/실거래/high-risk는 수동 승인 유지"
  ].join("\n");

  const discordReports = [
    {
      channel: "hq",
      message: startedMessage,
      metadata: {
        type: "discord_report",
        stage: "delegation_completed",
        orchestrationRunId: runId,
        requestedBy: actorEmail,
        childTaskCount: String(selected.length),
        departments: selected.map((agent) => agent.department).join(","),
        ...buildConversationMetadata({ projectSlug, agentSlug: "hq-agent", workstream: runId })
      }
    }
  ];

  return { runId, parentSummary, delegations, discordReports };
}
