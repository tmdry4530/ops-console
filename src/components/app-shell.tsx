import { SidebarNav } from "./sidebar-nav";
import { TopbarCrumbs } from "./topbar-crumbs";

export function AppShell({ children, pendingCount }: { children: React.ReactNode; pendingCount: number }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand-mark">O</div>
          <div className="brand-text">
            <div className="top">Ops Console</div>
            <div className="sub">private · operator</div>
          </div>
        </div>
        <SidebarNav pendingCount={pendingCount} />
        <div className="sidebar-foot">
          <div className="avatar">OP</div>
          <div className="sidebar-foot-meta" style={{ flex: 1, minWidth: 0 }}>
            <div className="who">operator</div>
            <div className="where">via reverse proxy</div>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <TopbarCrumbs />
          <div className="topbar-spacer" />
          <div className="private-banner">
            <span className="dot" /> Private network
          </div>
        </div>
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
