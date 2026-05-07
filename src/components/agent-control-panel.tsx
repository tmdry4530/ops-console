"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AgentControlAction } from "@/server/agent-control";

const ACTIONS: { action: AgentControlAction; label: string; danger?: boolean }[] = [
  { action: "pause", label: "일시정지" },
  { action: "resume", label: "재개" },
  { action: "retry", label: "재시도" },
  { action: "restart", label: "재시작 승인", danger: true },
  { action: "kill", label: "Kill 승인", danger: true }
];

export function AgentControlPanel({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");

  function submit(action: AgentControlAction) {
    startTransition(async () => {
      const res = await fetch(`/api/agents/${agentId}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json();
      setMessage(data.status === "approval_required" ? "승인 요청 생성됨" : data.status === "queued" ? "제어 명령 큐 등록됨" : "요청 실패");
      router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="card-head"><div className="title">관리 액션</div><div className="sub">· 감사/게이트 적용</div></div>
      <div className="card-body">
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {ACTIONS.map((item) => (
            <button key={item.action} className={`btn sm ${item.danger ? "ghost" : ""}`} disabled={pending} onClick={() => submit(item.action)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          restart/kill은 실제 실행 전 Ops Console 승인으로 게이트됩니다. {message}
        </div>
      </div>
    </div>
  );
}
