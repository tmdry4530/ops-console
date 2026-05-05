import { clsx } from "clsx";

const variants = {
  ok: "border-[var(--ok)] text-[var(--ok)]",
  warning: "border-[var(--warning)] text-[var(--warning)]",
  danger: "border-[var(--danger)] text-[var(--danger)]",
  neutral: "border-[var(--line)] text-[var(--muted)]"
} as const;

export type StatusTone = keyof typeof variants;

export function StatusBadge({ label, tone = "neutral" }: Readonly<{ label: string; tone?: StatusTone }>) {
  return <span className={clsx("rounded-full border px-2 py-1 text-xs uppercase tracking-[0.18em]", variants[tone])}>{label}</span>;
}
