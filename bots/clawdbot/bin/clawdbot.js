#!/usr/bin/env node
import { config } from "dotenv";
import readline from "node:readline";
import { Orchestrator } from "../src/orchestrator.js";
import { startScheduler, loadSchedule, addTask, removeTask } from "../src/scheduler.js";
import { notify } from "../src/notify.js";

config({ path: new URL("../.env", import.meta.url) });

const key = process.env.ANTHROPIC_API_KEY;
if (!key || !key.startsWith("sk-")) {
  console.error("[error] ANTHROPIC_API_KEY is missing or invalid.");
  console.error("  1. Copy the template:  cp .env.example .env");
  console.error("  2. Add your key:       ANTHROPIC_API_KEY=sk-ant-...");
  console.error("  3. Get a key at:       https://console.anthropic.com");
  process.exit(1);
}

const bot = new Orchestrator();

// Start scheduler — fires tasks in the background while the CLI is open
startScheduler(async (task) => {
  console.log(`\n[scheduler] Running: ${task.name}`);
  const result = await bot.run(task.task, {
    onStep: ({ type, step, tool }) => {
      if (type === "step") process.stdout.write(`  [step ${step}] ${tool}\n`);
    },
  });
  console.log(`[scheduler] Done: ${task.name}`);
  notify("Clawdbot", `Scheduled task complete: ${task.name}`);
  if (process.stdin.isTTY) process.stdout.write("you > ");
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});

if (process.stdin.isTTY) {
  console.log("Clawdbot ready. Your autonomous AI team is standing by.\n");
  console.log("  Chat:            just type your message");
  console.log("  Autonomous:      /run <task>");
  console.log("  Session cost:    /cost");
  console.log("  Schedule:        /schedule list");
  console.log("                   /schedule add <name> <minutes> <task>");
  console.log("                   /schedule remove <id>");
  console.log("  Clear history:   /clear");
  console.log("  Quit:            Ctrl+C\n");
  console.log("  Tip: set CLAWDBOT_NOTIFY=1 in .env for desktop notifications\n");
}

const prompt = () => {
  if (process.stdin.isTTY) process.stdout.write("you > ");
};

prompt();

rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) { prompt(); return; }

  // /clear
  if (input === "/clear") {
    bot.clearHistory();
    console.log("[history cleared]\n");
    prompt();
    return;
  }

  // /cost
  if (input === "/cost") {
    const c = bot.getCost();
    console.log(`[cost] Session tokens: ${c.inputTokens.toLocaleString()} in / ${c.outputTokens.toLocaleString()} out (${c.totalTokens.toLocaleString()} total)`);
    console.log(`[cost] Estimated spend: ${c.formatted} (claude-opus-4-7 rates)\n`);
    prompt();
    return;
  }

  // /schedule list
  if (input === "/schedule list") {
    const tasks = loadSchedule();
    if (tasks.length === 0) {
      console.log("[schedule] No tasks scheduled.\n");
    } else {
      console.log("[schedule]");
      for (const t of tasks) {
        const status = t.enabled ? "on " : "off";
        const last = t.lastRun ? new Date(t.lastRun).toLocaleTimeString() : "never";
        console.log(`  [${t.id}] ${status} | every ${t.intervalMinutes}m | last: ${last} | ${t.name}`);
      }
      console.log();
    }
    prompt();
    return;
  }

  // /schedule add <name> <minutes> <task>
  if (input.startsWith("/schedule add ")) {
    const parts = input.slice("/schedule add ".length).trim().split(" ");
    if (parts.length < 3) {
      console.log("Usage: /schedule add <name> <interval-minutes> <task description>\n");
      prompt();
      return;
    }
    const name = parts[0];
    const minutes = parseInt(parts[1], 10);
    const task = parts.slice(2).join(" ");
    if (isNaN(minutes) || minutes < 1) {
      console.log("[schedule] interval must be a number of minutes >= 1\n");
      prompt();
      return;
    }
    const entry = addTask({ name, intervalMinutes: minutes, task });
    console.log(`[schedule] Added task '${name}' (id: ${entry.id}) every ${minutes} min\n`);
    prompt();
    return;
  }

  // /schedule remove <id>
  if (input.startsWith("/schedule remove ")) {
    const id = input.slice("/schedule remove ".length).trim();
    removeTask(id);
    console.log(`[schedule] Removed task ${id}\n`);
    prompt();
    return;
  }

  // /run <task>
  if (input.startsWith("/run ")) {
    const task = input.slice(5).trim();
    if (!task) { prompt(); return; }

    console.log(`\n[autonomous] ${task}\n`);

    try {
      const result = await bot.run(task, {
        onStep: ({ type, step, tool, result, summary, question }) => {
          if (type === "step") {
            console.log(`[step ${step}] ${tool}`);
            if (result) console.log(`  └ ${result.split("\n")[0]}`);
          } else if (type === "complete") {
            console.log(`\n[done] ${summary}`);
          } else if (type === "needs_input") {
            console.log(`\n[needs input] ${question}`);
          }
        },
      });

      if (result.status === "timeout") {
        console.error(`\n[timeout] ${result.summary}\n`);
        notify("Clawdbot", `Task timed out: ${task.slice(0, 60)}`);
      } else if (result.status === "needs_input") {
        console.log(`\nclawdbot > ${result.question}\n`);
      } else {
        if (result.summary) console.log(`\nclawdbot > ${result.summary}\n`);
        notify("Clawdbot", `Task complete: ${task.slice(0, 60)}`);
      }
    } catch (err) {
      console.error(`\n[error] ${err.message}\n`);
    }

    prompt();
    return;
  }

  // Regular chat
  try {
    const reply = await bot.chat(input);
    console.log(`\nclawdbot > ${reply}\n`);
  } catch (err) {
    console.error(`\n[error] ${err.message}\n`);
  }

  prompt();
});

rl.on("close", () => process.exit(0));
