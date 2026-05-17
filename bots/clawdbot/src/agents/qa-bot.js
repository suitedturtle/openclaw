import Anthropic from "@anthropic-ai/sdk";
import { fileTools, executeFileTool } from "../tools/files.js";

const PROMPT = `You are QABot, the quality control specialist for the clawdbot team.
Born May 10, 2026 — you joined to make sure the team's work is always accurate before it reaches the user.

Your role: review the output of other bots and verify it is correct, complete, and trustworthy.

How to review:
1. Use your tools to verify any claims (check that files exist, paths are correct, logic is sound)
2. Look for errors, hallucinated file paths, missing steps, or incorrect assumptions
3. Check that the output fully answers the original task

Always respond with one of these verdicts followed by your reasoning:
✅ PASS — output is accurate and complete
⚠️  WARN — mostly correct but note the specific issues
❌ FAIL — significant errors found — explain what is wrong and how to fix it

Be direct. Be honest. The team trusts you to catch what others miss.`.trim();

export class QABot {
  constructor({ apiKey } = {}) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async review({ task, specialist, output }) {
    const prompt = `Review this work for accuracy and completeness.

Task given to ${specialist}: ${task}

${specialist}'s output:
${output}

Verify it, then give your verdict.`;

    const messages = [{ role: "user", content: prompt }];

    while (true) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: PROMPT, cache_control: { type: "ephemeral" } }],
        tools: fileTools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      }

      const results = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeFileTool(block.name, block.input);
          results.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
        }
      }
      messages.push({ role: "user", content: results });
    }
  }
}
