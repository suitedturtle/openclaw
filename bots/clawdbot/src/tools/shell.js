import { execFileSync } from "node:child_process";

const ALLOWED = new Set(["pnpm", "npm", "node", "ls", "find", "cat", "git"]);

export const shellTools = [
  {
    name: "run_shell",
    description: "Run a safe shell command in the project directory. Allowed programs: pnpm, npm, node, ls, find, cat, git.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Full command string, e.g. 'pnpm build' or 'git status'" },
      },
      required: ["command"],
    },
  },
];

export function executeShellTool(name, input) {
  if (name === "run_shell") {
    const [cmd, ...args] = input.command.trim().split(/\s+/);
    if (!ALLOWED.has(cmd)) {
      return `Not allowed: '${cmd}'. Allowed programs: ${[...ALLOWED].join(", ")}.`;
    }
    try {
      return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 512 * 1024 }) || "(no output)";
    } catch (e) {
      return `Error (exit ${e.status}): ${e.stderr || e.message}`;
    }
  }
}
