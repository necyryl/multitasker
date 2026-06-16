---
tags: [knowledge, orchestration, security]
---
# Orchestration model

[[HOME]]

## What this repo is
**Multitasker** = a fork of **NousResearch/hermes-agent** (MIT) — self-improving AI agent (CLI, TUI,
multi-platform gateway, Electron desktop, learning loop, cron, subagents, i18n). We build on top.
- Path: `C:\Users\Kyrylo\multitasker` · `origin`=github.com/necyryl/multitasker · `upstream`=NousResearch/hermes-agent
- **Naming:** *Multitasker* = this codebase. *Maestro* = owner's orchestration DESIGN (old "Hermes AI OS",
  repo necyryl/hermes-ai-os), layered on top. *hermes-agent* = upstream.

## The agency (multi-model team)
| Agent | Role | Invoke | Agentic? |
|---|---|---|---|
| **Claude (Opus)** | Lead: decisions, orchestration, final GATE. Only one with real tools. | this session | — |
| **Codex** | Senior coder, edits files autonomously. | `codex exec --full-auto` (prompt on stdin) | ✅ |
| **Qwen3-Coder-30B** | Bulk coder; text only (Claude applies output). | `ollama run qwen3-coder:30b "…"` | ❌ |
| **DeepSeek v4** | Cheap high-volume, agentic. | `opencode run -m opencode-go/deepseek-v4-flash "…"` | ✅ |

Chain: Claude specs → implement → **machine verify (real run, not self-report)** → Codex review → Claude gate. No auto-merge.

## Claude orchestrator auth (no paid API key!)
Claude runs via the **Claude Code subscription (OAuth)**. `agent/anthropic_adapter.py:resolve_anthropic_token()`
resolves: `ANTHROPIC_TOKEN` → `CLAUDE_CODE_OAUTH_TOKEN` → `~/.claude/.credentials.json` → `ANTHROPIC_API_KEY`.
We set `CLAUDE_CODE_OAUTH_TOKEN` (a `sk-ant-oat01-…` setup-token) in `.env`. Verified working.
Worker keys in `.env`: `GEMINI_API_KEY` (native provider), `MISTRAL_API_KEY` (custom OpenAI-compatible).

## 🔒 Security protocol for autonomous agents
Before running `codex exec --full-auto` / `opencode` in this repo: **move `.env` out**
(`mv .env ../multitasker-env.safe`); **restore** when done. Give an agent only the one key it needs, via its brief.
See [[decisions]] for why (auto-mode classifier blocks autonomous agents over live creds).

Related: [[agent-room]] · [[environment]] · [[state]]
