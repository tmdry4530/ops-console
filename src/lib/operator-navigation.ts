export type OperatorNavigationKey = "control" | "projects" | "decisions" | "observe";

export type OperatorNavigationItem = {
  key: OperatorNavigationKey;
  label: string;
  href: string;
  mode: "control" | "operations" | "decision" | "observe";
};

export type RetiredOperatorRoute = {
  href: string;
  replacement: string;
  reason: string;
};

export const operatorNavigationItems: OperatorNavigationItem[] = [
  { key: "control", label: "Control", href: "/control", mode: "control" },
  { key: "projects", label: "프로젝트", href: "/projects", mode: "operations" },
  { key: "decisions", label: "결정", href: "/decisions", mode: "decision" },
  { key: "observe", label: "관측", href: "/observe", mode: "observe" }
];

export const retiredOperatorRoutes: RetiredOperatorRoute[] = [
  { href: "/agents", replacement: "/observe/agents", reason: "agent status is observation, not a standalone CRUD menu; agent intervention stays in Control" },
  { href: "/approvals", replacement: "/decisions", reason: "approval is now one kind of human decision queue" },
  { href: "/events", replacement: "/observe", reason: "event stream belongs to the read-only Observe dashboard" },
  { href: "/artifacts", replacement: "/projects", reason: "artifact evidence stays in project/task context; future vault is separate from CRUD artifacts" },
  { href: "/dashboard", replacement: "/observe", reason: "dashboard metrics are split into Observe instead of a duplicated dashboard menu" },
  { href: "/reports", replacement: "/projects", reason: "reports are project/task artifacts, not a standalone report CRUD surface" },
  { href: "/settings", replacement: "/control", reason: "static settings remain out of the operator top-level until actionable controls exist" },
  { href: "/policies", replacement: "/control", reason: "policy affects command/autonomy control but is not restored as a standalone CRUD menu" }
];
