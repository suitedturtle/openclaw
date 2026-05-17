import { execFileSync } from "node:child_process";
import { platform } from "node:os";

// Notifications are opt-in. Set CLAWDBOT_NOTIFY=1 in your .env to enable.
export function notify(title, message) {
  if (!process.env.CLAWDBOT_NOTIFY) return;
  try {
    if (platform() === "darwin") {
      execFileSync(
        "osascript",
        ["-e", `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`],
        { timeout: 3000 }
      );
    } else if (platform() === "linux") {
      execFileSync("notify-send", [title, message], { timeout: 3000 });
    }
  } catch {
    // Notifications are best-effort — never crash the main loop
  }
}
