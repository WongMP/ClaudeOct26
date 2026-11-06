# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

An internal IT PMO Kanban board for a fictitious bank, built as a training demo. There is no build step, no `package.json` and no test suite. The root `index.html` (v1) and `v2/index.html` (redesign with status pie and due-date line charts) are two separate standalone pages.

## Commands

- Run: open `index.html` directly, or `python3 -m http.server 8000`. Serve over HTTP to test real FormSubmit delivery, because FormSubmit may reject `file://` origins.
- Lint (the only check, same as CI): `npx htmlhint@1.1.4 index.html`. CI lints only the root file, not `v2/`.

## Architecture

`index.html` is one file: a `<style>` block (design tokens in `:root`), the markup, and a `<script>` split into numbered sections (config, reference data, `state`, helpers, seed data, filtering, rendering, task operations, toasts, FormSubmit, form validation, event binding, init).

- `state = { tasks, filters, nextId, ui }` is the single source of truth. Change state, then call `renderBoard()`. Do not edit card DOM directly.
- Board events (click, change, drag and drop) are delegated on `#board`, which `renderBoard()` rebuilds on every render. Focus after a re-render is restored via `state.ui.focusSelector`.
- Escape every user-supplied string with `escapeHtml()` before it goes into an HTML template.
- `FORMSUBMIT_ENDPOINT` is a placeholder. While it still contains `YOUR_EMAIL@example.com`, `notifyNewTask()` throws before sending anything, which produces the "email notification failed" warning toast. This is intentional.
- `v2/index.html` has its own script and its own `FORMSUBMIT_ENDPOINT`. Changes to v1 do not carry over.

## Constraints on v1

These come from the original brief and should be kept:
- Vanilla HTML, CSS and JS only, in a single file, with no external resources (no CDNs, fonts or images).
- No storage APIs. Board state is memory-only, a refresh resets to the seeded tasks, and the UI says so.
- No `!important`, no `alert()` or `confirm()`.
- A neutral "IT PMO" text wordmark with no real bank logo or branding. The `UOB-ITPM-` task ID prefix and the `[UOB IT PMO]` email subject are required text, not branding to remove.

## Gotchas

- `.claude/hooks/security-briefing-popup.js` is a browser script, not a Claude Code hook. Only `v2/` loads it, and it uses `sessionStorage`, so the no-storage rule applies to v1 only.
- `.github/workflows/pages.yml` publishes `index.html`, `v2/index.html` and the popup script to the `gh-pages` branch on every push to `main`. Any new file the site needs must be added to its "Assemble site" step.
- `.claude/skills/design-taste-frontend` is a vendored skill pinned in `skills-lock.json`. Do not edit it. `.mcp.json` configures the Playwright MCP server.
