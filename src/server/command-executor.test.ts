import { afterEach, describe, expect, it } from "vitest";
import { processCommand, projectUpdateForCommand, type CommandExecutionPort, type QueuedCommandRecord } from "./command-executor";

const originalExternalSendEnabled = process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED;
const originalExternalSendMode = process.env.OPS_AGENT_EXTERNAL_SEND_MODE;

afterEach(() => {
  if (originalExternalSendEnabled === undefined) delete process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED;
  else process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED = originalExternalSendEnabled;
  if (originalExternalSendMode === undefined) delete process.env.OPS_AGENT_EXTERNAL_SEND_MODE;
  else process.env.OPS_AGENT_EXTERNAL_SEND_MODE = originalExternalSendMode;
});

function makePort() {
  const calls: Array<[string, unknown?]> = [];
  const port: CommandExecutionPort = {
    async markCommandRunning(id) {
      calls.push(["markCommandRunning", id]);
    },
    async markApprovalExecuting(id) {
      calls.push(["markApprovalExecuting", id]);
    },
    async completeCommand(id, result) {
      calls.push(["completeCommand", { id, result }]);
    },
    async failCommand(id, result) {
      calls.push(["failCommand", { id, result }]);
    },
    async completeApproval(id, result) {
      calls.push(["completeApproval", { id, result }]);
    },
    async completeTask(id, result) {
      calls.push(["completeTask", { id, result }]);
    },
    async updateProjectAfterCommand(id, actionType, result) {
      calls.push(["updateProjectAfterCommand", { id, actionType, result }]);
    },
    async activateHqDelegations(parentTaskId, result) {
      calls.push(["activateHqDelegations", { parentTaskId, result }]);
      return 0;
    },
    async createCommandEvent(event) {
      calls.push(["createCommandEvent", event]);
    }
  };
  return { calls, port };
}

const queuedCommand: QueuedCommandRecord = {
  id: "cmd_1",
  actionType: "internal_sync",
  riskLevel: "low",
  approvalId: "approval_1",
  payload: { projectId: "project_1", taskId: "task_1" }
};

describe("processCommand", () => {
  it("executes a queued low-risk internal command and completes linked records", async () => {
    const { calls, port } = makePort();

    const result = await processCommand(queuedCommand, port);

    expect(result.status).toBe("completed");
    expect(calls.map(([name]) => name)).toEqual([
      "markCommandRunning",
      "markApprovalExecuting",
      "createCommandEvent",
      "completeCommand",
      "completeApproval",
      "completeTask",
      "activateHqDelegations",
      "updateProjectAfterCommand",
      "createCommandEvent"
    ]);
  });

  it("refuses manual-handoff actions even if they are accidentally queued", async () => {
    const { calls, port } = makePort();

    const result = await processCommand({ ...queuedCommand, actionType: "immunefi_submit" }, port);

    expect(result.status).toBe("failed");
    expect(calls.map(([name]) => name)).toEqual(["failCommand", "createCommandEvent"]);
    expect(calls[0]?.[1]).toMatchObject({
      id: "cmd_1",
      result: { reason: "manual_handoff_required" }
    });
  });

  it("refuses revenue outreach commands because external sends need manual handoff unless enabled", async () => {
    process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED = "false";
    const { calls, port } = makePort();

    const result = await processCommand({ ...queuedCommand, actionType: "revenue_outreach", riskLevel: "medium" }, port);

    expect(result.status).toBe("failed");
    expect(calls.map(([name]) => name)).toEqual(["failCommand", "createCommandEvent"]);
    expect(calls[1]?.[1]).toMatchObject({
      type: "command.blocked_manual_handoff",
      metadata: { actionType: "revenue_outreach", riskLevel: "medium", reason: "manual_handoff_required" }
    });
  });

  it("blocks enabled revenue outreach commands without a complete send plan", async () => {
    process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED = "true";
    const { calls, port } = makePort();

    const result = await processCommand({ ...queuedCommand, actionType: "revenue_outreach", riskLevel: "medium" }, port);

    expect(result).toMatchObject({ status: "failed", reason: "external_send_plan_required" });
    expect(calls.map(([name]) => name)).toEqual(["failCommand", "createCommandEvent"]);
    expect(calls[1]?.[1]).toMatchObject({
      type: "external_send.blocked",
      metadata: { actionType: "revenue_outreach", riskLevel: "medium", reason: "external_send_plan_required" }
    });
  });

  it("runs enabled revenue outreach as dry-run when a complete send plan exists", async () => {
    process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED = "true";
    process.env.OPS_AGENT_EXTERNAL_SEND_MODE = "dry_run";
    const { calls, port } = makePort();

    const result = await processCommand({
      ...queuedCommand,
      actionType: "revenue_outreach",
      riskLevel: "medium",
      payload: {
        projectId: "project_1",
        taskId: "task_1",
        externalSendAuthorized: true,
        channel: "email",
        recipientBatchId: "agroup-20260506",
        draftArtifactId: "artifact_1",
        idempotencyKey: "send-agroup-20260506"
      }
    }, port);

    expect(result).toMatchObject({ status: "completed", reason: "dry_run_no_external_message_sent", mode: "external_send_dry_run" });
    expect(calls.map(([name]) => name)).toEqual([
      "markCommandRunning",
      "markApprovalExecuting",
      "createCommandEvent",
      "completeCommand",
      "completeApproval",
      "completeTask",
      "updateProjectAfterCommand",
      "createCommandEvent"
    ]);
    expect(calls[2]?.[1]).toMatchObject({ type: "external_send.dry_run_started" });
    expect(calls[7]?.[1]).toMatchObject({ type: "external_send.dry_run_completed" });
  });

  it("refuses high-risk commands even from an allowlisted operator network", async () => {
    const { calls, port } = makePort();

    const result = await processCommand({ ...queuedCommand, riskLevel: "high" }, port);

    expect(result.status).toBe("failed");
    expect(calls.map(([name]) => name)).toEqual(["failCommand", "createCommandEvent"]);
  });

  it("keeps generic operator instruction projects active after completion", () => {
    const update = projectUpdateForCommand("other", { status: "completed", executedAt: "2026-05-06T00:00:00.000Z", mode: "ops_console_worker" });

    expect(update).toMatchObject({ status: "active", blocker: null });
    expect(update.nextAction).toContain("Operator instruction completed");
  });

  it("marks revenue outreach projects submitted after completion", () => {
    const update = projectUpdateForCommand("revenue_outreach", { status: "completed", executedAt: "2026-05-06T00:00:00.000Z", mode: "ops_console_worker" });

    expect(update).toMatchObject({ status: "submitted", blocker: null });
  });
});
