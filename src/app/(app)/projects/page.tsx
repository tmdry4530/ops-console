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
          <div className="sub">Revenue · bounty · signal · monitoring</div>
        </div>
        <div className="actions">
          <button className="btn ghost sm">+ New project</button>
        </div>
      </div>
      <ProjectBoard projects={projects} />
    </>
  );
}
