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

function isMissingTableError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
  return Boolean(
    error &&
      typeof error === "object" &&
      ("code" in error && error.code === "P2021" ||
        (/table/i.test(message) && /does not exist/i.test(message)))
  );
}

async function findManyIfTableExists<T>(
  prisma: any,
  modelName: string,
  args: Record<string, unknown>,
  missingModels: Set<string>
): Promise<T[]> {
  try {
    return await prisma[modelName].findMany(args);
  } catch (error) {
    if (isMissingTableError(error)) {
      missingModels.add(modelName);
      return [];
    }
    throw error;
  }
}

async function deleteManyIfTableExists(
  tx: any,
  modelName: string,
  args: Record<string, unknown>,
  missingModels: Set<string>
) {
  if (missingModels.has(modelName)) return { count: 0 };
  try {
    return await tx[modelName].deleteMany(args);
  } catch (error) {
    if (isMissingTableError(error)) {
      missingModels.add(modelName);
      return { count: 0 };
    }
    throw error;
  }
}

async function markMissingIfTableAbsent(prisma: any, modelName: string, tableName: string, missingModels: Set<string>) {
  if (typeof prisma.$queryRawUnsafe !== "function") return;
  try {
    const escapedTableName = tableName.replace(/"/g, '""');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public."${escapedTableName}"') IS NOT NULL AS exists`
    ) as Array<{ exists: boolean }>;
    if (!rows[0]?.exists) missingModels.add(modelName);
  } catch {
    // Non-Postgres test doubles can skip this probe; Prisma errors are still caught by the query wrappers.
  }
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
  const missingModels = new Set<string>();
  await Promise.all([
    markMissingIfTableAbsent(prisma, "approval", "Approval", missingModels),
    markMissingIfTableAbsent(prisma, "artifact", "Artifact", missingModels),
    markMissingIfTableAbsent(prisma, "commandQueue", "CommandQueue", missingModels),
    markMissingIfTableAbsent(prisma, "orchestrationRun", "OrchestrationRun", missingModels),
    markMissingIfTableAbsent(prisma, "controlAction", "ControlAction", missingModels),
    markMissingIfTableAbsent(prisma, "traceSpan", "TraceSpan", missingModels),
    markMissingIfTableAbsent(prisma, "runStep", "RunStep", missingModels),
    markMissingIfTableAbsent(prisma, "event", "Event", missingModels)
  ]);
  const approvals = await findManyIfTableExists<{ id: string }>(prisma, "approval", { where: { OR: [{ projectId }, taskLinked] }, select: { id: true } }, missingModels);
  const approvalIds = ids(approvals);
  const approvalLinked = approvalIds.length ? { approvalId: { in: approvalIds } } : { id: "__never__" };
  const artifacts = await findManyIfTableExists<{ id: string; path: string | null }>(prisma, "artifact", { where: { OR: [{ projectId }, taskLinked] }, select: { id: true, path: true } }, missingModels);
  const artifactIds = ids(artifacts);
  const artifactLinked = artifactIds.length ? { artifactId: { in: artifactIds } } : { id: "__never__" };
  const commands = await findManyIfTableExists<{ id: string }>(prisma, "commandQueue", { where: { OR: [approvalLinked] }, select: { id: true } }, missingModels);
  const commandQueueIds = ids(commands);
  const commandLinked = commandQueueIds.length ? { commandQueueId: { in: commandQueueIds } } : { id: "__never__" };
  const runs = await findManyIfTableExists<{ id: string }>(prisma, "orchestrationRun", { where: { OR: [{ projectId }, ...(taskIds.length ? [{ rootTaskId: { in: taskIds } }] : [])] }, select: { id: true } }, missingModels);
  const runIds = ids(runs);
  const runLinked = runIds.length ? { runId: { in: runIds } } : { id: "__never__" };

  await Promise.all([
    findManyIfTableExists(prisma, "controlAction", { where: { id: "__never__" }, select: { id: true } }, missingModels),
    findManyIfTableExists(prisma, "traceSpan", { where: { id: "__never__" }, select: { id: true } }, missingModels),
    findManyIfTableExists(prisma, "runStep", { where: { id: "__never__" }, select: { id: true } }, missingModels),
    findManyIfTableExists(prisma, "event", { where: { id: "__never__" }, select: { id: true } }, missingModels)
  ]);

  const deletedRows = await prisma.$transaction(async (tx: typeof prisma) => {
    const controlActions = await deleteManyIfTableExists(tx, "controlAction", { where: { OR: [runLinked, taskLinked, commandLinked, approvalLinked] } }, missingModels);
    const traceSpans = await deleteManyIfTableExists(tx, "traceSpan", { where: { OR: [runLinked, taskLinked, commandLinked] } }, missingModels);
    const runSteps = await deleteManyIfTableExists(tx, "runStep", { where: { OR: [runLinked, taskLinked] } }, missingModels);
    const events = await deleteManyIfTableExists(tx, "event", { where: { OR: [{ projectId }, taskLinked, approvalLinked, artifactLinked, commandLinked] } }, missingModels);
    const commandQueues = await deleteManyIfTableExists(tx, "commandQueue", { where: { id: { in: commandQueueIds } } }, missingModels);
    const artifactRows = await deleteManyIfTableExists(tx, "artifact", { where: { id: { in: artifactIds } } }, missingModels);
    const approvalRows = await deleteManyIfTableExists(tx, "approval", { where: { id: { in: approvalIds } } }, missingModels);
    const taskRows = await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    const runRows = await deleteManyIfTableExists(tx, "orchestrationRun", { where: { id: { in: runIds } } }, missingModels);
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
