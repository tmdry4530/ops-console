import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { safeDeleteArtifactFile } from "./project-deletion";

describe("project deletion", () => {
  it("deletes only artifact files inside the configured root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ops-project-delete-"));
    const insideRel = "artifacts/delete-me.md";
    const insideAbs = path.join(root, insideRel);
    await mkdir(path.dirname(insideAbs), { recursive: true });
    await writeFile(insideAbs, "delete me", "utf8");
    const outside = path.join(tmpdir(), `outside-${Date.now()}.md`);
    await writeFile(outside, "keep me", "utf8");

    try {
      await expect(safeDeleteArtifactFile(insideRel, root)).resolves.toEqual({ deleted: insideRel });
      await expect(readFile(insideAbs, "utf8")).rejects.toThrow();

      await expect(safeDeleteArtifactFile(outside, root)).resolves.toEqual({ skipped: `outside_root:${outside}` });
      await expect(readFile(outside, "utf8")).resolves.toBe("keep me");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { force: true });
    }
  });

  it("requires exact project id confirmation before destructive deletion", async () => {
    const { deleteProjectCascade } = await import("./project-deletion");
    await expect(deleteProjectCascade({ projectId: "project-1", confirm: "DELETE", actorEmail: "operator@example.invalid" })).rejects.toThrow("exact_project_id_confirmation_required");
  });

  it("skips optional cascade tables that are in schema but missing from the deployed database", async () => {
    const { deleteProjectCascade } = await import("./project-deletion");
    const missingTableError = Object.assign(new Error("The table public.OrchestrationRun does not exist in the current database."), { code: "P2021" });
    const deleted: string[] = [];
    const delegate = (name: string, rows: Array<{ id: string; path?: string | null }> = []) => ({
      findMany: async () => rows,
      deleteMany: async () => {
        deleted.push(name);
        return { count: rows.length };
      }
    });
    const missingDelegate = () => ({
      findMany: async () => {
        throw missingTableError;
      },
      deleteMany: async () => {
        throw missingTableError;
      }
    });
    const prisma = {
      project: {
        findUnique: async () => ({ id: "project-1", slug: "scratch", name: "Scratch" }),
        deleteMany: async () => {
          deleted.push("project");
          return { count: 1 };
        }
      },
      task: delegate("task", [{ id: "task-1" }]),
      approval: delegate("approval"),
      artifact: delegate("artifact"),
      commandQueue: delegate("commandQueue"),
      orchestrationRun: missingDelegate(),
      controlAction: missingDelegate(),
      traceSpan: missingDelegate(),
      runStep: missingDelegate(),
      event: delegate("event"),
      $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma)
    };

    await expect(deleteProjectCascade({ projectId: "project-1", confirm: "project-1", actorEmail: "operator@example.invalid", prisma })).resolves.toMatchObject({
      ok: true,
      deletedRows: { orchestrationRuns: 0, controlActions: 0, traceSpans: 0, runSteps: 0, projects: 1 }
    });
    expect(deleted).toContain("project");
  });
});
