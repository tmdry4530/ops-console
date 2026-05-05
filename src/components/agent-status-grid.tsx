import type { Agent } from "@prisma/client";
import { StatusBadge } from "./status-badge";

export function AgentStatusGrid({ agents }: Readonly<{ agents: Agent[] }>) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={agent.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{agent.name}</p>
            <StatusBadge label={agent.health} tone={agent.health === "ok" ? "ok" : "warning"} />
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{agent.status} · {agent.currentTask ?? "no current task"}</p>
        </div>
      ))}
    </div>
  );
}
