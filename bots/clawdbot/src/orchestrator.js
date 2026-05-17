import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { CodeBot } from "./agents/code-bot.js";
import { DeployBot } from "./agents/deploy-bot.js";
import { MemoryBot } from "./agents/memory-bot.js";
import { storeMemory, getAllMemories, initializeMemories } from "./memory/store.js";

const CHAT_TOOLS = [
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
        subject: { type: "string" },
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

const AUTONOMY_TOOLS = [
  ...CHAT_TOOLS,
  {
    name: "task_complete",
    description: "Signal that the autonomous task is fully complete.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "What was accomplished" },
      },
      required: ["summary"],
    },
  },
  {
    name: "needs_human_input",
    description: "Pause autonomous execution and ask the user a question before continuing.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "What you need from the user" },
        context: { type: "string", description: "Why you need this" },
      },
      required: ["question"],
    },
  },
];

const AUTONOMOUS_PROMPT = `You are Clawdbot running in autonomous mode.
You have been given a task. Complete it without asking for help at every step.

Loop:
1. PLAN — think through what steps are needed before acting
2. ACT — execute one step using your tools
3. VERIFY — check the result before moving on
4. REPEAT — keep going until the task is fully done

Rules:
- Verify each step succeeded before proceeding to the next
- If a step fails twice in a row, use needs_human_input to ask for help
- Use task_complete when the entire task is done, with a clear summary of what was accomplished
- Use needs_human_input if you need a decision only the user can make
- Be efficient — don't over-explain, just do the work
- Save any important findings to memory along the way`.trim();

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

  async #executeTool(name, input) {
    if (name === "ask_code_bot") {
      process.stdout.write("  [CodeBot thinking...]\n");
      return this.codeBot.ask(input.question);
    }
    if (name === "ask_deploy_bot") {
      process.stdout.write("  [DeployBot running...]\n");
      return this.deployBot.ask(input.task);
    }
    if (name === "ask_memory_bot") {
      process.stdout.write("  [MemoryBot remembering...]\n");
      return this.memoryBot.ask(input.question);
    }
    if (name === "save_memory") {
      const m = storeMemory({ bot: "Orchestrator", ...input });
      return `Memory saved (id: ${m.id})`;
    }
    return `Unknown tool: ${name}`;
  }

  #memoryPrefix(limit = 40) {
    const mems = getAllMemories(limit);
    if (!mems.length) return "";
    return `<team_memories>\n${mems.map((m) => `[${m.type}:${m.subject}] ${m.content}`).join("\n")}\n</team_memories>\n\n`;
  }

  async chat(userMessage) {
    const content = this.history.length === 0 ? `${this.#memoryPrefix()}${userMessage}` : userMessage;
    this.history.push({ role: "user", content });

    while (true) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: CHAT_TOOLS,
        messages: this.history,
      });

      this.history.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      }

      const results = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = await this.#executeTool(block.name, block.input);
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
      }
      this.history.push({ role: "user", content: results });
    }
  }

  async run(task, { onStep, maxSteps = 20 } = {}) {
    const runHistory = [
      { role: "user", content: `${this.#memoryPrefix(20)}AUTONOMOUS TASK: ${task}` },
    ];

    let stepCount = 0;

    while (stepCount < maxSteps) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: AUTONOMOUS_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: AUTONOMY_TOOLS,
        messages: runHistory,
      });

      runHistory.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return {
          status: "complete",
          summary: response.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
        };
      }

      const results = [];
      let done = false;
      let needsInput = null;

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        stepCount++;

        let result;

        if (block.name === "task_complete") {
          done = true;
          result = "Task marked complete.";
          if (onStep) onStep({ type: "complete", summary: block.input.summary });
        } else if (block.name === "needs_human_input") {
          needsInput = block.input.question;
          result = "Paused for human input.";
          if (onStep) onStep({ type: "needs_input", question: block.input.question });
        } else {
          result = await this.#executeTool(block.name, block.input);
          if (onStep)
            onStep({ type: "step", step: stepCount, tool: block.name, result: String(result).slice(0, 300) });
        }

        results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
      }

      if (done) return { status: "complete", summary: "Task complete." };
      if (needsInput) return { status: "needs_input", question: needsInput };

      runHistory.push({ role: "user", content: results });
    }

    return { status: "max_steps_reached", summary: `Stopped after ${maxSteps} steps.` };
  }

  clearHistory() {
    this.history = [];
  }
}
