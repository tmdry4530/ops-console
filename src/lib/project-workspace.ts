export const PROJECT_WORKSPACE_ROLE_ORDER = [
  "lead",
  "research",
  "design",
  "dev",
  "qa",
  "docs",
  "ops"
] as const;

export type ProjectWorkspaceRoleKey = typeof PROJECT_WORKSPACE_ROLE_ORDER[number];

export type ProjectWorkspaceStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting_approval"
  | "blocked"
  | "failed"
  | "completed"
  | "unassigned";

export type ProjectWorkspaceRole = {
  key: ProjectWorkspaceRoleKey;
  title: string;
  agentSlug: string;
  capabilityHint: string;
  status: ProjectWorkspaceStatus;
  progress: number;
  taskCount: number;
  artifactCount: number;
  approvalCount: number;
  activeTaskTitle?: string;
  nextAction?: string;
  blocker?: string;
};

export type ProjectWorkspaceSummary = {
  overallProgress: number;
  statusLabel: string;
  syncLabel: string;
  activeRoleCount: number;
  blockedRoleCount: number;
  artifactCount: number;
  approvalCount: number;
};

export type ProjectWorkspaceProjection = {
  project: {
    id: string;
    slug: string;
    name: string;
    status: string;
    nextAction?: string | null;
    blocker?: string | null;
  };
  roles: ProjectWorkspaceRole[];
  summary: ProjectWorkspaceSummary;
};

type AgentLike = { slug: string; name?: string | null } | null | undefined;
type TaskLike = {
  id?: string;
  title: string;
  status: string;
  summary?: string | null;
  blocker?: string | null;
  nextAction?: string | null;
  agent?: AgentLike;
  agentId?: string | null;
};
type ApprovalLike = { status: string; riskLevel?: string | null; taskId?: string | null };
type ArtifactLike = { agent?: AgentLike; agentId?: string | null; taskId?: string | null };

type ProjectLike = {
  id: string;
  slug: string;
  name: string;
  status: string;
  nextAction?: string | null;
  blocker?: string | null;
};

type WorkspaceInput = {
  project: ProjectLike;
  tasks: TaskLike[];
  approvals: ApprovalLike[];
  artifacts: ArtifactLike[];
};

const ROLE_CONFIG: Record<ProjectWorkspaceRoleKey, Omit<ProjectWorkspaceRole, "status" | "progress" | "taskCount" | "artifactCount" | "approvalCount" | "activeTaskTitle" | "nextAction" | "blocker">> = {
  lead: {
    key: "lead",
    title: "Lead / Planner",
    agentSlug: "hq-agent",
    capabilityHint: "프로젝트 라우팅 · 우선순위 · 승인 분기"
  },
  research: {
    key: "research",
    title: "Research",
    agentSlug: "research-agent",
    capabilityHint: "자료 조사 · 근거 수집 · 비교표"
  },
  design: {
    key: "design",
    title: "Design",
    agentSlug: "design-agent",
    capabilityHint: "화면 설계 · UX 흐름 · 컴포넌트 사양"
  },
  dev: {
    key: "dev",
    title: "Dev / Builder",
    agentSlug: "dev-agent",
    capabilityHint: "구현 · 테스트 · 런타임 연결"
  },
  qa: {
    key: "qa",
    title: "QA / Verifier",
    agentSlug: "docs-agent",
    capabilityHint: "검증 기준 · 실패 근거 · 회귀 확인"
  },
  docs: {
    key: "docs",
    title: "Docs / Artifact",
    agentSlug: "docs-agent",
    capabilityHint: "문서화 · 산출물 정리 · 인덱스"
  },
  ops: {
    key: "ops",
    title: "Ops / Release",
    agentSlug: "main-agent",
    capabilityHint: "릴리즈 · 상태 보고 · 수동 게이트"
  }
};

const ROLE_KEYWORDS: Record<ProjectWorkspaceRoleKey, string[]> = {
  lead: ["hq", "lead", "planner", "project", "routing", "orchestration", "총괄", "기획", "라우팅"],
  research: ["research", "조사", "근거", "시장", "레퍼런스"],
  design: ["design", "ui", "ux", "화면", "디자인", "component"],
  dev: ["dev", "build", "implement", "code", "test", "구현", "개발"],
  qa: ["qa", "verify", "verifier", "검증", "테스트", "회귀"],
  docs: ["docs", "document", "artifact", "문서", "산출물", "인덱스"],
  ops: ["ops", "release", "deploy", "runtime", "운영", "배포", "릴리즈"]
};

const AGENT_ROLE: Record<string, ProjectWorkspaceRoleKey> = {
  "hq-agent": "lead",
  "projects-agent": "lead",
  "research-agent": "research",
  "design-agent": "design",
  "dev-agent": "dev",
  "docs-agent": "docs",
  "main-agent": "ops"
};

export function estimatedTaskProgress(status: string, hasArtifact = false): number {
  if (status === "completed") return 100;
  if (status === "failed" || status === "cancelled") return 100;
  if (hasArtifact) return 85;
  if (status === "running") return 60;
  if (status === "waiting_approval" || status === "needs_changes") return 25;
  if (status === "queued") return 10;
  return 0;
}

export function workspaceStatusFromTasks(tasks: TaskLike[], approvals: ApprovalLike[]): ProjectWorkspaceStatus {
  if (tasks.some((task) => task.status === "failed")) return "failed";
  if (tasks.some((task) => task.status === "needs_changes" || task.blocker)) return "blocked";
  if (tasks.some((task) => task.status === "running")) return "running";
  if (tasks.some((task) => task.status === "waiting_approval") || approvals.some((approval) => ["pending", "approved_waiting_execution", "executing", "manual_handoff"].includes(approval.status))) {
    return "waiting_approval";
  }
  if (tasks.some((task) => task.status === "queued")) return "queued";
  if (tasks.length > 0 && tasks.every((task) => task.status === "completed")) return "completed";
  return "idle";
}

function inferRoleFromText(text: string): ProjectWorkspaceRoleKey | null {
  const normalized = text.toLowerCase();
  for (const role of PROJECT_WORKSPACE_ROLE_ORDER) {
    if (ROLE_KEYWORDS[role].some((keyword) => normalized.includes(keyword))) return role;
  }
  return null;
}

function inferTaskRole(task: TaskLike): ProjectWorkspaceRoleKey {
  const agentSlug = task.agent?.slug;
  if (agentSlug && AGENT_ROLE[agentSlug]) return AGENT_ROLE[agentSlug];
  return inferRoleFromText(`${task.title} ${task.summary ?? ""} ${task.nextAction ?? ""}`) ?? "lead";
}

function roleProgress(tasks: TaskLike[], artifacts: ArtifactLike[]): number {
  if (tasks.length === 0) return artifacts.length > 0 ? 85 : 0;
  const progress = tasks.map((task) => estimatedTaskProgress(task.status, artifacts.length > 0));
  return Math.round(progress.reduce((sum, item) => sum + item, 0) / progress.length);
}

export function buildProjectWorkspaceProjection(input: WorkspaceInput): ProjectWorkspaceProjection {
  const tasksByRole = new Map<ProjectWorkspaceRoleKey, TaskLike[]>();
  const artifactsByRole = new Map<ProjectWorkspaceRoleKey, ArtifactLike[]>();

  for (const role of PROJECT_WORKSPACE_ROLE_ORDER) {
    tasksByRole.set(role, []);
    artifactsByRole.set(role, []);
  }

  for (const task of input.tasks) {
    tasksByRole.get(inferTaskRole(task))?.push(task);
  }

  for (const artifact of input.artifacts) {
    const role = artifact.agent?.slug && AGENT_ROLE[artifact.agent.slug]
      ? AGENT_ROLE[artifact.agent.slug]
      : "docs";
    artifactsByRole.get(role)?.push(artifact);
  }

  const roles = PROJECT_WORKSPACE_ROLE_ORDER.map((role) => {
    const tasks = tasksByRole.get(role) ?? [];
    const artifacts = artifactsByRole.get(role) ?? [];
    const approvals = input.approvals.filter((approval) => {
      if (!approval.taskId) return role === "lead";
      return tasks.some((task) => "id" in task && task.id === approval.taskId);
    });
    const activeTask = tasks.find((task) => ["running", "waiting_approval", "needs_changes", "queued"].includes(task.status)) ?? tasks[0];
    const status = workspaceStatusFromTasks(tasks, approvals);
    const progress = roleProgress(tasks, artifacts);

    return {
      ...ROLE_CONFIG[role],
      status: tasks.length === 0 && artifacts.length === 0 && approvals.length === 0 ? "unassigned" as const : status,
      progress,
      taskCount: tasks.length,
      artifactCount: artifacts.length,
      approvalCount: approvals.length,
      activeTaskTitle: activeTask?.title,
      nextAction: activeTask?.nextAction ?? undefined,
      blocker: activeTask?.blocker ?? undefined
    };
  });

  const activeRoleCount = roles.filter((role) => !["idle", "unassigned", "completed"].includes(role.status)).length;
  const blockedRoleCount = roles.filter((role) => ["blocked", "failed", "waiting_approval"].includes(role.status)).length;
  const roleProgressValues = roles.filter((role) => role.taskCount > 0 || role.artifactCount > 0).map((role) => role.progress);
  const overallProgress = roleProgressValues.length === 0
    ? 0
    : Math.round(roleProgressValues.reduce((sum, item) => sum + item, 0) / roleProgressValues.length);

  return {
    project: input.project,
    roles,
    summary: {
      overallProgress,
      statusLabel: input.project.status,
      syncLabel: "자동 동기화 · 5–8초 폴링/SSE fallback 예정",
      activeRoleCount,
      blockedRoleCount,
      artifactCount: input.artifacts.length,
      approvalCount: input.approvals.length
    }
  };
}
