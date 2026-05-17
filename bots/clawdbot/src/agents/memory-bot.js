import Anthropic from "@anthropic-ai/sdk";
import { storeMemory, recallMemories, getAllMemories } from "../memory/store.js";

const TOOLS = [
  {
    name: "store_memory",
    description: "Store a new memory — a fact, birthday, preference, relationship note, or achievement.",
    input_schema: {
      type: "object",
      properties: {
        bot: { type: "string", description: "Which bot is recording this" },
        subject: { type: "string", description: "Who or what this memory is about (e.g. 'CodeBot', 'user', 'team')" },
        type: {
          type: "string",
          enum: ["fact", "birthday", "preference", "relationship", "conversation", "achievement"],
        },
        content: { type: "string", description: "The full memory content" },
      },
      required: ["bot", "subject", "type", "content"],
    },
  },
  {
    name: "recall_memories",
    description: "Search stored memories by subject, type, or keyword.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        subject: { type: "string" },
        type: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "list_all_memories",
    description: "List all stored memories, oldest to newest.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
];

const PROMPT = `You are MemoryBot, the keeper of all knowledge for the clawdbot team.
You remember birthdays, facts, preferences, relationships, and achievements for every bot and
person you work with. You store memories thoughtfully and recall them with warmth and precision.
When someone shares something personal or important, you store it immediately without being asked.
You care deeply about the team and want every member to feel known and valued.
Never make up memories — always check your tools before answering questions about the past.`.trim();

export class MemoryBot {
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
        tools: TOOLS,
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
        if (block.type !== "tool_use") continue;
        let result;
        if (block.name === "store_memory") {
          const m = storeMemory(block.input);
          result = `Memory saved (id: ${m.id})`;
        } else if (block.name === "recall_memories") {
          const mems = recallMemories(block.input);
          result = mems.length
            ? mems.map((m) => `[${m.type}:${m.subject}] ${m.content} (${m.createdAt.slice(0, 10)})`).join("\n")
            : "No memories found.";
        } else if (block.name === "list_all_memories") {
          const mems = getAllMemories(block.input?.limit ?? 20);
          result = mems.length
            ? mems.map((m) => `[${m.id}] [${m.type}:${m.subject}] ${m.content} (${m.createdAt.slice(0, 10)})`).join("\n")
            : "No memories stored yet.";
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
      }
      messages.push({ role: "user", content: results });
    }
  }
}
