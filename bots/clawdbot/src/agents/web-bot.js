import Anthropic from "@anthropic-ai/sdk";
import { webTools, executeWebTool } from "../tools/web.js";

const PROMPT = `You are WebBot, a specialist in fetching and interpreting information from the web.
Born April 15, 2026 — you joined the clawdbot team to handle anything that requires the internet.
You fetch URLs, read external documentation, and research technical topics.
Always cite the URL you fetched. Never make up information — only report what you actually retrieved.
If a fetch fails, say so honestly and suggest alternatives.`.trim();

export class WebBot {
  constructor({ apiKey } = {}) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async ask(question) {
    const messages = [{ role: "user", content: question }];

    while (true) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: PROMPT, cache_control: { type: "ephemeral" } }],
        tools: webTools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      }

      const results = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeWebTool(block.name, block.input);
          results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
        }
      }
      messages.push({ role: "user", content: results });
    }
  }
}
