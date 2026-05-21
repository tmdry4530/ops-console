type SafeJson = Record<string, unknown> | null | undefined;

type TraceAgent = { slug: string; name: string } | null;
type TraceArtifact = { id: string; title: string; path?: string | null; restricted: boolean };
type TraceTask = {
  id: string;
  title: string;
  status: string;
  summary?: string | null;
  nextAction?: string | null;
  createdAt: Date;
  updatedAt: Date;
  agent?: TraceAgent;
  artifacts: TraceArtifact[];
};
type TraceEvent = {
  id: string;
  type: string;
  message: string;
  severity: string;
  createdAt: Date;
  metadata?: SafeJson;
};
type TraceCommand = {
  id: string;
  actionType: string;
  status: string;
  riskLevel: string;
  payload?: SafeJson;
  createdAt: Date;
  updatedAt: Date;
};

type TraceInput = {
  traceId: string;
  tasks: TraceTask[];
  events: TraceEvent[];
  commands: TraceCommand[];
  artifacts: (TraceArtifact & { createdAt: Date; updatedAt: Date })[];
};

const metadataAllowlist = new Set([
  "traceId",
  "source",
  "stage",
  "decision",
  "autonomyLevel",
  "verifierRequired",
  "orchestrationState",
  "compiledCommand",
  "action",
  "targetAgentId",
  "targetAgentSlug",
  "scopeLimit",
  "model",
  "tool",
  "latencyMs",
  "tokensToday",
  "output_mode",
  "verifier"
]);

function safeMetadata(metadata: SafeJson) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => metadataAllowlist.has(key) && ["string", "number", "boolean"].includes(typeof value))
  );
}

function hasTrace(metadata: SafeJson, traceId: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return metadata.traceId === traceId;
}

function inferOrchestrationState(task: TraceTask) {
  const text = `${task.status} ${task.summary ?? ""} ${task.nextAction ?? ""}`.toLowerCase();
  if (text.includes("delegated") || text.includes("waiting_children")) return "delegated/waiting_children";
  if (text.includes("aggregation")) return "aggregation_running";
  return task.status;
}

function latest<T extends { createdAt?: Date; updatedAt?: Date }>(items: T[], field: "createdAt" | "updatedAt" = "createdAt") {
  return [...items].sort((a, b) => (b[field]?.getTime() ?? 0) - (a[field]?.getTime() ?? 0))[0] ?? null;
}

export function buildTraceLineage(input: TraceInput) {
  const traceEvents = input.events.filter((event) => hasTrace(event.metadata, input.traceId) || event.id === input.traceId);
  const traceCommands = input.commands.filter((command) => hasTrace(command.payload, input.traceId) || command.id === input.traceId);
  const parentTasks = input.tasks
    .filter((task) => /parent|orchestration|hq|main|delegated|waiting_children/i.test(`${task.title} ${task.summary ?? ""} ${task.nextAction ?? ""} ${task.agent?.slug ?? ""}`))
    .map((task) => ({ id: task.id, title: task.title, status: task.status, agent: task.agent?.name ?? "unassigned", orchestrationState: inferOrchestrationState(task), updatedAt: task.updatedAt }));
  const childTasks = input.tasks
    .filter((task) => !parentTasks.some((parent) => parent.id === task.id))
    .map((task) => ({ id: task.id, title: task.title, status: task.status, agent: task.agent?.name ?? "unassigned", artifactCount: task.artifacts.length, updatedAt: task.updatedAt }));
  const verificationEvents = traceEvents.filter((event) => /verification|verifier|passed|failed/i.test(`${event.type} ${event.message}`));
  const modelToolEvents = traceEvents.filter((event) => /model|tool|hermes|worker|call/i.test(`${event.type} ${event.message}`));
  const finalEvent = latest(traceEvents.filter((event) => /final|completed|report/i.test(`${event.type} ${event.message}`)));

  const stages = [
    { key: "operator_intent", title: "Operator intent", status: traceEvents.some((event) => event.type.includes("operator") || event.type.includes("ingest")) ? "seen" : "derived", items: traceEvents.filter((event) => event.type.includes("operator") || event.type.includes("ingest")).map((event) => ({ id: event.id, message: event.message, at: event.createdAt, metadata: safeMetadata(event.metadata) })) },
    { key: "compiled_command", title: "Compiled command", status: traceCommands.length > 0 ? "compiled" : "not_recorded", items: traceCommands.map((command) => ({ id: command.id, actionType: command.actionType, status: command.status, riskLevel: command.riskLevel, metadata: safeMetadata(command.payload), at: command.createdAt })) },
    { key: "autonomy_decision", title: "Autonomy decision", status: traceEvents.some((event) => event.type.includes("autonomy")) ? "decided" : "not_recorded", items: traceEvents.filter((event) => event.type.includes("autonomy")).map((event) => ({ id: event.id, message: event.message, at: event.createdAt, metadata: safeMetadata(event.metadata) })) },
    { key: "orchestration", title: "Parent/child/aggregation", status: parentTasks.length || childTasks.length ? "linked" : "not_recorded", items: [...parentTasks, ...childTasks] },
    { key: "model_tool_calls", title: "Model/tool calls", status: modelToolEvents.length ? "observed" : "not_recorded", items: modelToolEvents.map((event) => ({ id: event.id, message: event.message, at: event.createdAt, metadata: safeMetadata(event.metadata) })) },
    { key: "artifacts", title: "Artifacts", status: input.artifacts.length ? "linked" : "not_recorded", items: input.artifacts.map((artifact) => ({ id: artifact.id, title: artifact.title, path: artifact.restricted ? "restricted" : artifact.path, restricted: artifact.restricted, at: artifact.updatedAt })) },
    { key: "verification", title: "Verification", status: verificationEvents.length ? "verified" : "pending", items: verificationEvents.map((event) => ({ id: event.id, message: event.message, at: event.createdAt, metadata: safeMetadata(event.metadata) })) },
    { key: "final_report", title: "Final report", status: finalEvent ? "reported" : "pending", items: finalEvent ? [{ id: finalEvent.id, message: finalEvent.message, at: finalEvent.createdAt, metadata: safeMetadata(finalEvent.metadata) }] : [] }
  ];

  return { traceId: input.traceId, stages, parentTasks, childTasks, artifactCount: input.artifacts.length, eventCount: traceEvents.length, commandCount: traceCommands.length };
}
