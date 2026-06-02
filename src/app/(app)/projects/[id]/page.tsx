import { notFound } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { ArtifactLink } from "@/components/artifact-link";
import { DeleteProjectPanel } from "@/components/delete-project-panel";
import { EventTimeline } from "@/components/event-timeline";
import { ProjectWorkspace } from "@/components/project-workspace";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { buildProjectWorkspaceProjection } from "@/lib/project-workspace";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      approvals: { orderBy: { updatedAt: "desc" } },
      artifacts: { include: { agent: true }, orderBy: { updatedAt: "desc" } },
      tasks: { include: { agent: true }, orderBy: { updatedAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
  if (!project) notFound();
  const workspace = buildProjectWorkspaceProjection({
    project,
    tasks: project.tasks,
    approvals: project.approvals,
    artifacts: project.artifacts
  });
  const mission = typeof project.metadata === "object" && project.metadata && !Array.isArray(project.metadata) && typeof (project.metadata as Record<string, unknown>).mission === "string"
    ? String((project.metadata as Record<string, unknown>).mission)
    : project.revenueType ?? project.nextAction ?? "프로젝트 미션은 task/agent 산출물 기준으로 운영된다.";
  const parentTasks = project.tasks.filter((task) => /parent|orchestration|hq|delegated|waiting_children/i.test(`${task.title} ${task.summary ?? ""} ${task.nextAction ?? ""} ${task.agent?.slug ?? ""}`));
  const childTasks = project.tasks.filter((task) => !parentTasks.some((parent) => parent.id === task.id));
  const roleWork = project.tasks.reduce<Record<string, typeof project.tasks>>((acc, task) => {
    const key = task.agent?.slug ?? "unassigned";
    acc[key] = [...(acc[key] ?? []), task];
    return acc;
  }, {});
  const risks = [project.blocker, ...project.approvals.filter((approval) => ["pending", "approved_waiting_execution", "executing", "manual_handoff"].includes(approval.status)).map((approval) => `${approval.riskLevel}: ${approval.title}`)].filter(Boolean);
  const nextActions = [project.nextAction, ...project.tasks.filter((task) => task.nextAction).slice(0, 5).map((task) => `${task.agent?.name ?? "unassigned"}: ${task.nextAction}`)].filter(Boolean);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/projects" className="btn ghost sm">← Projects</Link>
            <StatusBadge label={project.status} />
          </div>
          <h1>{project.name}</h1>
          <div className="sub">{project.revenueType ?? project.slug}</div>
        </div>
        <div className="actions">
          <Link href={`/projects/${project.id}/conversations` as Route} className="btn sm">대화 표면</Link>
        </div>
      </div>

      {project.nextAction && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div
              style={{
                borderLeft: "2px solid var(--accent)",
                paddingLeft: 12,
                background: "linear-gradient(90deg,var(--accent-soft),transparent 70%)",
                borderRadius: "0 6px 6px 0",
                padding: "6px 12px"
              }}
            >
              {project.nextAction}
            </div>
          </div>
        </div>
      )}

      <ProjectWorkspace workspace={workspace} />

      <section className="card project-ops-room" style={{ marginTop: 16 }} aria-label="Project Operations Room">
        <div className="card-head"><div className="title">프로젝트 작전실</div><div className="sub">· mission / parent-child / role work / decisions / risks / next actions</div></div>
        <div className="card-body">
          <div className="grid-12" style={{ gap: 12 }}>
            <div className="span-6 vstack" style={{ gap: 10 }}>
              <div className="ops-block"><div className="eyebrow">Mission</div><strong>{mission}</strong></div>
              <div className="ops-block"><div className="eyebrow">Parent tasks</div>{parentTasks.slice(0, 5).map((task) => <Link key={task.id} href={`/tasks/${task.id}` as Route} className="ops-row"><span>{task.title}</span><StatusBadge label={task.status} /></Link>)}{parentTasks.length === 0 && <span className="muted">delegated parent 없음</span>}</div>
              <div className="ops-block"><div className="eyebrow">Child tasks</div>{childTasks.slice(0, 8).map((task) => <Link key={task.id} href={`/tasks/${task.id}` as Route} className="ops-row"><span>{task.agent?.name ?? "unassigned"} · {task.title}</span><StatusBadge label={task.status} /></Link>)}{childTasks.length === 0 && <span className="muted">child task 없음</span>}</div>
            </div>
            <div className="span-6 vstack" style={{ gap: 10 }}>
              <div className="ops-block"><div className="eyebrow">Role-agent work</div>{Object.entries(roleWork).slice(0, 7).map(([agentSlug, tasks]) => <div key={agentSlug} className="ops-row"><span>{agentSlug}</span><strong>{tasks.length} tasks</strong></div>)}{Object.keys(roleWork).length === 0 && <span className="muted">할당된 role work 없음</span>}</div>
              <div className="ops-block"><div className="eyebrow">Decisions</div>{project.approvals.slice(0, 5).map((approval) => <div key={approval.id} className="ops-row"><span>{approval.title}</span><StatusBadge label={approval.status} /></div>)}{project.approvals.length === 0 && <span className="muted">대기 decision 없음</span>}</div>
              <div className="ops-block"><div className="eyebrow">Risks</div>{risks.slice(0, 5).map((risk, index) => <div key={`${risk}-${index}`} className="ops-row warn"><span>{risk}</span></div>)}{risks.length === 0 && <span className="muted">열린 risk 없음</span>}</div>
              <div className="ops-block"><div className="eyebrow">Next actions</div>{nextActions.slice(0, 5).map((action, index) => <div key={`${action}-${index}`} className="ops-row"><span>{action}</span></div>)}{nextActions.length === 0 && <span className="muted">다음 액션 없음</span>}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid-12" style={{ marginTop: 16 }}>
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Approvals & blockers</div></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Risk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {project.approvals.map((a) => (
                    <tr key={a.id}>
                      <td><span className="tag">{a.type}</span></td>
                      <td>
                        <Link href="/control#approvals" style={{ fontWeight: 500, color: "var(--text-0)" }}>
                          {a.title}
                        </Link>
                      </td>
                      <td><RiskBadge risk={a.riskLevel} /></td>
                      <td><StatusBadge label={a.status} /></td>
                    </tr>
                  ))}
                  {project.approvals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted" style={{ padding: 18 }}>No approvals.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="title">Artifacts</div></div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 8 }}>
                {project.artifacts.map((art) => (
                  <ArtifactLink
                    key={art.id}
                    title={art.title}
                    path={art.path}
                    restricted={art.restricted}
                    commitSha={art.commitSha}
                  />
                ))}
                {project.artifacts.length === 0 && <div className="muted">No artifacts.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="span-4 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Summary</div></div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 8, fontSize: 13 }}>
                <div className="between">
                  <span className="muted">Status</span>
                  <span>{project.status.replace(/_/g, " ")}</span>
                </div>
                {project.blocker && (
                  <div className="between">
                    <span className="muted">Blocker</span>
                    <span style={{ color: "var(--warn)" }}>{project.blocker}</span>
                  </div>
                )}
                <div className="between">
                  <span className="muted">Slug</span>
                  <span className="mono" style={{ fontSize: 11.5 }}>{project.slug}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">Timeline</div></div>
            <div className="card-body">
              <EventTimeline events={project.events.slice(0, 8)} />
            </div>
          </div>
          <DeleteProjectPanel projectId={project.id} projectName={project.name} />
        </div>
      </div>
    </>
  );
}
