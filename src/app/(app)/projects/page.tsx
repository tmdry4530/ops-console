import Link from "next/link";
import { ProjectBoard } from "@/components/project-board";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Projects</h1>
          <div className="sub">프로젝트 등록 · HQ 분배 · 역할 에이전트 Workspace</div>
        </div>
        <div className="actions">
          <Link className="btn ghost sm" href="/projects/new">+ New project</Link>
        </div>
      </div>
      <ProjectBoard projects={projects} />
    </>
  );
}
