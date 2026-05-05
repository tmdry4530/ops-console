export function MetricCard({
  label,
  value,
  delta,
  trend,
  alert
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  alert?: boolean;
}) {
  return (
    <div className={`kpi ${alert ? "alert" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className={`delta ${trend ?? ""}`}>{delta}</div>}
    </div>
  );
}
