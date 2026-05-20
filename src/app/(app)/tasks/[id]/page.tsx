import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDateTimeKo } from "@/lib/korean-labels";
import { artifactPreview, hermesExecutionEvents, hermesMetadata, shortLog } from "@/server/task-observability";

export const dynamic = "force-dynamic";

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
  const previews = await Promise.all(task.artifacts.slice(0, 3).map(async (artifact) => ({ artifact, preview: await artifactPreview(artifact) })));

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/control#control-execution" className="btn ghost sm">← Control 실행</Link>
            <StatusBadge label={task.status} />
            <StatusBadge label={task.riskLevel} kind={task.riskLevel === "high" || task.riskLevel === "critical" ? "warn" : "ok"} />
          </div>
          <h1>{task.title}</h1>
          <div className="sub">{task.slug} · {task.agent?.name ?? "unassigned"} · {formatDateTimeKo(task.updatedAt)}</div>
        </div>
        <div className="actions">
          <Link href="/control#control-observability" className="btn sm">Control 관측성</Link>
          <Link href="/projects" className="btn ghost sm">프로젝트</Link>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="span-3"><MetricCard label="상태" value={task.status} /></div>
        <div className="span-3"><MetricCard label="Hermes 이벤트" value={String(hermesEvents.length)} /></div>
        <div className="span-3"><MetricCard label="산출물" value={String(task.artifacts.length)} /></div>
        <div className="span-3"><MetricCard label="승인" value={String(task.approvals.length)} /></div>
      </div>

      <div className="grid-12">
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Hermes 실행 로그</div><div className="sub">· stdout/stderr/report path</div></div>
            <div className="card-body">
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>exitCode: {String(meta.exitCode ?? "-")} · reportPath: {String(meta.reportPath ?? "-")}</div>
              <pre className="codeblock">{shortLog(meta.stdout) || "stdout 없음"}</pre>
              <pre className="codeblock" style={{ marginTop: 10 }}>{shortLog(meta.stderr) || "stderr 없음"}</pre>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">산출물 프리뷰</div></div>
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
          <div className="card"><div className="card-head"><div className="title">요약/다음 액션</div></div><div className="card-body"><div>{task.summary ?? "-"}</div><div className="muted" style={{ marginTop: 10 }}>{task.nextAction ?? "다음 액션 없음"}</div>{task.blocker && <div className="badge warn" style={{ marginTop: 10 }}>{task.blocker}</div>}</div></div>
          <div className="card"><div className="card-head"><div className="title">이벤트 타임라인</div></div><div className="card-body"><EventTimeline events={task.events.slice(0, 12)} /></div></div>
        </div>
      </div>
    </>
  );
}
