import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApprovalRequest, decideApprovalRequest, listApprovalRequests } from "./approvals";

const prismaMock = vi.hoisted(() => ({
  approvalRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
  securityEvent: {
    create: vi.fn(),
  },
}));

vi.mock("./db", () => ({ prisma: prismaMock }));

vi.mock("./users", () => ({
  upsertUserFromClerk: vi.fn(async (user: { id: string; email: string }) => ({
    id: `db_${user.id}`,
    clerkId: user.id,
    email: user.email,
  })),
}));

describe("approval lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies and persists risk details when an agent action is submitted", async () => {
    prismaMock.approvalRequest.create.mockResolvedValue({ id: "approval_1" });

    await createApprovalRequest({
      clerkUser: { id: "user_1", email: "user@example.com" },
      input: {
        title: "Drop production database",
        description: "Agent wants to run DROP TABLE users in prod",
      },
    });

    expect(prismaMock.approvalRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdById: "db_user_1",
        riskLevel: "critical",
        riskSummary: expect.stringContaining("critical risk"),
        riskReasons: expect.arrayContaining([
          expect.stringContaining("destructive"),
          expect.stringContaining("production"),
        ]),
      }),
    });
    expect(prismaMock.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "approval_submitted",
        severity: "critical",
        userId: "db_user_1",
      }),
    });
  });

  it("lists only the current Clerk user's approvals", async () => {
    prismaMock.approvalRequest.findMany.mockResolvedValue([]);

    await listApprovalRequests({ clerkUserId: "user_1" });

    expect(prismaMock.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdBy: { clerkId: "user_1" } },
      })
    );
  });

  it("decides only pending approvals owned by the current user and records an audit event", async () => {
    prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.approvalRequest.findFirstOrThrow.mockResolvedValue({
      id: "approval_1",
      status: "APPROVED",
      riskLevel: "high",
    });

    await decideApprovalRequest({
      clerkUser: { id: "user_1", email: "user@example.com" },
      input: { requestId: "approval_1", decision: "approve", reason: "Matches deploy window" },
    });

    expect(prismaMock.approvalRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "approval_1", status: "PENDING", createdById: "db_user_1" },
        data: expect.objectContaining({
          status: "APPROVED",
          decidedById: "db_user_1",
          decisionReason: "Matches deploy window",
        }),
      })
    );
    expect(prismaMock.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "approval_approved",
        severity: "high",
        userId: "db_user_1",
        details: expect.objectContaining({
          approvalRequestId: "approval_1",
          decision: "approve",
        }),
      }),
    });
  });
});
