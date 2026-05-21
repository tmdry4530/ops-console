"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AgentOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
  currentTask: string | null;
};

const ACTIONS = [
  { value: "pause", label: "pause" },
  { value: "resume", label: "resume" },
  { value: "cancel", label: "cancel" },
  { value: "reprioritize", label: "reprioritize" },
  { value: "rollback", label: "rollback" },
  { value: "reassign", label: "reassign" },
  { value: "scope_limit", label: "scope-limit" }
] as const;

export function LiveInterventionPanel({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [action, setAction] = useState<(typeof ACTIONS)[number]["value"]>("pause");
  const [reason, setReason] = useState("operator intervention from Control Center");
  const [scopeLimit, setScopeLimit] = useState("Company/internal only; no external send/deploy/trading/secrets");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!agentId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason, scopeLimit })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessage(`queued: ${data.commandId ?? data.command?.id ?? "command"}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "command failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="intervention-panel">
      <div className="field">
        <label>Target agent</label>
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name} · {agent.status}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>CommandQueue action</label>
        <select value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
          {ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Reason / audit note</label>
        <input value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      <div className="field">
        <label>Scope limit / reassignment hint</label>
        <textarea value={scopeLimit} onChange={(event) => setScopeLimit(event.target.value)} />
      </div>
      <button className="btn primary" disabled={busy || !agentId} onClick={submit}>
        {busy ? "queueing…" : "CommandQueue에 기록"}
      </button>
      {message && <div className="hint mono">{message}</div>}
      <div className="hint">명령은 DB CommandQueue에 감사 로그로 남고, worker가 허용된 내부 상태 변경만 처리한다.</div>
    </div>
  );
}
