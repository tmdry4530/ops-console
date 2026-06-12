import { describe, expect, it, vi } from "vitest";

const baseProject = {
  id: "project_1",
  slug: "project-one",
  name: "Project One",
  status: "active",
  revenueType: "internal",
  nextAction: null,
  blocker: null,
  metadata: { traceId: "trace_1" },
  createdAt: new Date("2026-06-12T00:00:00.000Z"),
  updatedAt: new Date("2026-06-12T01:00:00.000Z"),
  tasks: [],
  approvals: [],
  artifacts: [],
  events: []
};

function missingOptionalTableError(table: string) {
  return Object.assign(new Error(`The table public.${table} does not exist in the current database.`), { code: "P2021" });
}

describe("GET /api/ops/projects/[id]", () => {
  it("keeps the project detail available when optional trace and run tables are absent", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      db: {
        project: { findFirst: vi.fn().mockResolvedValue(baseProject) },
        orchestrationRun: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("OrchestrationRun")) },
        traceSpan: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("TraceSpan")) },
        modelCall: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("ModelCall")) },
        toolCall: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("ToolCall")) }
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
        redactOpsRecord: <T,>(record: T) => record,
        secretSafeMetadata: (metadata: unknown) => metadata
      };
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/ops/projects/project-one"), { params: Promise.resolve({ id: "project-one" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project).toMatchObject({
      id: "project_1",
      slug: "project-one",
      orchestrationRuns: [],
      traceSpans: [],
      modelCalls: [],
      toolCalls: []
    });
    vi.doUnmock("@/lib/db");
    vi.doUnmock("@/server/ops-control-plane");
  });
});
