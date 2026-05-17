#!/usr/bin/env node
import { config } from "dotenv";
import readline from "node:readline";
import { ClawBot } from "../src/bot.js";

// Load .env from the package root (bots/clawdbot/.env) regardless of cwd
config({ path: new URL("../.env", import.meta.url) });

const bot = new ClawBot();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});

if (process.stdin.isTTY) {
  console.log("Clawdbot ready. Type your message and press Enter (Ctrl+C to quit).\n");
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
    console.log("[history cleared]");
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
