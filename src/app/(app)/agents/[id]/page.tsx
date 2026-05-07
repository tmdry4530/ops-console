import { notFound } from "next/navigation";
import Link from "next/link";
import { AgentControlPanel } from "@/components/agent-control-panel";
import { AgentInstructionForm } from "@/components/agent-instruction-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { HQ_DEPARTMENT_AGENTS } from "@/server/hq-orchestration";
import { formatDateTimeKo, labelForAgentWorkMode, labelForHealth } from "@/lib/korean-labels";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [agent, projects] = await Promise.all([
    db.agent.findUnique({
      where: { id },
      include: { tasks: { orderBy: { updatedAt: "desc" } }, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 25 }, capabilities: { orderBy: { capabilityKey: "asc" } } }
    }),
    db.project.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, slug: true } })
  ]);
  if (!agent) notFound();
  const latestWorkEvent = agent.events.find((event) => event.type === "company.task.mirrored" || event.type === "status.ingested");

  return (
    <>
      <AutoRefresh intervalMs={7000} />
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
          <Link href="/approvals" className="btn ghost sm">승인/게이트</Link>
          <Link href="/events" className="btn sm">이벤트 스트림</Link>
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
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                작업 빈도/모드: {labelForAgentWorkMode(latestWorkEvent?.metadata ?? agent.metadata)}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">작업 목록</div></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>작업</th>
                    <th>상태</th>
                    <th>다음 액션</th>
                  </tr>
                </thead>
                <tbody>
                  {agent.tasks.slice(0, 8).map((task) => (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/tasks/${task.id}` as never} style={{ fontWeight: 500, color: "var(--text-0)", textDecoration: "none" }}>{task.title}</Link>
                        <div className="muted" style={{ fontSize: 11.5 }}>{task.slug}</div>
                      </td>
                      <td><StatusBadge label={task.status} /></td>
                      <td className="muted">{task.nextAction ?? "-"}</td>
                    </tr>
                  ))}
                  {agent.tasks.length === 0 && (
                    <tr><td colSpan={3} className="empty">작업 없음</td></tr>
                  )}
                </tbody>
              </table>
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
          <AgentControlPanel agentId={agent.id} />
          <div className="card">
            <div className="card-head"><div className="title">Capabilities / Runbook</div><div className="sub">· 허용 도구/리스크/수동 게이트</div></div>
            <div className="card-body vstack" style={{ gap: 10 }}>
              {agent.capabilities.slice(0, 5).map((cap) => (
                <div key={cap.id} className="path" style={{ alignItems: "flex-start" }}>
                  <span className="sev ok" style={{ marginTop: 3 }} />
                  <span style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{cap.capabilityKey}</div>
                    <div className="muted" style={{ fontSize: 12 }}>maxRisk {cap.maxRisk} · artifact {cap.expectedArtifactType} · approval {cap.requiresApproval ? "필요" : "불필요"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{cap.rollbackOrManualHandoff}</div>
                  </span>
                </div>
              ))}
              {agent.capabilities.length === 0 && <div className="muted">등록된 capability 없음 · 기본 정책/승인 게이트 적용</div>}
            </div>
          </div>
          {agent.slug === "hq-agent" && (
            <div className="card">
              <div className="card-head"><div className="title">HQ 오케스트레이션</div></div>
              <div className="card-body">
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                  HQ 지시는 역할 키워드에 맞춰 하위 에이전트 작업과 Discord 보고 대기 이벤트로 자동 분배됩니다.
                </div>
                <ul className="bare" style={{ fontSize: 12.5 }}>
                  {HQ_DEPARTMENT_AGENTS.map((departmentAgent) => (
                    <li key={departmentAgent.slug}>
                      <span className="sev ok" /> {departmentAgent.department}: {departmentAgent.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
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
