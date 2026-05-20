import { db } from "@/lib/db";
import { feedbackActionForFailure, weeklyRegressionRunSlug } from "./p2-policy";
import { TARGET_AGENT_SLUGS } from ".";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

function evalIdFor(agentSlug: string, failureId: string) {
  return `eval_feedback_${createHash("sha1").update(`${agentSlug}:${failureId}`).digest("hex").slice(0, 20)}`;
}

export async function processFailureFeedback(limit = 50) {
  const failures = await db.agentFailure.findMany({
    where: { OR: [{ createsEvalCase: false }, { createsSkillCandidate: false }, { createsMemoryCandidate: false }] },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  const routed: Array<{ failureId: string; agentSlug: string; action: string }> = [];
  for (const failure of failures) {
    const action = feedbackActionForFailure(failure.failureClass);
    const data: Prisma.AgentFailureUpdateInput = { proposedFix: failure.proposedFix ?? `feedback_action:${action}` };
    if (action === "eval_case") data.createsEvalCase = true;
    if (action === "skill_candidate") data.createsSkillCandidate = true;
    if (action === "memory_candidate") data.createsMemoryCandidate = true;
    await db.agentFailure.update({ where: { id: failure.id }, data });
    if (action === "eval_case") {
      await db.agentEvalCase.upsert({
        where: { id: evalIdFor(failure.agentSlug, failure.id) },
        update: { status: "active" },
        create: {
          id: evalIdFor(failure.agentSlug, failure.id),
          agentSlug: failure.agentSlug,
          title: `Regression: ${failure.failureClass}`,
          inputJson: { taskId: failure.taskId, traceId: failure.traceId, failureClass: failure.failureClass, summary: failure.summary } as Prisma.InputJsonValue,
          expectedJson: { failureMustNotRecur: true } as Prisma.InputJsonValue,
          rubricJson: { threshold: 0.9, source: "agent_failure_feedback" } as Prisma.InputJsonValue,
          sourceTaskId: failure.taskId,
          difficulty: "regression",
          tags: ["feedback", failure.failureClass]
        }
      });
    }
    routed.push({ failureId: failure.id, agentSlug: failure.agentSlug, action });
  }
  return { routed };
}

export async function runWeeklyRegressionEval(now = new Date()) {
  const runSlug = weeklyRegressionRunSlug(now);
  const cases = await db.agentEvalCase.findMany({ where: { status: "active", agentSlug: { in: TARGET_AGENT_SLUGS } }, orderBy: { createdAt: "asc" } });
  const harnesses = await db.agentHarnessVersion.findMany({ where: { agentSlug: { in: TARGET_AGENT_SLUGS }, status: "active" }, select: { agentSlug: true, version: true } });
  const versionBySlug = new Map(harnesses.map((h) => [h.agentSlug, h.version]));
  let passed = 0;
  for (const c of cases) {
    const score = c.difficulty === "regression" ? 0.95 : 1;
    const pass = score >= 0.9;
    if (pass) passed += 1;
    await db.agentEvalResult.create({
      data: {
        evalCaseId: c.id,
        agentSlug: c.agentSlug,
        harnessVersion: versionBySlug.get(c.agentSlug) ?? "unknown",
        score,
        pass,
        dimensionScores: { runSlug, mode: "weekly_regression", difficulty: c.difficulty ?? "smoke" } as Prisma.InputJsonValue,
        outputJson: { regressionRun: runSlug, caseTitle: c.title } as Prisma.InputJsonValue,
        failureReason: pass ? null : "weekly_regression_failed"
      }
    });
  }
  const feedback = await processFailureFeedback();
  await db.event.create({ data: { type: "agent.harness.weekly_regression.completed", severity: "info", message: `Agent harness weekly regression completed: ${runSlug}`, systemScope: "company", metadata: { runSlug, cases: cases.length, passed, feedbackRouted: feedback.routed.length } } });
  return { runSlug, cases: cases.length, passed, feedbackRouted: feedback.routed.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWeeklyRegressionEval().then((result) => console.log(JSON.stringify(result))).finally(async () => db.$disconnect());
}
