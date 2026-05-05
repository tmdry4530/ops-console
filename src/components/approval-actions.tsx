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
            <div className="db-title">Operator decision required</div>
            <div className="db-sub">
              {isPending && "Review the artifacts and context, then approve, reject, or request changes."}
              {canManualSubmit && "Approval granted. Mark as manually submitted with the report ID."}
              {status === "needs_changes" && "Reviewer requested changes. Address notes and re-submit."}
            </div>
          </div>
        </div>

        {isPending && (
          <>
            <button className="btn ghost" disabled={busy !== null} onClick={() => setShowModal("reject")}>
              Reject
            </button>
            <button className="btn warn" disabled={busy !== null} onClick={() => setShowModal("request")}>
              Request changes
            </button>
            <button className="btn primary lg" disabled={busy !== null} onClick={() => setShowModal("approve")}>
              Approve
            </button>
          </>
        )}

        {canManualSubmit && (
          <button className="btn primary lg" disabled={busy !== null} onClick={() => setShowModal("manual")}>
            Mark manually submitted
          </button>
        )}
      </div>

      {showModal === "approve" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Approve & queue</h3>
              <div className="sub">This will queue the action for safe execution.</div>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Decision note</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for audit trail..." />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>Cancel</button>
              <button className="btn primary" disabled={busy !== null} onClick={() => submit("approve", { note })}>
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === "reject" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Reject approval</h3>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Reason (audit-visible)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this being rejected?" />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>Cancel</button>
              <button className="btn danger" disabled={busy !== null} onClick={() => submit("reject", { note })}>
                {busy === "reject" ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === "request" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Request changes</h3>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Notes</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs to be changed?" />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>Cancel</button>
              <button className="btn warn" disabled={busy !== null} onClick={() => submit("request-changes", { note })}>
                {busy === "request-changes" ? "Sending…" : "Send to author"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === "manual" && (
        <div className="modal-bg" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Mark manually submitted</h3>
              <div className="sub">Records that you submitted to the external portal.</div>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>External report ID</label>
                <input className="mono" placeholder="IMM-26405-…" value={reportId} onChange={(e) => setReportId(e.target.value)} />
                <div className="hint">Required. Stored as approval.manualReportId.</div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowModal(null)}>Cancel</button>
              <button
                className="btn primary"
                disabled={busy !== null || reportId.trim().length < 3}
                onClick={() => submit("manual-submit", { manualReportId: reportId.trim(), note })}
              >
                {busy === "manual-submit" ? "Submitting…" : "Mark submitted"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
