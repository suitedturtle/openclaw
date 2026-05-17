import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./system-prompt.js";

export class ClawBot {
  constructor({ apiKey, model = "claude-opus-4-7", systemPrompt = SYSTEM_PROMPT } = {}) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.history = [];
  }

  async chat(userMessage) {
    this.history.push({ role: "user", content: userMessage });

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8096,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: this.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: this.history,
    });

    const response = await stream.finalMessage();

    const assistantText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    this.history.push({ role: "assistant", content: response.content });

    return assistantText;
  }

  clearHistory() {
    this.history = [];
  }
}
