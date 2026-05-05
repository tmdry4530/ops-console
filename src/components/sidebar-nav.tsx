"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./icons";

const items = [
  { key: "dashboard", label: "Dashboard", icon: Icons.dashboard, href: "/dashboard" },
  { key: "approvals", label: "Approvals", icon: Icons.approvals, href: "/approvals" },
  { key: "agents", label: "Agents", icon: Icons.agents, href: "/agents" },
  { key: "projects", label: "Projects", icon: Icons.projects, href: "/projects" },
  { key: "artifacts", label: "Artifacts", icon: Icons.artifacts, href: "/artifacts" },
  { key: "events", label: "Events", icon: Icons.events, href: "/events" }
] as const;

const adminItems = [
  { key: "policies", label: "Policies", icon: Icons.policies, href: "/policies" },
  { key: "settings", label: "Settings", icon: Icons.settings, href: "/settings" }
] as const;

export function SidebarNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="nav">
      <div className="nav-section">
        <div className="nav-section-label">Workspace</div>
        {items.map((it) => (
          <Link key={it.key} href={it.href} className={`nav-item ${active(it.href) ? "active" : ""}`}>
            <span className="nav-icon">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
            {it.key === "approvals" && pendingCount > 0 && (
              <span className="nav-count alert">{pendingCount}</span>
            )}
          </Link>
        ))}
      </div>
      <div className="nav-section">
        <div className="nav-section-label">Admin</div>
        {adminItems.map((it) => (
          <Link key={it.key} href={it.href} className={`nav-item ${active(it.href) ? "active" : ""}`}>
            <span className="nav-icon">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
