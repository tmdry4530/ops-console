import type { Agent } from "@prisma/client";
import Link from "next/link";
import { formatTimeKo, labelForHealth } from "@/lib/korean-labels";
import { StatusBadge } from "./status-badge";

export function AgentStatusGrid({ agents, columns = 3 }: { agents: Agent[]; columns?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 12 }}>
      {agents.map((a) => (
        <Link key={a.id} href={`/agents/${a.id}`} className="agent-card" style={{ textDecoration: "none" }}>
          <div className="head">
            <div className="avatar" style={{ background: "var(--bg-3)" }}>{a.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">{a.name}</div>
              <div className="role">{a.slug}</div>
            </div>
            <StatusBadge label={a.status} />
          </div>
          <div className="muted" style={{ fontSize: 12, minHeight: 18 }}>{a.currentTask ?? "현재 작업 없음"}</div>
          <AgentHeartbeat status={a.status} health={a.health} heartbeatAt={a.heartbeatAt} />
          <div className="between" style={{ fontSize: 11, color: "var(--text-3)" }}>
            <span>상태: {labelForHealth(a.health)}</span>
            <span>최근 보고: {formatTimeKo(a.heartbeatAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AgentHeartbeat({ status, health, heartbeatAt }: { status: string; health: string; heartbeatAt: Date | null }) {
  const hasHeartbeat = Boolean(heartbeatAt);
  const activeBars = status === "running" && hasHeartbeat ? 24 : status === "running" ? 8 : 0;
  const warn = status === "blocked" || status === "failed" || health === "degraded" || health === "failing";
  const bars = Array.from({ length: 24 }, (_, i) => {
    const cls = warn && i >= 16 ? "warn-bar" : i < activeBars ? "on" : "";
    const height = i < activeBars ? 78 : 34;
    return <span key={i} className={cls} style={{ height: `${height}%` }} />;
  });
  return <div className="heartbeat" title={hasHeartbeat ? "최근 상태 보고 있음" : "상태 보고 없음"}>{bars}</div>;
}
