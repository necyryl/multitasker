# Multitasker — agent entry point

This repo is a fork of NousResearch/hermes-agent, customized by the owner. Upstream's own dev guide is
`AGENTS.md` (keep following it for core hermes code).

## START HERE
**Read `docs/brain/HOME.md` first** — the project "brain" (an Obsidian-style linked vault, 3 layers:
Map → Knowledge → Journal). Self-contained onboarding WITHOUT any chat history: model stack, the
"Agent Room" project, asset pipeline, conventions, current state, decision log.
(`docs/PROJECT-BRAIN.md` is the older flat single-file copy — superseded by the vault.)

Related specs: `docs/agent-room-spec.md` (asset/animation manifest + architecture),
`docs/event-bridge-spec.md` (live event feed), `docs/uk-i18n-coverage.md` (localization).

## Hard rules
- Secrets live in `.env` (gitignored). NEVER commit it or print raw key values. Referenced as env-var names.
- Windows: use `uv run python` (system python is a broken MS Store alias). `uv` = `AppData\Local\hermes\bin\uv`.
- Verify changes with REAL runs (machine verification), not self-report. Leave honest "still imperfect" notes.
- When other agents are running, respect file ownership (see PROJECT-BRAIN §9) — don't clobber their files.

## graphify

This project has a graphify knowledge graph at .graphify/.

Rules:
- For codebase or architecture questions, when `.graphify/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`); these return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output
- If .graphify/wiki/index.md exists, navigate it instead of reading raw files
- If .graphify/graph.json is missing but graphify-out/graph.json exists, run `graphify migrate-state --dry-run` first; if tracked legacy artifacts are reported, ask before using the recommended `git mv -f graphify-out .graphify` and commit message
- If .graphify/needs_update exists or .graphify/branch.json has stale=true, warn before relying on semantic results and run /graphify . --update when appropriate
- Before proposing or committing .graphify artifacts, run `graphify portable-check .graphify`; commit-safe graph artifacts must use repo-relative paths, and never commit .graphify/branch.json, .graphify/worktree.json, .graphify/needs_update, or .graphify/cache/. If a repo already tracks any of them, first add them to .gitignore, then propose `git rm --cached .graphify/branch.json .graphify/worktree.json .graphify/needs_update` and `git rm -r --cached .graphify/cache`; never mutate git state without asking
- Before deep graph traversal, prefer `graphify summary --graph .graphify/graph.json` for compact first-hop orientation
- For review impact on changed files, use `graphify review-delta --graph .graphify/graph.json` instead of generic traversal
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when `query` / `path` / `explain` do not surface enough context
- After modifying code files in this session, run `npx graphify hook-rebuild` to keep the graph current
