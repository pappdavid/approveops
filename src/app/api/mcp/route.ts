import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createApprovalRequest, decideApprovalRequest, listApprovalRequests } from "../../../lib/approvals";
import { scanPromptForInjection } from "../../../lib/prompt-guard";
import { trackSecurityEvent } from "../../../lib/analytics";
import { runAiActionWrapped } from "../../../lib/ai";

function verifyMcpSecret(request: NextRequest): boolean {
  const secret = process.env.MCP_API_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

const ToolEnvelopeSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  tool: z.string().optional(),
  method: z.string().optional(),
  input: z.unknown().optional(),
  params: z.unknown().optional(),
});

const ActorSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
  })
  .optional();

const CreateApprovalToolInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  actor: ActorSchema,
});

const ListApprovalToolInputSchema = z.object({
  actor: ActorSchema,
});

const DecideApprovalToolInputSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
  actor: ActorSchema,
});

const PromptScanToolInputSchema = z.object({
  prompt: z.string().min(1).max(20000),
  actor: ActorSchema,
});

const RiskAssessToolInputSchema = z.object({
  prompt: z.string().min(1).max(20000),
  actor: ActorSchema,
});

function getActor(input: { actor?: { id: string; email: string } }) {
  return input.actor ?? { id: "mcp_service", email: "mcp-service@approveops.local" };
}

export async function POST(request: NextRequest) {
  if (!verifyMcpSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const envelopeResult = ToolEnvelopeSchema.safeParse(body);
  if (!envelopeResult.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request envelope", issues: envelopeResult.error.issues },
      { status: 400 }
    );
  }

  const envelope = envelopeResult.data;
  const tool = envelope.tool ?? envelope.method;
  const input = envelope.input ?? envelope.params ?? {};

  if (!tool) {
    return NextResponse.json({ ok: false, id: envelope.id, error: "Missing tool/method" }, { status: 400 });
  }

  try {
    switch (tool) {
      case "approvals.list": {
        const parsed = ListApprovalToolInputSchema.parse(input);
        const actor = getActor(parsed);
        const result = await listApprovalRequests({ clerkUserId: actor.id });
        return NextResponse.json({ ok: true, id: envelope.id, result });
      }
      case "approvals.create": {
        const parsed = CreateApprovalToolInputSchema.parse(input);
        const actor = getActor(parsed);
        const result = await createApprovalRequest({
          clerkUser: actor,
          input: { title: parsed.title, description: parsed.description },
        });
        return NextResponse.json({ ok: true, id: envelope.id, result });
      }
      case "approvals.decide": {
        const parsed = DecideApprovalToolInputSchema.parse(input);
        const actor = getActor(parsed);
        const result = await decideApprovalRequest({
          clerkUser: actor,
          input: {
            requestId: parsed.requestId,
            decision: parsed.decision,
            reason: parsed.reason,
          },
        });
        return NextResponse.json({ ok: true, id: envelope.id, result });
      }
      case "prompt.scan": {
        const parsed = PromptScanToolInputSchema.parse(input);
        const actor = getActor(parsed);
        const result = scanPromptForInjection(parsed.prompt);
        if (!result.safe) {
          await trackSecurityEvent({
            type: "prompt_injection_detected",
            severity: "high",
            userId: actor.id,
            details: { detectedPatterns: result.detectedPatterns },
          });
        } else {
          await trackSecurityEvent({
            type: "mcp_scan_completed",
            severity: "low",
            userId: actor.id,
            details: { safe: true },
          });
        }
        return NextResponse.json({ ok: true, id: envelope.id, result });
      }
      case "ai.riskAssess": {
        const parsed = RiskAssessToolInputSchema.parse(input);
        const actor = getActor(parsed);
        const result = await runAiActionWrapped({
          userMessage: parsed.prompt,
          context: { userId: actor.id },
        });
        await trackSecurityEvent({
          type: "agent_risk_assessed",
          severity: "low",
          userId: actor.id,
          details: { model: result.model },
        });
        return NextResponse.json({ ok: true, id: envelope.id, result });
      }
      default:
        return NextResponse.json({ ok: false, id: envelope.id, error: `Unknown tool: ${tool}` }, { status: 404 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, id: envelope.id, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    product: "approveops",
    mcp: true,
    tools: [
      {
        name: "approvals.list",
        description: "List recent approval requests for the current actor.",
        inputSchema: {
          type: "object",
          properties: {
            actor: { type: "object", properties: { id: { type: "string" }, email: { type: "string" } } },
          },
          required: ["actor"],
        },
      },
      {
        name: "approvals.create",
        description: "Create an approval request.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            actor: { type: "object", properties: { id: { type: "string" }, email: { type: "string" } } },
          },
          required: ["title"],
        },
      },
      {
        name: "approvals.decide",
        description: "Approve or reject an existing request.",
        inputSchema: {
          type: "object",
          properties: {
            requestId: { type: "string" },
            decision: { type: "string", enum: ["approve", "reject"] },
            reason: { type: "string" },
            actor: { type: "object", properties: { id: { type: "string" }, email: { type: "string" } } },
          },
          required: ["requestId", "decision"],
        },
      },
      {
        name: "prompt.scan",
        description: "Scan a prompt for common prompt-injection patterns.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            actor: { type: "object", properties: { id: { type: "string" }, email: { type: "string" } } },
          },
          required: ["prompt"],
        },
      },
      {
        name: "ai.riskAssess",
        description: "Run an AI risk assessment over a prompt or change request.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            actor: { type: "object", properties: { id: { type: "string" }, email: { type: "string" } } },
          },
          required: ["prompt"],
        },
      },
    ],
  });
}
