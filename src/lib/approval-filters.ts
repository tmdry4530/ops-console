export type ApprovalCompletionFilter = "incomplete" | "completed" | "all";

export function normalizeApprovalCompletionFilter(value: string | string[] | undefined): ApprovalCompletionFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "completed" || raw === "all" || raw === "incomplete") {
    return raw;
  }
  return "incomplete";
}

export function approvalWhereForCompletionFilter(value: string | string[] | undefined) {
  const filter = normalizeApprovalCompletionFilter(value);
  if (filter === "completed") {
    return { status: "completed" as const };
  }
  if (filter === "all") {
    return {};
  }
  return { status: { not: "completed" as const } };
}
