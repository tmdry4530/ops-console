import { afterEach, describe, expect, it, vi } from "vitest";

const prismaClientConstructions = vi.hoisted(() => [] as Array<{
  args: unknown[];
  databaseUrl: string | undefined;
  opsConsoleDatabaseUrl: string | undefined;
}>);

vi.mock("@prisma/client", () => ({
  PrismaClient: class PrismaClient {
    constructor(...args: unknown[]) {
      prismaClientConstructions.push({
        args,
        databaseUrl: process.env.DATABASE_URL,
        opsConsoleDatabaseUrl: process.env.OPS_CONSOLE_DATABASE_URL
      });
    }
  }
}));

async function importFreshDbModule(env: Record<string, string | undefined>) {
  vi.resetModules();
  prismaClientConstructions.length = 0;
  delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;

  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalOpsConsoleDatabaseUrl = process.env.OPS_CONSOLE_DATABASE_URL;
  if (env.DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  if (env.OPS_CONSOLE_DATABASE_URL === undefined) {
    delete process.env.OPS_CONSOLE_DATABASE_URL;
  } else {
    process.env.OPS_CONSOLE_DATABASE_URL = env.OPS_CONSOLE_DATABASE_URL;
  }

  try {
    return await import("./db");
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    if (originalOpsConsoleDatabaseUrl === undefined) {
      delete process.env.OPS_CONSOLE_DATABASE_URL;
    } else {
      process.env.OPS_CONSOLE_DATABASE_URL = originalOpsConsoleDatabaseUrl;
    }
  }
}

afterEach(() => {
  vi.resetModules();
  prismaClientConstructions.length = 0;
  delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;
});

describe("canonical task storage database wiring", () => {
  it("constructs the task Prisma client from DATABASE_URL even when the legacy ops-console DB URL is wrong", async () => {
    await importFreshDbModule({
      DATABASE_URL: "postgresql://task-store-user:task-store-pass@127.0.0.1:15432/task_store_test",
      OPS_CONSOLE_DATABASE_URL: "file:/definitely/wrong/ops-console.sqlite"
    });

    expect(prismaClientConstructions).toHaveLength(1);
    expect(prismaClientConstructions[0]).toMatchObject({
      databaseUrl: "postgresql://task-store-user:task-store-pass@127.0.0.1:15432/task_store_test",
      opsConsoleDatabaseUrl: "file:/definitely/wrong/ops-console.sqlite"
    });
    expect(prismaClientConstructions[0].args).toEqual([{ log: ["error", "warn"] }]);
  });

  it("refuses to start task storage without DATABASE_URL instead of falling back to an ops-console DB URL", async () => {
    await expect(importFreshDbModule({
      DATABASE_URL: undefined,
      OPS_CONSOLE_DATABASE_URL: "postgresql://wrong-user:wrong-pass@127.0.0.1:15433/ops_console_wrong"
    })).rejects.toThrow(/Invalid environment/);

    expect(prismaClientConstructions).toHaveLength(0);
  });
});
