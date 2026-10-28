---
description: Scan for sensitive data, push to a GitHub repo, then write the README, About section, Pages site and CI/CD
argument-hint: <owner/repo or repo URL> [branch]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Ship this project to GitHub

Repo info from the user: **$ARGUMENTS**

Take the first argument as the target repo (`owner/repo` or a GitHub URL) and the optional second as the branch (default `main`). If no repo was given, ask for it and stop. Prefer the `gh` CLI. If it is missing or unauthenticated, use the GitHub MCP tools instead, and if neither works tell the user how to authenticate.

Read `CLAUDE.md` first if it exists and follow its constraints. Work through the phases in order and print one status line after each. Phase A blocks everything else.

## Phase A: Sensitive-data check (before anything is uploaded)

1. List what would be published (`git ls-files` plus untracked files not ignored).
2. Make sure `.gitignore` excludes env files (keep `.env.example`), keys and certificates, credential JSON files, local settings (`.claude/settings.local.json`), databases, logs, dependency folders and OS junk.
3. Search the files that would be published, and git history if any, for API keys and tokens, private keys, passwords or secrets set to literal values, URLs with embedded credentials, and personal data (personal emails, phone numbers, internal hostnames or IPs, absolute home paths). Run gitleaks too if it is installed.
4. If anything is found, stop. Report each finding as `file:line` with the value masked, and propose a fix (env var, `.env.example`, ignore it, `git rm --cached`). A secret already in history must be rotated. Do not rewrite history or continue until the user agrees and a re-scan is clean.

## Phase B: Push

1. Create the repo if it does not exist (ask the user for visibility, default private). Point `origin` at it, asking before replacing a different origin.
2. Commit the reviewed files and push the branch. Never force-push; if the remote has diverged, show how and ask.

## Phase C: README

Create or update `README.md` from what the project really contains. Keep accurate existing content. Include title and tagline, badges (CI status plus the real tech stack), live demo link, features, how to run, project structure, CI/CD summary, and license. Ask which license if none exists.

## Phase D: CI/CD

Under `.github/workflows/`, keep any working workflow and extend it rather than replacing it. If none exist, add a CI workflow (lint and tests the project actually has, plus a gitleaks secret-scan job) triggered on push and pull request, with minimal `permissions` and actions pinned to major versions. Never put secrets in workflow files.

## Phase E: GitHub Pages

1. Publish the project's static output, or if it has none, a simple `docs/index.html` landing page.
2. Enable Pages using whichever method the existing deploy workflow implies (a `gh-pages` branch or the Actions flow). If Pages is unavailable on a private repo, tell the user and ask whether to make it public.
3. Push, watch the workflow run, fix failures, and confirm the site URL returns 200.

## Phase F: About section

Set the repo description, topics (5 to 10, from the real stack) and the **homepage to the Pages URL** (`https://<owner>.github.io/<repo>/`). Verify by reading them back.

## Phase G: Final check and report

Re-scan what is now on the remote for sensitive files and secrets. Then report the repo URL, Pages URL and live check result, About values, workflow results, scan outcome, and any manual follow-ups.
