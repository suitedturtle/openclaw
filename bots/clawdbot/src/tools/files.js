import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export const fileTools = [
  {
    name: "read_file",
    description: "Read the contents of a file from the codebase.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the project root" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_files",
    description: "Search for a text pattern across source files in the codebase.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Literal string or basic regex to search for" },
        directory: { type: "string", description: "Directory to search in (default: .)" },
      },
      required: ["pattern"],
    },
  },
];

export async function executeFileTool(name, input) {
  if (name === "read_file") {
    try {
      return await readFile(resolve(process.cwd(), input.path), "utf8");
    } catch (e) {
      return `Error reading file: ${e.message}`;
    }
  }

  if (name === "search_files") {
    try {
      return execFileSync(
        "grep",
        ["-r", "-n", "--include=*.js", "--include=*.ts", "--include=*.json",
         "--include=*.md", input.pattern, input.directory ?? "."],
        { encoding: "utf8", maxBuffer: 512 * 1024 }
      ) || "No matches found.";
    } catch (e) {
      return e.stdout || "No matches found.";
    }
  }
}
