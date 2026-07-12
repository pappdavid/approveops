import { z } from "zod";
import { ApprovalStatus, Prisma } from "@prisma/client";

import { prisma } from "./db";
import { classifyActionRisk } from "./risk-classifier";
import { upsertUserFromClerk } from "./users";

export const CreateApprovalRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateApprovalRequestInput = z.infer<typeof CreateApprovalRequestSchema>;

type ApprovalTransaction = Pick<Prisma.TransactionClient, "approvalRequest" | "securityEvent">;

function auditSeverityForRisk(riskLevel: string): "low" | "medium" | "high" | "critical" {
  if (riskLevel === "critical" || riskLevel === "high" || riskLevel === "medium") return riskLevel;
  return "low";
}

async function recordApprovalAuditEvent(
  db: ApprovalTransaction,
  params: {
    type: "approval_submitted" | "approval_approved" | "approval_rejected";
    userId: string;
    severity: "low" | "medium" | "high" | "critical";
    details: Prisma.InputJsonValue;
  }
) {
  await db.securityEvent.create({
    data: {
      type: params.type,
      severity: params.severity,
      userId: params.userId,
      details: params.details,
    },
  });
}

export async function listApprovalAuditEvents(params: {
  clerkUser: { id: string; email: string };
}) {
  const user = await upsertUserFromClerk(params.clerkUser);

  return prisma.securityEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createApprovalRequest(params: {
  clerkUser: { id: string; email: string };
  input: CreateApprovalRequestInput;
}) {
  const input = CreateApprovalRequestSchema.parse(params.input);
  const user = await upsertUserFromClerk(params.clerkUser);
  const risk = classifyActionRisk({
    title: input.title,
    description: input.description,
  });

  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.create({
      data: {
        title: input.title,
        description: input.description,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        riskLevel: risk.riskLevel,
        riskReasons: risk.reasons as Prisma.InputJsonValue,
        riskSummary: risk.summary,
        createdById: user.id,
      },
    });

    await recordApprovalAuditEvent(tx, {
      type: "approval_submitted",
      userId: user.id,
      severity: auditSeverityForRisk(risk.riskLevel),
      details: {
        approvalRequestId: approval.id,
        title: approval.title,
        status: approval.status,
        riskLevel: risk.riskLevel,
        riskReasons: risk.reasons,
        requiresApproval: risk.requiresApproval,
      },
    });

    return approval;
  });
}

export async function listApprovalRequests(params: { clerkUserId: string }) {
  return prisma.approvalRequest.findMany({
    where: { createdBy: { clerkId: params.clerkUserId } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listMyApprovalRequests(params: { clerkUserId: string }) {
  return listApprovalRequests(params);
}

export const DecideApprovalSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
});

export type DecideApprovalInput = z.infer<typeof DecideApprovalSchema>;

export async function decideApprovalRequest(params: {
  clerkUser: { id: string; email: string };
  input: DecideApprovalInput;
}) {
  const input = DecideApprovalSchema.parse(params.input);
  const decidingUser = await upsertUserFromClerk(params.clerkUser);

  const nextStatus: ApprovalStatus = input.decision === "approve" ? "APPROVED" : "REJECTED";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.approvalRequest.updateMany({
      where: { id: input.requestId, status: "PENDING", createdById: decidingUser.id },
      data: {
        status: nextStatus,
        decidedAt: new Date(),
        decidedById: decidingUser.id,
        decisionReason: input.reason,
      },
    });

    if (updated.count === 0) {
      throw new Error("Approval request not found or already decided.");
    }

    const approval = await tx.approvalRequest.findFirstOrThrow({
      where: { id: input.requestId, createdById: decidingUser.id },
    });

    await recordApprovalAuditEvent(tx, {
      type: input.decision === "approve" ? "approval_approved" : "approval_rejected",
      userId: decidingUser.id,
      severity: auditSeverityForRisk(approval.riskLevel),
      details: {
        approvalRequestId: approval.id,
        title: approval.title,
        decision: input.decision,
        status: approval.status,
        reason: input.reason ?? null,
        riskLevel: approval.riskLevel,
      },
    });

    return approval;
  });
}
