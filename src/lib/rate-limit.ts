export type RateLimitDecision = {
  allowed: boolean;
  reason: string;
};

export async function checkPrivateRateLimit(_key: string): Promise<RateLimitDecision> {
  return { allowed: true, reason: "redis-backed limiter pending" };
}
