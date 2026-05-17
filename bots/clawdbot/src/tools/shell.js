import { execFileSync } from "node:child_process";

const ALLOWED = new Set(["pnpm", "npm", "node", "ls", "find", "cat", "git"]);

const SAFE_GIT = new Set([
  "status", "log", "diff", "show", "branch",
  "fetch", "ls-files", "ls-tree", "rev-parse", "describe",
]);

const SHELL_TIMEOUT_MS = 30_000;

export const shellTools = [
  {
    name: "run_shell",
    description:
      "Run a safe shell command in the project directory. " +
      "Allowed programs: pnpm, npm, node, ls, find, cat. " +
      "Git is read-only: status, log, diff, show, branch, fetch, ls-files, ls-tree.",
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
      return `Not allowed: '${cmd}'. Allowed: ${[...ALLOWED].join(", ")}.`;
    }

    if (cmd === "git") {
      const sub = args[0];
      if (!SAFE_GIT.has(sub)) {
        return `Git subcommand '${sub}' is not allowed. Safe subcommands: ${[...SAFE_GIT].join(", ")}.`;
      }
    }

    try {
      return (
        execFileSync(cmd, args, {
          encoding: "utf8",
          maxBuffer: 512 * 1024,
          timeout: SHELL_TIMEOUT_MS,
        }) || "(no output)"
      );
    } catch (e) {
      if (e.signal === "SIGTERM") return `Command timed out after ${SHELL_TIMEOUT_MS / 1000}s.`;
      return `Error (exit ${e.status}): ${e.stderr || e.message}`;
    }
  }
}
