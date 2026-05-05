import { z } from "zod";

export const statusContractSchema = z.object({
  schema_version: z.literal("1.0"),
  agent_id: z.string().min(1),
  project_id: z.string().min(1),
  task_id: z.string().min(1),
  status: z.string().min(1),
  health_status: z.string().min(1),
  summary: z.string().min(1),
  current_blocker: z.string().optional(),
  needs_approval: z.boolean().default(false),
  approval_type: z.string().optional(),
  risk_level: z.string().default("low"),
  artifacts: z.array(z.object({ type: z.string().min(1), path: z.string().min(1), commit: z.string().optional() })).default([]),
  next_action: z.string().optional(),
  updated_at: z.string().datetime({ offset: true })
});

export type StatusContract = z.infer<typeof statusContractSchema>;
