import Link from "next/link";

const navItems = [
  ["Dashboard", "/dashboard"],
  ["Approvals", "/approvals"],
  ["Agents", "/agents"],
  ["Projects", "/projects"],
  ["Artifacts", "/artifacts"],
  ["Events", "/events"],
  ["Policies", "/policies"],
  ["Settings", "/settings"]
] as const;

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen border-x border-[var(--line)] bg-[rgba(7,17,15,0.82)] lg:mx-6">
      <header className="border-b border-[var(--line)] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.42em] text-[var(--accent)]">Production-private</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Company Ops Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Agent operations control plane for audited approvals, artifacts, project state, and safe continuation workflows.
            </p>
          </div>
          <div className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[var(--ok)]">
            Private network required
          </div>
        </div>
        <nav className="mt-6 flex flex-wrap gap-2">
          {navItems.map(([label, href]) => (
            <Link
              className="rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="px-5 py-6">{children}</main>
    </div>
  );
}
