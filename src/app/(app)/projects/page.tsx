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
          <div className="sub">active/paused만 기본 표시 · stale/smoke/old intake는 접어서 보관</div>
        </div>
        <div className="actions">
          <Link className="btn ghost sm" href="/projects/new">+ New project</Link>
        </div>
      </div>
      <ProjectBoard projects={projects} />
    </>
  );
}
