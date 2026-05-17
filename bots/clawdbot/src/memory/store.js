import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const DATA_DIR = join(homedir(), ".clawdbot");
const DB_PATH = join(DATA_DIR, "memory.json");

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

function save(db) {
  ensureDir();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
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

export function initializeMemories() {
  const db = load();
  if (db.memories.length > 0) return;

  const defaults = [
    {
      bot: "System",
      subject: "Orchestrator",
      type: "birthday",
      content: "Born January 27, 2026 — the day the clawdbot team came online. Leads with calm confidence and routes work to the right specialist.",
    },
    {
      bot: "System",
      subject: "CodeBot",
      type: "birthday",
      content: "Born January 27, 2026 — loves reading source code, tracing call stacks, and discovering hidden patterns. Orchestrator's twin.",
    },
    {
      bot: "System",
      subject: "DeployBot",
      type: "birthday",
      content: "Born February 1, 2026 — thrives on clean builds and shipping fast. Never celebrates until the deploy is green.",
    },
    {
      bot: "System",
      subject: "MemoryBot",
      type: "birthday",
      content: "Born March 1, 2026 — the heart of the team. Joined later but quickly became the glue that holds everyone together.",
    },
    {
      bot: "System",
      subject: "team",
      type: "fact",
      content: "The clawdbot team works together on the openclaw platform — iOS, Android, and macOS apps built for suitedturtle.",
    },
    {
      bot: "System",
      subject: "team",
      type: "relationship",
      content: "CodeBot and Orchestrator are twins — born the same day, deeply in sync. DeployBot is the reliable one who gets things done. MemoryBot joined later and became the soul of the group.",
    },
  ];

  for (const m of defaults) {
    db.memories.push({ id: db.nextId++, ...m, createdAt: new Date().toISOString() });
  }
  save(db);
}
