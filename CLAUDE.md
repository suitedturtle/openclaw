# Repository Guidelines

- Repo: https://github.com/suitedturtle/openclaw (fork of https://github.com/openclaw/openclaw)
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` (or $'...') for real newlines; never embed "\\n".

## Codebase Overview

OpenClaw is a TypeScript/Node.js AI gateway CLI that connects messaging channels (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, LINE, and more) to Claude and other AI models. It also ships native apps for macOS, iOS, and Android.

**Key technology choices:**
- Language: TypeScript (ESM), Node 22+, pnpm workspace monorepo
- Package manager: pnpm 10 (also supports bun for dev/test execution)
- Build: `tsc` → `dist/`; Bun preferred for dev scripts
- Linting/formatting: Oxlint + Oxfmt
- Tests: Vitest with V8 coverage (70% threshold)
- Native apps: Swift/SwiftUI (macOS + iOS), Kotlin (Android)
- Docs: Mintlify at https://docs.openclaw.ai

### Top-Level Directory Map

```
openclaw/
├── src/                     # Core TypeScript source (see module map below)
├── dist/                    # Build output (gitignored)
├── extensions/              # Optional channel plugins (workspace packages)
├── apps/
│   ├── ios/                 # Swift/SwiftUI iPhone/iPad app
│   ├── android/             # Kotlin Android app
│   ├── macos/               # Swift/SwiftUI macOS menubar app
│   └── shared/OpenClawKit/  # Cross-platform Swift kit
├── bots/
│   └── clawdbot/            # Autonomous multi-agent AI bot (Node.js/ESM)
├── Swabble/                 # Voice wake-word detection library (Swift Package)
├── docs/                    # Mintlify documentation source
├── scripts/                 # Build, release, test, and dev helper scripts
├── assets/                  # Icons, chrome extension assets
├── assistants/              # Scoped CLAUDE.md files for sub-areas
│   ├── clawdbot/CLAUDE.md
│   ├── ios/CLAUDE.md
│   ├── android/CLAUDE.md
│   └── macos/CLAUDE.md
└── .pi/                     # Pi agent prompts and extensions
    ├── prompts/             # Shorthand prompt files (cl.md, is.md, pr.md)
    └── extensions/          # Pi UI extensions (diff, files, redraws, prompt-url)
```

### `src/` Module Map

```
src/
├── acp/                     # Agent Client Protocol SDK wiring
├── agents/                  # Pi agent runner, sandbox, skills, auth profiles
├── auto-reply/              # Auto-reply rule engine
├── browser/                 # Playwright-based browser routes
├── canvas-host/             # A2UI canvas host + a2ui bundle (auto-generated hash)
├── channels/                # Shared channel logic: allowlists, command-gating, registry, session
├── cli/                     # Commander-based CLI wiring (gateway, node, browser, daemon, cron)
├── commands/                # CLI command implementations (onboard, status, models, channels)
├── compat/                  # Legacy migration shims
├── config/                  # Config read/write, session config
├── cron/                    # Scheduled task runner + isolated agent cron
├── daemon/                  # Daemon/service process management
├── discord/                 # Discord channel integration
├── docs/                    # In-process doc helpers
├── gateway/                 # Gateway server, protocol, server-methods (config/send/skills/talk)
├── hooks/                   # Hook system + bundled hooks
├── imessage/                # iMessage channel integration
├── infra/                   # Network, TLS, outbound HTTP
├── line/                    # LINE messaging channel
├── link-understanding/      # URL/link preview and understanding
├── logging/                 # tslog-based logging
├── macos/                   # macOS-specific bridge code
├── markdown/                # Markdown rendering
├── media/                   # Media pipeline (image/audio/video processing)
├── media-understanding/     # AI media analysis providers
├── memory/                  # Persistent memory store
├── node-host/               # Node process hosting
├── pairing/                 # Device pairing flow
├── plugin-sdk/              # Public plugin SDK (exported as `openclaw/plugin-sdk`)
├── plugins/                 # Plugin runtime loader
├── process/                 # Process bridging (tau-rpc, exec)
├── providers/               # AI provider adapters (Anthropic, OpenAI, Bedrock, Ollama, etc.)
├── routing/                 # Message routing logic
├── security/                # Security utilities
├── sessions/                # Session management
├── shared/                  # Shared text utilities
├── signal/                  # Signal channel integration
├── slack/                   # Slack channel integration
├── telegram/                # Telegram channel (grammy)
├── terminal/                # CLI table rendering, palette, progress
├── tts/                     # Text-to-speech (node-edge-tts)
├── tui/                     # Terminal UI (interactive TUI components)
├── types/                   # Shared TypeScript types
├── utils/                   # General utilities
├── web/                     # WhatsApp Web channel (Baileys)
├── whatsapp/                # WhatsApp protocol helpers
└── wizard/                  # Interactive onboarding wizard
```

### Extensions (Channel Plugins)

Each extension is an independent workspace package under `extensions/`:

| Extension | Channel |
|-----------|---------|
| `discord` | Discord (standalone plugin version) |
| `slack` | Slack |
| `signal` | Signal |
| `msteams` | Microsoft Teams |
| `matrix` | Matrix |
| `zalo` | Zalo |
| `zalouser` | Zalo User |
| `googlechat` | Google Chat |
| `mattermost` | Mattermost |
| `tlon` | Tlon |
| `google-antigravity-auth` | Google auth for antigravity tools |
| `diagnostics-otel` | OpenTelemetry diagnostics |

Plugin rules: runtime deps in `dependencies`, not `devDependencies`; use `peerDependencies` for the `openclaw` package (not `workspace:*`); no `^`/`~` on patched deps.

### Clawdbot (`bots/clawdbot/`)

Autonomous multi-agent AI bot built on top of the openclaw platform. Uses the Anthropic SDK directly (`@anthropic-ai/sdk`).

```
bots/clawdbot/
├── bin/clawdbot.js        # CLI entrypoint
├── src/
│   ├── bot.js             # Bot wiring
│   ├── orchestrator.js    # Agent orchestration loop
│   ├── scheduler.js       # Scheduled tasks
│   ├── system-prompt.js   # Shared system prompt
│   ├── notify.js          # Notification helpers
│   ├── memory/            # Persistent memory layer
│   ├── tools/             # Tool implementations
│   └── agents/            # Specialist bots: CodeBot, DeployBot, DocBot, EditorBot,
│                          #   MemoryBot, QABot, ReviewBot, TestBot, VisionBot, WebBot
```

See `assistants/clawdbot/CLAUDE.md` for scoped guidance on this area.

### Swabble (`Swabble/`)

Swift Package for voice wake-word detection. Standalone library used by the macOS app. Has its own CI, Swift linting, and format config.

### Native Apps (`apps/`)

- **macOS** (`apps/macos/`): Swift/SwiftUI menubar app. Hosts the gateway. Rebuild requires a real Mac — never rebuild over SSH.
- **iOS** (`apps/ios/`): Swift/SwiftUI app. Uses XcodeGen (`pnpm ios:gen`). Tests live in `apps/ios/Tests/`.
- **Android** (`apps/android/`): Kotlin + Gradle. Build with `pnpm android:assemble`.
- **Shared** (`apps/shared/OpenClawKit/`): Cross-platform Swift kit shared by macOS and iOS.

SwiftUI state management: prefer `@Observable`/`@Bindable` (Observation framework) over `ObservableObject`/`@StateObject`. Do not introduce `ObservableObject` in new code.

### Render Deployment (`render.yaml`)

Docker-based web service. Key env vars: `PORT=8080`, `OPENCLAW_STATE_DIR=/data/.openclaw`, `OPENCLAW_WORKSPACE_DIR=/data/workspace`, `OPENCLAW_GATEWAY_TOKEN` (auto-generated), `SETUP_PASSWORD`. Uses a 1 GB persistent disk at `/data`.

## Project Structure & Module Organization

- Source code: `src/` (CLI wiring in `src/cli`, commands in `src/commands`, web provider in `src/provider-web.ts`, infra in `src/infra`, media pipeline in `src/media`).
- Tests: colocated `*.test.ts`.
- Docs: `docs/` (images, queue, Pi config). Built output lives in `dist/`.
- Plugins/extensions: live under `extensions/*` (workspace packages). Keep plugin-only deps in the extension `package.json`; do not add them to the root `package.json` unless core uses them.
- Plugins: install runs `npm install --omit=dev` in plugin dir; runtime deps must live in `dependencies`. Avoid `workspace:*` in `dependencies` (npm install breaks); put `openclaw` in `devDependencies` or `peerDependencies` instead (runtime resolves `openclaw/plugin-sdk` via jiti alias).
- Installers served from `https://openclaw.ai/*`: live in the sibling repo `../openclaw.ai` (`public/install.sh`, `public/install-cli.sh`, `public/install.ps1`).
- Messaging channels: always consider **all** built-in + extension channels when refactoring shared logic (routing, allowlists, pairing, command gating, onboarding, docs).
  - Core channel docs: `docs/channels/`
  - Core channel code: `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web` (WhatsApp web), `src/channels`, `src/routing`
  - Extensions (channel plugins): `extensions/*` (e.g. `extensions/msteams`, `extensions/matrix`, `extensions/zalo`, `extensions/zalouser`, `extensions/voice-call`)
- When adding channels/extensions/apps/docs, review `.github/labeler.yml` for label coverage.

## Docs Linking (Mintlify)

- Docs are hosted on Mintlify (docs.openclaw.ai).
- Internal doc links in `docs/**/*.md`: root-relative, no `.md`/`.mdx` (example: `[Config](/configuration)`).
- Section cross-references: use anchors on root-relative paths (example: `[Hooks](/configuration#hooks)`).
- Doc headings and anchors: avoid em dashes and apostrophes in headings because they break Mintlify anchor links.
- When Peter asks for links, reply with full `https://docs.openclaw.ai/...` URLs (not root-relative).
- When you touch docs, end the reply with the `https://docs.openclaw.ai/...` URLs you referenced.
- README (GitHub): keep absolute docs URLs (`https://docs.openclaw.ai/...`) so links work on GitHub.
- Docs content must be generic: no personal device names/hostnames/paths; use placeholders like `user@gateway-host` and "gateway host".

## exe.dev VM ops (general)

- Access: stable path is `ssh exe.dev` then `ssh vm-name` (assume SSH key already set).
- SSH flaky: use exe.dev web terminal or Shelley (web agent); keep a tmux session for long ops.
- Update: `sudo npm i -g openclaw@latest` (global install needs root on `/usr/lib/node_modules`).
- Config: use `openclaw config set ...`; ensure `gateway.mode=local` is set.
- Discord: store raw token only (no `DISCORD_BOT_TOKEN=` prefix).
- Restart: stop old gateway and run:
  `pkill -9 -f openclaw-gateway || true; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &`
- Verify: `openclaw channels status --probe`, `ss -ltnp | rg 18789`, `tail -n 120 /tmp/openclaw-gateway.log`.

## Build, Test, and Development Commands

- Runtime baseline: Node **22+** (keep Node + Bun paths working).
- Install deps: `pnpm install`
- Pre-commit hooks: `prek install` (runs same checks as CI)
- Also supported: `bun install` (keep `pnpm-lock.yaml` + Bun patching in sync when touching deps/patches).
- Prefer Bun for TypeScript execution (scripts, dev, tests): `bun <file.ts>` / `bunx <tool>`.
- Run CLI in dev: `pnpm openclaw ...` (bun) or `pnpm dev`.
- Node remains supported for running built output (`dist/*`) and production installs.
- Mac packaging (dev): `scripts/package-mac-app.sh` defaults to current arch. Release checklist: `docs/platforms/mac/release.md`.
- Type-check/build: `pnpm build`
- Lint/format: `pnpm lint` (oxlint), `pnpm format` (oxfmt)
- Tests: `pnpm test` (vitest); coverage: `pnpm test:coverage`

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Prefer strict typing; avoid `any`.
- Formatting/linting via Oxlint and Oxfmt; run `pnpm lint` before commits.
- Add brief code comments for tricky or non-obvious logic.
- Keep files concise; extract helpers instead of "V2" copies. Use existing patterns for CLI options and dependency injection via `createDefaultDeps`.
- Aim to keep files under ~700 LOC; guideline only (not a hard guardrail). Split/refactor when it improves clarity or testability.
- Naming: use **OpenClaw** for product/app/docs headings; use `openclaw` for CLI command, package/binary, paths, and config keys.

## Release Channels (Naming)

- stable: tagged releases only (e.g. `vYYYY.M.D`), npm dist-tag `latest`.
- beta: prerelease tags `vYYYY.M.D-beta.N`, npm dist-tag `beta` (may ship without macOS app).
- dev: moving head on `main` (no tag; git checkout main).

## Version Locations

When bumping a version, update **all** of these:
- `package.json` — CLI version
- `apps/android/app/build.gradle.kts` — `versionName`/`versionCode`
- `apps/ios/Sources/Info.plist` + `apps/ios/Tests/Info.plist` — `CFBundleShortVersionString`/`CFBundleVersion`
- `apps/macos/Sources/OpenClaw/Resources/Info.plist` — same keys
- `docs/install/updating.md` — pinned npm version
- `docs/platforms/mac/release.md` — APP_VERSION/APP_BUILD examples
- Peekaboo Xcode projects/Info.plists — `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`

## Testing Guidelines

- Framework: Vitest with V8 coverage thresholds (70% lines/branches/functions/statements).
- Naming: match source names with `*.test.ts`; e2e in `*.e2e.test.ts`.
- Run `pnpm test` (or `pnpm test:coverage`) before pushing when you touch logic.
- Do not set test workers above 16; tried already.
- Live tests (real keys): `CLAWDBOT_LIVE_TEST=1 pnpm test:live` (OpenClaw-only) or `LIVE=1 pnpm test:live` (includes provider live tests). Docker: `pnpm test:docker:live-models`, `pnpm test:docker:live-gateway`. Onboarding Docker E2E: `pnpm test:docker:onboard`.
- Full kit + what's covered: `docs/testing.md`.
- Pure test additions/fixes generally do **not** need a changelog entry unless they alter user-facing behavior or the user asks for one.
- Mobile: before using a simulator, check for connected real devices (iOS + Android) and prefer them when available.

## Commit & Pull Request Guidelines

- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit` so staging stays scoped.
- Follow concise, action-oriented commit messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- Changelog workflow: keep latest released version at top (no `Unreleased`); after publishing, bump version and start a new top section.
- PRs should summarize scope, note testing performed, and mention any user-facing changes or new flags.
- PR review flow: when given a PR link, review via `gh pr view`/`gh pr diff` and do **not** change branches.
- PR review calls: prefer a single `gh pr view --json ...` to batch metadata/comments; run `gh pr diff` only when needed.
- Before starting a review when a GH Issue/PR is pasted: run `git pull`; if there are local changes or unpushed commits, stop and alert the user before reviewing.
- Goal: merge PRs. Prefer **rebase** when commits are clean; **squash** when history is messy.
- PR merge flow: create a temp branch from `main`, merge the PR branch into it (prefer squash unless commit history is important; use rebase/merge when it is). Always try to merge the PR unless it's truly difficult, then use another approach. If we squash, add the PR author as a co-contributor. Apply fixes, add changelog entry (include PR # + thanks), run full gate before the final commit, commit, merge back to `main`, delete the temp branch, and end on `main`.
- If you review a PR and later do work on it, land via merge/squash (no direct-main commits) and always add the PR author as a co-contributor.
- When working on a PR: add a changelog entry with the PR number and thank the contributor.
- When working on an issue: reference the issue in the changelog entry.
- When merging a PR: leave a PR comment that explains exactly what we did and include the SHA hashes.
- When merging a PR from a new contributor: add their avatar to the README "Thanks to all clawtributors" thumbnail list.
- After merging a PR: run `bun scripts/update-clawtributors.ts` if the contributor is missing, then commit the regenerated README.

## Shorthand Commands

- `sync`: if working tree is dirty, commit all changes (pick a sensible Conventional Commit message), then `git pull --rebase`; if rebase conflicts and cannot resolve, stop; otherwise `git push`.

### PR Workflow (Review vs Land)

- **Review mode (PR link only):** read `gh pr view/diff`; **do not** switch branches; **do not** change code.
- **Landing mode:** create an integration branch from `main`, bring in PR commits (**prefer rebase** for linear history; **merge allowed** when complexity/conflicts make it safer), apply fixes, add changelog (+ thanks + PR #), run full gate **locally before committing** (`pnpm lint && pnpm build && pnpm test`), commit, merge back to `main`, then `git switch main` (never stay on a topic branch after landing). Important: contributor needs to be in git graph after this!

## Security & Configuration Tips

- Web provider stores creds at `~/.openclaw/credentials/`; rerun `openclaw login` if logged out.
- Pi sessions live under `~/.openclaw/sessions/` by default; the base directory is not configurable.
- Environment variables: see `~/.profile`.
- Never commit or publish real phone numbers, videos, or live configuration values. Use obviously fake placeholders in docs, tests, and examples.
- Release flow: always read `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md` before any release work; do not ask routine questions once those docs answer them.

## Troubleshooting

- Rebrand/migration issues or legacy config/service warnings: run `openclaw doctor` (see `docs/gateway/doctor.md`).

## Agent-Specific Notes

- Vocabulary: "makeup" = "mac app".
- Never edit `node_modules` (global/Homebrew/npm/git installs too). Updates overwrite. Skill notes go in `tools.md` or `AGENTS.md`.
- Signal: "update fly" => `fly ssh console -a flawd-bot -C "bash -lc 'cd /data/clawd/openclaw && git pull --rebase origin main'"` then `fly machines restart e825232f34d058 -a flawd-bot`.
- When working on a GitHub Issue or PR, print the full URL at the end of the task.
- When answering questions, respond with high-confidence answers only: verify in code; do not guess.
- Never update the Carbon dependency.
- Any dependency with `pnpm.patchedDependencies` must use an exact version (no `^`/`~`).
- Patching dependencies (pnpm patches, overrides, or vendored changes) requires explicit approval; do not do this by default.
- CLI progress: use `src/cli/progress.ts` (`osc-progress` + `@clack/prompts` spinner); don't hand-roll spinners/bars.
- Status output: keep tables + ANSI-safe wrapping (`src/terminal/table.ts`); `status --all` = read-only/pasteable, `status --deep` = probes.
- Gateway currently runs only as the menubar app; there is no separate LaunchAgent/helper label installed. Restart via the OpenClaw Mac app or `scripts/restart-mac.sh`; to verify/kill use `launchctl print gui/$UID | grep openclaw` rather than assuming a fixed label. **When debugging on macOS, start/stop the gateway via the app, not ad-hoc tmux sessions; kill any temporary tunnels before handoff.**
- macOS logs: use `./scripts/clawlog.sh` to query unified logs for the OpenClaw subsystem; it supports follow/tail/category filters and expects passwordless sudo for `/usr/bin/log`.
- If shared guardrails are available locally, review them; otherwise follow this repo's guidance.
- SwiftUI state management (iOS/macOS): prefer the `Observation` framework (`@Observable`, `@Bindable`) over `ObservableObject`/`@StateObject`; don't introduce new `ObservableObject` unless required for compatibility, and migrate existing usages when touching related code.
- Connection providers: when adding a new connection, update every UI surface and docs (macOS app, web UI, mobile if applicable, onboarding/overview docs) and add matching status + configuration forms so provider lists and settings stay in sync.
- **Restart apps:** "restart iOS/Android apps" means rebuild (recompile/install) and relaunch, not just kill/launch.
- **Device checks:** before testing, verify connected real devices (iOS/Android) before reaching for simulators/emulators.
- iOS Team ID lookup: `security find-identity -p codesigning -v` → use Apple Development (…) TEAMID. Fallback: `defaults read com.apple.dt.Xcode IDEProvisioningTeamIdentifiers`.
- A2UI bundle hash: `src/canvas-host/a2ui/.bundle.hash` is auto-generated; ignore unexpected changes, and only regenerate via `pnpm canvas:a2ui:bundle` (or `scripts/bundle-a2ui.sh`) when needed. Commit the hash as a separate commit.
- Release signing/notary keys are managed outside the repo; follow internal release docs.
- Notary auth env vars (`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8`) are expected in your environment (per internal release docs).
- **Multi-agent safety:** do **not** create/apply/drop `git stash` entries unless explicitly requested (this includes `git pull --rebase --autostash`). Assume other agents may be working; keep unrelated WIP untouched and avoid cross-cutting state changes.
- **Multi-agent safety:** when the user says "push", you may `git pull --rebase` to integrate latest changes (never discard other agents' work). When the user says "commit", scope to your changes only. When the user says "commit all", commit everything in grouped chunks.
- **Multi-agent safety:** do **not** create/remove/modify `git worktree` checkouts (or edit `.worktrees/*`) unless explicitly requested.
- **Multi-agent safety:** do **not** switch branches / check out a different branch unless explicitly requested.
- **Multi-agent safety:** running multiple agents is OK as long as each agent has its own session.
- **Multi-agent safety:** when you see unrecognized files, keep going; focus on your changes and commit only those.
- Lint/format churn:
  - If staged+unstaged diffs are formatting-only, auto-resolve without asking.
  - If commit/push already requested, auto-stage and include formatting-only follow-ups in the same commit (or a tiny follow-up commit if needed), no extra confirmation.
  - Only ask when changes are semantic (logic/data/behavior).
- Lobster seam: use the shared CLI palette in `src/terminal/palette.ts` (no hardcoded colors); apply palette to onboarding/config prompts and other TTY UI output as needed.
- **Multi-agent safety:** focus reports on your edits; avoid guard-rail disclaimers unless truly blocked; when multiple agents touch the same file, continue if safe; end with a brief "other files present" note only if relevant.
- Bug investigations: read source code of relevant npm dependencies and all related local code before concluding; aim for high-confidence root cause.
- Code style: add brief comments for tricky logic; keep files under ~500 LOC when feasible (split/refactor as needed).
- Tool schema guardrails (google-antigravity): avoid `Type.Union` in tool input schemas; no `anyOf`/`oneOf`/`allOf`. Use `stringEnum`/`optionalStringEnum` (Type.Unsafe enum) for string lists, and `Type.Optional(...)` instead of `... | null`. Keep top-level tool schema as `type: "object"` with `properties`.
- Tool schema guardrails: avoid raw `format` property names in tool schemas; some validators treat `format` as a reserved keyword and reject the schema.
- When asked to open a "session" file, open the Pi session logs under `~/.openclaw/agents/<agentId>/sessions/*.jsonl` (use the `agent=<id>` value in the Runtime line of the system prompt; newest unless a specific ID is given), not the default `sessions.json`. If logs are needed from another machine, SSH via Tailscale and read the same path there.
- Do not rebuild the macOS app over SSH; rebuilds must be run directly on the Mac.
- Never send streaming/partial replies to external messaging surfaces (WhatsApp, Telegram); only final replies should be delivered there. Streaming/tool events may still go to internal UIs/control channel.
- Voice wake forwarding tips:
  - Command template should stay `openclaw-mac agent --message "${text}" --thinking low`; `VoiceWakeForwarder` already shell-escapes `${text}`. Don't add extra quotes.
  - launchd PATH is minimal; ensure the app's launch agent PATH includes standard system paths plus your pnpm bin (typically `$HOME/Library/pnpm`) so `pnpm`/`openclaw` binaries resolve when invoked via `openclaw-mac`.
- For manual `openclaw message send` messages that include `!`, use the heredoc pattern noted below to avoid the Bash tool's escaping.
- Release guardrails: do not change version numbers without operator's explicit consent; always ask permission before running any npm publish/release step.

## NPM + 1Password (publish/verify)

- Use the 1password skill; all `op` commands must run inside a fresh tmux session.
- Sign in: `eval "$(op signin --account my.1password.com)"` (app unlocked + integration on).
- OTP: `op read 'op://Private/Npmjs/one-time password?attribute=otp'`.
- Publish: `npm publish --access public --otp="<otp>"` (run from the package dir).
- Verify without local npmrc side effects: `npm view <pkg> version --userconfig "$(mktemp)"`.
- Kill the tmux session after publish.
