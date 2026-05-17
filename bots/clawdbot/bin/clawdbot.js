#!/usr/bin/env node
import { config } from "dotenv";
import readline from "node:readline";
import { Orchestrator } from "../src/orchestrator.js";

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});

if (process.stdin.isTTY) {
  console.log("Clawdbot ready. Your autonomous AI team is standing by.\n");
  console.log("  Chat:       just type your message");
  console.log("  Autonomous: /run <task>");
  console.log("  Clear:      /clear");
  console.log("  Quit:       Ctrl+C\n");
}

const prompt = () => {
  if (process.stdin.isTTY) process.stdout.write("you > ");
};

prompt();

rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) { prompt(); return; }

  if (input === "/clear") {
    bot.clearHistory();
    console.log("[history cleared]\n");
    prompt();
    return;
  }

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
      } else if (result.status === "needs_input") {
        console.log(`\nclawdbot > ${result.question}\n`);
      } else if (result.summary) {
        console.log(`\nclawdbot > ${result.summary}\n`);
      } else {
        console.log(`\n[${result.status}]\n`);
      }
    } catch (err) {
      console.error(`\n[error] ${err.message}\n`);
    }

    prompt();
    return;
  }

  try {
    const reply = await bot.chat(input);
    console.log(`\nclawdbot > ${reply}\n`);
  } catch (err) {
    console.error(`\n[error] ${err.message}\n`);
  }

  prompt();
});

rl.on("close", () => process.exit(0));
