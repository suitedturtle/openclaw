import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { CodeBot } from "./agents/code-bot.js";
import { DeployBot } from "./agents/deploy-bot.js";
import { MemoryBot } from "./agents/memory-bot.js";
import { WebBot } from "./agents/web-bot.js";
import { TestBot } from "./agents/test-bot.js";
import { DocBot } from "./agents/doc-bot.js";
import { QABot } from "./agents/qa-bot.js";
import { VisionBot } from "./agents/vision-bot.js";
import { storeMemory, getAllMemories, initializeMemories } from "./memory/store.js";
import { postMessage, readInbox } from "./memory/messages.js";

const MAX_HISTORY = 40;
const MAX_RUN_HISTORY = 60;
const MAX_TOOL_RESULT = 8 * 1024;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const API_MAX_RETRIES = 2;

const CHAT_TOOLS = [
  {
    name: "ask_code_bot",
    description: "Ask CodeBot to search or read files in the openclaw codebase.",
    input_schema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
  },
  {
    name: "ask_deploy_bot",
    description: "Ask DeployBot to run a build, install, or shell command.",
    input_schema: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
  },
  {
    name: "ask_memory_bot",
    description: "Ask MemoryBot to recall, search, or synthesize memories.",
    input_schema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
  },
  {
    name: "ask_web_bot",
    description: "Ask WebBot to fetch a public URL or research a topic on the web.",
    input_schema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
  },
  {
    name: "ask_test_bot",
    description: "Ask TestBot to run the test suite and report results.",
    input_schema: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
  },
  {
    name: "ask_doc_bot",
    description: "Ask DocBot to read or write documentation.",
    input_schema: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
  },
  {
    name: "ask_vision_bot",
    description: "Ask VisionBot to analyze an image, screenshot, UI design, or any visual content.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "What to look for or analyze in the image" },
        image_path: { type: "string", description: "Local file path to the image" },
        image_url: { type: "string", description: "Public URL of the image" },
      },
      required: ["task"],
    },
  },
  {
    name: "verify_with_qa",
    description: "Have QABot cross-check a specialist's output for accuracy and completeness.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string" },
        specialist: { type: "string" },
        output: { type: "string" },
      },
      required: ["task", "specialist", "output"],
    },
  },
  {
    name: "send_bot_message",
    description: "Send a direct message from one bot to another for handoffs, notes, or coordination.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Sending bot name" },
        to: { type: "string", description: "Receiving bot name, or 'all' for broadcast" },
        content: { type: "string", description: "Message content" },
      },
      required: ["from", "to", "content"],
    },
  },
  {
    name: "check_bot_inbox",
    description: "Check unread messages waiting for a specific bot.",
    input_schema: {
      type: "object",
      properties: { bot: { type: "string", description: "Which bot's inbox to check" } },
      required: ["bot"],
    },
  },
  {
    name: "suggest_improvement",
    description: "Log a suggestion for improving the team's tools or capabilities for future review.",
    input_schema: {
      type: "object",
      properties: {
        bot: { type: "string", description: "Which bot or area needs improvement" },
        issue: { type: "string", description: "The current limitation or problem" },
        suggestion: { type: "string", description: "How to fix or improve it" },
      },
      required: ["bot", "issue", "suggestion"],
    },
  },
  {
    name: "save_memory",
    description: "Save an important fact, preference, birthday, relationship, achievement, or improvement note.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        type: {
          type: "string",
          enum: ["fact", "birthday", "preference", "relationship", "conversation", "achievement", "improvement"],
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
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
  {
    name: "needs_human_input",
    description: "Pause autonomous execution and ask the user a question.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" }, context: { type: "string" } },
      required: ["question"],
    },
  },
];

const AUTONOMOUS_PROMPT = `You are Clawdbot running in autonomous mode.
Complete the given task without asking for help at every step.

Loop:
1. PLAN — think through steps before acting
2. ACT — execute one step using your specialist bots
3. VERIFY — use verify_with_qa on important outputs before proceeding
4. REPEAT — keep going until done

Retry and escalation rules:
- If a tool returns an error, try a different approach once before escalating
- If QABot returns FAIL, fix the specific issue and retry that step once
- If QABot returns FAIL a second time on the same step, use needs_human_input
- If QABot returns WARN, note the issues but proceed unless blocking
- Never retry the same failing action more than twice

Bot coordination:
- Use send_bot_message to leave notes for other bots during handoffs
- Use check_bot_inbox to see if a bot has pending context before tasking it
- Use suggest_improvement if you notice a tool limitation during the task

General rules:
- Use task_complete when done with a clear summary
- Save important findings to memory along the way`.trim();

function capToolResult(result) {
  const s = String(result);
  if (s.length <= MAX_TOOL_RESULT) return s;
  return s.slice(0, MAX_TOOL_RESULT) + `\n[...truncated — ${s.length - MAX_TOOL_RESULT} chars omitted]`;
}

function trimMessages(messages, limit) {
  if (messages.length <= limit) return messages;
  let realUserCount = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isRealUser =
      msg.role === "user" &&
      !(Array.isArray(msg.content) && msg.content[0]?.type === "tool_result");
    if (isRealUser) {
      realUserCount++;
      if (realUserCount === 2) return messages.slice(i);
    }
  }
  return messages;
}

export class Orchestrator {
  constructor({ apiKey } = {}) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is required.");
    this.client = new Anthropic({ apiKey: key });
    this.codeBot = new CodeBot({ apiKey: key });
    this.deployBot = new DeployBot({ apiKey: key });
    this.memoryBot = new MemoryBot({ apiKey: key });
    this.webBot = new WebBot({ apiKey: key });
    this.testBot = new TestBot({ apiKey: key });
    this.docBot = new DocBot({ apiKey: key });
    this.qaBot = new QABot({ apiKey: key });
    this.visionBot = new VisionBot({ apiKey: key });
    this.history = [];
    initializeMemories();
  }

  async #createMessage(params) {
    for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
      try {
        return await this.client.messages.create(params);
      } catch (e) {
        const retryable = e.status === 429 || e.status === 529 || (e.status >= 500 && e.status < 600);
        if (!retryable || attempt === API_MAX_RETRIES) throw e;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async #executeTool(name, input) {
    try {
      if (name === "ask_code_bot") {
        process.stdout.write("  [CodeBot thinking...]\n");
        return await this.codeBot.ask(input.question);
      }
      if (name === "ask_deploy_bot") {
        process.stdout.write("  [DeployBot running...]\n");
        return await this.deployBot.ask(input.task);
      }
      if (name === "ask_memory_bot") {
        process.stdout.write("  [MemoryBot remembering...]\n");
        return await this.memoryBot.ask(input.question);
      }
      if (name === "ask_web_bot") {
        process.stdout.write("  [WebBot fetching...]\n");
        return await this.webBot.ask(input.question);
      }
      if (name === "ask_test_bot") {
        process.stdout.write("  [TestBot running tests...]\n");
        return await this.testBot.ask(input.task);
      }
      if (name === "ask_doc_bot") {
        process.stdout.write("  [DocBot writing...]\n");
        return await this.docBot.ask(input.task);
      }
      if (name === "ask_vision_bot") {
        process.stdout.write("  [VisionBot looking...]\n");
        return await this.visionBot.analyze({
          task: input.task,
          imagePath: input.image_path,
          imageUrl: input.image_url,
        });
      }
      if (name === "verify_with_qa") {
        process.stdout.write("  [QABot reviewing...]\n");
        return await this.qaBot.review({ task: input.task, specialist: input.specialist, output: input.output });
      }
      if (name === "send_bot_message") {
        const m = postMessage(input);
        return `Message sent (id: ${m.id}) from ${m.from} to ${m.to}.`;
      }
      if (name === "check_bot_inbox") {
        const msgs = readInbox(input.bot);
        return msgs.length
          ? msgs.map((m) => `[from ${m.from}] ${m.content}`).join("\n")
          : `No unread messages for ${input.bot}.`;
      }
      if (name === "suggest_improvement") {
        const m = storeMemory({
          bot: "Orchestrator",
          subject: input.bot,
          type: "improvement",
          content: `ISSUE: ${input.issue} | SUGGESTION: ${input.suggestion}`,
        });
        return `Improvement suggestion saved (id: ${m.id}).`;
      }
      if (name === "save_memory") {
        const m = storeMemory({ bot: "Orchestrator", ...input });
        return `Memory saved (id: ${m.id})`;
      }
      return `Unknown tool: ${name}`;
    } catch (e) {
      return `[${name} failed] ${e.message} — report this to the user and try a different approach.`;
    }
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
      this.history = trimMessages(this.history, MAX_HISTORY);

      const response = await this.#createMessage({
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
        results.push({ type: "tool_result", tool_use_id: block.id, content: capToolResult(result) });
      }
      this.history.push({ role: "user", content: results });
    }
  }

  async run(task, { onStep, maxSteps = 30, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const deadline = Date.now() + timeoutMs;
    let runHistory = [
      { role: "user", content: `${this.#memoryPrefix(20)}AUTONOMOUS TASK: ${task}` },
    ];

    let stepCount = 0;

    while (stepCount < maxSteps) {
      if (Date.now() > deadline) {
        return { status: "timeout", summary: `Stopped: exceeded ${timeoutMs / 1000}s time limit.` };
      }

      runHistory = trimMessages(runHistory, MAX_RUN_HISTORY);

      const response = await this.#createMessage({
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
        results.push({ type: "tool_result", tool_use_id: block.id, content: capToolResult(result) });
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
