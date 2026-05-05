import { StatusBadge } from "@/components/status-badge";

export default function SettingsPage() {
  return <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="text-2xl font-semibold">Settings</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4"><p className="font-semibold">Environment</p><p className="mt-2 text-sm text-[var(--muted)]">Production-private deployment defaults are configured through env and Docker Compose.</p></div><div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4"><p className="font-semibold">Notifications</p><p className="mt-2 text-sm text-[var(--muted)]">Notification implementation is represented by audit/event emission placeholder.</p></div><StatusBadge label="integration placeholders" tone="neutral" /></div></section>;
}
