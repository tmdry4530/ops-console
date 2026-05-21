import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDateTimeKo } from "@/lib/korean-labels";
import { artifactPreview, hermesExecutionEvents, hermesMetadata, hermesRunSidecars, shortLog } from "@/server/task-observability";

export const dynamic = "force-dynamic";

function textValue(value: unknown, fallback = "-") {
  if (value == null || value === "") return fallback;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function MiniField({ label, value, warn }: { label: string; value: unknown; warn?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--line-1)", borderRadius: 10, padding: 10, background: warn ? "rgba(245, 158, 11, 0.08)" : "rgba(255,255,255,0.02)", minWidth: 0 }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, color: warn ? "var(--warn)" : "var(--text-0)", overflowWrap: "anywhere" }}>{textValue(value)}</div>
    </div>
  );
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      agent: true,
      project: true,
      approvals: { orderBy: { updatedAt: "desc" } },
      artifacts: { orderBy: { updatedAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50 }
    }
  });
  if (!task) notFound();
  const hermesEvents = hermesExecutionEvents(task.events);
  const meta = hermesMetadata(task.events);
  const reportPath = typeof meta.reportPath === "string" ? meta.reportPath : task.artifacts[0]?.path ?? null;
  const sidecars = await hermesRunSidecars(reportPath);
  const runJson = sidecars.runJson ?? {};
  const git = typeof meta.git === "object" && meta.git !== null ? meta.git as Record<string, unknown> : null;
  const kanban = typeof meta.kanban === "object" && meta.kanban !== null ? meta.kanban as Record<string, unknown> : null;
  const previews = await Promise.all(task.artifacts.slice(0, 3).map(async (artifact) => ({ artifact, preview: await artifactPreview(artifact) })));
  const stderr = textValue(meta.stderr, "");
  const hasStderr = stderr.trim().length > 0;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/control#agents" className="btn ghost sm">← 담당 에이전트</Link>
            <StatusBadge label={task.status} />
            <StatusBadge label={task.riskLevel} kind={task.riskLevel === "high" || task.riskLevel === "critical" ? "warn" : "ok"} />
          </div>
          <h1>{task.title}</h1>
          <div className="sub">{task.slug} · {task.agent?.name ?? "unassigned"} · {formatDateTimeKo(task.updatedAt)}</div>
        </div>
        <div className="actions">
          <Link href="/control#events" className="btn sm">이벤트 스트림</Link>
          <Link href="/control" className="btn ghost sm">산출물</Link>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="span-3"><MetricCard label="상태" value={task.status} /></div>
        <div className="span-3"><MetricCard label="Hermes 이벤트" value={String(hermesEvents.length)} /></div>
        <div className="span-3"><MetricCard label="산출물" value={String(task.artifacts.length)} /></div>
        <div className="span-3"><MetricCard label="exit" value={textValue(runJson.returncode ?? meta.exitCode, "-")} delta={hasStderr ? "stderr 있음" : "stderr 없음"} /></div>
      </div>

      <div className="grid-12">
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Hermes 실행 결과</div><div className="sub">· report/run.json/stdout/stderr</div></div>
            <div className="card-body vstack" style={{ gap: 12 }}>
              <div className="grid-12" style={{ gap: 10 }}>
                <div className="span-6"><MiniField label="Report path" value={reportPath} /></div>
                <div className="span-6"><MiniField label="Run metadata" value={sidecars.runJsonPath} /></div>
                <div className="span-3"><MiniField label="returncode" value={runJson.returncode ?? meta.exitCode} warn={runJson.returncode !== undefined && runJson.returncode !== 0} /></div>
                <div className="span-3"><MiniField label="output_mode" value={runJson.output_mode} /></div>
                <div className="span-3"><MiniField label="stderr_chars" value={runJson.stderr_chars ?? (hasStderr ? stderr.length : 0)} warn={Boolean((runJson.stderr_chars as number | undefined) ?? 0) || hasStderr} /></div>
                <div className="span-3"><MiniField label="git publish" value={git?.status ?? "unknown"} /></div>
                <div className="span-6"><MiniField label="Kanban task" value={kanban ? "synced" : "not recorded"} /></div>
                <div className="span-6"><MiniField label="Kanban flow" value={kanban ? Object.keys(kanban).join(" → ") : "-"} /></div>
              </div>
              {kanban && (
                <details open>
                  <summary className="muted" style={{ cursor: "pointer", marginBottom: 8 }}>Kanban sync metadata</summary>
                  <pre className="codeblock">{shortLog(kanban, 3000)}</pre>
                </details>
              )}
              {sidecars.runJson && (
                <details open>
                  <summary className="muted" style={{ cursor: "pointer", marginBottom: 8 }}>run.json 요약</summary>
                  <pre className="codeblock">{shortLog(sidecars.runJson, 3000)}</pre>
                </details>
              )}
              <details>
                <summary className="muted" style={{ cursor: "pointer", marginBottom: 8 }}>Hermes bridge stdout</summary>
                <pre className="codeblock">{shortLog(meta.stdout) || "stdout 없음"}</pre>
              </details>
              {sidecars.stdoutLog && (
                <details>
                  <summary className="muted" style={{ cursor: "pointer", marginBottom: 8 }}>Hermes CLI transcript · {sidecars.stdoutLogPath}</summary>
                  <pre className="codeblock">{shortLog(sidecars.stdoutLog, 5000)}</pre>
                </details>
              )}
              <details open={hasStderr}>
                <summary className="muted" style={{ cursor: "pointer", marginBottom: 8 }}>stderr</summary>
                <pre className="codeblock" style={hasStderr ? { borderColor: "var(--warn)" } : undefined}>{shortLog(meta.stderr) || "stderr 없음"}</pre>
              </details>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">산출물 프리뷰</div><div className="sub">· allowed local paths only</div></div>
            <div className="card-body vstack" style={{ gap: 12 }}>
              {previews.map(({ artifact, preview }) => (
                <div key={artifact.id} className="vstack" style={{ gap: 8 }}>
                  <ArtifactLink title={artifact.title} path={artifact.path} restricted={artifact.restricted} commitSha={artifact.commitSha} />
                  {preview && <pre className="codeblock">{preview}</pre>}
                </div>
              ))}
              {previews.length === 0 && <div className="muted">산출물 없음</div>}
            </div>
          </div>
        </div>
        <div className="span-4 vstack" style={{ gap: 16 }}>
          <div className="card"><div className="card-head"><div className="title">요약/다음 액션</div></div><div className="card-body"><div style={{ whiteSpace: "pre-wrap" }}>{task.summary ?? "-"}</div><div className="muted" style={{ marginTop: 10 }}>{task.nextAction ?? "다음 액션 없음"}</div>{task.blocker && <div className="badge warn" style={{ marginTop: 10 }}>{task.blocker}</div>}</div></div>
          <div className="card"><div className="card-head"><div className="title">이벤트 타임라인</div></div><div className="card-body"><EventTimeline events={task.events.slice(0, 12)} /></div></div>
        </div>
      </div>
    </>
  );
}
