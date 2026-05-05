import { StatusBadge, type StatusTone } from "./status-badge";

const toneByRisk: Record<string, StatusTone> = {
  low: "ok",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

export function RiskBadge({ risk }: Readonly<{ risk: string }>) {
  return <StatusBadge label={`risk:${risk}`} tone={toneByRisk[risk] ?? "neutral"} />;
}
