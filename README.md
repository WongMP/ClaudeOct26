# IT PMO Kanban Board

A single-file Kanban board for tracking IT PMO project tasks, built as an internal training demo.

[![CI](https://github.com/WongMP/ClaudeOct26/actions/workflows/ci.yml/badge.svg)](https://github.com/WongMP/ClaudeOct26/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/WongMP/ClaudeOct26/actions/workflows/pages.yml/badge.svg)](https://github.com/WongMP/ClaudeOct26/actions/workflows/pages.yml)
[![License](https://img.shields.io/github/license/WongMP/ClaudeOct26)](#license)
[![Last commit](https://img.shields.io/github/last-commit/WongMP/ClaudeOct26)](https://github.com/WongMP/ClaudeOct26/commits/main)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)
![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![GitHub Pages](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-222222?logo=githubpages&logoColor=white)

**Live demo:** https://wongmp.github.io/ClaudeOct26/

**Version 2 (redesign with status pie and due-date line charts):** https://wongmp.github.io/ClaudeOct26/v2/

> Demo mode: the board is held in memory only. Refreshing the page resets it to the sample tasks.

## Features

- Four columns: **Backlog**, **In Progress**, **Blocked** and **Done**
- Summary strip with live counts per status, plus an **Overdue** count
- Add tasks with title, description, project, category, assignee, priority, status and due date, with form validation and character counters
- Move cards by drag and drop or with the per-card **Move** menu, and delete with confirmation
- Filter by project, assignee and priority
- Overdue cards are flagged, and priorities are colour-coded and always labelled in text
- Accessible: keyboard support, ARIA labels and screen-reader announcements for notifications
- Optional email notification for new tasks via [FormSubmit](https://formsubmit.co)

## Tech stack

| Layer | Technology |
| --- | --- |
| Markup | HTML5 |
| Styling | CSS3 (custom properties, no framework) |
| Logic | Vanilla JavaScript (ES2020), no build step |
| Notifications | FormSubmit AJAX endpoint (optional) |
| Hosting | GitHub Pages via GitHub Actions |

## Prerequisites

- Any modern browser (Chrome, Edge, Firefox or Safari)
- Optional: Python 3 or Node.js 18+ to serve the file locally

## Installation

```bash
git clone https://github.com/WongMP/ClaudeOct26.git
cd ClaudeOct26
```

There is nothing to install. The app is the single file `index.html`.

## How to run

Open `index.html` directly in a browser, or serve it locally:

```bash
# Python
python3 -m http.server 8000

# or Node.js
npx serve .
```

Then go to http://localhost:8000.

To lint the HTML the same way CI does:

```bash
npx htmlhint@1.1.4 index.html
```

## Configuration

Email notifications for new tasks are off until you set a real address. In `index.html`, replace the placeholder in:

```js
const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/YOUR_EMAIL@example.com";
```

FormSubmit sends a one-time activation email to that address the first time the board submits. Submissions are delivered only after you click its activation link. FormSubmit may refuse requests from pages opened as `file://`, so serve the page over HTTP for email delivery.

## Project structure

```
.
├── index.html                  # The whole app: markup, styles and script
├── .github/
│   ├── workflows/ci.yml        # HTML lint + secret scan
│   ├── workflows/pages.yml     # GitHub Pages deployment
│   └── dependabot.yml          # Weekly GitHub Actions updates
└── .claude/commands/
    └── github-publish.md       # Claude Code /github-publish command
```

## CI/CD

- **CI** (`ci.yml`) runs on every push and pull request to `main`. It lints `index.html` with HTMLHint and scans the full git history for secrets with Gitleaks.
- **Deploy GitHub Pages** (`pages.yml`) runs on every push to `main` and on demand. It copies `index.html` to the `gh-pages` branch, which GitHub Pages serves at https://wongmp.github.io/ClaudeOct26/.
- **Dependabot** checks weekly for updates to the GitHub Actions used.

## Contributing

1. Fork the repo and create a branch.
2. Make your change and run `npx htmlhint@1.1.4 index.html`.
3. Open a pull request against `main`. CI must pass.

## License

No license has been chosen yet, so all rights are reserved by default.
