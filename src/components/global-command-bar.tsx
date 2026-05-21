"use client";

import { useMemo, useState } from "react";
import { compileGlobalCommand } from "@/server/command-compiler";
import { StatusBadge } from "./status-badge";

export function GlobalCommandBar({ agentSlugs }: { agentSlugs: string[] }) {
  const [value, setValue] = useState("/pause dev-agent --reason scope check");
  const compiled = useMemo(() => compileGlobalCommand(value), [value]);
  const examples = ["/pause main-agent --reason overload", "/scope-limit dev-agent --scope docs-only", "/rollback main-agent --reason bad deploy"];

  return (
    <div className="agentops-command-compiler" aria-label="Command Compiler">
      <div className="command-line">
        <input
          aria-label="Global Command Bar input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="/pause dev-agent --reason ..."
        />
      </div>
      <div className="command-compiler-grid">
        <div>
          <div className="eyebrow">Command Compiler</div>
          {compiled.ok ? (
            <div className="compiler-result">
              <strong>{compiled.operatorSummary}</strong>
              <span>kind: {compiled.kind} · risk: {compiled.riskLevel}</span>
              <StatusBadge label={compiled.requiresApproval ? "approval required" : "audit queue only"} kind={compiled.requiresApproval ? "warn" : "ok"} />
            </div>
          ) : (
            <div className="compiler-result danger">
              <strong>blocked</strong>
              <span>{compiled.reason}</span>
            </div>
          )}
        </div>
        <div>
          <div className="eyebrow">대상 agent</div>
          <div className="command-tags">{agentSlugs.slice(0, 8).map((slug) => <span key={slug}>{slug}</span>)}</div>
        </div>
        <div>
          <div className="eyebrow">예시</div>
          <div className="command-tags">{examples.map((example) => <button key={example} type="button" onClick={() => setValue(example)}>{example}</button>)}</div>
        </div>
      </div>
      <pre className="codeblock command-compiled-payload">{JSON.stringify(compiled.ok ? compiled.commandQueuePayload : { blockedTerms: compiled.blockedTerms }, null, 2)}</pre>
    </div>
  );
}
