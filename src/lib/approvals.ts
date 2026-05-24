import { z } from "zod";
import { ApprovalStatus, Prisma } from "@prisma/client";

import { prisma } from "./db";
import { upsertUserFromClerk } from "./users";

export const CreateApprovalRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateApprovalRequestInput = z.infer<typeof CreateApprovalRequestSchema>;

export async function createApprovalRequest(params: {
  clerkUser: { id: string; email: string };
  input: CreateApprovalRequestInput;
}) {
  const input = CreateApprovalRequestSchema.parse(params.input);
  const user = await upsertUserFromClerk(params.clerkUser);

  return prisma.approvalRequest.create({
    data: {
      title: input.title,
      description: input.description,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      createdById: user.id,
    },
  });
}

export async function listApprovalRequests() {
  return prisma.approvalRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listMyApprovalRequests(params: { clerkUserId: string }) {
  return prisma.approvalRequest.findMany({
    where: { createdBy: { clerkId: params.clerkUserId } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
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

  const updated = await prisma.approvalRequest.updateMany({
    where: { id: input.requestId, status: "PENDING" },
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

  return prisma.approvalRequest.findUniqueOrThrow({ where: { id: input.requestId } });
}
