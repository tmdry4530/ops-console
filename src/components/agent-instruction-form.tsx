"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProjectOption = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  agentId: string;
  projects: ProjectOption[];
};

const actionOptions = [
  { value: "operator_instruction", label: "일반 운영 지시" },
  { value: "internal_sync", label: "내부 동기화/정리" },
  { value: "revenue_outreach", label: "매출/아웃리치" },
  { value: "deploy", label: "배포" },
  { value: "bounty_submission", label: "바운티 제출" },
  { value: "wallet_kyc", label: "지갑/KYC" },
  { value: "live_trading", label: "실거래" },
  { value: "paid_action", label: "유료 작업" },
  { value: "public_disclosure", label: "공개 공시" }
];

const riskOptions = [
  { value: "low", label: "낮음 · 안전 큐 가능" },
  { value: "medium", label: "중간 · 승인 후 정책 판단" },
  { value: "high", label: "높음 · 수동 게이트" },
  { value: "critical", label: "치명 · 수동 게이트" }
];

export function AgentInstructionForm({ agentId, projects }: Props) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [actionType, setActionType] = useState("operator_instruction");
  const [riskLevel, setRiskLevel] = useState("low");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/instructions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction, actionType, riskLevel, projectId: projectId || undefined })
      });
      if (!res.ok) throw new Error(await res.text());
      setInstruction("");
      setActionType("operator_instruction");
      setRiskLevel("low");
      setProjectId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "지시 등록 실패");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || instruction.trim().length < 3;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="title">콘솔 지시</div>
          <div className="sub">모든 지시는 먼저 승인 대기열로 들어가고, 정책에 따라 안전 큐 또는 수동 게이트로 처리됩니다.</div>
        </div>
      </div>
      <div className="card-body vstack" style={{ gap: 12 }}>
        <div className="field">
          <label>지시 내용</label>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="예: 최근 crypto signal 소스 품질을 점검하고 이상 항목을 보고해줘"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div className="field">
            <label>작업 유형</label>
            <select value={actionType} onChange={(event) => setActionType(event.target.value)}>
              {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>위험도</label>
            <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
              {riskOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>연결 프로젝트</label>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">선택 안 함</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.slug}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="hint" style={{ color: "var(--danger)" }}>{error}</div>}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="hint">외부 제출, 지갑, 2FA, 유료/고위험 작업은 IP 허용 여부와 무관하게 자동 실행되지 않습니다.</div>
          <button className="btn primary" disabled={disabled} onClick={submit}>{busy ? "등록 중…" : "지시 등록"}</button>
        </div>
      </div>
    </div>
  );
}
