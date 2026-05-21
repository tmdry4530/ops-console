import type { AgentStatus, TaskStatus } from "@prisma/client";

function slugStamp(now: Date) {
  return now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
}

export function parentDelegationStateAfterDispatch(childTaskCount: number, isoTimestamp: string): {
  parentTask: { status: TaskStatus; blocker: null; nextAction: string };
  parentEventMetadata: { orchestrationState: "waiting_children"; childTaskCount: number; delegatedAt: string };
  mainAgent: { status: AgentStatus; currentTask: null };
} {
  return {
    parentTask: {
      status: "queued",
      blocker: null,
      nextAction: `waiting_children · 0/${childTaskCount} child tasks terminal · currentStep=awaiting_child_results · statusReason=delegation_completed`
    },
    parentEventMetadata: { orchestrationState: "waiting_children", childTaskCount, delegatedAt: isoTimestamp },
    mainAgent: { status: "idle", currentTask: null }
  };
}

export function isTerminalTaskStatus(status: TaskStatus) {
  return status === "completed" || status === "failed";
}

export function planAggregationAfterChildTerminals(input: { parentTaskId: string; childStatuses: TaskStatus[]; now: Date }): {
  shouldCreateAggregation: boolean;
  aggregationTask?: {
    slugSuffix: string;
    title: string;
    status: TaskStatus;
    riskLevel: "low";
    summary: string;
    nextAction: string;
  };
  parentTask?: { status: TaskStatus; nextAction: string; blocker: null };
  mainAgent?: { status: AgentStatus; currentTask: string | null };
  eventMetadata?: { orchestrationState: "aggregation_running"; parentTaskId: string; childTaskCount: number; aggregationStartedAt: string };
} {
  if (input.childStatuses.length === 0 || !input.childStatuses.every(isTerminalTaskStatus)) {
    return { shouldCreateAggregation: false };
  }

  return {
    shouldCreateAggregation: true,
    aggregationTask: {
      slugSuffix: `aggregation-${slugStamp(input.now)}`,
      title: "HQ aggregation · child task terminal review",
      status: "queued",
      riskLevel: "low",
      summary: `Aggregate child terminal outputs for parent task ${input.parentTaskId}`,
      nextAction: "main-agent aggregation queued · verifier evidence required before parent completion"
    },
    parentTask: {
      status: "queued",
      blocker: null,
      nextAction: `aggregation_pending · child tasks terminal at ${input.now.toISOString()} · verifier gate required before completion`
    },
    mainAgent: { status: "idle", currentTask: null },
    eventMetadata: {
      orchestrationState: "aggregation_running",
      parentTaskId: input.parentTaskId,
      childTaskCount: input.childStatuses.length,
      aggregationStartedAt: input.now.toISOString()
    }
  };
}
