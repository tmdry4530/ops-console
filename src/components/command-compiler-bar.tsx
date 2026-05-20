"use client";

import { useState } from "react";

export function CommandCompilerBar() {
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    if (command.trim().length < 3) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/control/command/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "compile_failed");
      setResult(`${json.status} · ${json.compiled.actionType} · ${json.compiled.decision.decision} · trace ${json.traceId}`);
      setCommand("");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "compile_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="control-command-compiler">
      <input
        aria-label="Command Compiler"
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
        placeholder="명령 입력: ingest run, agent pause, deploy gate..."
      />
      <button className="btn sm" type="button" disabled={busy || command.trim().length < 3} onClick={() => void submit()}>{busy ? "컴파일 중" : "Compile"}</button>
      {result && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{result}</div>}
    </div>
  );
}
