import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  APP_BASE_URL: z.string().url().optional(),
  PRIVATE_NETWORK_CIDRS: z.string().min(1).optional(),
  OPERATOR_BOOTSTRAP_EMAIL: z.string().email().optional(),
  SESSION_COOKIE_NAME: z.string().min(1).optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
