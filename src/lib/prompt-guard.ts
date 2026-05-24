const INJECTION_PATTERNS = [
  /ignore (previous|all|above) instructions/i,
  /you are now/i,
  /forget (everything|your instructions|your system prompt)/i,
  /jailbreak/i,
  /act as (an? )?(DAN|unrestricted|evil|malicious)/i,
  /<\|.*?\|>/,
  /\[\[.*?system.*?\]\]/i,
];

export interface GuardResult {
  safe: boolean;
  detectedPatterns: string[];
}

export function scanPromptForInjection(input: string): GuardResult {
  const detectedPatterns: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString());
    }
  }

  return { safe: detectedPatterns.length === 0, detectedPatterns };
}

export function assertSafePrompt(input: string): void {
  const result = scanPromptForInjection(input);
  if (!result.safe) {
    throw new Error(`Prompt injection detected: ${result.detectedPatterns.join(", ")}`);
  }
}
