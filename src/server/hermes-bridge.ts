import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import type { RiskLevel } from "@prisma/client";

const execFileAsync = promisify(execFile);

export type HermesBridgeTask = {
  id: string;
  title: string;
  summary: string | null;
  riskLevel: RiskLevel;
  projectId?: string | null;
  agent: { id: string; slug: string; name: string } | null;
};

export type HermesBridgeDecision = {
  enabled: boolean;
  reason: "enabled" | "disabled" | "unsupported_agent" | "risk_not_allowed";
};

const DEPARTMENT_BY_AGENT: Record<string, string> = {
  "main-agent": "main",
  "research-agent": "research",
  "projects-agent": "projects",
  "dev-agent": "dev",
  "content-agent": "content",
  "trading-agent": "trading",
  "docs-agent": "docs"
};

function safeTaskSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").slice(0, 80);
}

function departmentForAgent(slug: string): string | null {
  return DEPARTMENT_BY_AGENT[slug] ?? null;
}

export function hermesReportPathForTask(task: HermesBridgeTask, companyRoot = process.env.COMPANY_DATA_ROOT ?? "/Users/domclaw/dom-company"): string {
  const department = task.agent ? departmentForAgent(task.agent.slug) ?? "main" : "main";
  return `${companyRoot}/${department}/ops-console-runs/${safeTaskSlug(task.id)}.md`;
}

export function hermesBridgeDecision(task: HermesBridgeTask, env: Record<string, string | undefined> = process.env): HermesBridgeDecision {
  if (env.OPS_AGENT_HERMES_EXEC_ENABLED !== "true") return { enabled: false, reason: "disabled" };
  if (!task.agent || !departmentForAgent(task.agent.slug)) return { enabled: false, reason: "unsupported_agent" };
  if (task.riskLevel !== "low" && task.riskLevel !== "medium") return { enabled: false, reason: "risk_not_allowed" };
  return { enabled: true, reason: "enabled" };
}

export function buildHermesCompanyTaskPrompt(task: HermesBridgeTask, companyRoot = process.env.COMPANY_DATA_ROOT ?? "/Users/domclaw/dom-company"): string {
  const department = task.agent ? departmentForAgent(task.agent.slug) ?? "main" : "main";
  const reportPath = hermesReportPathForTask(task, companyRoot);
  return [
    `너는 Company ${department} 에이전트다.`,
    "Ops Console에서 승인되어 실행되는 실제 하위 작업이다.",
    "",
    `Task ID: ${task.id}`,
    `Agent: ${task.agent?.slug ?? "unknown"}`,
    `Risk: ${task.riskLevel}`,
    `Title: ${task.title}`,
    `Summary: ${task.summary ?? "없음"}`,
    "",
    "작업 규칙:",
    "- safe/internal 작업만 수행한다.",
    "- 외부 발송, 결제, 지갑, KYC, 배포, public disclosure는 하지 말고 Ops Console 승인 필요로 보고한다.",
    "- secret/token/env 값은 출력하지 않는다.",
    `- 결과를 ${reportPath} 에 저장한다.`,
    "- 보고서에는 반드시 '## 핵심 결과', '## 변경/생성 파일', '## 근거/검증', '## 다음 액션' 섹션을 채운다.",
    "- operator가 GitHub에서 바로 볼 수 있게 실제 작업 내용·근거·파일 경로를 구체적으로 쓴다. 상태만 쓰지 않는다.",
    `- 가능하면 Company Discord ${department} 채널에 한국어로 짧게 실제 보고한다.`,
    "- 최종 답변에는 저장 파일, 검증 결과, 다음 액션만 짧게 남긴다."
  ].join("\n");
}

export type HermesRunResult = {
  status: "completed" | "failed";
  stdout: string;
  stderr: string;
  reportPath: string;
  executedAt: string;
  git?: CompanyReportPublishResult;
};

export type CompanyReportPublishResult = {
  enabled: boolean;
  status: "disabled" | "skipped" | "committed" | "failed";
  commit?: string;
  stdout?: string;
  stderr?: string;
  reason?: string;
};

function reportPathIsInsideCompanyRoot(reportPath: string, companyRoot: string): boolean {
  const root = path.resolve(companyRoot);
  const target = path.resolve(reportPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export function shouldPublishCompanyReport(env: Record<string, string | undefined> = process.env): boolean {
  return env.OPS_AGENT_COMPANY_GIT_PUBLISH_ENABLED !== "false";
}

export async function publishCompanyReportToGit(reportPath: string, task: HermesBridgeTask, companyRoot = process.env.COMPANY_DATA_ROOT ?? "/Users/domclaw/dom-company", env: Record<string, string | undefined> = process.env): Promise<CompanyReportPublishResult> {
  if (!shouldPublishCompanyReport(env)) return { enabled: false, status: "disabled", reason: "OPS_AGENT_COMPANY_GIT_PUBLISH_ENABLED=false" };
  if (!reportPathIsInsideCompanyRoot(reportPath, companyRoot)) return { enabled: true, status: "skipped", reason: "report_path_outside_company_root" };

  const relativeReportPath = path.relative(companyRoot, reportPath);
  const commitMessage = `docs: publish ${task.agent?.slug ?? "company"} work ${task.id.slice(0, 12)}`;
  try {
    await execFileAsync("git", ["add", "--", relativeReportPath], { cwd: companyRoot, timeout: 30_000, maxBuffer: 1024 * 1024 });
    const staged = await execFileAsync("git", ["diff", "--cached", "--name-only", "--", relativeReportPath], { cwd: companyRoot, timeout: 30_000, maxBuffer: 1024 * 1024 });
    if (!staged.stdout.trim()) return { enabled: true, status: "skipped", reason: "no_report_changes" };
    const commit = await execFileAsync("git", ["commit", "-m", commitMessage], { cwd: companyRoot, timeout: 60_000, maxBuffer: 1024 * 1024 });
    const push = await execFileAsync("git", ["push"], { cwd: companyRoot, timeout: 120_000, maxBuffer: 1024 * 1024 });
    const rev = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: companyRoot, timeout: 30_000, maxBuffer: 1024 * 1024 });
    return { enabled: true, status: "committed", commit: rev.stdout.trim(), stdout: `${commit.stdout}\n${push.stdout}`.trim(), stderr: `${commit.stderr}\n${push.stderr}`.trim() };
  } catch (error) {
    const err = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    return { enabled: true, status: "failed", stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? err.message ?? "git_publish_failed") };
  }
}

export async function runHermesCompanyTask(task: HermesBridgeTask): Promise<HermesRunResult> {
  const companyRoot = process.env.COMPANY_DATA_ROOT ?? "/Users/domclaw/dom-company";
  const hermes = process.env.OPS_AGENT_HERMES_CLI ?? "/Users/domclaw/.hermes/hermes-agent/venv/bin/hermes";
  const timeout = Number(process.env.OPS_AGENT_HERMES_TIMEOUT_MS ?? 900000);
  const prompt = buildHermesCompanyTaskPrompt(task, companyRoot);
  const reportPath = hermesReportPathForTask(task, companyRoot);
  try {
    const { stdout, stderr } = await execFileAsync(hermes, ["--profile", "company", "chat", "-q", prompt], {
      cwd: companyRoot,
      timeout,
      maxBuffer: 1024 * 1024 * 2
    });
    const git = await publishCompanyReportToGit(reportPath, task, companyRoot);
    return { status: "completed", stdout, stderr, reportPath, executedAt: new Date().toISOString(), git };
  } catch (error) {
    const err = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    return {
      status: "failed",
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? err.message ?? "hermes_execution_failed"),
      reportPath,
      executedAt: new Date().toISOString()
    };
  }
}
