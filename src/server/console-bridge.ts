import { db } from "@/lib/db";
import { workAgentWhereClause } from "@/lib/agent-visibility";

type BridgeDb = {
  approval: {
    findMany: (args: unknown) => Promise<ApprovalRecord[]>;
    count: (args: unknown) => Promise<number>;
  };
  task: {
    findMany: (args: unknown) => Promise<TaskRecord[]>;
    count: (args: unknown) => Promise<number>;
  };
  agent: {
    findMany: (args: unknown) => Promise<AgentRecord[]>;
    count: (args: unknown) => Promise<number>;
  };
  event: {
    findMany: (args: unknown) => Promise<EventRecord[]>;
    count: (args: unknown) => Promise<number>;
  };
  commandQueue: {
    findMany: (args: unknown) => Promise<CommandRecord[]>;
    count: (args: unknown) => Promise<number>;
  };
};

type LinkRecord = {
  id: string;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
};

type ArtifactRecord = {
  id: string;
  type: string;
  title: string;
  path?: string | null;
  url?: string | null;
  repo?: string | null;
  commitSha?: string | null;
  restricted: boolean;
  restrictionReason?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ApprovalRecord = {
  id: string;
  title: string;
  status: string;
  type: string;
  riskLevel: string;
  summary: string;
  project?: LinkRecord | null;
  task?: LinkRecord | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type TaskRecord = {
  id: string;
  slug: string;
  title: string;
  status: string;
  riskLevel: string;
  summary?: string | null;
  blocker?: string | null;
  nextAction?: string | null;
  agent?: LinkRecord | null;
  project?: LinkRecord | null;
  artifacts?: ArtifactRecord[];
  createdAt: Date | string;
  updatedAt: Date | string;
};

type EventRecord = {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date | string;
};

type CommandRecord = {
  id: string;
  actionType: string;
  status: string;
  riskLevel: string;
  approvalId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AgentRecord = {
  id: string;
  slug: string;
  name: string;
  status: string;
  health: string;
  heartbeatAt?: Date | string | null;
  currentTask?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function link(value: LinkRecord | null | undefined) {
  if (!value) return null;
  return {
    id: value.id,
    slug: value.slug ?? null,
    name: value.name ?? null,
    title: value.title ?? null,
  };
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), max));
}

function approvalSummary(approval: ApprovalRecord) {
  return {
    id: approval.id,
    title: approval.title,
    status: approval.status,
    type: approval.type,
    riskLevel: approval.riskLevel,
    summary: approval.summary,
    project: link(approval.project),
    task: link(approval.task),
    createdAt: iso(approval.createdAt),
    updatedAt: iso(approval.updatedAt),
  };
}

function taskProgress(status: string, artifacts: ArtifactRecord[] = []) {
  if (status === "completed") return 100;
  if (status === "failed") return 100;
  if (artifacts.length > 0) return 85;
  if (status === "running") return 60;
  if (status === "waiting_approval") return 25;
  if (status === "queued") return 10;
  if (status === "needs_changes") return 70;
  return 0;
}

function artifactSummary(artifact: ArtifactRecord) {
  return {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    path: artifact.restricted ? null : artifact.path ?? null,
    url: artifact.restricted ? null : artifact.url ?? null,
    repo: artifact.repo ?? null,
    commitSha: artifact.commitSha ?? null,
    restricted: artifact.restricted,
    restrictionReason: artifact.restrictionReason ?? null,
    createdAt: iso(artifact.createdAt),
    updatedAt: iso(artifact.updatedAt),
  };
}

function taskSummary(task: TaskRecord) {
  const artifacts = task.artifacts ?? [];
  return {
    id: task.id,
    slug: task.slug,
    title: task.title,
    status: task.status,
    riskLevel: task.riskLevel,
    summary: task.summary ?? null,
    progress: taskProgress(task.status, artifacts),
    blocker: task.blocker ?? null,
    nextAction: task.nextAction ?? null,
    agent: link(task.agent),
    project: link(task.project),
    artifacts: artifacts.map(artifactSummary),
    createdAt: iso(task.createdAt),
    updatedAt: iso(task.updatedAt),
  };
}

function eventSummary(event: EventRecord) {
  return {
    id: event.id,
    type: event.type,
    severity: event.severity,
    message: event.message,
    createdAt: iso(event.createdAt),
  };
}

function commandSummary(command: CommandRecord) {
  return {
    id: command.id,
    actionType: command.actionType,
    status: command.status,
    riskLevel: command.riskLevel,
    approvalId: command.approvalId ?? null,
    createdAt: iso(command.createdAt),
    updatedAt: iso(command.updatedAt),
  };
}

function agentSummary(agent: AgentRecord) {
  return {
    id: agent.id,
    slug: agent.slug,
    name: agent.name,
    status: agent.status,
    health: agent.health,
    heartbeatAt: iso(agent.heartbeatAt),
    currentTask: agent.currentTask ?? null,
    createdAt: iso(agent.createdAt),
    updatedAt: iso(agent.updatedAt),
  };
}

const openApprovalStatuses = ["pending", "approved_waiting_execution", "executing", "needs_changes", "manual_handoff"];
const activeTaskStatuses = ["queued", "waiting_approval", "running", "needs_changes", "failed"];
const activeAgentStatuses = ["running", "waiting_approval", "blocked", "failed"];
const activeCommandStatuses = ["queued", "waiting_manual_handoff", "running", "failed"];

function operatorTaskWhere(includeRecentCompleted = false) {
  const clauses: unknown[] = [{ status: { in: activeTaskStatuses } }, { blocker: { not: null } }];
  if (includeRecentCompleted) {
    clauses.push({
      status: "completed",
      updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
  }
  return { OR: clauses };
}

function activeWorkAgentWhere() {
  return {
    status: { in: activeAgentStatuses },
    ...workAgentWhereClause(),
  };
}

const approvalInclude = { project: { select: { id: true, slug: true, name: true } }, task: { select: { id: true, slug: true, title: true } } };
const taskInclude = {
  agent: { select: { id: true, slug: true, name: true } },
  project: { select: { id: true, slug: true, name: true } },
  artifacts: {
    select: {
      id: true,
      type: true,
      title: true,
      path: true,
      url: true,
      repo: true,
      commitSha: true,
      restricted: true,
      restrictionReason: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  },
};

export async function getConsoleBridgeApprovals(client: BridgeDb = db as unknown as BridgeDb, options: { limit?: number } = {}) {
  const take = clampLimit(options.limit, 50, 100);
  const [items, total] = await Promise.all([
    client.approval.findMany({
      where: { status: { in: openApprovalStatuses } },
      include: approvalInclude,
      orderBy: { updatedAt: "desc" },
      take,
    }),
    client.approval.count({ where: { status: { in: openApprovalStatuses } } }),
  ]);
  return {
    mode: "read_only" as const,
    generatedAt: new Date().toISOString(),
    total,
    items: items.map(approvalSummary),
  };
}

export async function getConsoleBridgeTasks(client: BridgeDb = db as unknown as BridgeDb, options: { limit?: number } = {}) {
  const take = clampLimit(options.limit, 50, 100);
  // Workspace /swarm is the operator control plane: it must show queued HQ delegations,
  // pending approvals, blockers, and failures. If we only return blocker states, HQ can
  // appear to have "done nothing" while child tasks are actually queued.
  const where = operatorTaskWhere(true);
  const [items, total] = await Promise.all([
    client.task.findMany({
      where,
      include: taskInclude,
      orderBy: { updatedAt: "desc" },
      take,
    }),
    client.task.count({ where }),
  ]);
  return {
    mode: "read_only" as const,
    generatedAt: new Date().toISOString(),
    total,
    items: items.map(taskSummary),
  };
}

export async function getConsoleBridgeEvents(client: BridgeDb = db as unknown as BridgeDb, options: { limit?: number } = {}) {
  const take = clampLimit(options.limit, 50, 100);
  const where = { severity: { in: ["warning", "critical"] } };
  const [items, total] = await Promise.all([
    client.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    }),
    client.event.count({ where }),
  ]);
  return {
    mode: "read_only" as const,
    generatedAt: new Date().toISOString(),
    total,
    items: items.map(eventSummary),
  };
}

export async function getConsoleBridgeCommands(client: BridgeDb = db as unknown as BridgeDb, options: { limit?: number } = {}) {
  const take = clampLimit(options.limit, 50, 100);
  const where = { status: { in: activeCommandStatuses } };
  const [items, total] = await Promise.all([
    client.commandQueue.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
    }),
    client.commandQueue.count({ where }),
  ]);
  return {
    mode: "read_only" as const,
    generatedAt: new Date().toISOString(),
    total,
    items: items.map(commandSummary),
  };
}

export async function getConsoleBridgeAgents(client: BridgeDb = db as unknown as BridgeDb, options: { limit?: number } = {}) {
  const take = clampLimit(options.limit, 50, 100);
  // The Workspace Swarm tab is an operator roster, not only a live-process list.
  // Include idle workflow agents so per-agent status/commands remain individually visible.
  const where = workAgentWhereClause();
  const [items, total] = await Promise.all([
    client.agent.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take,
    }),
    client.agent.count({ where }),
  ]);
  return {
    mode: "read_only" as const,
    generatedAt: new Date().toISOString(),
    total,
    items: items.map(agentSummary),
  };
}

export async function getConsoleBridgeSummary(client: BridgeDb = db as unknown as BridgeDb) {
  const [approvalList, taskList, eventList, commandList, activeAgents, criticalEventsCount, activeTaskCount] = await Promise.all([
    getConsoleBridgeApprovals(client, { limit: 8 }),
    getConsoleBridgeTasks(client, { limit: 8 }),
    client.event.findMany({
      where: { severity: "critical" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getConsoleBridgeCommands(client, { limit: 5 }),
    client.agent.count({ where: activeWorkAgentWhere() }),
    client.event.count({ where: { severity: "critical" } }),
    client.task.count({ where: operatorTaskWhere(false) }),
  ]);

  return {
    mode: "read_only" as const,
    generatedAt: new Date().toISOString(),
    counts: {
      pendingApprovals: approvalList.total,
      blockedTasks: activeTaskCount,
      activeAgents,
      criticalEvents: criticalEventsCount,
      queuedCommands: commandList.total,
    },
    approvals: approvalList.items,
    blockers: taskList.items,
    criticalEvents: eventList.map(eventSummary),
    commandQueue: commandList.items,
  };
}
