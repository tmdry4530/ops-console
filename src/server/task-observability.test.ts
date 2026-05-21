import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artifactDigest, artifactPreview, artifactPreviewPathIsAllowed, hermesRunSidecarPaths, hermesRunSidecars, reportSummaryFromMarkdown } from "./task-observability";

describe("task observability", () => {
  it("extracts a human-readable report summary from markdown headings", () => {
    const summary = reportSummaryFromMarkdown(`# Dev run report

## 구현

- API 필터 검증 추가.
- invalid status는 HTTP 400.

## 검증

- 70 passed.
`, 160);
    expect(summary).toContain("구현");
    expect(summary).toContain("API 필터 검증 추가");
    expect(summary).toContain("검증");
    expect(summary).toContain("70 passed");
  });

  it("builds an artifact digest with title, path, and preview", () => {
    const digest = artifactDigest({ title: "Dev Agent Hermes execution output", path: "/Users/domclaw/dom-company/dev/ops-console-runs/task.md", restricted: false }, "# Report\n\n## 결론\n\n작업 완료");
    expect(digest).toContain("Dev Agent Hermes execution output");
    expect(digest).toContain("/Users/domclaw/dom-company/dev/ops-console-runs/task.md");
    expect(digest).toContain("결론");
  });

  it("allows artifact previews only for exact allowlist roots or their descendants", async () => {
    expect(artifactPreviewPathIsAllowed("/Users/domclaw/ops-console/report.md")).toBe(true);
    expect(artifactPreviewPathIsAllowed("/Users/domclaw/ops-console-archive/report.md")).toBe(false);
    expect(artifactPreviewPathIsAllowed("/Users/domclaw/dom-company-malicious/report.md")).toBe(false);

    await expect(artifactPreview({ path: "/Users/domclaw/ops-console-archive/report.md", restricted: false })).resolves.toBe("[preview blocked: path outside allowlist]");
  });

  it("derives run.json and stdout sidecar paths for Hermes reports", () => {
    expect(hermesRunSidecarPaths("/Users/domclaw/dom-company/design/ops-console-runs/task.md")).toEqual({
      runJsonPath: "/Users/domclaw/dom-company/design/ops-console-runs/task.md.run.json",
      defaultStdoutLogPath: "/Users/domclaw/dom-company/design/ops-console-runs/task.md.stdout.log"
    });
  });

  it("loads Hermes run sidecars and respects stdout_log_path from run metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ops-observability-"));
    const report = join(dir, "task.md");
    const stdout = join(dir, "custom.stdout.log");
    await writeFile(report, "# Report\n\n## 핵심 결과\n\n완료", "utf8");
    await writeFile(`${report}.run.json`, JSON.stringify({ returncode: 0, output_mode: "agent_written_report_preserved", stdout_log_path: stdout }), "utf8");
    await writeFile(stdout, "Hermes transcript", "utf8");

    const sidecars = await hermesRunSidecars(report);
    expect(sidecars.runJson).toMatchObject({ returncode: 0, output_mode: "agent_written_report_preserved" });
    expect(sidecars.stdoutLogPath).toBe(stdout);
    expect(sidecars.stdoutLog).toContain("Hermes transcript");
  });
});
