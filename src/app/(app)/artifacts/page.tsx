import { ArtifactLink } from "@/components/artifact-link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ArtifactsPage() {
  const artifacts = await db.artifact.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
  return <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="text-2xl font-semibold">Artifacts</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{artifacts.map((artifact) => <ArtifactLink key={artifact.id} path={artifact.path} restricted={artifact.restricted} title={artifact.title} />)}</div></section>;
}
