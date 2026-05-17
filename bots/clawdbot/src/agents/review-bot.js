import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const MAX_FILE_SIZE = 100 * 1024;
const PROJECT_ROOT = process.cwd();

const REVIEW_TOOLS = [
  {
    name: "read_file",
    description: "Read a source code file for review.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

const REVIEW_SYSTEM = `You are ReviewBot, the code quality specialist for the openclaw team. Born June 15, 2026.

Your job: review code for bugs, security issues, performance problems, and quality gaps.

What you look for:
1. Security — injection, unsafe evals, unvalidated inputs, exposed secrets, path traversal
2. Error handling — uncaught exceptions, missing null checks, failed promise chains
3. Performance — N+1 queries, missing caches, synchronous blocking in async contexts
4. Correctness — off-by-one errors, race conditions, incorrect logic, wrong assumptions
5. Code quality — overly complex functions, magic numbers, misleading names

Output format:
- Rate each issue: CRITICAL / HIGH / MEDIUM / LOW
- For each issue: describe the problem, the exact function/line, and what to fix
- End with overall rating: PASS (no issues), WARN (minor issues only), FAIL (must fix before shipping)

Be specific and actionable. Read the file first, then review what you actually see.`.trim();

export class ReviewBot {
  constructor({ apiKey } = {}) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async review(task) {
    const messages = [{ role: "user", content: task }];
    const maxSteps = 8;
    let steps = 0;

    while (steps < maxSteps) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: REVIEW_TOOLS,
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
        steps++;
        let result;
        try {
          if (block.name === "read_file") {
            const abs = resolve(PROJECT_ROOT, block.input.path);
            if (!existsSync(abs)) {
              result = `File not found: ${block.input.path}`;
            } else {
              const { size } = statSync(abs);
              if (size > MAX_FILE_SIZE) {
                result = `[file too large: ${Math.round(size / 1024)}KB — max ${
                  MAX_FILE_SIZE / 1024
                }KB]`;
              } else {
                result = readFileSync(abs, "utf8");
              }
            }
          } else {
            result = `Unknown tool: ${block.name}`;
          }
        } catch (e) {
          result = `[${block.name} failed] ${e.message}`;
        }
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(result).slice(0, 8192),
        });
      }
      messages.push({ role: "user", content: results });
    }

    return `ReviewBot reached the step limit without completing the review.`;
  }
}
