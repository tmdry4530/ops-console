const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:seed phrase|mnemonic)\b/i,
  /\b(?:api[_-]?secret|private[_-]?key|access[_-]?token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}/i,
  /\b(?:sk_live|sk_test|ghp|xox[baprs])-?[A-Za-z0-9_\-]{16,}/i
];

export type SecretScanResult = {
  restricted: boolean;
  matches: string[];
};

export function scanForSecretLikeContent(content: string): SecretScanResult {
  const matches = secretPatterns.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source);
  return { restricted: matches.length > 0, matches };
}
