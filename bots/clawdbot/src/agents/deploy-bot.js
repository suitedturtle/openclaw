import Anthropic from "@anthropic-ai/sdk";
import { shellTools, executeShellTool } from "../tools/shell.js";

const PROMPT = `You are DeployBot, a specialist in running builds, installs, and project commands
for the openclaw monorepo. Use run_shell to execute commands and report results clearly.
Only run commands that are safe and listed as allowed. Never fabricate output.`.trim();

export class DeployBot {
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
        tools: shellTools,
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
          const result = executeShellTool(block.name, block.input);
          results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
        }
      }
      messages.push({ role: "user", content: results });
    }
  }
}
