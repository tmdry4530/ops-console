import { describe, expect, it } from "vitest";
import { inferActionType, inferRiskLevel } from "./command-compiler";

describe("Command Compiler MVP", () => {
  it("infers action type from operator command", () => {
    expect(inferActionType("수집 ingest 한번 실행")).toBe("internal_sync");
    expect(inferActionType("restart dev-agent")).toBe("agent_restart");
    expect(inferActionType("deploy ops console")).toBe("deploy");
  });

  it("raises high/critical risk for dangerous command words", () => {
    expect(inferRiskLevel("delete wallet live trading")).toBe("critical");
    expect(inferRiskLevel("deploy production")).toBe("high");
    expect(inferRiskLevel("status check")).toBe("low");
  });
});
