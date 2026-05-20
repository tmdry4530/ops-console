import Link from "next/link";
import { labelForStatus } from "@/lib/korean-labels";
import type { ProjectAgentSection, ProjectSurfaceCard } from "@/lib/project-surface";
import { StatusBadge } from "./status-badge";

function ProjectCard({ project, context }: { project: ProjectSurfaceCard; context: "all" | "agent" }) {
  return (
    <Link key={project.id} href={`/projects/${project.id}`} className="proj-card" style={{ textDecoration: "none" }}>
      <div className="row1">
        <StatusBadge label={project.revenueType ?? "project"} dot={false} />
        <span className="right muted" style={{ fontSize: 11 }}>{labelForStatus(project.status)}</span>
      </div>
      <div className="pname">{project.name}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        {context === "agent"
          ? `담당 작업 ${project.assignmentCount}개 · 활성 ${project.activeAssignmentCount}개`
          : `연결 작업 ${project.assignmentCount}개 · 활성 ${project.activeAssignmentCount}개`}
      </div>
      {project.blocker && <div className="blocker-msg">{project.blocker}</div>}
      {project.nextAction ? <div className="next-action">{project.nextAction}</div> : <div className="muted" style={{ fontSize: 12.5 }}>다음 액션 미등록</div>}
    </Link>
  );
}

export function ProjectBoard({ allProjects, byAgent }: { allProjects: ProjectSurfaceCard[]; byAgent: ProjectAgentSection[] }) {
  return (
    <div className="vstack" style={{ gap: 20 }}>
      <section className="card">
        <div className="card-head">
          <div>
            <div className="title">전체 프로젝트</div>
            <div className="sub">Company active scope 전체 목록 · 최신 업데이트순</div>
          </div>
          <div className="right"><span className="tag">{allProjects.length} projects</span></div>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {allProjects.map((project) => <ProjectCard key={project.id} project={project} context="all" />)}
            {allProjects.length === 0 && <div className="empty">등록된 프로젝트 없음</div>}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="title">에이전트별 담당 프로젝트</div>
            <div className="sub">각 에이전트가 실제 Task로 맡고 있는 프로젝트만 분리 표시</div>
          </div>
          <div className="right"><span className="tag">{byAgent.length} agents</span></div>
        </div>
        <div className="card-body vstack" style={{ gap: 16 }}>
          {byAgent.map((section) => (
            <div key={section.agentId} className="agent-project-section">
              <div className="between" style={{ marginBottom: 8 }}>
                <div>
                  <strong>{section.agentName}</strong>
                  <div className="mono tiny">{section.agentSlug}</div>
                </div>
                <StatusBadge label={`${section.projects.length} projects`} dot={false} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {section.projects.map((project) => <ProjectCard key={`${section.agentId}-${project.id}`} project={project} context="agent" />)}
              </div>
            </div>
          ))}
          {byAgent.length === 0 && <div className="empty">아직 agent가 맡은 프로젝트 task가 없음</div>}
        </div>
      </section>
    </div>
  );
}
