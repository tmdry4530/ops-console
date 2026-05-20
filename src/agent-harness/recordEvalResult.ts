import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
export async function recordEvalResult(input: { agentSlug: string; harnessVersion: string; score: number; pass: boolean; dimensions?: Record<string, unknown>; failureReason?: string | null; outputJson?: Record<string, unknown>; evalCaseId?: string | null; latencyMs?: number | null }) {
  return db.agentEvalResult.create({ data: { agentSlug: input.agentSlug, harnessVersion: input.harnessVersion, score: input.score, pass: input.pass, dimensionScores: (input.dimensions ?? {}) as Prisma.InputJsonValue, failureReason: input.failureReason ?? null, outputJson: input.outputJson as Prisma.InputJsonValue | undefined, evalCaseId: input.evalCaseId ?? null, latencyMs: input.latencyMs ?? null } });
}
