import type { Route } from "next";
import Link from "next/link";
import { ProjectBoard } from "@/components/project-board";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
  return <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="text-2xl font-semibold">Projects</h2><p className="mt-2 text-sm text-[var(--muted)]">Revenue, bounty, crypto signal, blockers, and next-action board.</p><div className="mt-5"><ProjectBoard projects={projects} /></div><div className="mt-5 flex flex-wrap gap-2">{projects.map((project) => <Link className="rounded-full border border-[var(--line)] px-3 py-2 text-sm hover:border-[var(--accent)]" href={`/projects/${project.id}` as Route} key={project.id}>Open {project.slug}</Link>)}</div></section>;
}
