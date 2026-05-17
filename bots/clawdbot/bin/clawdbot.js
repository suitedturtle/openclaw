#!/usr/bin/env node
import { config } from "dotenv";
import readline from "node:readline";
import { Orchestrator } from "../src/orchestrator.js";

config({ path: new URL("../.env", import.meta.url) });

const bot = new Orchestrator();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});

if (process.stdin.isTTY) {
  console.log("Clawdbot (team mode) ready. Type your message and press Enter (Ctrl+C to quit).\n");
  console.log("  CodeBot   — searches and reads the codebase");
  console.log("  DeployBot — runs builds and shell commands");
  console.log("  Orchestrator — routes your request to the right specialist\n");
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

  try {
    const reply = await bot.chat(input);
    console.log(`\nclawdbot > ${reply}\n`);
  } catch (err) {
    console.error(`\n[error] ${err.message}\n`);
  }

  prompt();
});

rl.on("close", () => process.exit(0));
