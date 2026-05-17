import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { CodeBot } from "./agents/code-bot.js";
import { DeployBot } from "./agents/deploy-bot.js";

const TOOLS = [
  {
    name: "ask_code_bot",
    description: "Ask CodeBot to search or read files in the openclaw codebase.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "What to find or explain about the codebase" },
      },
      required: ["question"],
    },
  },
  {
    name: "ask_deploy_bot",
    description: "Ask DeployBot to run a build, install, or shell command in the project.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "What command or build task to perform" },
      },
      required: ["task"],
    },
  },
];

export class Orchestrator {
  constructor({ apiKey } = {}) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.client = new Anthropic({ apiKey: key });
    this.codeBot = new CodeBot({ apiKey: key });
    this.deployBot = new DeployBot({ apiKey: key });
    this.history = [];
  }

  async chat(userMessage) {
    this.history.push({ role: "user", content: userMessage });

    while (true) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages: this.history,
      });

      this.history.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
      }

      const results = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        let result;
        if (block.name === "ask_code_bot") {
          console.log("  [CodeBot thinking...]\n");
          result = await this.codeBot.ask(block.input.question);
        } else if (block.name === "ask_deploy_bot") {
          console.log("  [DeployBot running...]\n");
          result = await this.deployBot.ask(block.input.task);
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
      }
      this.history.push({ role: "user", content: results });
    }
  }

  clearHistory() {
    this.history = [];
  }
}
