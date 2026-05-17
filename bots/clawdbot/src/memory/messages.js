import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";

const DATA_DIR = join(homedir(), ".clawdbot");
const MSG_PATH = join(DATA_DIR, "messages.json");
const TMP_PATH = join(DATA_DIR, "messages.json.tmp");
const MAX_MESSAGES = 100;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!existsSync(MSG_PATH)) return { messages: [], nextId: 1 };
  try {
    return JSON.parse(readFileSync(MSG_PATH, "utf8"));
  } catch {
    return { messages: [], nextId: 1 };
  }
}

function save(db) {
  if (db.messages.length > MAX_MESSAGES) db.messages = db.messages.slice(-MAX_MESSAGES);
  writeFileSync(TMP_PATH, JSON.stringify(db, null, 2), "utf8");
  renameSync(TMP_PATH, MSG_PATH);
}

export function postMessage({ from, to, content }) {
  const db = load();
  const msg = { id: db.nextId++, from, to, content, createdAt: new Date().toISOString(), read: false };
  db.messages.push(msg);
  save(db);
  return msg;
}

export function readInbox(bot) {
  const db = load();
  const inbox = db.messages.filter((m) => (m.to === bot || m.to === "all") && !m.read);
  for (const m of inbox) m.read = true;
  if (inbox.length > 0) save(db);
  return inbox;
}

export function getAllMessages(limit = 20) {
  return load().messages.slice(-limit);
}
