import { StatusBadge } from "@/components/status-badge";
import type { StatusKind } from "@/components/status-badge";

export default function SettingsPage() {
  const cards: { title: string; value: string; status: StatusKind; hint: string }[] = [
    { title: "Auth proxy", value: "Reverse proxy (header injection)", status: "ok", hint: "x-ops-operator-email" },
    { title: "Database", value: "Postgres · primary", status: "ok", hint: "Production database" },
    { title: "Redis / rate-limit", value: "Not connected", status: "warn", hint: "Production hardening pending" },
    { title: "Worker pool", value: "Ingest + commands + autonomous agents", status: "ok", hint: "DB workflow workers" },
    { title: "Backup freshness", value: "Backups configured", status: "ok", hint: "S3 · object-lock" },
    { title: "Notification target", value: "Discord reports only", status: "warn", hint: "Approvals stay in Ops Console" }
  ];

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Settings</h1>
          <div className="sub">Environment, integrations, and operator surface.</div>
        </div>
      </div>
      <div className="grid-12">
        {cards.map((c) => (
          <div key={c.title} className="span-4">
            <div className="card">
              <div className="card-head">
                <div className="title">{c.title}</div>
                <div className="right">
                  <StatusBadge label={c.status === "ok" ? "ok" : "warn"} kind={c.status} dot={false} />
                </div>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-0)" }}>{c.value}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{c.hint}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-12" style={{ marginTop: 20 }}>
        <div className="span-12">
          <div className="card">
            <div className="card-head">
              <div className="title">UI access policy</div>
              <div className="sub">· Operator surface only</div>
            </div>
            <div className="card-body">
              <ul className="bare" style={{ fontSize: 13 }}>
                <li>
                  <span className="sev ok" />
                  <span style={{ flex: 1 }}>
                    Header <code className="mono">x-ops-operator-email</code> required to render any page
                  </span>
                </li>
                <li>
                  <span className="sev ok" />
                  <span style={{ flex: 1 }}>No password / 2FA / seed phrase / private key fields anywhere in the UI</span>
                </li>
                <li>
                  <span className="sev ok" />
                  <span style={{ flex: 1 }}>Plaintext tokens never persisted in UI-visible state</span>
                </li>
                <li>
                  <span className="sev warn" />
                  <span style={{ flex: 1 }}>
                    Local dev allows <code className="mono">AUTH_BYPASS_LOCAL=true</code> — disable in production
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
