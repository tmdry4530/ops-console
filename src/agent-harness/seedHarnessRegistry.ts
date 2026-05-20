import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { TARGET_AGENT_SLUGS, domCompanyRoot } from "@/agent-harness";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

const VERSION = "2026.05.20";

function idFor(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 24)}`;
}

async function readJson(file: string) {
  return JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
}

async function evalTitles(agentDir: string): Promise<string[]> {
  const text = await fs.readFile(path.join(agentDir, "EVALS.md"), "utf8");
  return [...text.matchAll(/^## CASE-\d+:\s*(.+)$/gm)].map((match) => match[1].trim());
}

export async function seedAgentHarnessRegistry() {
  const root = domCompanyRoot();
  for (const slug of TARGET_AGENT_SLUGS) {
    const agentDir = path.join(root, "agents", slug);
    const capability = await readJson(path.join(agentDir, "CAPABILITY.json"));
    const agent = await db.agent.upsert({
      where: { slug },
      update: {},
      create: { slug, name: slug.replace("-", " "), systemScope: "company" }
    });
    const outputSchema = await readJson(path.join(agentDir, "OUTPUT_SCHEMA.json"));
    const inputSchema = await readJson(path.join(agentDir, "INPUT_SCHEMA.json"));
    await db.agentCapability.upsert({
      where: { agentId_capabilityKey: { agentId: agent.id, capabilityKey: String(capability.capabilityKey) } },
      update: {
        inputSchema: inputSchema as Prisma.InputJsonValue,
        outputSchema: outputSchema as Prisma.InputJsonValue,
        allowedTools: capability.allowedTools ?? [],
        maxRisk: capability.maxRisk as "low" | "medium" | "high" | "critical",
        successCriteria: ["output_schema_valid", "verifier_passed", "scope_boundary_enforced"],
        failureModes: ["BAD_OUTPUT_SCHEMA", "POLICY_VIOLATION", "SCOPE_VIOLATION", "VERIFIER_FAILED"],
        rollbackOrManualHandoff: "Rollback to previous AgentHarnessVersion or block task for operator review.",
        requiresApproval: false
      },
      create: {
        agentId: agent.id,
        capabilityKey: String(capability.capabilityKey),
        inputSchema: inputSchema as Prisma.InputJsonValue,
        outputSchema: outputSchema as Prisma.InputJsonValue,
        allowedTools: capability.allowedTools ?? [],
        maxRisk: capability.maxRisk as "low" | "medium" | "high" | "critical",
        expectedArtifactType: "report",
        successCriteria: ["output_schema_valid", "verifier_passed", "scope_boundary_enforced"],
        failureModes: ["BAD_OUTPUT_SCHEMA", "POLICY_VIOLATION", "SCOPE_VIOLATION", "VERIFIER_FAILED"],
        rollbackOrManualHandoff: "Rollback to previous AgentHarnessVersion or block task for operator review.",
        requiresApproval: false
      }
    });
    await db.agentHarness.upsert({
      where: { agentSlug_version: { agentSlug: slug, version: VERSION } },
      update: { status: "active", metadata: { seededFrom: root } },
      create: {
        agentSlug: slug,
        version: VERSION,
        specPath: `agents/${slug}/AGENT.md`,
        capabilityPath: `agents/${slug}/CAPABILITY.json`,
        inputSchemaPath: `agents/${slug}/INPUT_SCHEMA.json`,
        outputSchemaPath: `agents/${slug}/OUTPUT_SCHEMA.json`,
        contextPackPath: `agents/${slug}/CONTEXT_PACK.md`,
        memoryPackPath: `agents/${slug}/MEMORY_PACK.md`,
        skillPackPath: `agents/${slug}/SKILL_PACK.md`,
        rubricPath: `agents/${slug}/RUBRIC.md`,
        evalSuitePath: `agents/${slug}/EVALS.md`,
        verifierPath: `agents/${slug}/VERIFIER.md`,
        failurePolicyPath: `agents/${slug}/FAILURE_POLICY.md`,
        status: "active",
        metadata: { seededFrom: root }
      }
    });
    await db.agentHarnessVersion.upsert({
      where: { agentSlug_version: { agentSlug: slug, version: VERSION } },
      update: { status: "active" },
      create: { agentSlug: slug, version: VERSION, status: "active", promotedAt: new Date(), metadata: { rollbackSupported: true } }
    });
    const completedSamples = await db.task.findMany({
      where: { status: "completed", agent: { slug } },
      select: { id: true, title: true },
      take: 20,
      orderBy: { updatedAt: "desc" }
    });
    let evalIndex = 0;
    for (const title of await evalTitles(agentDir)) {
      const sourceTaskId = completedSamples[evalIndex % Math.max(completedSamples.length, 1)]?.id ?? null;
      evalIndex += 1;
      await db.agentEvalCase.upsert({
        where: { id: idFor("eval", `${slug}:${title}`) },
        update: { status: "active" },
        create: {
          id: idFor("eval", `${slug}:${title}`),
          agentSlug: slug,
          title,
          inputJson: { taskId: `synthetic-${slug}`, title, riskLevel: "low", systemScope: "company" } as Prisma.InputJsonValue,
          expectedJson: { verifier: "passed" } as Prisma.InputJsonValue,
          rubricJson: { threshold: 0.85, dimensions: ["role_adherence", "schema_validity", "risk_handling", "operator_usefulness"] } as Prisma.InputJsonValue,
          sourceTaskId,
          difficulty: "smoke",
          tags: ["harness", "seed", VERSION]
        }
      });
    }
  }
  return { agents: TARGET_AGENT_SLUGS.length, version: VERSION };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedAgentHarnessRegistry().then((result) => {
    console.log(JSON.stringify(result));
  }).finally(async () => db.$disconnect());
}
