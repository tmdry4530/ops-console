export function MetricCard({ label, value, detail }: Readonly<{ label: string; value: string; detail: string }>) {
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl shadow-black/20">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-[var(--foreground)]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </section>
  );
}
