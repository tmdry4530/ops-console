import { describe, expect, it } from "vitest";
import { artifactDigest, reportSummaryFromMarkdown } from "./task-observability";

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
});
