import { execFile } from "node:child_process";
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
};

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
    return { status: "completed", stdout, stderr, reportPath, executedAt: new Date().toISOString() };
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
