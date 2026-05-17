import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname, basename } from "node:path";
import { execFileSync } from "node:child_process";

const SAFE_EXTENSIONS = new Set([".md", ".txt", ".rst"]);
const BLOCKED_FILENAMES = new Set([
  "package.json", "pnpm-workspace.yaml", ".env", ".env.example",
  "tsconfig.json", "wrangler.toml", "vite.config.ts",
]);

export const docTools = [
  {
    name: "read_doc",
    description: "Read a markdown or text document from the project.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "File path relative to project root" } },
      required: ["path"],
    },
  },
  {
    name: "write_doc",
    description: "Write or update a .md, .txt, or .rst document. Cannot overwrite source or config files.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "Full document content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_docs",
    description: "List all markdown files in a directory.",
    input_schema: {
      type: "object",
      properties: { directory: { type: "string", description: "Directory to search (default: .)" } },
    },
  },
];

export async function executeDocTool(name, input) {
  if (name === "read_doc") {
    try {
      return await readFile(resolve(process.cwd(), input.path), "utf8");
    } catch (e) {
      return `Error reading doc: ${e.message}`;
    }
  }

  if (name === "write_doc") {
    const fullPath = resolve(process.cwd(), input.path);
    const cwd = process.cwd();

    if (!fullPath.startsWith(cwd)) {
      return `Rejected: path must be inside the project directory.`;
    }
    if (!SAFE_EXTENSIONS.has(extname(fullPath))) {
      return `Rejected: DocBot can only write .md, .txt, or .rst files.`;
    }
    if (BLOCKED_FILENAMES.has(basename(fullPath))) {
      return `Rejected: ${basename(fullPath)} is a protected file.`;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.content, "utf8");
    return `Written: ${input.path}`;
  }

  if (name === "list_docs") {
    try {
      return (
        execFileSync(
          "find",
          [input.directory ?? ".", "-name", "*.md", "-not", "-path", "*/node_modules/*"],
          { encoding: "utf8" }
        ) || "No docs found."
      );
    } catch (e) {
      return `Error: ${e.message}`;
    }
  }
}
