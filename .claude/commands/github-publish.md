---
description: Security-scan the project, push it to GitHub, write the README and repo About section, set up CI/CD and a GitHub Pages site
argument-hint: <owner/repo> [public|private] [branch]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Publish this project to GitHub

GitHub info from the user: **$ARGUMENTS**

Parse the arguments as:
- `owner/repo` (required). It can also be a full URL such as `https://github.com/owner/repo(.git)`.
- visibility: `public` or `private`. Default is `private`.
- branch. Default is `main`.

If `owner/repo` is missing or unclear, **stop and ask the user** before doing anything else. Check that `gh auth status` succeeds. If it does not, tell the user to run `gh auth login` and stop.

Do the steps in order. **Step 1 is a hard gate: nothing is pushed until it passes.** Print a short status line after each step.

---

## Step 1: Security scan (before anything leaves the machine)

The goal is that no secrets, credentials, private data or junk files reach the internet.

1. **Inventory what would be published.** If the folder is not a git repo yet, run `git init -b <branch>`. Then list every file that would be committed: `git add -A --dry-run` plus `git ls-files`.
2. **Create or harden `.gitignore`** for the detected stack. It must always include:
   `.env`, `.env.*` (but keep `!.env.example`), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa*`, `*.keystore`, `credentials*.json`, `service-account*.json`, `secrets.*`, `*.sqlite`, `*.db`, `node_modules/`, `venv/`, `.venv/`, `__pycache__/`, `dist/`, `build/`, `.DS_Store`, `*.log`, `.idea/`, `.vscode/` (unless the user wants to share it), `.claude/settings.local.json`.
3. **Secret scan.**
   - If `gitleaks` is installed, run `gitleaks detect --source . --no-banner -v`. If the repo has history, also run `gitleaks detect --log-opts="--all"`. Otherwise use `trufflehog filesystem .` if that is installed.
   - Always also grep the files to be committed for:
     - AWS keys: `AKIA[0-9A-Z]{16}`
     - GitHub tokens: `gh[pousr]_[A-Za-z0-9]{36,}` and `github_pat_`
     - Slack tokens: `xox[baprs]-`
     - Google API keys: `AIza[0-9A-Za-z_-]{35}`
     - Stripe keys: `sk_live_` and `rk_live_`
     - Anthropic and OpenAI keys: `sk-ant-` and `sk-[A-Za-z0-9]{20,}`
     - Private keys: `-----BEGIN .*PRIVATE KEY-----`
     - Hard-coded values like `password\s*[:=]`, `secret\s*[:=]`, `api[_-]?key\s*[:=]` and `token\s*[:=]` set to a literal
     - Connection strings with embedded credentials: `://[^/\s:]+:[^@\s]+@`
   - Flag hard-coded personal data: emails, phone numbers, internal hostnames and IPs, absolute home paths.
4. **Check file hygiene.** Flag files over 50 MB (GitHub rejects files over 100 MB) and binaries that do not belong in source. Also flag `.env` files, keystores and database dumps.
5. **Check dependencies (advisory).** Run whatever applies: `npm audit --omit=dev`, `pip-audit`, `cargo audit` or `govulncheck`. Report the results, but they do not block the push.
6. **Gate.**
   - If a secret or sensitive file is found, **do not push.** Show the user each finding with `file:line` and the value masked, for example `AKIA****XYZ`. Propose fixes: move the value to an env var, add a `.env.example` with placeholders, add the file to `.gitignore`, or `git rm --cached` it. If a secret is already in git history, tell the user to **rotate it** and to rewrite history with `git filter-repo`. Apply fixes only after the user agrees, then re-run the scan.
   - Continue only when the scan is clean, or when the user explicitly accepts a finding as a false positive.

## Step 2: Push the code to GitHub

1. Check whether the repo exists: `gh repo view <owner/repo>`.
   - If it does not exist, create it with `gh repo create <owner/repo> --<visibility> --source=. --remote=origin`. Do not push yet.
   - If it exists and `origin` is missing or different, set `origin` to it. Confirm with the user before overwriting a different `origin`.
2. Make sure `git config user.name` and `git config user.email` are set. If they are not, ask the user.
3. Stage only the files you reviewed in Step 1 and commit with a clear message. Do not commit an empty change.
4. Push with `git push -u origin <branch>`. If the remote has commits that are not in the local history, **never force-push.** Show the divergence and ask the user how to proceed.

## Step 3: Create or update README.md

Read `CLAUDE.md` if present and respect its constraints (for example no build step, and no real bank logo or branding). Read the codebase first: package manifests, entry points, scripts, Dockerfile, existing docs. Base everything on what the project actually does and never invent features. If a README already exists, keep any accurate content the user wrote and improve it rather than discarding it.

The README must contain:
- **Title and a one-line tagline.**
- **Badges** (shields.io). Include:
  - CI status: `https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg`
  - Pages deploy status
  - License
  - Last commit
  - One badge for each real technology in the stack: language, framework, database, tooling. Example: `![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)`. Use the official logo slug and brand color.
- **Live demo link** to the GitHub Pages URL `https://<owner>.github.io/<repo>/`.
- **Features**: a short bullet list.
- **Tech stack**: a list or table.
- **Prerequisites** with exact versions taken from the manifests.
- **Installation**: copy-pasteable steps, from `git clone` through installing dependencies and copying `.env.example` to `.env`.
- **How to run**: dev mode, production or build, and tests, using the real script names.
- **Configuration**: the environment variables from `.env.example`, using placeholder values only.
- **Project structure**: a short tree.
- **CI/CD**: what the workflows do.
- **Contributing** and **License**. If there is no LICENSE file, ask the user which license they want; suggest MIT.

## Step 4: Automate CI/CD with GitHub Actions

First check whether `.github/workflows/ci.yml` and `pages.yml` already exist. **If they do, keep them.** Validate them and extend them only where something is missing (for example a secret-scan job), and never replace a working workflow. Create the workflows below only when none exist, tailored to the detected stack.

**`ci.yml`**
- Triggers: `push` and `pull_request` on `<branch>`.
- Steps: checkout, set up the language toolchain with dependency caching, install, lint, test and build. Include only the steps the project actually supports.
- Use `permissions: contents: read` and pin each action to a major version, such as `actions/checkout@v4`.
- Add a job that runs `gitleaks/gitleaks-action@v2` so every future push is scanned for secrets.
- Add `.github/dependabot.yml` for the package ecosystem and for `github-actions`.

**`pages.yml`**: deploys GitHub Pages using the official Actions flow.
- Triggers: `push` to `<branch>` and `workflow_dispatch`.
- `permissions: contents: read, pages: write, id-token: write`.
- `concurrency: { group: pages, cancel-in-progress: false }`.
- Build job: `actions/configure-pages@v5`, then build the site, then `actions/upload-pages-artifact@v3` with the output folder.
- Deploy job: `actions/deploy-pages@v4`, with `environment: github-pages`.

Never put secrets in workflow files. If the workflows need any, tell the user which ones to add with `gh secret set NAME`.

## Step 5: Create the GitHub Pages site

1. Decide what the site shows:
   - If the project is a static site or frontend app (React, Vite, Next export, Astro, plain HTML), deploy its build output. Set the base path to `/<repo>/` where the framework needs one, for example `base` in Vite or `basePath` in Next.
   - Otherwise, create a clean, responsive landing page in `docs/index.html`. It should cover the project overview, features, tech badges, install and run steps, and a link back to the repo. Upload `docs/` as the artifact.
2. Enable Pages.
   - If an existing `pages.yml` publishes to a `gh-pages` branch, serve from that branch: `gh api -X POST repos/<owner>/<repo>/pages -f "source[branch]=gh-pages" -f "source[path]=/"` (use `-X PUT` if Pages already exists). Remind the user that any new file the site needs must be added to the workflow's "Assemble site" step.
   - Otherwise use the Actions build type: `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow` (again `-X PUT` if Pages exists).
   - Pages on a **private** repo needs a paid plan. If this call fails for that reason, tell the user and ask whether to make the repo public or skip Pages.
3. Commit and push the workflows and site, then watch the run with `gh run watch`. If it fails, read `gh run view --log-failed`, fix it and push again.
4. Confirm that the site is live: `curl -sI https://<owner>.github.io/<repo>/` should return 200.

## Step 6: Update the repo About section and add the Pages link

```
gh repo edit <owner/repo> \
  --description "<concise one-line description, under 350 chars>" \
  --homepage "https://<owner>.github.io/<repo>/" \
  --add-topic <topic1> --add-topic <topic2> ...
```

- Add 5–10 lowercase topics drawn from the real tech stack and domain, such as `python`, `fastapi` or `machine-learning`.
- Verify with `gh repo view <owner/repo> --json description,homepageUrl,repositoryTopics`.

## Step 7: Final security verification and report

1. Re-run the Step 1 secret scan against what is now **on GitHub**: run `git ls-files` and grep the pushed history with `git log -p origin/<branch>`. Then run `gh api repos/<owner>/<repo>/secret-scanning/alerts` and ignore the error if secret scanning is unavailable for the repo.
2. Check that no `.env`, key or credential file is tracked: `git ls-files | grep -Ei '\.env$|\.pem$|\.key$|credentials|secret'` should return nothing except `.env.example`.
3. Print a summary with:
   - The repo URL, the visibility and the branch pushed.
   - The Pages URL and whether the live check returned 200.
   - The About section's description, homepage and topics.
   - The workflows added and the result of their latest run.
   - The security scan results: clean, or the findings with what was done about each.
   - Any manual follow-ups for the user, such as rotating a key, adding a repo secret or choosing a license.
