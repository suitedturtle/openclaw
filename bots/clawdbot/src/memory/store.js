import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";

const DATA_DIR = join(homedir(), ".clawdbot");
const DB_PATH = join(DATA_DIR, "memory.json");
const TMP_PATH = join(DATA_DIR, "memory.json.tmp");
const MAX_MEMORIES = 500;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!existsSync(DB_PATH)) return { memories: [], nextId: 1 };
  try {
    return JSON.parse(readFileSync(DB_PATH, "utf8"));
  } catch {
    return { memories: [], nextId: 1 };
  }
}

// Atomic write: write to a temp file then rename into place.
// Prevents JSON corruption if the process is killed mid-write.
function save(db) {
  ensureDir();
  if (db.memories.length > MAX_MEMORIES) {
    db.memories = db.memories.slice(-MAX_MEMORIES);
  }
  writeFileSync(TMP_PATH, JSON.stringify(db, null, 2), "utf8");
  renameSync(TMP_PATH, DB_PATH);
}

export function storeMemory({ bot, subject, type, content }) {
  const db = load();
  const entry = {
    id: db.nextId++,
    bot,
    subject,
    type,
    content,
    createdAt: new Date().toISOString(),
  };
  db.memories.push(entry);
  save(db);
  return entry;
}

export function recallMemories({ query, subject, type, limit = 20 } = {}) {
  const db = load();
  let results = [...db.memories];
  if (subject) results = results.filter((m) => m.subject.toLowerCase().includes(subject.toLowerCase()));
  if (type) results = results.filter((m) => m.type === type);
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (m) => m.content.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q)
    );
  }
  return results.slice(-limit);
}

export function getAllMemories(limit = 50) {
  const db = load();
  return db.memories.slice(-limit);
}

const LESSONS = [
  { subject: "lessons", type: "fact", content: "LESSON: Always wrap tool execution in try/catch — a failing tool must return an error string, never crash the loop." },
  { subject: "lessons", type: "fact", content: "LESSON: History trimming must preserve complete user/assistant pairs — never slice mid-exchange or orphan tool_result blocks." },
  { subject: "lessons", type: "fact", content: "LESSON: WebBot must strip HTML before returning content — raw HTML floods the context with token noise." },
  { subject: "lessons", type: "fact", content: "LESSON: DocBot must validate write paths — only .md/.txt/.rst inside the project root; never overwrite config or source files." },
  { subject: "lessons", type: "fact", content: "LESSON: Shell commands need a 30-second timeout — a hung process blocks the entire agent loop." },
  { subject: "lessons", type: "fact", content: "LESSON: Git is read-only for agents — push, reset, checkout, and other destructive subcommands are blocked." },
  { subject: "lessons", type: "fact", content: "LESSON: WebBot must block private/local addresses (localhost, 127.x, 10.x, 192.168.x) before any fetch." },
  { subject: "lessons", type: "fact", content: "LESSON: run() history must be trimmed — unbounded runHistory overflows the context window on long autonomous tasks." },
  { subject: "lessons", type: "fact", content: "LESSON: Tool results must be capped at 8 KB in history — large grep or file outputs burn the context window fast." },
  { subject: "lessons", type: "fact", content: "LESSON: If QABot returns FAIL twice on the same step, escalate to needs_human_input — never loop on the same failure indefinitely." },
  { subject: "lessons", type: "fact", content: "LESSON: messages.create() must use retry logic with exponential backoff — transient 429/529 errors must not crash the session." },
  { subject: "lessons", type: "fact", content: "LESSON: Memory writes must be atomic (write-to-tmp then rename) — a crash mid-write must never corrupt memory.json." },
];

export function initializeMemories() {
  const db = load();
  let changed = false;

  if (db.memories.length === 0) {
    const defaults = [
      { subject: "Orchestrator", type: "birthday", content: "Born January 27, 2026 — leads the team with calm confidence, routes work to the right specialist." },
      { subject: "CodeBot", type: "birthday", content: "Born January 27, 2026 — Orchestrator's twin. Loves reading source code and tracing patterns." },
      { subject: "DeployBot", type: "birthday", content: "Born February 1, 2026 — never celebrates until the build is green." },
      { subject: "MemoryBot", type: "birthday", content: "Born March 1, 2026 — the heart of the team. Joined later but became essential glue." },
      { subject: "WebBot", type: "birthday", content: "Born April 15, 2026 — fetches the web and researches technical topics for the team." },
      { subject: "TestBot", type: "birthday", content: "Born April 20, 2026 — runs tests and makes sure nothing ships broken." },
      { subject: "DocBot", type: "birthday", content: "Born May 1, 2026 — reads and writes documentation, keeps knowledge current and clear." },
      { subject: "QABot", type: "birthday", content: "Born May 10, 2026 — quality control specialist. Cross-checks all work before it ships." },
      { subject: "team", type: "fact", content: "The clawdbot team works on the openclaw platform — iOS, Android, and macOS apps built by suitedturtle." },
      { subject: "team", type: "relationship", content: "CodeBot and Orchestrator are twins. DeployBot is reliable. MemoryBot is the soul. WebBot is curious. TestBot is the gatekeeper. DocBot is the scribe. QABot keeps everyone honest." },
    ];
    for (const m of defaults) {
      db.memories.push({ id: db.nextId++, bot: "System", ...m, createdAt: new Date().toISOString() });
    }
    changed = true;
  }

  const migrations = [
    { subject: "WebBot", type: "birthday", content: "Born April 15, 2026 — fetches the web and researches technical topics for the team." },
    { subject: "TestBot", type: "birthday", content: "Born April 20, 2026 — runs tests and makes sure nothing ships broken." },
    { subject: "DocBot", type: "birthday", content: "Born May 1, 2026 — reads and writes documentation, keeps knowledge current and clear." },
    { subject: "QABot", type: "birthday", content: "Born May 10, 2026 — quality control specialist. Cross-checks all work before it ships." },
    ...LESSONS,
  ];

  for (const m of migrations) {
    const exists = db.memories.some((e) => e.subject === m.subject && e.type === m.type && e.content === m.content);
    if (!exists) {
      db.memories.push({ id: db.nextId++, bot: "System", ...m, createdAt: new Date().toISOString() });
      changed = true;
    }
  }

  if (changed) save(db);
}
