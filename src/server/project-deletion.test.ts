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
});
