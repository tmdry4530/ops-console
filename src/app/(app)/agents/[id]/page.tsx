import { notFound } from "next/navigation";
import Link from "next/link";
import { AgentInstructionForm } from "@/components/agent-instruction-form";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDateTimeKo, labelForHealth } from "@/lib/korean-labels";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [agent, projects] = await Promise.all([
    db.agent.findUnique({
      where: { id },
      include: { tasks: { orderBy: { updatedAt: "desc" } }, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 25 } }
    }),
    db.project.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, slug: true } })
  ]);
  if (!agent) notFound();

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/agents" className="btn ghost sm">← 에이전트 목록</Link>
            <StatusBadge label={agent.status} />
            <StatusBadge label={agent.health} kind={agent.health === "ok" ? "ok" : "warn"} />
          </div>
          <h1>{agent.name}</h1>
          <div className="sub">{agent.slug} · {agent.currentTask ?? "대기 중"}</div>
        </div>
        <div className="actions">
          <button className="btn ghost sm">일시정지</button>
          <button className="btn sm">재시작</button>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="span-3"><MetricCard label="상태" value={labelForHealth(agent.health)} /></div>
        <div className="span-3"><MetricCard label="작업 수" value={String(agent.tasks.length)} /></div>
        <div className="span-3"><MetricCard label="산출물" value={String(agent.artifacts.length)} /></div>
        <div className="span-3"><MetricCard label="이벤트" value={String(agent.events.length)} /></div>
      </div>

      <div className="grid-12">
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <AgentInstructionForm agentId={agent.id} projects={projects} />
          <div className="card">
            <div className="card-head"><div className="title">현재 작업</div></div>
            <div className="card-body">
              <div style={{ fontSize: 14, fontWeight: 500 }}>{agent.currentTask ?? "대기 중"}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                최근 상태 보고: {formatDateTimeKo(agent.heartbeatAt)}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">산출물</div></div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 8 }}>
                {agent.artifacts.map((art) => (
                  <ArtifactLink
                    key={art.id}
                    title={art.title}
                    path={art.path}
                    restricted={art.restricted}
                    commitSha={art.commitSha}
                  />
                ))}
                {agent.artifacts.length === 0 && <div className="muted">산출물 없음</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="span-4 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">권한</div></div>
            <div className="card-body">
              <ul className="bare" style={{ fontSize: 12.5 }}>
                <li><span className="sev ok" /> 외부 네트워크: 허용목록만</li>
                <li><span className="sev ok" /> 저장소 읽기: 허용</li>
                <li><span className="sev warn" /> 산출물 쓰기: 주의</li>
                <li><span className="sev danger" /> 지갑 작업: 차단</li>
              </ul>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">최근 이벤트</div></div>
            <div className="card-body">
              <EventTimeline events={agent.events.slice(0, 8)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
