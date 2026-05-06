-- Add capability contracts for department agent adapters.
CREATE TABLE "AgentCapability" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL DEFAULT '{}',
    "outputSchema" JSONB NOT NULL DEFAULT '{}',
    "allowedTools" JSONB NOT NULL DEFAULT '[]',
    "maxRisk" "RiskLevel" NOT NULL DEFAULT 'low',
    "expectedArtifactType" "ArtifactType" NOT NULL DEFAULT 'report',
    "successCriteria" JSONB NOT NULL DEFAULT '[]',
    "failureModes" JSONB NOT NULL DEFAULT '[]',
    "rollbackOrManualHandoff" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "avgCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgDuration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentCapability_agentId_capabilityKey_key" ON "AgentCapability"("agentId", "capabilityKey");
CREATE INDEX "AgentCapability_capabilityKey_idx" ON "AgentCapability"("capabilityKey");

ALTER TABLE "AgentCapability" ADD CONSTRAINT "AgentCapability_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
