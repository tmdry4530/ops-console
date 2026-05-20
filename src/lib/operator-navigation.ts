export type OperatorNavigationKey = "control" | "projects";

export type OperatorNavigationItem = {
  key: OperatorNavigationKey;
  label: string;
  href: string;
};

export type RetiredOperatorRoute = {
  href: string;
  replacement: string;
  reason: string;
};

export const operatorNavigationItems: OperatorNavigationItem[] = [
  { key: "control", label: "Control", href: "/control" },
  { key: "projects", label: "프로젝트", href: "/projects" }
];

export const retiredOperatorRoutes: RetiredOperatorRoute[] = [
  { href: "/agents", replacement: "/control", reason: "standalone agent page was removed; agent runtime/quality belongs inside Control responsibility sections" },
  { href: "/approvals", replacement: "/control", reason: "approval gates are now a Control risk responsibility, not a separate menu" },
  { href: "/events", replacement: "/control", reason: "event stream is now Control observability, not a standalone menu" },
  { href: "/artifacts", replacement: "/control", reason: "artifact evidence is surfaced through Control/task/project context instead of a separate menu" },
  { href: "/dashboard", replacement: "/control", reason: "duplicated by the canonical Control Center" },
  { href: "/reports", replacement: "/control", reason: "Discord report firehose is disabled; evidence belongs in Control observability" },
  { href: "/settings", replacement: "/control", reason: "static placeholder settings were not operator-actionable" },
  { href: "/policies", replacement: "/control", reason: "policy state is surfaced through gates instead of a dead admin menu" }
];
