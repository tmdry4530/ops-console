"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CreatedState = {
  projectId: string;
  projectName: string;
  delegationCount: number;
} | null;

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [instruction, setInstruction] = useState("");
  const [workstream, setWorkstream] = useState("project-intake");
  const [riskLevel, setRiskLevel] = useState("low");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedState>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, slug: slug || undefined, instruction, workstream, riskLevel, ownerAgentSlug: "hq-agent", actionType: "operator_instruction" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "프로젝트 등록 실패");
      setCreated({ projectId: data.project.id, projectName: data.project.name, delegationCount: data.delegations?.length ?? 0 });
      router.refresh();
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 등록 실패");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || name.trim().length < 2 || instruction.trim().length < 3;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="title">새 프로젝트 등록</div>
          <div className="sub">등록 즉시 HQ가 projectSlug/workstream/threadKey를 만들고 역할 에이전트 작업으로 분배합니다.</div>
        </div>
      </div>
      <div className="card-body vstack" style={{ gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div className="field">
            <label>프로젝트 이름</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: Company OS Portal" />
          </div>
          <div className="field">
            <label>projectSlug · 비우면 자동 생성</label>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="company-os-portal" />
          </div>
        </div>
        <div className="field">
          <label>초기 지시</label>
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="예: 컴퍼니 전체로 조사, 설계, 구현, 문서화까지 분배해서 1차 산출물 만들어줘" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div className="field">
            <label>workstream</label>
            <input value={workstream} onChange={(event) => setWorkstream(event.target.value)} placeholder="project-intake" />
          </div>
          <div className="field">
            <label>위험도</label>
            <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
              <option value="low">낮음 · 내부 작업 자동 분배</option>
              <option value="medium">중간 · 내부 작업 자동 분배</option>
              <option value="high">높음 · 승인 게이트</option>
              <option value="critical">치명 · 승인 게이트</option>
            </select>
          </div>
        </div>
        {error && <div className="hint" style={{ color: "var(--danger)" }}>{error}</div>}
        {created && <div className="hint">등록 완료: {created.projectName} · 분배 작업 {created.delegationCount}개 생성</div>}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="hint">외부 발송/배포/결제/지갑/실거래/high-risk는 계속 승인 게이트로 막습니다.</div>
          <button className="btn primary" disabled={disabled} onClick={submit}>{busy ? "등록/분배 중…" : "프로젝트 등록 + HQ 분배"}</button>
        </div>
      </div>
    </div>
  );
}
