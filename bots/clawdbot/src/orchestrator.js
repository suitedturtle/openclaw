import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { CodeBot } from "./agents/code-bot.js";
import { DeployBot } from "./agents/deploy-bot.js";
import { MemoryBot } from "./agents/memory-bot.js";
import { storeMemory, getAllMemories, initializeMemories } from "./memory/store.js";

const TOOLS = [
  {
    name: "ask_code_bot",
    description: "Ask CodeBot to search or read files in the openclaw codebase.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
  {
    name: "ask_deploy_bot",
    description: "Ask DeployBot to run a build, install, or shell command.",
    input_schema: {
      type: "object",
      properties: { task: { type: "string" } },
      required: ["task"],
    },
  },
  {
    name: "ask_memory_bot",
    description: "Ask MemoryBot to recall, search, or synthesize memories about the team and users.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
  {
    name: "save_memory",
    description: "Save an important fact, preference, birthday, relationship note, or achievement to long-term memory.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Who or what this is about" },
        type: {
          type: "string",
          enum: ["fact", "birthday", "preference", "relationship", "conversation", "achievement"],
        },
        content: { type: "string" },
      },
      required: ["subject", "type", "content"],
    },
  },
];

export class Orchestrator {
  constructor({ apiKey } = {}) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.client = new Anthropic({ apiKey: key });
    this.codeBot = new CodeBot({ apiKey: key });
    this.deployBot = new DeployBot({ apiKey: key });
    this.memoryBot = new MemoryBot({ apiKey: key });
    this.history = [];
    initializeMemories();
  }

  async chat(userMessage) {
    if (this.history.length === 0) {
      const memories = getAllMemories(40);
      const prefix = memories.length > 0
        ? `<team_memories>\n${memories.map((m) => `[${m.type}:${m.subject}] ${m.content}`).join("\n")}\n</team_memories>\n\n`
        : "";
      this.history.push({ role: "user", content: `${prefix}${userMessage}` });
    } else {
      this.history.push({ role: "user", content: userMessage });
    }

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
        } else if (block.name === "ask_memory_bot") {
          console.log("  [MemoryBot remembering...]\n");
          result = await this.memoryBot.ask(block.input.question);
        } else if (block.name === "save_memory") {
          const m = storeMemory({ bot: "Orchestrator", ...block.input });
          result = `Memory saved (id: ${m.id})`;
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
