# Clawdbot

Your autonomous AI team for the openclaw platform. 10 specialist bots led by an orchestrator — they search code, run builds, remember everything, fetch the web, run tests, write docs, edit code, review quality, analyze images, and coordinate with each other.

---

## First-time setup

```bash
# 1. Go to the clawdbot folder
cd bots/clawdbot

# 2. Create your .env file
cp .env.example .env

# 3. Add your API key (get one at console.anthropic.com)
# Open .env and set: ANTHROPIC_API_KEY=sk-ant-...

# 4. Install dependencies
pnpm install

# 5. Start the team
pnpm start
```

That's it. The team is ready.

---

## Every time after that

```bash
cd bots/clawdbot
pnpm start
```

---

## Commands

| Command | What it does |
|---|---|
| Just type | Chat with the team |
| `/run <task>` | Autonomous mode — team plans and executes on its own |
| `/cost` | Show token usage and estimated spend for this session |
| `/schedule list` | See all scheduled tasks |
| `/schedule add <name> <minutes> <task>` | Schedule a recurring task |
| `/schedule remove <id>` | Remove a scheduled task |
| `/clear` | Clear chat history (start fresh) |
| `Ctrl+C` | Quit |

**Tip:** Set `CLAWDBOT_NOTIFY=1` in your `.env` to get desktop notifications when autonomous tasks finish.

---

## The team

| Bot | Born | What they do |
|---|---|---|
| **Orchestrator** | Jan 27, 2026 | Lead — routes work, coordinates the team, makes final calls |
| **CodeBot** | Jan 27, 2026 | Searches and reads the codebase |
| **DeployBot** | Feb 1, 2026 | Runs builds and shell commands (git is read-only) |
| **MemoryBot** | Mar 1, 2026 | Stores and recalls memories, maintains the glossary |
| **WebBot** | Apr 15, 2026 | Fetches public URLs, researches technical topics |
| **TestBot** | Apr 20, 2026 | Runs tests, reports what's passing or failing |
| **DocBot** | May 1, 2026 | Reads and writes `.md`/`.txt`/`.rst` documentation |
| **QABot** | May 10, 2026 | Cross-checks every specialist's output before it ships |
| **VisionBot** | Jun 1, 2026 | Analyzes screenshots, UI designs, and visual content |
| **EditorBot** | Jun 15, 2026 | Writes, creates, and patches source code files |
| **ReviewBot** | Jun 15, 2026 | Reviews code for bugs, security issues, and quality gaps |

---

## Cost awareness

Run `/cost` at any time to see how many tokens the session has used and the estimated USD spend. The team uses `claude-opus-4-7` — a typical chat costs a few cents, an autonomous `/run` task costs $0.10–$0.50.

Set a monthly spend limit at [console.anthropic.com](https://console.anthropic.com) so there are never any surprises.

---

## Where memory lives

The team stores everything in `~/.clawdbot/`:

| File | Contents |
|---|---|
| `memory.json` | All memories — birthdays, facts, keywords, lessons |
| `messages.json` | Bot-to-bot message bus |
| `schedule.json` | Scheduled tasks |

These persist between sessions. The team remembers everything worth keeping.
