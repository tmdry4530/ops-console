export type AuditEventInput = {
  type: string;
  severity: "info" | "warning" | "critical";
  actorId?: string;
  message: string;
};

export function buildAuditEvent(input: AuditEventInput) {
  return {
    ...input,
    createdAt: new Date().toISOString()
  };
}
