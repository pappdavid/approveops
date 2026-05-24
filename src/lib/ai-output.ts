import { z } from "zod";

export const AiOutputSchema = z.object({
  content: z.string(),
  safe: z.boolean(),
  flaggedReason: z.string().nullable(),
  model: z.string(),
});

export type AiOutput = z.infer<typeof AiOutputSchema>;

export function wrapAiOutput(
  raw: string,
  model: string,
  checks?: { flagged?: boolean; reason?: string }
): AiOutput {
  return AiOutputSchema.parse({
    content: raw,
    safe: !checks?.flagged,
    flaggedReason: checks?.reason ?? null,
    model,
  });
}

export function isOutputSafe(output: AiOutput): boolean {
  return output.safe;
}
