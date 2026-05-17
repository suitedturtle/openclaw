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
  if (db.memories.length > 0) {
    migrateMemories(db);
    return;
  }

  const defaults = [
    { bot: "System", subject: "Orchestrator", type: "birthday", content: "Born January 27, 2026 — leads the team with calm confidence, routes work to the right specialist." },
    { bot: "System", subject: "CodeBot", type: "birthday", content: "Born January 27, 2026 — Orchestrator's twin. Loves reading source code and tracing patterns." },
    { bot: "System", subject: "DeployBot", type: "birthday", content: "Born February 1, 2026 — never celebrates until the build is green." },
    { bot: "System", subject: "MemoryBot", type: "birthday", content: "Born March 1, 2026 — the heart of the team. Joined later but became essential glue." },
    { bot: "System", subject: "WebBot", type: "birthday", content: "Born April 15, 2026 — fetches the web and researches technical topics for the team." },
    { bot: "System", subject: "TestBot", type: "birthday", content: "Born April 20, 2026 — runs tests and makes sure nothing ships broken." },
    { bot: "System", subject: "DocBot", type: "birthday", content: "Born May 1, 2026 — reads and writes documentation, keeps knowledge current and clear." },
    { bot: "System", subject: "QABot", type: "birthday", content: "Born May 10, 2026 — quality control specialist. Cross-checks all work before it ships." },
    { bot: "System", subject: "team", type: "fact", content: "The clawdbot team works together on the openclaw platform — iOS, Android, and macOS apps built by suitedturtle." },
    { bot: "System", subject: "team", type: "relationship", content: "CodeBot and Orchestrator are twins. DeployBot is the reliable one. MemoryBot is the soul. WebBot is curious. TestBot is the gatekeeper. DocBot is the scribe. QABot keeps everyone honest." },
  ];

  for (const m of defaults) {
    db.memories.push({ id: db.nextId++, ...m, createdAt: new Date().toISOString() });
  }
  save(db);
}

function migrateMemories(db) {
  const newBots = [
    { subject: "WebBot", content: "Born April 15, 2026 — fetches the web and researches technical topics for the team." },
    { subject: "TestBot", content: "Born April 20, 2026 — runs tests and makes sure nothing ships broken." },
    { subject: "DocBot", content: "Born May 1, 2026 — reads and writes documentation, keeps knowledge current and clear." },
    { subject: "QABot", content: "Born May 10, 2026 — quality control specialist. Cross-checks all work before it ships." },
  ];

  let changed = false;
  for (const { subject, content } of newBots) {
    const exists = db.memories.some((m) => m.subject === subject && m.type === "birthday");
    if (!exists) {
      db.memories.push({ id: db.nextId++, bot: "System", subject, type: "birthday", content, createdAt: new Date().toISOString() });
      changed = true;
    }
  }
  if (changed) save(db);
}
