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
            <div className="sub">프라이빗 · 운영자</div>
          </div>
        </div>
        <SidebarNav pendingCount={pendingCount} />
        <div className="sidebar-foot">
          <div className="avatar">OP</div>
          <div className="sidebar-foot-meta" style={{ flex: 1, minWidth: 0 }}>
            <div className="who">운영자</div>
            <div className="where">리버스 프록시 경유</div>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <TopbarCrumbs />
          <div className="topbar-spacer" />
          <div className="private-banner">
            <span className="dot" /> 프라이빗 네트워크
          </div>
        </div>
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
