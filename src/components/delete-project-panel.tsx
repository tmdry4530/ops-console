"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteProjectPanel({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirm === projectId && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : await res.text());
      }
      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "project_delete_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ borderColor: "rgba(239,68,68,.45)", marginTop: 16 }} aria-label="Danger zone">
      <div className="card-head">
        <div className="title" style={{ color: "var(--danger)" }}>Danger zone</div>
        <div className="sub">프로젝트와 연결된 작업 기록/산출물 파일 삭제</div>
      </div>
      <div className="card-body vstack" style={{ gap: 10 }}>
        <p className="muted" style={{ margin: 0 }}>
          삭제하면 <strong>{projectName}</strong> 프로젝트, tasks, approvals, command queue, events, orchestration runs, trace/run steps, artifacts DB 기록과 안전한 artifact 파일을 함께 지운다. 실행 전 프로젝트 ID를 정확히 입력해야 한다.
        </p>
        <div className="field">
          <label>Confirm project id</label>
          <input className="mono" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={projectId} autoComplete="off" />
        </div>
        {error && <div className="blocker-msg">삭제 실패: {error}</div>}
        <button className="btn danger" disabled={!canDelete} onClick={submit}>
          {busy ? "삭제 중…" : "Delete project and related work"}
        </button>
      </div>
    </section>
  );
}
