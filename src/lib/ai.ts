import OpenAI from "openai";
import { wrapAiOutput, type AiOutput } from "./ai-output";
import { scanPromptForInjection } from "./prompt-guard";
import { trackSecurityEvent } from "./analytics";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are the AI for ApproveOps, a tool that helps teams review and approve agent-initiated changes.

You must:
- Provide concise, actionable analysis.
- Call out risky operations (data loss, auth bypass, secret handling, supply-chain risk).
- Prefer safer alternatives when possible.
- If asked to produce structured output, return valid JSON only.`;

export interface AiActionInput {
  userMessage: string;
  context?: Record<string, unknown>;
}

export interface AiActionOutput {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}

export async function runAiAction(input: AiActionInput): Promise<AiActionOutput> {
  const injectionScan = scanPromptForInjection(input.userMessage);
  if (!injectionScan.safe) {
    await trackSecurityEvent({
      type: "prompt_injection_detected",
      severity: "high",
      userId: input.context?.userId ? String(input.context.userId) : undefined,
      details: { detectedPatterns: injectionScan.detectedPatterns },
    });
    throw new Error("Prompt injection detected.");
  }

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input.userMessage },
    ],
  });

  const choice = response.choices[0];
  return {
    content: choice.message.content ?? "",
    model: response.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

export async function runAiActionWrapped(input: AiActionInput): Promise<AiOutput> {
  const raw = await runAiAction(input);
  return wrapAiOutput(raw.content, raw.model);
}
