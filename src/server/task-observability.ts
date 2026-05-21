import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
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
    if (isRecord(event.metadata) && (event.metadata.stdout || event.metadata.stderr || event.metadata.reportPath || event.metadata.exitCode !== undefined || event.metadata.executedAt)) {
      return event.metadata;
    }
  }
  return {};
}

function pathIsInsideRoot(targetPath: string, rootPath: string): boolean {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export function artifactPreviewPathIsAllowed(targetPath: string): boolean {
  const allowedRoots = ["/Users/domclaw/dom-company", "/Users/domclaw/ops-console", "/tmp", tmpdir()];
  return allowedRoots.some((root) => pathIsInsideRoot(targetPath, root));
}

export async function artifactPreview(artifact: Pick<Artifact, "path" | "restricted">, maxBytes = 12_000): Promise<string | null> {
  if (artifact.restricted || !artifact.path) return null;
  return readAllowedTextFile(artifact.path, maxBytes);
}

export async function readAllowedTextFile(targetPath: string, maxBytes = 12_000): Promise<string | null> {
  const resolved = path.resolve(targetPath);
  if (!artifactPreviewPathIsAllowed(resolved)) return "[preview blocked: path outside allowlist]";
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

export type HermesRunSidecars = {
  runJsonPath: string | null;
  runJson: JsonRecord | null;
  stdoutLogPath: string | null;
  stdoutLog: string | null;
};

export function hermesRunSidecarPaths(reportPath: string | null | undefined): { runJsonPath: string | null; defaultStdoutLogPath: string | null } {
  if (!reportPath) return { runJsonPath: null, defaultStdoutLogPath: null };
  return { runJsonPath: `${reportPath}.run.json`, defaultStdoutLogPath: `${reportPath}.stdout.log` };
}

export async function hermesRunSidecars(reportPath: string | null | undefined, maxBytes = 8_000): Promise<HermesRunSidecars> {
  const { runJsonPath, defaultStdoutLogPath } = hermesRunSidecarPaths(reportPath);
  const runText = runJsonPath ? await readAllowedTextFile(runJsonPath, maxBytes) : null;
  let runJson: JsonRecord | null = null;
  if (runText && !runText.startsWith("[preview blocked")) {
    try {
      const parsed: unknown = JSON.parse(runText);
      if (isRecord(parsed)) runJson = parsed;
    } catch {
      runJson = { parseError: true, raw: shortLog(runText, 1200) };
    }
  }
  const stdoutLogPath = typeof runJson?.stdout_log_path === "string" ? runJson.stdout_log_path : defaultStdoutLogPath;
  const stdoutLog = stdoutLogPath ? await readAllowedTextFile(stdoutLogPath, maxBytes) : null;
  return { runJsonPath, runJson, stdoutLogPath, stdoutLog };
}

export function shortLog(value: unknown, max = 4000): string {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}

export function reportSummaryFromMarkdown(markdown: string, max = 1200): string {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("---"))
    .filter((line) => !line.startsWith("```"));

  const useful = lines
    .filter((line) => {
      if (/^title:|^task_id:|^agent:|^risk:|^created_at:|^scope:/i.test(line)) return false;
      if (/^\|[-:| ]+\|$/.test(line)) return false;
      return true;
    })
    .slice(0, 36)
    .join("\n");

  return shortLog(useful, max);
}

export function artifactDigest(artifact: Pick<Artifact, "title" | "path" | "restricted">, preview: string | null, max = 1000): string {
  const body = preview ? reportSummaryFromMarkdown(preview, max) : artifact.restricted ? "[restricted artifact]" : "[preview unavailable]";
  return [`**${artifact.title}**`, artifact.path ? `Path: ${artifact.path}` : null, "", body].filter(Boolean).join("\n");
}
