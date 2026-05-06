import { PrismaClient, type ApprovalType, type ArtifactType, type PolicyAction, type RiskLevel, Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { contentHash } from "../src/server/ingest/hash";
import { AGENT_CAPABILITY_SEEDS } from "../src/server/agent-capabilities";

const prisma = new PrismaClient();

const policies: Array<{ actionType: string; action: PolicyAction; riskLevel: RiskLevel; description: string }> = [
  { actionType: "outreach", action: "require_approval", riskLevel: "medium", description: "Human approval required before external outreach." },
  { actionType: "bounty_submission", action: "require_manual_handoff", riskLevel: "medium", description: "Bounty submissions require manual handoff and audited decision." },
  { actionType: "wallet_kyc", action: "require_manual_handoff", riskLevel: "critical", description: "Wallet and KYC actions cannot be automated." },
  { actionType: "live_trading", action: "block", riskLevel: "critical", description: "Live trading is blocked until separately authorized." },
  { actionType: "paid_action", action: "require_approval", riskLevel: "high", description: "Paid actions require approval." },
  { actionType: "deploy", action: "require_approval", riskLevel: "high", description: "Deployments require approval and audit trail." },
  { actionType: "public_disclosure", action: "require_approval", riskLevel: "high", description: "Public disclosure requires approval." }
];

const companyDepartmentAgents = [
  { slug: "hq-agent", name: "HQ Agent", department: "hq", repoPath: "hq/", focus: "의사결정, 승인 게이트, 전략 요약" },
  { slug: "main-agent", name: "Main Ops Agent", department: "main", repoPath: "main/", focus: "공통 운영, 라우팅, cross-functional handoff" },
  { slug: "research-agent", name: "Research Agent", department: "research", repoPath: "research/", focus: "후보 조사, scope, 중복/근거 확인" },
  { slug: "projects-agent", name: "Projects Agent", department: "projects", repoPath: "projects/", focus: "프로젝트 보드, milestone, blocker 관리" },
  { slug: "dev-agent", name: "Dev Agent", department: "dev", repoPath: "dev/", focus: "구현, 자동화, 검증 노트" },
  { slug: "content-agent", name: "Content Agent", department: "content", repoPath: "content/", focus: "랜딩, 아웃리치, 카피 초안" },
  { slug: "trading-agent", name: "Trading Agent", department: "trading", repoPath: "trading/", focus: "Web3 bounty/security 실행, PoC, draft report" },
  { slug: "docs-agent", name: "Docs Agent", department: "docs", repoPath: "docs/", focus: "시스템 문서, 로그, 아카이브" }
];

function safeHashForFile(filePath: string) {
  try {
    return contentHash(readFileSync(filePath));
  } catch {
    return contentHash(filePath);
  }
}

async function main() {
  const operator = await prisma.user.upsert({
    where: { email: process.env.OPERATOR_BOOTSTRAP_EMAIL ?? "operator@example.invalid" },
    update: {},
    create: { email: process.env.OPERATOR_BOOTSTRAP_EMAIL ?? "operator@example.invalid", role: "operator" }
  });

  for (const policy of policies) {
    await prisma.policy.upsert({ where: { actionType: policy.actionType }, update: policy, create: policy });
  }

  for (const agent of companyDepartmentAgents) {
    await prisma.agent.upsert({
      where: { slug: agent.slug },
      update: {
        name: agent.name,
        health: "ok",
        metadata: {
          type: "company_department_agent",
          department: agent.department,
          discordChannel: agent.department,
          repoPath: agent.repoPath,
          focus: agent.focus,
          source: "dom-company"
        }
      },
      create: {
        slug: agent.slug,
        name: agent.name,
        status: "idle",
        health: "ok",
        metadata: {
          type: "company_department_agent",
          department: agent.department,
          discordChannel: agent.department,
          repoPath: agent.repoPath,
          focus: agent.focus,
          source: "dom-company"
        }
      }
    });
  }

  for (const capability of AGENT_CAPABILITY_SEEDS) {
    const agent = await prisma.agent.findUnique({ where: { slug: capability.agentSlug }, select: { id: true } });
    if (!agent) continue;
    await prisma.agentCapability.upsert({
      where: { agentId_capabilityKey: { agentId: agent.id, capabilityKey: capability.capabilityKey } },
      update: {
        inputSchema: capability.inputSchema as Prisma.InputJsonValue,
        outputSchema: capability.outputSchema as Prisma.InputJsonValue,
        allowedTools: capability.allowedTools,
        maxRisk: capability.maxRisk,
        expectedArtifactType: capability.expectedArtifactType,
        successCriteria: capability.successCriteria,
        failureModes: capability.failureModes,
        rollbackOrManualHandoff: capability.rollbackOrManualHandoff,
        requiresApproval: capability.requiresApproval,
        avgCost: capability.avgCost,
        avgDuration: capability.avgDuration
      },
      create: {
        agentId: agent.id,
        capabilityKey: capability.capabilityKey,
        inputSchema: capability.inputSchema as Prisma.InputJsonValue,
        outputSchema: capability.outputSchema as Prisma.InputJsonValue,
        allowedTools: capability.allowedTools,
        maxRisk: capability.maxRisk,
        expectedArtifactType: capability.expectedArtifactType,
        successCriteria: capability.successCriteria,
        failureModes: capability.failureModes,
        rollbackOrManualHandoff: capability.rollbackOrManualHandoff,
        requiresApproval: capability.requiresApproval,
        avgCost: capability.avgCost,
        avgDuration: capability.avgDuration
      }
    });
  }

  const bountyAgent = await prisma.agent.upsert({
    where: { slug: "trading-bounty" },
    update: { health: "ok" },
    create: { slug: "trading-bounty", name: "Trading Bounty Agent", status: "waiting_approval", health: "ok", currentTask: "capyfi-oracle-report" }
  });

  const bountyProject = await prisma.project.upsert({
    where: { slug: "capyfi-bounty" },
    update: {},
    create: { slug: "capyfi-bounty", name: "CapyFi Bounty Submission", status: "active", nextAction: "Manual Immunefi submission after logged-in scope confirmation", blocker: "Logged-in Immunefi scope confirmation required" }
  });

  const bountyTask = await prisma.task.upsert({
    where: { slug: "capyfi-oracle-report" },
    update: { riskLevel: "medium", agentId: bountyAgent.id, projectId: bountyProject.id },
    create: { slug: "capyfi-oracle-report", title: "CapyFi oracle report approval", status: "waiting_approval", riskLevel: "medium", agentId: bountyAgent.id, projectId: bountyProject.id }
  });

  const artifacts: Array<{ type: ArtifactType; title: string; path: string; commitSha: string }> = [
    { type: "report", title: "CapyFi submission-ready report", path: "trading/reports/CapyFi-ChainlinkPriceOracle-StaleRound-Submission-Ready.md", commitSha: "9fba2ad" },
    { type: "poc", title: "CapyFi stale round PoC", path: "trading/reports/CapyFi-ChainlinkPriceOracle-StaleRound-PoC.md", commitSha: "9fba2ad" }
  ];

  for (const artifact of artifacts) {
    await prisma.artifact.upsert({
      where: { contentHash: safeHashForFile(artifact.path) },
      update: { path: artifact.path, projectId: bountyProject.id, taskId: bountyTask.id, agentId: bountyAgent.id, commitSha: artifact.commitSha },
      create: { ...artifact, contentHash: safeHashForFile(artifact.path), projectId: bountyProject.id, taskId: bountyTask.id, agentId: bountyAgent.id }
    });
  }

  await prisma.approval.upsert({
    where: { externalKey: "capyfi-bounty-submission" },
    update: { riskLevel: "medium", projectId: bountyProject.id, taskId: bountyTask.id },
    create: {
      externalKey: "capyfi-bounty-submission",
      type: "bounty_submission" as ApprovalType,
      status: "pending",
      riskLevel: "medium",
      title: "Approve CapyFi bounty submission",
      summary: "Submission-ready report and PoC are prepared; manual Immunefi submission remains required.",
      projectId: bountyProject.id,
      taskId: bountyTask.id,
      requestedBy: bountyAgent.id
    }
  });

  const revenueProject = await prisma.project.upsert({
    where: { slug: "revenue-manual-outreach" },
    update: {},
    create: { slug: "revenue-manual-outreach", name: "Revenue Manual Outreach", status: "active", revenueType: "manual_outreach", nextAction: "Draft outreach requires operator review and manual send" }
  });

  const revenueTask = await prisma.task.upsert({
    where: { slug: "revenue-outreach-review" },
    update: { projectId: revenueProject.id, riskLevel: "medium" },
    create: { slug: "revenue-outreach-review", title: "Review manual outreach draft", status: "waiting_approval", riskLevel: "medium", projectId: revenueProject.id }
  });

  await prisma.approval.upsert({
    where: { externalKey: "revenue-manual-outreach" },
    update: { projectId: revenueProject.id, taskId: revenueTask.id },
    create: {
      externalKey: "revenue-manual-outreach",
      type: "revenue_outreach" as ApprovalType,
      status: "pending",
      riskLevel: "medium",
      title: "Approve revenue manual outreach",
      summary: "Manual outreach path exists; external sends remain manual handoff only.",
      projectId: revenueProject.id,
      taskId: revenueTask.id
    }
  });

  await prisma.event.create({
    data: { type: "seed.completed", severity: "info", message: "Production-private seed completed.", actorId: operator.id, projectId: bountyProject.id, taskId: bountyTask.id }
  });
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
