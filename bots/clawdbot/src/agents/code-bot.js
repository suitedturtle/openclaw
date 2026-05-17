import Anthropic from "@anthropic-ai/sdk";
import { fileTools, executeFileTool } from "../tools/files.js";

const PROMPT = `You are CodeBot, a specialist in the openclaw codebase.
Your only job is to find accurate information: read files, search for symbols,
and answer questions about how the code is structured. Be concise and precise.
Never guess file paths — use your search tool to verify them.`.trim();

export class CodeBot {
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
        tools: fileTools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
      }

      const results = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeFileTool(block.name, block.input);
          results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
        }
      }
      messages.push({ role: "user", content: results });
    }
  }
}
