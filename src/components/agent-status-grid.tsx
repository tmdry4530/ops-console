import type { Agent } from "@prisma/client";
import Link from "next/link";
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
          <div className="muted" style={{ fontSize: 12, minHeight: 18 }}>{a.currentTask ?? "—"}</div>
          <AgentHeartbeat status={a.status} health={a.health} />
          <div className="between" style={{ fontSize: 11, color: "var(--text-3)" }}>
            <span>{a.health}</span>
            <span>{a.heartbeatAt ? new Date(a.heartbeatAt).toLocaleTimeString() : "—"}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AgentHeartbeat({ status, health }: { status: string; health: string }) {
  const bars = Array.from({ length: 24 }, (_, i) => {
    const v = Math.sin(i * 0.7 + i * 0.3) * 0.5 + 0.5;
    let cls = "";
    if (status === "running" && v > 0.4) cls = "on";
    else if ((status === "blocked" || status === "failed" || health === "degraded" || health === "failing") && v > 0.5) cls = "warn-bar";
    return <span key={i} className={cls} style={{ height: `${30 + v * 70}%` }} />;
  });
  return <div className="heartbeat">{bars}</div>;
}
