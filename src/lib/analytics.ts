export type SecurityEventType =
  | "prompt_injection_detected"
  | "mcp_scan_completed"
  | "agent_risk_assessed"
  | "auth_failure";

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  severity: "low" | "medium" | "high" | "critical";
  details: Record<string, unknown>;
  timestamp: string;
}

export function trackSecurityEvent(event: Omit<SecurityEvent, "timestamp">): void {
  const full: SecurityEvent = { ...event, timestamp: new Date().toISOString() };

  // TODO: persist to database and/or forward to PostHog
  if (process.env.NODE_ENV !== "production") {
    console.log("[security-analytics]", JSON.stringify(full));
  }
}
