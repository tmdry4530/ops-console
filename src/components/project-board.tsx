import type { Project } from "@prisma/client";
import { StatusBadge } from "./status-badge";

export function ProjectBoard({ projects }: Readonly<{ projects: Project[] }>) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={project.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{project.name}</p>
            <StatusBadge label={project.status} tone={project.status === "blocked" ? "danger" : "neutral"} />
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">Next: {project.nextAction ?? "none"}</p>
          {project.blocker ? <p className="mt-2 text-sm text-[var(--warning)]">Blocker: {project.blocker}</p> : null}
        </div>
      ))}
    </div>
  );
}
