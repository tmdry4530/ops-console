import { StatusBadge } from "@/components/status-badge";
import type { ProjectWorkspaceProjection, ProjectWorkspaceRole } from "@/lib/project-workspace";

function roleRingClass(status: ProjectWorkspaceRole["status"]): string {
  if (status === "running") return "role-ring running";
  if (status === "waiting_approval" || status === "queued") return "role-ring waiting";
  if (status === "blocked" || status === "failed") return "role-ring danger";
  if (status === "completed") return "role-ring done";
  if (status === "unassigned") return "role-ring unassigned";
  return "role-ring idle";
}

export function ProjectWorkspace({ workspace }: { workspace: ProjectWorkspaceProjection }) {
  return (
    <div className="project-workspace vstack" style={{ gap: 16 }}>
      <div className="card workspace-hero">
        <div className="card-head">
          <div>
            <div className="title">Project Workspace</div>
            <div className="sub">역할 버블 · 작업 진행 · 산출물/승인 게이트</div>
          </div>
          <div className="right">
            <span className="badge info"><span className="dot" />{workspace.summary.syncLabel}</span>
          </div>
        </div>
        <div className="card-body">
          <div className="workspace-metrics">
            <div>
              <div className="muted" style={{ fontSize: 12 }}>예상 진행률</div>
              <div className="workspace-progress-value">{workspace.summary.overallProgress}%</div>
            </div>
            <div className="workspace-progress-track" aria-label={`Project progress ${workspace.summary.overallProgress}%`}>
              <div className="workspace-progress-fill" style={{ width: `${workspace.summary.overallProgress}%` }} />
            </div>
            <div className="workspace-pill-set">
              <span className="badge ok"><span className="dot" />활성 {workspace.summary.activeRoleCount}</span>
              <span className={workspace.summary.blockedRoleCount > 0 ? "badge warn" : "badge muted"}><span className="dot" />게이트 {workspace.summary.blockedRoleCount}</span>
              <span className="badge info"><span className="dot" />산출물 {workspace.summary.artifactCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="workspace-role-grid">
        {workspace.roles.map((role) => (
          <div className="card workspace-role-card" key={role.key}>
            <div className="card-body">
              <div className="workspace-role-top">
                <div className={roleRingClass(role.status)}>{role.title.slice(0, 1)}</div>
                <div className="workspace-role-primary">
                  <div className="workspace-role-title">{role.title}</div>
                  <div className="mono muted workspace-role-agent">{role.agentSlug}</div>
                </div>
              </div>
              <div className="workspace-role-status">
                <StatusBadge label={role.status} />
              </div>
              <div className="workspace-role-hint">{role.capabilityHint}</div>
              <div className="workspace-role-progress"><span style={{ width: `${role.progress}%` }} /></div>
              <div className="workspace-role-counts">
                <span>Tasks {role.taskCount}</span>
                <span>Artifacts {role.artifactCount}</span>
                <span>Approvals {role.approvalCount}</span>
              </div>
              {role.activeTaskTitle ? (
                <div className="workspace-active-task">{role.activeTaskTitle}</div>
              ) : (
                <div className="workspace-active-task muted">아직 배정된 작업 없음</div>
              )}
              {role.nextAction && <div className="workspace-next-action">다음: {role.nextAction}</div>}
              {role.blocker && <div className="workspace-blocker">Blocker: {role.blocker}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
