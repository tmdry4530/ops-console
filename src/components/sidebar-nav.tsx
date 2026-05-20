"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { operatorNavigationItems } from "@/lib/operator-navigation";
import { Icons } from "./icons";

const iconByKey = {
  control: Icons.dashboard,
  agents: Icons.agents,
  approvals: Icons.approvals,
  projects: Icons.projects,
  artifacts: Icons.artifacts,
  events: Icons.events
} as const;

export function SidebarNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="nav">
      <div className="nav-section">
        <div className="nav-section-label">운영 표면</div>
        {operatorNavigationItems.map((it) => (
          <Link key={it.key} href={it.href as never} className={`nav-item ${active(it.href) ? "active" : ""}`}>
            <span className="nav-icon">{iconByKey[it.key]}</span>
            <span className="nav-label">{it.label}</span>
            {it.badge === "pendingApprovals" && pendingCount > 0 && (
              <span className="nav-count alert">{pendingCount}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
