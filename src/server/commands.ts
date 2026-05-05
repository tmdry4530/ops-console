import { requiresManualHandoff } from "@/lib/auth";

export function canQueueCommand(actionType: string, riskLevel: string) {
  return !requiresManualHandoff(actionType, riskLevel);
}
