import { describe, expect, it, vi } from "vitest";

const baseTask = {
  id: "task_1",
  slug: "task-one",
  title: "Task One",
  status: "running",
  priority: 1,
  summary: null,
  nextAction: null,
  blocker: null,
  metadata: {},
  createdAt: new Date("2026-06-12T00:00:00.000Z"),
  updatedAt: new Date("2026-06-12T01:00:00.000Z"),
  agent: null,
  project: null,
  approvals: [],
  artifacts: [],
  events: [
    {
      id: "event_1",
      type: "task.created",
      metadata: { traceId: "trace_1" },
      createdAt: new Date("2026-06-12T00:00:00.000Z")
    }
  ]
};

function missingOptionalTableError(table: string) {
  return Object.assign(new Error(`The table public.${table} does not exist in the current database.`), { code: "P2021" });
}

describe("GET /api/ops/tasks/[id]", () => {
  it("keeps the task detail available when optional control-plane tables are absent", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      db: {
        task: { findFirst: vi.fn().mockResolvedValue(baseTask) },
        orchestrationRun: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("OrchestrationRun")) },
        traceSpan: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("TraceSpan")) },
        runStep: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("RunStep")) },
        modelCall: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("ModelCall")) },
        toolCall: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("ToolCall")) },
        commandQueue: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("CommandQueue")) },
        controlAction: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("ControlAction")) }
      }
    }));
    vi.doMock("@/server/ops-control-plane", () => {
      const findOptionalControlRecords = async <T,>(query: () => Promise<T[]>): Promise<T[]> => {
        try {
          return await query();
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "P2021") return [];
          throw error;
        }
      };
      return {
        findOptionalControlRecords,
        redactOpsRecord: <T,>(record: T) => record
      };
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/ops/tasks/task-one"), { params: Promise.resolve({ id: "task-one" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.task).toMatchObject({
      id: "task_1",
      slug: "task-one",
      orchestrationRuns: [],
      traceSpans: [],
      runSteps: [],
      modelCalls: [],
      toolCalls: [],
      commandQueues: [],
      controlActions: []
    });
    vi.doUnmock("@/lib/db");
    vi.doUnmock("@/server/ops-control-plane");
  });
});
