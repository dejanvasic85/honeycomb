import Anthropic from "@anthropic-ai/sdk";

// Same narrow-interface pattern as src/durable-objects/llm-cluster.ts's
// ClusterLLMClient — keeps the real SDK/network call out of unit tests.
export interface QuestionGenClient {
  complete(prompt: string): Promise<string>;
}

const QUESTION_GEN_MODEL = "claude-haiku-4-5-20251001";
const QUESTION_GEN_MAX_TOKENS = 2048;

export function createAnthropicQuestionGenClient(apiKey: string): QuestionGenClient {
  const anthropic = new Anthropic({ apiKey });

  return {
    async complete(prompt: string): Promise<string> {
      const message = await anthropic.messages.create({
        model: QUESTION_GEN_MODEL,
        max_tokens: QUESTION_GEN_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      const block = message.content.find((b) => b.type === "text");
      if (!block) {
        throw new Error("Anthropic response had no text content block");
      }
      return block.text;
    },
  };
}
