import { ProjectBoard } from "@/components/project-board";
import { db } from "@/lib/db";
import { buildProjectSurface } from "@/lib/project-surface";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      tasks: {
        orderBy: { updatedAt: "desc" },
        include: { agent: true }
      }
    }
  });
  const surface = buildProjectSurface(projects);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>프로젝트</h1>
          <div className="sub">전체 프로젝트와 agent별 담당 프로젝트를 분리해서 본다.</div>
        </div>
      </div>
      <ProjectBoard allProjects={surface.allProjects} byAgent={surface.byAgent} />
    </>
  );
}
