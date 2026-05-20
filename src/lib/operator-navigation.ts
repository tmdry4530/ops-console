export type OperatorNavigationKey = "control" | "agents" | "approvals" | "projects" | "artifacts" | "events";

export type OperatorNavigationItem = {
  key: OperatorNavigationKey;
  label: string;
  href: string;
  badge?: "pendingApprovals";
};

export type RetiredOperatorRoute = {
  href: string;
  replacement: string;
  reason: string;
};

export const operatorNavigationItems: OperatorNavigationItem[] = [
  { key: "control", label: "Control", href: "/control" },
  { key: "agents", label: "에이전트", href: "/agents" },
  { key: "approvals", label: "승인", href: "/approvals", badge: "pendingApprovals" },
  { key: "projects", label: "프로젝트", href: "/projects" },
  { key: "artifacts", label: "산출물", href: "/artifacts" },
  { key: "events", label: "이벤트", href: "/events" }
];

export const retiredOperatorRoutes: RetiredOperatorRoute[] = [
  { href: "/dashboard", replacement: "/control", reason: "duplicated by the canonical Control Center" },
  { href: "/reports", replacement: "/events", reason: "Discord report firehose is disabled; evidence belongs in Events" },
  { href: "/settings", replacement: "/control", reason: "static placeholder settings were not operator-actionable" },
  { href: "/policies", replacement: "/control", reason: "policy state is surfaced through gates instead of a dead admin menu" }
];
