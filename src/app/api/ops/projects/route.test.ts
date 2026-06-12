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

describe("GET /api/ops/projects", () => {
  it("returns projects with empty run arrays when optional orchestration tables are absent", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      db: {
        project: { findMany: vi.fn().mockResolvedValue([baseProject]) },
        orchestrationRun: { findMany: vi.fn().mockRejectedValue(missingOptionalTableError("OrchestrationRun")) }
      }
    }));
    vi.doMock("@/lib/auth", () => ({ readOperatorIdentity: vi.fn() }));
    vi.doMock("@/server/project-intake", () => ({ createProjectIntake: vi.fn() }));
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
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({ id: "project_1", slug: "project-one", runs: [] });
    vi.doUnmock("@/lib/db");
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/server/project-intake");
    vi.doUnmock("@/server/ops-control-plane");
  });
});
