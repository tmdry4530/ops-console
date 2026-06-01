import type { Project } from "@prisma/client";
import Link from "next/link";
import { labelForStatus } from "@/lib/korean-labels";
import { StatusBadge } from "./status-badge";

type ProjectView = Project & {
  lifecycleBucket?: "active" | "paused" | "archived" | "stale";
  noiseClass?: "none" | "smoke_test" | "old_intake" | "unrelated_side_research";
  defaultHidden?: boolean;
  hideReason?: string;
};

const staleAfterMs = 14 * 24 * 60 * 60 * 1000;

function textFor(project: Project) {
  return `${project.slug} ${project.name} ${project.revenueType ?? ""} ${project.nextAction ?? ""} ${project.blocker ?? ""}`.toLowerCase();
}

export function classifyProject(project: Project, now = new Date()): ProjectView {
  const haystack = textFor(project);
  const updatedAt = new Date(project.updatedAt).getTime();
  const isStale = Number.isFinite(updatedAt) && now.getTime() - updatedAt > staleAfterMs;
  const metadata = (project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata) ? project.metadata : {}) as Record<string, unknown>;
  const metadataState = String(metadata.opsState ?? metadata.lifecycle ?? "").toLowerCase();
  const noiseClass = /smoke|fixture|sample|demo|test-only/.test(haystack)
    ? "smoke_test"
    : /old[-_ ]?intake|legacy intake|project-intake/.test(haystack)
      ? "old_intake"
      : /side research|unrelated|market opportunity|speculative/.test(haystack)
        ? "unrelated_side_research"
        : "none";
  const lifecycleBucket = project.status === "archived" || project.status === "completed"
    ? "archived"
    : metadataState === "paused" || project.status === "blocked"
      ? "paused"
      : isStale
        ? "stale"
        : "active";
  const defaultHidden = lifecycleBucket === "archived" || lifecycleBucket === "stale" || noiseClass !== "none";
  const hideReason = defaultHidden
    ? noiseClass !== "none"
      ? noiseClass.replaceAll("_", " ")
      : lifecycleBucket
    : undefined;
  return { ...project, lifecycleBucket, noiseClass, defaultHidden, hideReason };
}

export function ProjectBoard({ projects }: { projects: Project[] }) {
  const classified = projects.map((project) => classifyProject(project));
  const visible = classified.filter((project) => !project.defaultHidden);
  const hidden = classified.filter((project) => project.defaultHidden);
  const buckets = classified.reduce<Record<string, number>>((acc, project) => {
    const key = project.lifecycleBucket ?? "active";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="project-workbench">
      <section className="project-taxonomy" aria-label="Project taxonomy summary">
        <div><span>기본 표시</span><strong>{visible.length}</strong><em>active / paused</em></div>
        <div><span>숨김</span><strong>{hidden.length}</strong><em>stale · archived · smoke</em></div>
        <div><span>Active</span><strong>{buckets.active ?? 0}</strong><em>오늘 볼 프로젝트</em></div>
        <div><span>Paused/Stale</span><strong>{(buckets.paused ?? 0) + (buckets.stale ?? 0)}</strong><em>분리 관리</em></div>
      </section>
      <div className="project-board-grid">
        {visible.map((p) => <ProjectCard key={p.id} project={p} />)}
        {visible.length === 0 && <div className="empty project-empty">기본 노출 프로젝트 없음. 숨김 섹션에서 stale/smoke 항목을 확인하세요.</div>}
      </div>
      {hidden.length > 0 && (
        <details className="project-hidden-panel">
          <summary>기본 숨김 항목 보기 · {hidden.length}개</summary>
          <div className="project-board-grid compact">
            {hidden.slice(0, 48).map((p) => <ProjectCard key={p.id} project={p} compact />)}
          </div>
        </details>
      )}
    </div>
  );
}

function ProjectCard({ project: p, compact = false }: { project: ProjectView; compact?: boolean }) {
  return (
    <Link href={`/projects/${p.id}`} className={`proj-card ${compact ? "compact" : ""}`} style={{ textDecoration: "none" }}>
      <div className="row1">
        <StatusBadge label={p.lifecycleBucket ?? labelForStatus(p.status)} dot={false} />
        <span className="right muted" style={{ fontSize: 11 }}>{p.noiseClass && p.noiseClass !== "none" ? p.noiseClass.replaceAll("_", " ") : labelForStatus(p.status)}</span>
      </div>
      <div className="pname">{p.name}</div>
      {p.blocker && <div className="blocker-msg">{p.blocker}</div>}
      {p.nextAction ? <div className="next-action">{p.nextAction}</div> : <div className="muted" style={{ fontSize: 12.5 }}>다음 액션 미등록</div>}
      {p.hideReason && <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>숨김 사유: {p.hideReason}</div>}
    </Link>
  );
}
