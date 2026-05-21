import { describe, expect, it, vi } from "vitest";
import {
  getConsoleBridgeAgents,
  getConsoleBridgeApprovals,
  getConsoleBridgeCommands,
  getConsoleBridgeEvents,
  getConsoleBridgeSummary,
  getConsoleBridgeTasks,
} from "./console-bridge";

const now = new Date("2026-05-14T11:00:00.000Z");

function createDb() {
  return {
    approval: {
      findMany: vi.fn(async () => [
        {
          id: "approval-1",
          title: "Deploy worker handoff",
          status: "pending",
          type: "deploy",
          riskLevel: "high",
          summary: "Needs operator approval",
          project: { id: "project-1", slug: "ops", name: "Ops Console" },
          task: { id: "task-1", slug: "handoff", title: "Worker handoff" },
          updatedAt: now,
          createdAt: now,
        },
      ]),
      count: vi.fn(async () => 1),
    },
    task: {
      findMany: vi.fn(async () => [
        {
          id: "task-2",
          slug: "blocked-task",
          title: "Blocked task",
          status: "waiting_approval",
          riskLevel: "medium",
          blocker: "Needs review",
          nextAction: "Review approval",
          agent: { id: "agent-1", slug: "dev-agent", name: "Dev Agent" },
          project: { id: "project-1", slug: "ops", name: "Ops Console" },
          updatedAt: now,
          createdAt: now,
        },
      ]),
      count: vi.fn(async () => 1),
    },
    agent: {
      findMany: vi.fn(async () => [
        {
          id: "agent-1",
          slug: "dev-agent",
          name: "Dev Agent",
          status: "running",
          health: "ok",
          heartbeatAt: now,
          currentTask: "Bridge UI",
          metadata: { apiKey: "SHOULD_NOT_LEAK", safe: "ignored" },
          updatedAt: now,
          createdAt: now,
        },
      ]),
      count: vi.fn(async (args) => {
        const where = (args as { where?: { NOT?: unknown } })?.where;
        return where?.NOT ? 1 : 2;
      }),
    },
    event: {
      findMany: vi.fn(async () => [
        {
          id: "event-1",
          type: "agent.blocked",
          severity: "critical",
          message: "Agent blocked",
          metadata: { token: "SHOULD_NOT_LEAK", safe: "ok" },
          createdAt: now,
        },
      ]),
      count: vi.fn(async () => 1),
    },
    commandQueue: {
      findMany: vi.fn(async () => [
        {
          id: "command-1",
          actionType: "internal_sync",
          status: "queued",
          riskLevel: "low",
          approvalId: "approval-1",
          payload: { token: "SHOULD_NOT_LEAK" },
          result: { secret: "SHOULD_NOT_LEAK" },
          updatedAt: now,
          createdAt: now,
        },
      ]),
      count: vi.fn(async () => 1),
    },
  };
}

describe("getConsoleBridgeSummary", () => {
  it("returns a read-only approvals/blockers summary without secret-like metadata", async () => {
    const summary = await getConsoleBridgeSummary(createDb());

    expect(summary.mode).toBe("read_only");
    expect(summary.counts).toMatchObject({
      pendingApprovals: 1,
      blockedTasks: 1,
      activeAgents: 1,
      criticalEvents: 1,
      queuedCommands: 1,
    });
    expect(summary.approvals[0]).toMatchObject({
      id: "approval-1",
      title: "Deploy worker handoff",
      status: "pending",
      riskLevel: "high",
      project: { slug: "ops" },
      task: { slug: "handoff" },
    });
    expect(summary.blockers[0]).toMatchObject({
      id: "task-2",
      title: "Blocked task",
      status: "waiting_approval",
      blocker: "Needs review",
      agent: { slug: "dev-agent" },
    });
    expect(JSON.stringify(summary)).not.toContain("SHOULD_NOT_LEAK");
  });

  it("returns read-only drilldown lists for approvals, tasks, and events", async () => {
    const db = createDb();

    const approvals = await getConsoleBridgeApprovals(db, { limit: 25 });
    const tasks = await getConsoleBridgeTasks(db, { limit: 25 });
    const events = await getConsoleBridgeEvents(db, { limit: 25 });

    expect(approvals.mode).toBe("read_only");
    expect(approvals.total).toBe(1);
    expect(approvals.items[0]?.title).toBe("Deploy worker handoff");
    expect(tasks.total).toBe(1);
    expect(tasks.items[0]?.slug).toBe("blocked-task");
    expect(events.total).toBe(1);
    expect(events.items[0]).toMatchObject({ severity: "critical", message: "Agent blocked" });
    expect(JSON.stringify(events)).not.toContain("SHOULD_NOT_LEAK");
  });

  it("returns read-only commands and agents without payload, result, or metadata leaks", async () => {
    const db = createDb();

    const commands = await getConsoleBridgeCommands(db, { limit: 25 });
    const agents = await getConsoleBridgeAgents(db, { limit: 25 });

    expect(commands.mode).toBe("read_only");
    expect(commands.total).toBe(1);
    expect(commands.items[0]).toMatchObject({
      id: "command-1",
      actionType: "internal_sync",
      status: "queued",
      riskLevel: "low",
      approvalId: "approval-1",
    });
    expect(agents.total).toBe(1);
    expect(db.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: expect.arrayContaining([
            expect.objectContaining({ slug: { endsWith: "-gateway" } }),
            expect.objectContaining({ slug: { endsWith: "-proxy" } }),
            expect.objectContaining({ slug: { startsWith: "ops-console-" } }),
          ]),
        }),
      }),
    );
    expect(agents.items[0]).toMatchObject({
      id: "agent-1",
      slug: "dev-agent",
      name: "Dev Agent",
      status: "running",
      health: "ok",
      currentTask: "Bridge UI",
    });
    expect(JSON.stringify(commands)).not.toContain("SHOULD_NOT_LEAK");
    expect(JSON.stringify(agents)).not.toContain("SHOULD_NOT_LEAK");
  });
});
