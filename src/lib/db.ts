import { PrismaClient } from "@prisma/client";
import { readEnv } from "./env";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

// Fail fast if the application database is not explicitly injected. Prisma also
// reads DATABASE_URL from process.env, but validating here prevents task storage
// paths from silently starting against an unintended ops-console/default DB.
readEnv();

export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
