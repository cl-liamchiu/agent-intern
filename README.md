# agent-intern

Let an AI agent fix bugs while you review and approve like a senior dev.

The idea is simple: instead of writing fixes yourself, you delegate bug fixing to an AI agent working in an isolated git mirror. You only see the diff and the commit message — and decide whether to merge or reject.

---

## How it works

```
Your project  ──push──▶  project-agent/  ◀── Claude fixes bugs here
                                │
                          sandboxed, isolated
                                │
                         fix/main/JIRA-404
                                │
                    You review the diff and decide
```

- The AI works in a separate `{project}-agent/` folder, sandboxed to only touch files within it
- Each bug gets its own branch (`fix/<base>/<bugId>`)
- You review the branch like any other PR — approve or reject

---

## Installation

```bash
npm install -g agent-intern
```

---

## Setup

### 1. Initialize the agent mirror

Run this from the parent directory of your project:

```bash
agent init <projectName>
```

This will:
- Create `{projectName}-agent/` as a sandboxed git mirror
- Add a git remote named `agent` in your project pointing to it
- Write `.claude/settings.local.json` with sandbox config into the agent folder

### 2. Register your bug fetch script

Write a script that fetches bugs from your tracker (Jira, Linear, GitHub Issues, etc.) and prints a JSON array to stdout:

```json
[
  { "id": "JIRA-404", "title": "Cart button broken", "description": "..." },
  { "id": "GITHUB-22", "title": "API returns 500", "description": "..." }
]
```

Then register it from inside your project folder:

```bash
cd my-project
agent bug fetch init ./fetch-bugs.sh
```

### 3. (Optional) Configure commit and fix prompts

```bash
agent bug commit init --prompt ./prompts/commit.txt --script ./scripts/format-commit.sh
agent bug fix init --prompt ./prompts/fix.txt
```

- `--prompt` — path to a text file used as the Claude prompt (uses a sensible default if omitted)
- `--script` (commit only) — a script that transforms Claude's response into the final commit message

---

## Daily workflow

```bash
# 1. Sync bugs from your tracker
agent bug fetch

# 2. Let the agent fix everything
agent bug fix --all --base main

# 3. Review each fix branch and merge or reject
git log fix/main/JIRA-404
git diff main..fix/main/JIRA-404
```

---

## Commands

### `agent init <projectName>`
Initialize an agent mirror for an existing git project.

### `agent branch update [branchName]`
Push a branch from your project to the agent mirror. Defaults to the current branch.

### `agent bug fetch init <scriptPath>`
Register the script used to fetch bugs from your tracker.

### `agent bug fetch`
Run the fetch script and upsert results into the local bug database.

### `agent bug commit init [--prompt <path>] [--script <path>]`
Configure the Claude prompt and optional transform script for commits.

### `agent bug commit <bugId> [--resume <sessionId>]`
Commit staged changes in the current directory using Claude to generate the commit message.

### `agent bug fix init --prompt <path>`
Configure the Claude prompt used when fixing bugs.

### `agent bug fix [bugIds...] --base <branch>`
Fix one or more bugs with Claude. For each bug:
1. Pushes `<branch>` to the agent mirror
2. Creates `fix/<branch>/<bugId>` in the agent folder
3. Runs Claude to fix the bug
4. Commits with an AI-generated message
5. Switches back to `<branch>`

### `agent bug fix --all --base <branch>`
Fix all bugs with status `todo`.

---

## Data storage

All data is stored outside your project — nothing is added to your repo.

```
~/.agent-pilot/<projectName>/
├── config.json   ← registered scripts and prompt paths
└── bugs.db       ← SQLite: bugs + agent activity logs
```

---

## Bug statuses

| Status | Meaning |
|--------|---------|
| `todo` | Fetched, not yet fixed |
| `in-progress` | Being worked on |
| `review` | Fix ready for review |
| `done` | Merged |
| `rejected` | Fix rejected |

Only bugs with status `todo` are processed by `agent bug fix`.
