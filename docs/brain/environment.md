---
tags: [knowledge, environment, gotchas]
---
# Environment & conventions (Windows)

[[HOME]]

- **Shell:** PowerShell + Bash. The repo is `C:\Users\Kyrylo\multitasker`; owner's session often runs from
  `C:\Users\Kyrylo\рій`, so **always use ABSOLUTE multitasker paths** in links or they won't resolve.
- **Python:** system `python`/`python3` = broken MS Store alias. **Use `uv run python`** from the repo.
  `uv` at `AppData\Local\hermes\bin\uv`. Node exists off-PATH: `AppData\Local\hermes\node\node`.
- **Browser preview verification:**
  - The preview tab is HIDDEN → `requestAnimationFrame` is THROTTLED. Render loops need a `setTimeout`
    fallback when `document.hidden` (we added `scheduleFrame()`).
  - `preview_screenshot` TIMES OUT on an animation loop → capture via `canvas.toDataURL()` (downscaled
    ~560px to stay under token limits) then decode with `uv run python`.
  - Browsers cache JS → bump `?v=N` on the `<script>` tag + navigate with a `?cb=<ts>` query after each renderer.js edit.
  - Verify via `preview_eval` reading DOM (agent counts, `canvas.width` > 300 once frames run).
- **Verification ethos:** machine-verify with real runs, not self-report. Codex/opencode sandboxes may
  lack network or PATH tools — they should test first and report blockers, not fight the sandbox.

Back to [[HOME]] · [[orchestration]]
