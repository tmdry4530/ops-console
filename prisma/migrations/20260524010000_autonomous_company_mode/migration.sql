-- Autonomous Company Mode scoped implementation.
-- Local/work-branch migration only; production deploy remains excluded.

CREATE TYPE "CandidateStatus" AS ENUM ('new', 'enriching', 'ready_for_review', 'converted', 'rejected', 'deferred');
CREATE TYPE "CandidateVisibility" AS ENUM ('private', 'internal', 'external', 'public');
CREATE TYPE "AutonomyDecision" AS ENUM ('allow', 'allow_with_verification', 'require_owner_approval', 'require_manual_handoff', 'block', 'pause', 'lower_autonomy');
CREATE TYPE "AutonomyRunStatus" AS ENUM ('queued', 'running', 'waiting_children', 'waiting_approval', 'verifying', 'completed', 'failed', 'cancelled', 'blocked');
CREATE TYPE "ProjectDraftStatus" AS ENUM ('drafting', 'needs_enrichment', 'needs_owner_decision', 'approved', 'rejected', 'deferred', 'activated');
CREATE TYPE "OwnerDecisionRequestStatus" AS ENUM ('open', 'approved', 'rejected', 'needs_changes', 'deferred', 'manual_handoff', 'withdrawn');

CREATE TABLE "AutonomyPolicy" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "maxAutonomyLevel" TEXT NOT NULL DEFAULT 'L5',
  "emergencyState" TEXT NOT NULL DEFAULT 'normal',
  "allowedActions" JSONB NOT NULL DEFAULT '[]',
  "approvalRequiredActions" JSONB NOT NULL DEFAULT '[]',
  "blockedActions" JSONB NOT NULL DEFAULT '[]',
  "concurrencyLimit" INTEGER NOT NULL DEFAULT 1,
  "budgetLimit" JSONB NOT NULL DEFAULT '{}',
  "riskRules" JSONB NOT NULL DEFAULT '[]',
  "ownerApprovalId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutonomyPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutonomyPolicy_scopeKey_key" ON "AutonomyPolicy"("scopeKey");
CREATE INDEX "AutonomyPolicy_emergencyState_idx" ON "AutonomyPolicy"("emergencyState");

CREATE TABLE "AutonomyRun" (
  "id" TEXT NOT NULL,
  "runType" TEXT NOT NULL,
  "status" "AutonomyRunStatus" NOT NULL DEFAULT 'queued',
  "trigger" JSONB NOT NULL DEFAULT '{}',
  "policyId" TEXT,
  "decision" "AutonomyDecision" NOT NULL DEFAULT 'allow',
  "primaryAgent" TEXT NOT NULL,
  "childRunIds" JSONB NOT NULL DEFAULT '[]',
  "candidateIds" JSONB NOT NULL DEFAULT '[]',
  "projectDraftIds" JSONB NOT NULL DEFAULT '[]',
  "ownerDecisionRequestIds" JSONB NOT NULL DEFAULT '[]',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "eventIds" JSONB NOT NULL DEFAULT '[]',
  "traceId" TEXT NOT NULL,
  "artifactIds" JSONB NOT NULL DEFAULT '[]',
  "verificationIds" JSONB NOT NULL DEFAULT '[]',
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutonomyRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutonomyRun_traceId_key" ON "AutonomyRun"("traceId");
CREATE INDEX "AutonomyRun_status_updatedAt_idx" ON "AutonomyRun"("status", "updatedAt");
CREATE INDEX "AutonomyRun_runType_status_idx" ON "AutonomyRun"("runType", "status");
CREATE INDEX "AutonomyRun_primaryAgent_status_idx" ON "AutonomyRun"("primaryAgent", "status");

CREATE TABLE "OpportunityCandidate" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CandidateStatus" NOT NULL DEFAULT 'new',
  "source" JSONB NOT NULL DEFAULT '{}',
  "summary" TEXT NOT NULL,
  "customerPain" TEXT,
  "proposedAngle" TEXT,
  "marketSignals" JSONB NOT NULL DEFAULT '[]',
  "competitorSignals" JSONB NOT NULL DEFAULT '[]',
  "confidence" TEXT NOT NULL DEFAULT 'low',
  "score" JSONB NOT NULL DEFAULT '{}',
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'medium',
  "visibility" "CandidateVisibility" NOT NULL DEFAULT 'internal',
  "excludedReason" TEXT,
  "projectDraftId" TEXT,
  "eventIds" JSONB NOT NULL DEFAULT '[]',
  "traceId" TEXT NOT NULL,
  "artifactIds" JSONB NOT NULL DEFAULT '[]',
  "verificationIds" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityCandidate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OpportunityCandidate_traceId_key" ON "OpportunityCandidate"("traceId");
CREATE INDEX "OpportunityCandidate_status_updatedAt_idx" ON "OpportunityCandidate"("status", "updatedAt");
CREATE INDEX "OpportunityCandidate_riskLevel_status_idx" ON "OpportunityCandidate"("riskLevel", "status");

CREATE TABLE "ImprovementCandidate" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CandidateStatus" NOT NULL DEFAULT 'new',
  "area" TEXT NOT NULL,
  "detectedBy" TEXT NOT NULL,
  "signalRefs" JSONB NOT NULL DEFAULT '[]',
  "problem" TEXT NOT NULL,
  "impact" JSONB NOT NULL DEFAULT '{}',
  "proposedFix" TEXT NOT NULL,
  "autonomyFit" TEXT NOT NULL DEFAULT 'auto_prepare_only',
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'medium',
  "visibility" "CandidateVisibility" NOT NULL DEFAULT 'internal',
  "taskId" TEXT,
  "projectDraftId" TEXT,
  "eventIds" JSONB NOT NULL DEFAULT '[]',
  "traceId" TEXT NOT NULL,
  "artifactIds" JSONB NOT NULL DEFAULT '[]',
  "verificationIds" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImprovementCandidate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImprovementCandidate_traceId_key" ON "ImprovementCandidate"("traceId");
CREATE INDEX "ImprovementCandidate_status_updatedAt_idx" ON "ImprovementCandidate"("status", "updatedAt");
CREATE INDEX "ImprovementCandidate_area_status_idx" ON "ImprovementCandidate"("area", "status");
CREATE INDEX "ImprovementCandidate_riskLevel_status_idx" ON "ImprovementCandidate"("riskLevel", "status");

CREATE TABLE "ProjectDraft" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceCandidateIds" JSONB NOT NULL DEFAULT '[]',
  "status" "ProjectDraftStatus" NOT NULL DEFAULT 'drafting',
  "summary" TEXT NOT NULL,
  "problem" TEXT,
  "proposedOutcome" TEXT,
  "scope" JSONB NOT NULL DEFAULT '{}',
  "classification" JSONB NOT NULL DEFAULT '{}',
  "successCriteria" JSONB NOT NULL DEFAULT '[]',
  "milestones" JSONB NOT NULL DEFAULT '[]',
  "tasks" JSONB NOT NULL DEFAULT '[]',
  "dependencies" JSONB NOT NULL DEFAULT '[]',
  "blockers" JSONB NOT NULL DEFAULT '[]',
  "requiredOwnerDecisionIds" JSONB NOT NULL DEFAULT '[]',
  "artifactIds" JSONB NOT NULL DEFAULT '[]',
  "eventIds" JSONB NOT NULL DEFAULT '[]',
  "traceId" TEXT NOT NULL,
  "verificationIds" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectDraft_traceId_key" ON "ProjectDraft"("traceId");
CREATE INDEX "ProjectDraft_status_updatedAt_idx" ON "ProjectDraft"("status", "updatedAt");

CREATE TABLE "OwnerDecisionRequest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "requestedByAgent" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "urgency" TEXT NOT NULL DEFAULT 'normal',
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'medium',
  "ownerQuestion" TEXT NOT NULL,
  "contextSummary" TEXT NOT NULL,
  "recommendation" JSONB,
  "options" JSONB NOT NULL DEFAULT '[]',
  "impact" JSONB NOT NULL DEFAULT '{}',
  "gates" JSONB NOT NULL DEFAULT '{}',
  "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
  "allowedResponses" JSONB NOT NULL DEFAULT '[]',
  "status" "OwnerDecisionRequestStatus" NOT NULL DEFAULT 'open',
  "approvalId" TEXT,
  "traceId" TEXT NOT NULL,
  "eventIds" JSONB NOT NULL DEFAULT '[]',
  "artifactIds" JSONB NOT NULL DEFAULT '[]',
  "verificationIds" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerDecisionRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OwnerDecisionRequest_traceId_key" ON "OwnerDecisionRequest"("traceId");
CREATE INDEX "OwnerDecisionRequest_status_updatedAt_idx" ON "OwnerDecisionRequest"("status", "updatedAt");
CREATE INDEX "OwnerDecisionRequest_riskLevel_status_idx" ON "OwnerDecisionRequest"("riskLevel", "status");
CREATE INDEX "OwnerDecisionRequest_requestedByAgent_status_idx" ON "OwnerDecisionRequest"("requestedByAgent", "status");
