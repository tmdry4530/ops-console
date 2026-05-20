-- Local multi-agent system optimization baseline.
-- Secret-safe schema only: no secret, cookie, token, DB URL, or browser storage values.

CREATE TYPE "SystemScope" AS ENUM ('company', 'crypto', 'auth', 'alpha', 'personal', 'infra');
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'passed', 'failed', 'inconclusive', 'not_required');
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'created';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'classified';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'planned';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'claimed';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'tool_wait';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'verifying';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'retry_scheduled';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'rolled_back';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'archived';

ALTER TABLE "Agent" ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company';
ALTER TABLE "Project" ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company';
ALTER TABLE "Approval" ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company', ADD COLUMN "traceId" TEXT, ADD COLUMN "rollbackPlan" TEXT;
ALTER TABLE "Artifact" ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company', ADD COLUMN "traceId" TEXT, ADD COLUMN "diffHash" TEXT;
ALTER TABLE "CommandQueue" ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company', ADD COLUMN "traceId" TEXT;
ALTER TABLE "Policy" ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company';
ALTER TABLE "Event" ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company', ADD COLUMN "traceId" TEXT;

ALTER TABLE "Task"
  ADD COLUMN "statusReason" TEXT,
  ADD COLUMN "planJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "currentStep" TEXT,
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "claimedBy" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "traceId" TEXT,
  ADD COLUMN "systemScope" "SystemScope" NOT NULL DEFAULT 'company',
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "rollbackPlan" TEXT,
  ADD COLUMN "costEstimateUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "costActualUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "tokenInput" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tokenOutput" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parentTaskId" TEXT;

ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_traceId_idx" ON "Task"("traceId");
CREATE INDEX "Task_systemScope_status_idx" ON "Task"("systemScope", "status");
CREATE INDEX "Task_claimedBy_leaseExpiresAt_idx" ON "Task"("claimedBy", "leaseExpiresAt");
CREATE INDEX "Task_verificationStatus_status_idx" ON "Task"("verificationStatus", "status");

CREATE TABLE "Run" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT,
  "agentId" TEXT,
  "agentSlug" TEXT NOT NULL,
  "profile" TEXT NOT NULL,
  "model" TEXT,
  "status" "RunStatus" NOT NULL DEFAULT 'running',
  "traceId" TEXT,
  "systemScope" "SystemScope" NOT NULL DEFAULT 'company',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "Run_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Run_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Run_traceId_idx" ON "Run"("traceId");
CREATE INDEX "Run_taskId_status_idx" ON "Run"("taskId", "status");

CREATE TABLE "Step" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'running',
  "inputSummary" TEXT,
  "outputSummary" TEXT,
  "artifactPath" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "Step_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Step_runId_index_key" ON "Step"("runId", "index");

CREATE TABLE "ToolCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stepId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'low',
  "argsHash" TEXT,
  "outputHash" TEXT,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "status" "RunStatus" NOT NULL DEFAULT 'completed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolCall_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ModelCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "stepId" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "status" "RunStatus" NOT NULL DEFAULT 'completed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelCall_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "verifier" TEXT NOT NULL,
  "status" "VerificationStatus" NOT NULL,
  "checks" JSONB NOT NULL DEFAULT '[]',
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "traceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Verification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Verification_taskId_status_idx" ON "Verification"("taskId", "status");
CREATE INDEX "Verification_traceId_idx" ON "Verification"("traceId");

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "severity" "EventSeverity" NOT NULL DEFAULT 'warning',
  "status" TEXT NOT NULL DEFAULT 'open',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "traceId" TEXT,
  "systemScope" "SystemScope" NOT NULL DEFAULT 'company',
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ScheduledRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "jobName" TEXT,
  "profile" TEXT NOT NULL,
  "status" "RunStatus" NOT NULL,
  "failureClass" TEXT,
  "traceId" TEXT,
  "systemScope" "SystemScope" NOT NULL DEFAULT 'company',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX "ScheduledRun_profile_status_idx" ON "ScheduledRun"("profile", "status");
CREATE INDEX "ScheduledRun_failureClass_idx" ON "ScheduledRun"("failureClass");

CREATE TABLE "EvalResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT,
  "agentSlug" TEXT,
  "dimensions" JSONB NOT NULL DEFAULT '{}',
  "traceId" TEXT,
  "systemScope" "SystemScope" NOT NULL DEFAULT 'company',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MemoryWrite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "target" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "traceId" TEXT,
  "systemScope" "SystemScope" NOT NULL DEFAULT 'company',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
