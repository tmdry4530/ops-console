-- Add explicit non-running orchestration parent states.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'waiting_children';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'aggregation_pending';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'awaiting_verifier';
