import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const DATA_DIR = join(homedir(), ".clawdbot");
const SCHEDULE_PATH = join(DATA_DIR, "schedule.json");

export function loadSchedule() {
  if (!existsSync(SCHEDULE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(SCHEDULE_PATH, "utf8"));
  } catch {
    return [];
  }
}

export function saveSchedule(tasks) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SCHEDULE_PATH, JSON.stringify(tasks, null, 2), "utf8");
}

export function addTask({ name, task, intervalMinutes }) {
  const tasks = loadSchedule();
  const entry = {
    id: Date.now(),
    name,
    task,
    intervalMinutes,
    lastRun: null,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  tasks.push(entry);
  saveSchedule(tasks);
  return entry;
}

export function removeTask(id) {
  saveSchedule(loadSchedule().filter((t) => t.id !== Number(id)));
}

// Checks every minute whether any scheduled task is due. Runs onTask(task) when it fires.
export function startScheduler(onTask) {
  setInterval(() => {
    const tasks = loadSchedule();
    const now = Date.now();
    let changed = false;

    for (const task of tasks) {
      if (!task.enabled) continue;
      const lastRun = task.lastRun ? new Date(task.lastRun).getTime() : 0;
      if (now - lastRun >= task.intervalMinutes * 60 * 1000) {
        task.lastRun = new Date().toISOString();
        changed = true;
        onTask(task).catch(() => {});
      }
    }

    if (changed) saveSchedule(tasks);
  }, 60 * 1000);
}
