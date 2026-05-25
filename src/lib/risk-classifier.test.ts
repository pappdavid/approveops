import { describe, expect, it } from "vitest";
import { classifyActionRisk } from "./risk-classifier";

describe("classifyActionRisk", () => {
  it("requires approval for destructive production actions", () => {
    const result = classifyActionRisk({
      title: "Drop production database",
      description: "Agent wants to run DROP TABLE users in prod",
    });

    expect(result.riskLevel).toBe("critical");
    expect(result.requiresApproval).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("destructive"),
        expect.stringContaining("production"),
      ])
    );
  });

  it("keeps read-only actions low risk", () => {
    const result = classifyActionRisk({
      title: "Read deployment status",
      description: "Agent wants to fetch current deployment status",
    });

    expect(result.riskLevel).toBe("low");
    expect(result.requiresApproval).toBe(false);
  });
});
