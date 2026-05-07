import { promises as fs } from "node:fs";
import path from "node:path";
import type { Artifact, Event } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function hermesExecutionEvents(events: Event[]) {
  return events.filter((event) => event.type.startsWith("agent.hermes.") || event.type === "agent.task.started");
}

export function hermesMetadata(events: Event[]): JsonRecord {
  for (const event of events) {
    if (isRecord(event.metadata) && (event.metadata.stdout || event.metadata.stderr || event.metadata.reportPath || event.metadata.exitCode !== undefined)) {
      return event.metadata;
    }
  }
  return {};
}

export async function artifactPreview(artifact: Pick<Artifact, "path" | "restricted">, maxBytes = 12_000): Promise<string | null> {
  if (artifact.restricted || !artifact.path) return null;
  const resolved = path.resolve(artifact.path);
  const allowedRoots = ["/Users/domclaw/dom-company", "/Users/domclaw/ops-console", "/tmp"];
  if (!allowedRoots.some((root) => resolved.startsWith(root))) return "[preview blocked: path outside allowlist]";
  const handle = await fs.open(resolved, "r").catch(() => null);
  if (!handle) return null;
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

export function shortLog(value: unknown, max = 4000): string {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}
