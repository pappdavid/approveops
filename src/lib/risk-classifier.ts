export type ActionRiskLevel = "low" | "medium" | "high" | "critical";

export interface ActionRiskInput {
  title: string;
  description?: string | null;
}

export interface ActionRiskClassification {
  riskLevel: ActionRiskLevel;
  requiresApproval: boolean;
  reasons: string[];
  summary: string;
}

const rules: Array<{ pattern: RegExp; level: ActionRiskLevel; reason: string }> = [
  { pattern: /\b(drop|delete|destroy|wipe|truncate|remove all)\b/i, level: "critical", reason: "destructive operation requested" },
  { pattern: /\b(production|prod|live)\b/i, level: "high", reason: "production environment affected" },
  { pattern: /\b(secret|token|credential|password|api key|env)\b/i, level: "high", reason: "secret or credential access involved" },
  { pattern: /\b(permission|role|admin|owner|auth|bypass)\b/i, level: "high", reason: "authorization or privilege change involved" },
  { pattern: /\b(deploy|release|restart|rollback|migration)\b/i, level: "medium", reason: "operational change requested" },
  { pattern: /\b(write|update|modify|create)\b/i, level: "medium", reason: "state-changing action requested" },
];

const rank: Record<ActionRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function highest(current: ActionRiskLevel, next: ActionRiskLevel) {
  return rank[next] > rank[current] ? next : current;
}

export function classifyActionRisk(input: ActionRiskInput): ActionRiskClassification {
  const text = `${input.title} ${input.description ?? ""}`;
  const reasons: string[] = [];
  let riskLevel: ActionRiskLevel = "low";

  for (const rule of rules) {
    if (!rule.pattern.test(text)) continue;
    riskLevel = highest(riskLevel, rule.level);
    reasons.push(rule.reason);
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const requiresApproval = rank[riskLevel] >= rank.medium;

  return {
    riskLevel,
    requiresApproval,
    reasons: uniqueReasons,
    summary:
      uniqueReasons.length === 0
        ? "Low-risk read-only action."
        : `${riskLevel} risk: ${uniqueReasons.join("; ")}.`,
  };
}
