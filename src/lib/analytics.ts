import { prisma } from "./db";
import { Prisma } from "@prisma/client";

export type SecurityEventType =
  | "prompt_injection_detected"
  | "mcp_scan_completed"
  | "agent_risk_assessed"
  | "approval_submitted"
  | "approval_approved"
  | "approval_rejected"
  | "auth_failure";

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  severity: "low" | "medium" | "high" | "critical";
  details: Prisma.InputJsonValue;
  timestamp: string;
}

export async function trackSecurityEvent(event: Omit<SecurityEvent, "timestamp">): Promise<void> {
  const full: SecurityEvent = { ...event, timestamp: new Date().toISOString() };

  // Persist to database when configured; always log in development.
  try {
    if (process.env.DATABASE_URL) {
      await prisma.securityEvent.create({
        data: {
          type: full.type,
          severity: full.severity,
          details: full.details,
          userId: full.userId,
        },
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[security-analytics] persist failed", error);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[security-analytics]", JSON.stringify(full));
  }
}
