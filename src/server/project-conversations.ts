import { db } from "@/lib/db";
import type { EventSeverity, TaskStatus } from "@prisma/client";

export const ACTIVE_CONVERSATION_PROJECT_SLUGS = ["ops-console", "alpha-terminal"] as const;

export const COMPANY_CONVERSATION_AGENT_SLUGS = [
  "hq-agent",
  "main-agent",
  "research-agent",
  "projects-agent",
  "dev-agent",
  "docs-agent",
  "content-agent",
  "design-agent"
] as const;

const AGENT_TITLES: Record<string, string> = {
  "hq-agent": "HQ Agent",
  "main-agent": "Main Agent",
  "research-agent": "Research Agent",
  "projects-agent": "Projects Agent",
  "dev-agent": "Dev Agent",
  "docs-agent": "Docs Agent",
  "content-agent": "Content Agent",
  "design-agent": "Design Agent"
};

const AGENT_MEMORY_OWNERS: Record<string, string> = {
  "hq-agent": "role_profile:hq",
  "main-agent": "role_profile:main",
  "research-agent": "role_profile:research",
  "projects-agent": "role_profile:projects",
  "dev-agent": "role_profile:dev",
  "docs-agent": "role_profile:docs",
  "content-agent": "role_profile:content",
  "design-agent": "role_profile:design"
};

export type ConversationRoutingInput = {
  projectSlug: string;
  agentSlug: string;
  workstream?: string | null;
};

export type ConversationMetadata = {
  projectSlug: string;
  agentSlug: string;
  workstream: string;
  threadKey: string;
  threadPolicy: "reuse_project_agent_thread";
  memoryOwner: string;
  contextOwner: string;
};

export type ConversationMessage = {
  id: string;
  kind: "task" | "event" | "artifact";
  title: string;
  body?: string | null;
  status?: string | null;
  severity?: EventSeverity | null;
  path?: string | null;
  createdAt: Date;
};

export type ProjectConversation = ConversationMetadata & {
  title: string;
  status: "active" | "running" | "waiting" | "blocked" | "completed" | "archived";
  lastActivityAt: Date;
  messages: ConversationMessage[];
};

export type ProjectConversationRegistry = {
  enabled: boolean;
  projectSlug: string;
  projectName: string;
  conversations: ProjectConversation[];
  emptyReason?: string;
};

export type ConversationTaskInput = {
  id: string;
  title: string;
  status: TaskStatus | string;
  summary?: string | null;
  agentSlug?: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: unknown;
};

export type ConversationEventInput = {
  id: string;
  type: string;
  severity: EventSeverity;
  message: string;
  agentSlug?: string | null;
  createdAt: Date;
  metadata?: unknown;
};

export type ConversationArtifactInput = {
  id: string;
  title: string;
  path?: string | null;
  agentSlug?: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: unknown;
};

export type DeriveProjectConversationInput = {
  project: { id: string; slug: string; name: string };
  tasks: ConversationTaskInput[];
  events: ConversationEventInput[];
  artifacts: ConversationArtifactInput[];
};

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
}

function textField(metadata: unknown, key: string): string | null {
  const item = metadataRecord(metadata)[key];
  return typeof item === "string" && item.trim() ? item.trim() : null;
}

function slugifyPart(value: string | null | undefined, fallback: string): string {
  const slug = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

function normalizeProjectSlug(projectSlug: string): string {
  return slugifyPart(projectSlug, "unknown-project");
}

function normalizeAgentSlug(agentSlug: string | null | undefined): string {
  const slug = slugifyPart(agentSlug, "main-agent");
  return COMPANY_CONVERSATION_AGENT_SLUGS.includes(slug as typeof COMPANY_CONVERSATION_AGENT_SLUGS[number]) ? slug : "main-agent";
}

function normalizeWorkstream(workstream: string | null | undefined): string {
  return slugifyPart(workstream, "general");
}

export function resolveConversationThreadKey(input: ConversationRoutingInput): string {
  return `${normalizeProjectSlug(input.projectSlug)}/${normalizeAgentSlug(input.agentSlug)}/${normalizeWorkstream(input.workstream)}`;
}

export function memoryOwnerForAgent(agentSlug: string): string {
  return AGENT_MEMORY_OWNERS[normalizeAgentSlug(agentSlug)] ?? "company-router";
}

export function buildConversationMetadata(input: ConversationRoutingInput): ConversationMetadata {
  const projectSlug = normalizeProjectSlug(input.projectSlug);
  const agentSlug = normalizeAgentSlug(input.agentSlug);
  const workstream = normalizeWorkstream(input.workstream);
  return {
    projectSlug,
    agentSlug,
    workstream,
    threadKey: resolveConversationThreadKey({ projectSlug, agentSlug, workstream }),
    threadPolicy: "reuse_project_agent_thread",
    memoryOwner: memoryOwnerForAgent(agentSlug),
    contextOwner: memoryOwnerForAgent(agentSlug)
  };
}

export function isConversationEnabledProject(projectSlug: string): boolean {
  return ACTIVE_CONVERSATION_PROJECT_SLUGS.includes(normalizeProjectSlug(projectSlug) as typeof ACTIVE_CONVERSATION_PROJECT_SLUGS[number]);
}

function metadataForItem(projectSlug: string, agentSlug: string | null | undefined, metadata: unknown): ConversationMetadata {
  const explicitThreadKey = textField(metadata, "threadKey");
  const explicitProject = textField(metadata, "projectSlug") ?? projectSlug;
  const explicitAgent = textField(metadata, "agentSlug") ?? agentSlug ?? "main-agent";
  const explicitWorkstream = textField(metadata, "workstream") ?? explicitThreadKey?.split("/")[2] ?? "general";
  return buildConversationMetadata({ projectSlug: explicitProject, agentSlug: explicitAgent, workstream: explicitWorkstream });
}

function statusRank(status: string): ProjectConversation["status"] {
  if (["blocked", "failed", "needs_changes"].includes(status)) return "blocked";
  if (["running"].includes(status)) return "running";
  if (["waiting_approval", "queued"].includes(status)) return "waiting";
  if (["completed"].includes(status)) return "completed";
  return "active";
}

function mergeStatus(current: ProjectConversation["status"], next: ProjectConversation["status"]): ProjectConversation["status"] {
  const order: ProjectConversation["status"][] = ["blocked", "running", "waiting", "active", "completed", "archived"];
  return order.indexOf(next) < order.indexOf(current) ? next : current;
}

function titleForConversation(projectName: string, agentSlug: string, workstream: string): string {
  return `${projectName} · ${AGENT_TITLES[agentSlug] ?? agentSlug} · ${workstream}`;
}

export function deriveProjectConversationRegistry(input: DeriveProjectConversationInput): ProjectConversationRegistry {
  if (!isConversationEnabledProject(input.project.slug)) {
    return {
      enabled: false,
      projectSlug: input.project.slug,
      projectName: input.project.name,
      conversations: [],
      emptyReason: "Project conversation split is enabled for active Company scope only: ops-console / alpha-terminal."
    };
  }

  const byKey = new Map<string, ProjectConversation>();
  const ensure = (metadata: ConversationMetadata, at: Date) => {
    const existing = byKey.get(metadata.threadKey);
    if (existing) {
      if (at > existing.lastActivityAt) existing.lastActivityAt = at;
      return existing;
    }
    const conversation: ProjectConversation = {
      ...metadata,
      title: titleForConversation(input.project.name, metadata.agentSlug, metadata.workstream),
      status: "active",
      lastActivityAt: at,
      messages: []
    };
    byKey.set(metadata.threadKey, conversation);
    return conversation;
  };

  for (const task of input.tasks) {
    const metadata = metadataForItem(input.project.slug, task.agentSlug, task.metadata);
    const conversation = ensure(metadata, task.updatedAt);
    conversation.status = mergeStatus(conversation.status, statusRank(task.status));
    conversation.messages.push({
      id: task.id,
      kind: "task",
      title: task.title,
      body: task.summary ?? null,
      status: task.status,
      createdAt: task.createdAt
    });
  }

  for (const event of input.events) {
    const metadata = metadataForItem(input.project.slug, event.agentSlug, event.metadata);
    const conversation = ensure(metadata, event.createdAt);
    conversation.messages.push({
      id: event.id,
      kind: "event",
      title: event.message,
      body: event.type,
      severity: event.severity,
      createdAt: event.createdAt
    });
  }

  for (const artifact of input.artifacts) {
    const metadata = metadataForItem(input.project.slug, artifact.agentSlug, artifact.metadata);
    const conversation = ensure(metadata, artifact.updatedAt);
    conversation.messages.push({
      id: artifact.id,
      kind: "artifact",
      title: artifact.title,
      path: artifact.path ?? null,
      createdAt: artifact.createdAt
    });
  }

  const conversations = Array.from(byKey.values()).map((conversation) => ({
    ...conversation,
    messages: conversation.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  })).sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

  return {
    enabled: true,
    projectSlug: input.project.slug,
    projectName: input.project.name,
    conversations,
    emptyReason: conversations.length === 0 ? "아직 재사용 가능한 프로젝트/에이전트 대화가 없습니다. 운영자 지시나 worker report 이벤트가 생성되면 projectSlug/agentSlug/workstream 기준으로 같은 threadKey에 다시 묶입니다." : undefined
  };
}

export async function loadProjectConversationRegistry(projectId: string): Promise<ProjectConversationRegistry | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: { include: { agent: { select: { slug: true } } }, orderBy: { updatedAt: "desc" } },
      events: { include: { agent: { select: { slug: true } } }, orderBy: { createdAt: "desc" }, take: 200 },
      artifacts: { include: { agent: { select: { slug: true } } }, orderBy: { updatedAt: "desc" } }
    }
  });
  if (!project) return null;

  return deriveProjectConversationRegistry({
    project: { id: project.id, slug: project.slug, name: project.name },
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      summary: task.summary,
      agentSlug: task.agent?.slug ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      metadata: {}
    })),
    events: project.events.map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      agentSlug: event.agent?.slug ?? null,
      createdAt: event.createdAt,
      metadata: event.metadata
    })),
    artifacts: project.artifacts.map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      path: artifact.path,
      agentSlug: artifact.agent?.slug ?? null,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
      metadata: {}
    }))
  });
}
