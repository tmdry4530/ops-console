import { describe, expect, it } from "vitest";
import { approvalWhereForCompletionFilter, normalizeApprovalCompletionFilter } from "./approval-filters";

describe("approval completion filters", () => {
  it("defaults to incomplete approvals so completed requests are hidden", () => {
    expect(normalizeApprovalCompletionFilter(undefined)).toBe("incomplete");
    expect(approvalWhereForCompletionFilter(undefined)).toEqual({ status: { not: "completed" } });
  });

  it("supports completed and all filters", () => {
    expect(normalizeApprovalCompletionFilter("completed")).toBe("completed");
    expect(approvalWhereForCompletionFilter("completed")).toEqual({ status: "completed" });

    expect(normalizeApprovalCompletionFilter("all")).toBe("all");
    expect(approvalWhereForCompletionFilter("all")).toEqual({});
  });

  it("treats unknown filter values as incomplete", () => {
    expect(normalizeApprovalCompletionFilter("done")).toBe("incomplete");
    expect(approvalWhereForCompletionFilter("done")).toEqual({ status: { not: "completed" } });
  });
});
