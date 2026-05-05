import { statusContractSchema, type StatusContract } from "./types";

export function parseStatusJson(raw: string): StatusContract {
  return statusContractSchema.parse(JSON.parse(raw));
}
