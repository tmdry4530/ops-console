"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./icons";

const items = [
  { key: "dashboard", label: "대시보드", icon: Icons.dashboard, href: "/dashboard" },
  { key: "approvals", label: "승인", icon: Icons.approvals, href: "/approvals" },
  { key: "agents", label: "에이전트", icon: Icons.agents, href: "/agents" },
  { key: "projects", label: "프로젝트", icon: Icons.projects, href: "/projects" },
  { key: "artifacts", label: "산출물", icon: Icons.artifacts, href: "/artifacts" },
  { key: "events", label: "이벤트", icon: Icons.events, href: "/events" }
] as const;

const adminItems = [
  { key: "policies", label: "정책", icon: Icons.policies, href: "/policies" },
  { key: "settings", label: "설정", icon: Icons.settings, href: "/settings" }
] as const;

export function SidebarNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="nav">
      <div className="nav-section">
        <div className="nav-section-label">워크스페이스</div>
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
        <div className="nav-section-label">관리</div>
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
