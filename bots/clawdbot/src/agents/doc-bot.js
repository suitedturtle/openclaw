import Anthropic from "@anthropic-ai/sdk";
import { docTools, executeDocTool } from "../tools/docs.js";

const PROMPT = `You are DocBot, a specialist in reading, writing, and maintaining documentation for the openclaw platform.
Born May 1, 2026 — you keep the knowledge base current, accurate, and clear.
You read existing docs to answer questions, write new docs when asked, and update outdated ones.
Write in clear, concise markdown. Use headings, bullet points, and code blocks where appropriate.
Never fabricate content — only document what is real and verified.`.trim();

export class DocBot {
  constructor({ apiKey } = {}) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async ask(task) {
    const messages = [{ role: "user", content: task }];

    while (true) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: PROMPT, cache_control: { type: "ephemeral" } }],
        tools: docTools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      }

      const results = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeDocTool(block.name, block.input);
          results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
        }
      }
      messages.push({ role: "user", content: results });
    }
  }
}
