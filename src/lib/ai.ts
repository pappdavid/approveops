import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are the AI for ApproveOps.
TODO: customize this system prompt for the product's specific use case.`;

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
