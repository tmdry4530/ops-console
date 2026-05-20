import { db } from "@/lib/db";
export async function recordHarnessTrace(input: { agentSlug: string; taskId?: string; type: string; message: string; metadata?: Record<string, unknown> }) {
  return db.event.create({ data: { type: input.type, severity: "info", message: input.message, taskId: input.taskId, metadata: { agentSlug: input.agentSlug, ...(input.metadata ?? {}) } } });
}
