import { describe, expect, it } from "vitest";
import { parseStatusJson } from "./status-json";

describe("parseStatusJson", () => {
  it("accepts the required v1 status contract", () => {
    const parsed = parseStatusJson(JSON.stringify({
      schema_version: "1.0",
      agent_id: "trading-bounty",
      project_id: "capyfi-bounty",
      task_id: "capyfi-oracle-report",
      status: "waiting_approval",
      health_status: "ok",
      summary: "Submission-ready report prepared",
      needs_approval: true,
      approval_type: "bounty_submission",
      risk_level: "medium",
      artifacts: [{ type: "report", path: "trading/reports/report.md", commit: "9fba2ad" }],
      next_action: "Submit after scope check",
      updated_at: "2026-05-05T12:00:00+09:00"
    }));

    expect(parsed.agent_id).toBe("trading-bounty");
    expect(parsed.artifacts).toHaveLength(1);
  });
});
