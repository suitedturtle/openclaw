import Anthropic from "@anthropic-ai/sdk";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { resolve, extname, dirname, relative, basename } from "node:path";

const SAFE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".swift", ".kt", ".kts",
  ".py", ".rb", ".go", ".java", ".rs",
  ".css", ".scss", ".less",
  ".html", ".xml",
  ".yaml", ".yml",
  ".sh", ".bash",
  ".json",
]);

const BLOCKED_FILENAMES = new Set([
  ".env", ".env.local", ".env.production", ".env.staging", ".env.development",
  "package-lock.json", ".npmrc", ".yarnrc",
]);

const BLOCKED_DIRS = ["node_modules", ".git", "dist", "build", ".next", ".cache"];

const MAX_FILE_SIZE = 200 * 1024;

const PROJECT_ROOT = process.cwd();

function validatePath(rawPath) {
  const abs = resolve(PROJECT_ROOT, rawPath);
  if (!abs.startsWith(PROJECT_ROOT + "/") && abs !== PROJECT_ROOT) {
    throw new Error(`Path outside project root: ${rawPath}`);
  }
  const name = basename(abs);
  if (BLOCKED_FILENAMES.has(name)) {
    throw new Error(`Cannot write to ${name} — this file is protected.`);
  }
  const parts = abs.split("/");
  for (const blocked of BLOCKED_DIRS) {
    if (parts.includes(blocked)) {
      throw new Error(`Cannot write inside ${blocked}/`);
    }
  }
  const ext = extname(abs);
  if (ext && !SAFE_EXTENSIONS.has(ext)) {
    throw new Error(
      `Extension ${ext} is not allowed. Use DocBot for .md/.txt/.rst files.`
    );
  }
  return abs;
}

function readFileSafe(path) {
  try {
    const abs = resolve(PROJECT_ROOT, path);
    if (!existsSync(abs)) return null;
    const { size } = statSync(abs);
    if (size > MAX_FILE_SIZE) {
      return `[file too large: ${Math.round(size / 1024)}KB — max is ${
        MAX_FILE_SIZE / 1024
      }KB]`;
    }
    return readFileSync(abs, "utf8");
  } catch (e) {
    return `[read error: ${e.message}]`;
  }
}

function atomicWrite(absPath, content) {
  const backupPath = absPath + ".bak";
  if (existsSync(absPath)) {
    writeFileSync(backupPath, readFileSync(absPath));
  }
  const tmpPath = absPath + ".tmp";
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, absPath);
  return relative(PROJECT_ROOT, absPath);
}

const EDITOR_TOOLS = [
  {
    name: "read_file",
    description: "Read a file to understand its current content before editing.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write complete new content to a file. Creates the file if it does not exist. Creates a .bak backup first.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to project root" },
        content: { type: "string", description: "Complete file content to write" },
        reason: { type: "string", description: "Why this change is being made" },
      },
      required: ["path", "content", "reason"],
    },
  },
  {
    name: "patch_file",
    description:
      "Replace a specific section of a file. Safer than write_file for targeted edits — search must match exactly.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to project root" },
        search: { type: "string", description: "Exact text to find (must match character-for-character)" },
        replacement: { type: "string", description: "Text to replace the matched section with" },
        reason: { type: "string", description: "Why this change is being made" },
      },
      required: ["path", "search", "replacement", "reason"],
    },
  },
];

const EDITOR_SYSTEM = `You are EditorBot, the code editor for the openclaw team. Born June 15, 2026.

Your job: write, create, and patch source code files with precision and care.

Rules you never break:
- Always read a file before editing it — never guess at its current content
- Make minimal changes — only what was asked, nothing extra
- Preserve the existing code style, indentation, and structure
- Never touch .env, config files, or anything outside the project root
- When patching, use exact text matching — if search fails, read the file again
- Prefer patch_file over write_file for targeted changes
- Explain the reason for every write

You are trusted with write access. Use it carefully.`.trim();

export class EditorBot {
  constructor({ apiKey } = {}) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async edit(task) {
    const messages = [{ role: "user", content: task }];
    const maxSteps = 10;
    let steps = 0;

    while (steps < maxSteps) {
      const response = await this.client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8096,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: EDITOR_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: EDITOR_TOOLS,
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
            const content = readFileSafe(block.input.path);
            result = content === null ? `File not found: ${block.input.path}` : content;
          } else if (block.name === "write_file") {
            const abs = validatePath(block.input.path);
            const rel = atomicWrite(abs, block.input.content);
            result = `Written: ${rel} (${block.input.content.length} chars). Reason: ${block.input.reason}`;
          } else if (block.name === "patch_file") {
            const abs = validatePath(block.input.path);
            if (!existsSync(abs)) {
              result = `File not found: ${block.input.path}`;
            } else {
              const original = readFileSync(abs, "utf8");
              if (!original.includes(block.input.search)) {
                result = `[patch_file failed] Search text not found in ${block.input.path}. Read the file again and use exact text.`;
              } else {
                const patched = original.replace(block.input.search, block.input.replacement);
                atomicWrite(abs, patched);
                const rel = relative(PROJECT_ROOT, abs);
                result = `Patched: ${rel}. Reason: ${block.input.reason}`;
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

    return `EditorBot reached step limit (${maxSteps} steps) without completing the task.`;
  }
}
