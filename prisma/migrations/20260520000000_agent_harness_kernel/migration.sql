CREATE TABLE IF NOT EXISTS "AgentHarness" (
  "id" TEXT NOT NULL,
  "agentSlug" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "specPath" TEXT NOT NULL,
  "capabilityPath" TEXT NOT NULL,
  "inputSchemaPath" TEXT,
  "outputSchemaPath" TEXT NOT NULL,
  "contextPackPath" TEXT,
  "memoryPackPath" TEXT,
  "skillPackPath" TEXT,
  "rubricPath" TEXT,
  "evalSuitePath" TEXT,
  "verifierPath" TEXT,
  "failurePolicyPath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentHarness_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentHarness_agentSlug_version_key" ON "AgentHarness"("agentSlug", "version");
CREATE INDEX IF NOT EXISTS "AgentHarness_agentSlug_status_idx" ON "AgentHarness"("agentSlug", "status");

CREATE TABLE IF NOT EXISTS "AgentHarnessVersion" (
  "id" TEXT NOT NULL,
  "agentSlug" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "rollbackFrom" TEXT,
  "promotedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "AgentHarnessVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentHarnessVersion_agentSlug_version_key" ON "AgentHarnessVersion"("agentSlug", "version");
CREATE INDEX IF NOT EXISTS "AgentHarnessVersion_agentSlug_status_idx" ON "AgentHarnessVersion"("agentSlug", "status");

CREATE TABLE IF NOT EXISTS "AgentEvalCase" (
  "id" TEXT NOT NULL,
  "agentSlug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "inputJson" JSONB NOT NULL,
  "expectedJson" JSONB,
  "rubricJson" JSONB NOT NULL DEFAULT '{}',
  "sourceTaskId" TEXT,
  "difficulty" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEvalCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentEvalCase_agentSlug_status_idx" ON "AgentEvalCase"("agentSlug", "status");

CREATE TABLE IF NOT EXISTS "AgentEvalResult" (
  "id" TEXT NOT NULL,
  "evalCaseId" TEXT,
  "agentSlug" TEXT NOT NULL,
  "harnessVersion" TEXT NOT NULL,
  "model" TEXT,
  "score" DOUBLE PRECISION NOT NULL,
  "dimensionScores" JSONB NOT NULL DEFAULT '{}',
  "outputJson" JSONB,
  "pass" BOOLEAN NOT NULL,
  "failureReason" TEXT,
  "costUsd" DECIMAL(65,30),
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEvalResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentEvalResult_agentSlug_createdAt_idx" ON "AgentEvalResult"("agentSlug", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentEvalResult_evalCaseId_idx" ON "AgentEvalResult"("evalCaseId");

CREATE TABLE IF NOT EXISTS "AgentSkillPack" ("id" TEXT NOT NULL, "agentSlug" TEXT NOT NULL, "version" TEXT NOT NULL, "path" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AgentSkillPack_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "AgentMemoryPack" ("id" TEXT NOT NULL, "agentSlug" TEXT NOT NULL, "version" TEXT NOT NULL, "path" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AgentMemoryPack_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "AgentVerifier" ("id" TEXT NOT NULL, "agentSlug" TEXT NOT NULL, "version" TEXT NOT NULL, "path" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AgentVerifier_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "AgentFailure" (
  "id" TEXT NOT NULL,
  "agentSlug" TEXT NOT NULL,
  "taskId" TEXT,
  "traceId" TEXT,
  "failureClass" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "proposedFix" TEXT,
  "createsEvalCase" BOOLEAN NOT NULL DEFAULT false,
  "createsSkillCandidate" BOOLEAN NOT NULL DEFAULT false,
  "createsMemoryCandidate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentFailure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentFailure_agentSlug_failureClass_idx" ON "AgentFailure"("agentSlug", "failureClass");
CREATE INDEX IF NOT EXISTS "AgentFailure_taskId_idx" ON "AgentFailure"("taskId");
