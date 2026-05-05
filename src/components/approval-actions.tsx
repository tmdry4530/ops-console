"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  approvalId: string;
  status: string;
  manualReportId: string | null;
}

export function ApprovalActions({ approvalId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [reportId, setReportId] = useState("");
  const [note, setNote] = useState("");
  const [showModal, setShowModal] = useState<string | null>(null);

  const isPending = status === "pending";
  const canManualSubmit = status === "manual_handoff" || status === "approved_waiting_execution";

  async function submit(action: string, body: Record<string, string> = {}) {
    setBusy(action);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
      setShowModal(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="decision-bar">
        <div className="lhs">
          <span className="pulse" />
          <div>
            <div className="db-title">운영자 승인 필요</div>
            <div className="db-sub">
              {isPending && "근거와 산출물을 검토한 뒤 승인, 거절, 수정 요청을 선택하세요."}
              {canManualSubmit && "승인은 완료됐습니다. 외부 포털에서 직접 처리한 경우에만 외부 제출 ID를 기록하세요."}
              {status === "needs_changes" && "수정 요청 상태입니다. 메모를 반영한 뒤 다시 제출하세요."}
            </div>
          </div>
        </div>

        {isPending && (
          <>
            <button className="btn ghost" disabled={busy !== null} onClick={() => setShowModal("reject")}>
              거절
            </button>
            <button className="btn warn" disabled={busy !== null} onClick={() => setShowModal("request")}>
              수정 요청
            </button>
            <button className="btn primary lg" disabled={busy !== null} onClick={() => setShowModal("approve")}>
              승인
            </button>
          </>
        )}

        {canManualSubmit && (
          <button className="btn primary lg" disabled={busy !== null} onClick={() => setShowModal("manual")}>
            외부 제출 완료 기록
          </button>
        )}
      </div>

      {showModal === "approve" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>승인 및 실행 큐 등록</h3>
              <div className="sub">허용된 안전 액션은 command worker가 자동 처리합니다. 수동 게이트 액션은 외부 제출/서명/2FA를 자동 실행하지 않습니다.</div>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>승인 메모</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="감사 로그에 남길 메모, 선택 사항" />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>취소</button>
              <button className="btn primary" disabled={busy !== null} onClick={() => submit("approve", { note })}>
                {busy === "approve" ? "승인 중…" : "승인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === "reject" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>승인 거절</h3>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>사유 / 감사 로그 표시</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="왜 거절하는지 적어주세요" />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>취소</button>
              <button className="btn danger" disabled={busy !== null} onClick={() => submit("reject", { note })}>
                {busy === "reject" ? "거절 중…" : "거절"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === "request" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>수정 요청</h3>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>메모</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="무엇을 고쳐야 하는지 적어주세요" />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>취소</button>
              <button className="btn warn" disabled={busy !== null} onClick={() => submit("request-changes", { note })}>
                {busy === "request-changes" ? "전송 중…" : "작성자에게 보내기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === "manual" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>외부 제출 완료 기록</h3>
              <div className="sub">실제 외부 포털에서 직접 제출한 뒤 받은 리포트/티켓 ID만 기록합니다. 이 버튼은 외부 제출을 실행하지 않습니다.</div>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>외부 제출 ID / 리포트 ID</label>
                <input className="mono" placeholder="예: IMM-26405 또는 ticket-123" value={reportId} onChange={(e) => setReportId(e.target.value)} />
                <div className="hint">필수. 실제 제출 후 받은 ID만 입력하세요. 저장 위치: approval.manualReportId</div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>취소</button>
              <button
                className="btn primary"
                disabled={busy !== null || reportId.trim().length < 3}
                onClick={() => submit("manual-submit", { manualReportId: reportId.trim(), note })}
              >
                {busy === "manual-submit" ? "기록 중…" : "제출 완료로 기록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
