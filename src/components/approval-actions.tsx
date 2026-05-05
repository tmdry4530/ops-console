"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalActions({ approvalId }: Readonly<{ approvalId: string }>) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [manualReportId, setManualReportId] = useState("");
  const [note, setNote] = useState("");

  async function submit(action: string, body: Record<string, string> = {}) {
    setBusy(action);
    try {
      const response = await fetch(`/api/approvals/${approvalId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <button className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#07110f]" disabled={busy !== null} onClick={() => submit("approve", { note })}>
          Approve / queue safe action
        </button>
        <button className="rounded-full border border-[var(--danger)] px-4 py-3 text-sm text-[var(--danger)]" disabled={busy !== null} onClick={() => submit("reject", { note })}>
          Reject
        </button>
        <button className="rounded-full border border-[var(--warning)] px-4 py-3 text-sm text-[var(--warning)]" disabled={busy !== null} onClick={() => submit("request-changes", { note })}>
          Request changes
        </button>
        <button className="rounded-full border border-[var(--ok)] px-4 py-3 text-sm text-[var(--ok)]" disabled={busy !== null || manualReportId.length < 3} onClick={() => submit("manual-submit", { note, manualReportId })}>
          Mark manually submitted
        </button>
      </div>
      <label className="block text-sm text-[var(--muted)]">
        Decision note
        <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--line)] bg-[#07110f] p-3 text-[var(--foreground)]" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label className="block text-sm text-[var(--muted)]">
        Manual submission report ID
        <input className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-[#07110f] p-3 text-[var(--foreground)]" value={manualReportId} onChange={(event) => setManualReportId(event.target.value)} />
      </label>
      {busy ? <p className="text-sm text-[var(--accent)]">Submitting {busy}...</p> : null}
    </div>
  );
}
