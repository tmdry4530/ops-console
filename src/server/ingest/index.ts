import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { contentHash } from "./hash";
import { scanForSecretLikeContent } from "./secrets";
import { parseStatusJson } from "./status-json";

export const ingestionSources = [
  "ops/status/*.json",
  "projects/saas/data/revenue_pipeline.csv",
  "trading/status/*.md",
  "trading/reports/*.md",
  "hq/decisions/Company-Decision-Log.md",
  "docs/INDEX.md",
  "git log summary"
] as const;

export type IngestionRunSummary = {
  sourceCount: number;
  changed: number;
  skipped: number;
  restricted: number;
};

type Candidate = {
  type: "status_file" | "csv" | "report" | "decision_log" | "other";
  filePath: string;
  displayPath: string;
};

function riskLevel(value: string) {
  return (["low", "medium", "high", "critical"] as const).find((item) => item === value) ?? "low";
}

function agentStatus(value: string) {
  return (["idle", "running", "waiting_approval", "blocked", "failed", "offline"] as const).find((item) => item === value) ?? "idle";
}

function healthStatus(value: string) {
  return (["ok", "degraded", "failing", "unknown"] as const).find((item) => item === value) ?? "unknown";
}

function approvalType(value: string | undefined) {
  return (["bounty_submission", "revenue_outreach", "wallet_kyc", "live_trading", "paid_action", "deploy", "public_disclosure", "other"] as const).find((item) => item === value) ?? "other";
}

function artifactType(value: string) {
  return (["report", "poc", "csv", "decision_log", "discord_thread", "github_commit", "cron_output", "screenshot", "config_backup", "status_file", "other"] as const).find((item) => item === value) ?? "other";
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function filesInDirectory(directory: string, extension: string): Promise<string[]> {
  if (!(await pathExists(directory))) {
    return [];
  }
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => path.join(directory, entry.name));
}

function candidate(root: string, relativePath: string, type: Candidate["type"]): Candidate {
  return {
    type,
    filePath: path.join(root, relativePath),
    displayPath: root === "." ? relativePath : path.join(root, relativePath)
  };
}

async function discoverCandidatesInRoot(root: string): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const statusDir = path.join(root, "ops/status");
  for (const filePath of await filesInDirectory(statusDir, ".json")) {
    candidates.push({ type: "status_file", filePath, displayPath: root === "." ? path.relative(root, filePath) : filePath });
  }
  if (await pathExists(path.join(root, "projects/saas/data/revenue_pipeline.csv"))) candidates.push(candidate(root, "projects/saas/data/revenue_pipeline.csv", "csv"));
  for (const filePath of await filesInDirectory(path.join(root, "trading/status"), ".md")) {
    candidates.push({ type: "status_file", filePath, displayPath: root === "." ? path.relative(root, filePath) : filePath });
  }
  for (const filePath of await filesInDirectory(path.join(root, "trading/reports"), ".md")) {
    candidates.push({ type: "report", filePath, displayPath: root === "." ? path.relative(root, filePath) : filePath });
  }
  if (await pathExists(path.join(root, "hq/decisions/Company-Decision-Log.md"))) candidates.push(candidate(root, "hq/decisions/Company-Decision-Log.md", "decision_log"));
  if (await pathExists(path.join(root, "docs/INDEX.md"))) candidates.push(candidate(root, "docs/INDEX.md", "other"));
  return candidates;
}

async function discoverCandidates(): Promise<Candidate[]> {
  const roots = [".", process.env.COMPANY_DATA_ROOT ?? "/Users/domclaw/dom-company"];
  const uniqueRoots = Array.from(new Set(roots.filter(Boolean)));
  const candidates = (await Promise.all(uniqueRoots.map((root) => discoverCandidatesInRoot(root)))).flat();
  const seen = new Set<string>();
  return candidates.filter((item) => {
    if (seen.has(item.filePath)) return false;
    seen.add(item.filePath);
    return true;
  });
}

export async function runIngestionSkeleton(): Promise<IngestionRunSummary> {
  const candidates = await discoverCandidates();
  let changed = 0;
  let skipped = 0;
  let restricted = 0;

  for (const candidate of candidates) {
    const content = await readFile(candidate.filePath, "utf8");
    const hash = contentHash(content);
    const existing = await db.artifact.findUnique({ where: { contentHash: hash } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const scan = scanForSecretLikeContent(content);
    if (scan.restricted) restricted += 1;

    if (candidate.filePath.endsWith(".json") && candidate.type === "status_file") {
      const status = parseStatusJson(content);
      const agent = await db.agent.upsert({
        where: { slug: status.agent_id },
        update: { status: agentStatus(status.status), health: healthStatus(status.health_status), currentTask: status.task_id, heartbeatAt: new Date(status.updated_at) },
        create: { slug: status.agent_id, name: status.agent_id, status: agentStatus(status.status), health: healthStatus(status.health_status), currentTask: status.task_id, heartbeatAt: new Date(status.updated_at) }
      });
      const project = await db.project.upsert({
        where: { slug: status.project_id },
        update: { nextAction: status.next_action, blocker: status.current_blocker },
        create: { slug: status.project_id, name: status.project_id, nextAction: status.next_action, blocker: status.current_blocker }
      });
      const task = await db.task.upsert({
        where: { slug: status.task_id },
        update: { status: status.needs_approval ? "waiting_approval" : "running", riskLevel: riskLevel(status.risk_level), summary: status.summary, blocker: status.current_blocker, nextAction: status.next_action, agentId: agent.id, projectId: project.id },
        create: { slug: status.task_id, title: status.task_id, status: status.needs_approval ? "waiting_approval" : "running", riskLevel: riskLevel(status.risk_level), summary: status.summary, blocker: status.current_blocker, nextAction: status.next_action, agentId: agent.id, projectId: project.id }
      });
      for (const item of status.artifacts) {
        await db.artifact.upsert({
          where: { contentHash: contentHash(`${item.path}:${item.commit ?? ""}`) },
          update: { path: item.path, commitSha: item.commit, agentId: agent.id, projectId: project.id, taskId: task.id },
          create: { type: artifactType(item.type), title: item.path, path: item.path, commitSha: item.commit, contentHash: contentHash(`${item.path}:${item.commit ?? ""}`), restricted: scan.restricted, restrictionReason: scan.restricted ? "secret-like content detected" : null, agentId: agent.id, projectId: project.id, taskId: task.id }
        });
      }
      if (status.needs_approval) {
        await db.approval.upsert({
          where: { externalKey: `${status.task_id}:${approvalType(status.approval_type)}` },
          update: { riskLevel: riskLevel(status.risk_level), projectId: project.id, taskId: task.id },
          create: { externalKey: `${status.task_id}:${approvalType(status.approval_type)}`, type: approvalType(status.approval_type), status: "pending", riskLevel: riskLevel(status.risk_level), title: `Approve ${status.task_id}`, summary: status.summary, projectId: project.id, taskId: task.id, requestedBy: agent.id }
        });
      }
      await db.event.create({ data: { type: "status.ingested", severity: scan.restricted ? "critical" : "info", message: `Status ingested: ${candidate.displayPath}`, agentId: agent.id, projectId: project.id, taskId: task.id } });
      changed += 1;
      continue;
    }

    const artifact = await db.artifact.create({
      data: {
        type: candidate.type,
        title: candidate.displayPath,
        path: candidate.displayPath,
        contentHash: hash,
        restricted: scan.restricted,
        restrictionReason: scan.restricted ? "secret-like content detected" : null
      }
    });

    await db.event.create({
      data: {
        type: scan.restricted ? "artifact.restricted" : "artifact.ingested",
        severity: scan.restricted ? "critical" : "info",
        message: scan.restricted ? `Restricted artifact detected: ${candidate.displayPath}` : `Artifact ingested: ${candidate.displayPath}`,
        artifactId: artifact.id
      }
    });
    changed += 1;
  }

  return { sourceCount: ingestionSources.length, changed, skipped, restricted };
}
