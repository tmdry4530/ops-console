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
          <div className="sub">Company active scope · ops-console · alpha-terminal</div>
        </div>
      </div>
      <ProjectBoard projects={projects} />
    </>
  );
}
