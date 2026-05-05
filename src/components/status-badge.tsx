export type StatusKind = "ok" | "info" | "warn" | "danger" | "muted";

function statusKind(status: string): StatusKind {
  if (status === "completed" || status === "approved" || status === "ok") return "ok";
  if (status === "pending" || status === "needs_changes" || status === "warning") return "warn";
  if (status === "manual_handoff" || status === "info") return "info";
  if (status === "rejected" || status === "danger" || status === "critical") return "danger";
  return "muted";
}

export function StatusBadge({ label, kind, dot = true }: { label: string; kind?: StatusKind; dot?: boolean }) {
  const k = kind ?? statusKind(label);
  return (
    <span className={`badge ${k}`}>
      {dot && <span className="dot" />}
      {label.replace(/_/g, " ")}
    </span>
  );
}
