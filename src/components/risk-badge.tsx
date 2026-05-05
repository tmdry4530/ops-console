import { labelForRisk } from "@/lib/korean-labels";

export function RiskBadge({ risk }: { risk: string }) {
  return <span className={`risk-badge ${risk}`}>{labelForRisk(risk)}</span>;
}
