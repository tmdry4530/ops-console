import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readOperatorIdentity, type OperatorIdentity } from "@/lib/auth";
import type { EventSeverity, RiskLevel, SystemScope } from "@prisma/client";

export type WriteRole = "viewer" | "operator" | "approver" | "admin";
export type WriteCapability = "agent:control" | "agent:instruct" | "approval:decide" | "artifact:update" | "harness:manage" | "ingest:run" | "command:compile";

const ROLE_ORDER: Record<WriteRole, number> = { viewer: 0, operator: 1, approver: 2, admin: 3 };
const REQUIRED_ROLE: Record<WriteCapability, WriteRole> = {
  "agent:control": "operator",
  "agent:instruct": "operator",
  "approval:decide": "approver",
  "artifact:update": "operator",
  "harness:manage": "admin",
  "ingest:run": "operator",
  "command:compile": "operator"
};

export type AuthorizedWrite = { identity: OperatorIdentity; role: WriteRole; traceId: string };

function roleFromRequest(request: NextRequest): WriteRole {
  const header = request.headers.get("x-ops-operator-role")?.toLowerCase();
  if (header === "admin" || header === "approver" || header === "operator" || header === "viewer") return header;
  if (process.env.AUTH_BYPASS_LOCAL === "true" && process.env.NODE_ENV !== "production") return "admin";
  return "viewer";
}

export function isRoleAllowed(role: WriteRole, capability: WriteCapability) {
  return ROLE_ORDER[role] >= ROLE_ORDER[REQUIRED_ROLE[capability]];
}

export async function requireWriteAccess(request: NextRequest, capability: WriteCapability): Promise<AuthorizedWrite | NextResponse> {
  const identity = readOperatorIdentity(request);
  const traceId = request.headers.get("x-ops-trace-id") || crypto.randomUUID();
  if (!identity) {
    await auditWriteEvent({ type: "write.unauthorized", severity: "warning", message: `Unauthorized write rejected: ${capability}`, traceId, metadata: { capability } });
    return NextResponse.json({ error: "unauthorized", traceId }, { status: 401 });
  }
  const role = roleFromRequest(request);
  if (!isRoleAllowed(role, capability)) {
    await auditWriteEvent({ type: "write.forbidden", severity: "warning", message: `Forbidden write rejected: ${capability}`, traceId, metadata: { actorEmail: identity.email, role, capability, requiredRole: REQUIRED_ROLE[capability] } });
    return NextResponse.json({ error: "forbidden", traceId }, { status: 403 });
  }
  return { identity, role, traceId };
}

export async function auditWriteEvent(input: {
  type: string;
  message: string;
  severity?: EventSeverity;
  actorEmail?: string;
  traceId?: string;
  systemScope?: SystemScope;
  agentId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
  commandQueueId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return db.event.create({
    data: {
      type: input.type,
      severity: input.severity ?? "info",
      message: input.message,
      traceId: input.traceId,
      systemScope: input.systemScope ?? "company",
      agentId: input.agentId ?? undefined,
      projectId: input.projectId ?? undefined,
      taskId: input.taskId ?? undefined,
      approvalId: input.approvalId ?? undefined,
      artifactId: input.artifactId ?? undefined,
      commandQueueId: input.commandQueueId ?? undefined,
      metadata: { ...(input.metadata ?? {}), actorEmail: input.actorEmail ?? input.metadata?.actorEmail ?? null }
    }
  });
}

export function highCriticalApprovalRequired(riskLevel: RiskLevel) {
  return riskLevel === "high" || riskLevel === "critical";
}
