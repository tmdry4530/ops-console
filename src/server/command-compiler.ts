import { enforcePolicyForAction } from "./policy-enforcement";
import type { RiskLevel } from "@prisma/client";

const RISK_WORDS: Array<[RegExp, RiskLevel]> = [
  [/critical|긴급|위험|삭제|kill|live trading|wallet|kyc/i, "critical"],
  [/deploy|restart|외부|발송|submit|approve/i, "high"],
  [/run|sync|ingest|queue|worker/i, "medium"]
];

export type CompiledCommand = {
  actionType: string;
  riskLevel: RiskLevel;
  intent: string;
  target?: string;
  decision: Awaited<ReturnType<typeof enforcePolicyForAction>>;
  queueable: boolean;
  payload: Record<string, unknown>;
};

export function inferRiskLevel(command: string): RiskLevel {
  for (const [pattern, risk] of RISK_WORDS) if (pattern.test(command)) return risk;
  return "low";
}

export function inferActionType(command: string) {
  const text = command.toLowerCase();
  if (text.includes("ingest") || text.includes("수집")) return "internal_sync";
  if (text.includes("restart")) return "agent_restart";
  if (text.includes("pause")) return "agent_pause";
  if (text.includes("resume")) return "agent_resume";
  if (text.includes("deploy")) return "deploy";
  if (text.includes("outreach") || text.includes("발송")) return "revenue_outreach";
  return "operator_instruction";
}

export async function compileCommand(input: { command: string; actorEmail: string; traceId: string }): Promise<CompiledCommand> {
  const command = input.command.trim();
  if (command.length < 3) throw new Error("command_required");
  const actionType = inferActionType(command);
  const riskLevel = inferRiskLevel(command);
  const decision = await enforcePolicyForAction({ actionType, riskLevel, systemScope: "company" });
  const queueable = decision.decision === "allow" && riskLevel !== "high" && riskLevel !== "critical";
  return {
    actionType,
    riskLevel,
    intent: command,
    decision,
    queueable,
    payload: { command, compiledBy: input.actorEmail, compiler: "command-compiler-mvp", traceId: input.traceId }
  };
}
