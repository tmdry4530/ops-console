import { scanForSecretLikeContent } from "./ingest/secrets";

export function classifyArtifactContent(content: string) {
  const scan = scanForSecretLikeContent(content);
  return {
    restricted: scan.restricted,
    restrictionReason: scan.restricted ? "secret-like content detected" : null
  };
}
