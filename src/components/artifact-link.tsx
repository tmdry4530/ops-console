import { StatusBadge } from "./status-badge";

export function ArtifactLink({ title, path, restricted }: Readonly<{ title: string; path: string | null; restricted: boolean }>) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        {restricted ? <StatusBadge label="restricted" tone="danger" /> : <StatusBadge label="artifact" tone="neutral" />}
      </div>
      <p className="mt-2 break-all text-sm text-[var(--muted)]">{restricted ? "Content hidden due to restriction policy" : path}</p>
    </div>
  );
}
