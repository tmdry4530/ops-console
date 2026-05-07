import type { RiskLevel } from "@prisma/client";

export type AgentControlAction = "pause" | "resume" | "retry" | "restart" | "kill";

export type AgentControlTarget = { id: string; name: string; slug: string };

export type AgentControlPlan = {
  action: AgentControlAction;
  status: "queued" | "approval_required";
  riskLevel: RiskLevel;
  commandActionType: string;
  approvalTitle: string;
  approvalSummary: string;
  eventType: "agent.control.requested";
};

const HIGH_RISK_ACTIONS = new Set<AgentControlAction>(["restart", "kill"]);

export function buildAgentControlPlan(action: AgentControlAction, agent: AgentControlTarget): AgentControlPlan {
  const highRisk = HIGH_RISK_ACTIONS.has(action);
  return {
    action,
    status: highRisk ? "approval_required" : "queued",
    riskLevel: highRisk ? "high" : "medium",
    commandActionType: `agent_${action}`,
    approvalTitle: `에이전트 제어 승인 필요 · ${agent.name}`,
    approvalSummary: [
      `대상: ${agent.name} (${agent.slug})`,
      `요청 액션: ${action}`,
      highRisk ? "실제 프로세스 restart/kill은 운영 영향이 있으므로 승인 후 실행해야 합니다." : "안전한 내부 제어 요청으로 command queue에 기록합니다."
    ].join("\n"),
    eventType: "agent.control.requested"
  };
}
