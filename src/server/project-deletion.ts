import { access, lstat, unlink } from "node:fs/promises";
import * as path from "node:path";
import { db } from "@/lib/db";

type DeleteFileResult = { deleted: string } | { skipped: string };

const protectedProjectSlugs = new Set(["ops-console", "company-ops-console", "alpha-terminal"]);

function isInsideRoot(candidate: string, root: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(root, candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

export async function safeDeleteArtifactFile(filePath: string | null | undefined, root = process.cwd()): Promise<DeleteFileResult | null> {
  if (!filePath) return null;
  const target = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  if (!isInsideRoot(target, root)) return { skipped: `outside_root:${filePath}` };
  try {
    await access(target);
  } catch {
    return null;
  }
  const stat = await lstat(target);
  if (stat.isDirectory()) return { skipped: `directory:${filePath}` };
  await unlink(target);
  return { deleted: filePath };
}

function ids<T extends { id: string }>(rows: T[]) {
  return rows.map((row) => row.id);
}

export async function deleteProjectCascade({
  projectId,
  confirm,
  actorEmail,
  root = process.cwd(),
  prisma = db
}: {
  projectId: string;
  confirm: string;
  actorEmail: string;
  root?: string;
  prisma?: any;
}) {
  if (confirm !== projectId) throw new Error("exact_project_id_confirmation_required");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, slug: true, name: true } });
  if (!project) throw new Error("project_not_found");
  if (protectedProjectSlugs.has(project.slug)) throw new Error("protected_project_cannot_be_deleted");

  const tasks = await prisma.task.findMany({ where: { projectId }, select: { id: true } });
  const taskIds = ids(tasks);
  const taskLinked = taskIds.length ? { taskId: { in: taskIds } } : { id: "__never__" };
  const approvals = await prisma.approval.findMany({ where: { OR: [{ projectId }, taskLinked] }, select: { id: true } });
  const approvalIds = ids(approvals);
  const approvalLinked = approvalIds.length ? { approvalId: { in: approvalIds } } : { id: "__never__" };
  const artifacts = await prisma.artifact.findMany({ where: { OR: [{ projectId }, taskLinked] }, select: { id: true, path: true } });
  const artifactIds = ids(artifacts);
  const artifactLinked = artifactIds.length ? { artifactId: { in: artifactIds } } : { id: "__never__" };
  const commands = await prisma.commandQueue.findMany({ where: { OR: [approvalLinked] }, select: { id: true } });
  const commandQueueIds = ids(commands);
  const commandLinked = commandQueueIds.length ? { commandQueueId: { in: commandQueueIds } } : { id: "__never__" };
  const runs = await prisma.orchestrationRun.findMany({ where: { OR: [{ projectId }, ...(taskIds.length ? [{ rootTaskId: { in: taskIds } }] : [])] }, select: { id: true } });
  const runIds = ids(runs);
  const runLinked = runIds.length ? { runId: { in: runIds } } : { id: "__never__" };

  const deletedRows = await prisma.$transaction(async (tx: typeof prisma) => {
    const controlActions = await tx.controlAction.deleteMany({ where: { OR: [runLinked, taskLinked, commandLinked, approvalLinked] } });
    const traceSpans = await tx.traceSpan.deleteMany({ where: { OR: [runLinked, taskLinked, commandLinked] } });
    const runSteps = await tx.runStep.deleteMany({ where: { OR: [runLinked, taskLinked] } });
    const events = await tx.event.deleteMany({ where: { OR: [{ projectId }, taskLinked, approvalLinked, artifactLinked, commandLinked] } });
    const commandQueues = await tx.commandQueue.deleteMany({ where: { id: { in: commandQueueIds } } });
    const artifactRows = await tx.artifact.deleteMany({ where: { id: { in: artifactIds } } });
    const approvalRows = await tx.approval.deleteMany({ where: { id: { in: approvalIds } } });
    const taskRows = await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    const runRows = await tx.orchestrationRun.deleteMany({ where: { id: { in: runIds } } });
    const projectRows = await tx.project.deleteMany({ where: { id: projectId } });
    return {
      controlActions: controlActions.count,
      traceSpans: traceSpans.count,
      runSteps: runSteps.count,
      events: events.count,
      commandQueues: commandQueues.count,
      artifacts: artifactRows.count,
      approvals: approvalRows.count,
      tasks: taskRows.count,
      orchestrationRuns: runRows.count,
      projects: projectRows.count
    };
  });

  const deletedFiles: string[] = [];
  const skippedFiles: string[] = [];
  for (const artifact of artifacts) {
    const result = await safeDeleteArtifactFile(artifact.path, root);
    if (result && "deleted" in result) deletedFiles.push(result.deleted);
    if (result && "skipped" in result) skippedFiles.push(result.skipped);
  }

  return { ok: true, projectId, actorEmail, deletedRows, deletedFiles, skippedFiles };
}
