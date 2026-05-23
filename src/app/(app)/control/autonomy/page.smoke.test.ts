import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("/control/autonomy UI smoke", () => {
  it("exposes operator controls and links to autonomy work queues", () => {
    const source = readFileSync("src/app/(app)/control/autonomy/page.tsx", "utf8");
    expect(source).toContain("/api/ops/autonomy/control-actions");
    expect(source).toContain("일시 정지");
    expect(source).toContain("Emergency Stop");
    expect(source).toContain("/projects/opportunities");
    expect(source).toContain("/projects/improvements");
    expect(source).toContain("/observe/autonomy-runs");
  });
});
