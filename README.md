# agent-intern

Let an AI agent fix bugs while you review and approve like a senior dev.

Instead of writing fixes yourself, you delegate bug fixing to Claude working in an isolated git mirror. You review the diff, then merge or reject — just like reviewing a junior dev's PR.

## Installation

```bash
npm install -g cl-liamchiu/agent-intern
```

**Requirements:** [Claude Code](https://claude.ai/code) CLI (`claude`) must be installed and authenticated.

---

## How it works

```
your-project/
  .agent-intern/       ← config and bug database (git-excluded)
    config.json        ← registered scripts and prompts
    bugs.db            ← SQLite: bugs + agent activity logs
your-project-agent/    ← Claude works here (sandboxed mirror)
```

1. `agent init` creates a sandboxed git mirror next to your project
2. `agent bug fetch` pulls bugs from your tracker into a local SQLite DB
3. `agent bug fix` pushes a branch to the mirror, runs Claude to fix the bug, and commits
4. `agent bug review` checks out the fix branch locally so you can inspect it
5. `agent bug close` rebases and fast-forward merges the fix into your base branch

---

## Setup

### 1. Initialize the agent mirror

Run from the **parent directory** of your project, or pass any path form:

```bash
agent init your-project      # from parent dir
agent init .                 # from inside the project
agent init ~/path/to/project # absolute path
```

This creates `your-project-agent/` as a sandboxed git mirror, adds an `agent` remote in your project, and creates `.agent-intern/` for local config and bug data (automatically git-excluded).

### 2. Write a bug fetch script

Write a script that fetches bugs from your tracker and prints a JSON array to stdout:

```json
[
  { "id": "GITHUB-1", "title": "Button broken", "description": "..." },
  { "id": "JIRA-42",  "title": "API returns 500", "description": "..." }
]
```

Example using GitHub Issues:

```bash
#!/bin/bash
gh issue list --repo your-org/your-repo --state open --json number,title,body \
  --jq '[.[] | {id: ("GITHUB-" + (.number | tostring)), title: .title, description: .body}]'
```

Register it from inside your project:

```bash
agent bug fetch init ./fetch-bugs.sh
```

### 3. (Optional) Customize prompts

```bash
# Custom prompt for fixing bugs
agent bug fix init --prompt ./prompts/fix.txt

# Custom prompt and/or transform script for commit messages
agent bug commit init --prompt ./prompts/commit.txt --script ./scripts/format-commit.sh
```

- `--prompt` — path to a text file used as the Claude prompt
- `--script` (commit only) — a script that receives Claude's response on stdin and outputs the final commit message

---

## Daily workflow

```bash
# 1. Pull bugs from your tracker
agent bug fetch

# 2. Check what's in the queue
agent bug list

# 3. Fix all todo bugs against a branch
agent bug fix --all --base main

# 4. Review each fix
agent bug review GITHUB-1

# 5. Inspect the diff
git diff main..fix/main/GITHUB-1

# 6. Merge if happy, or reject
agent bug close GITHUB-1 --base main   # merges + marks done
agent bug status GITHUB-1 rejected     # mark as rejected
```

---

## Command reference

### `agent init <path>`
Initialize a sandboxed agent mirror for a project. `<path>` can be a project name, `.`, or an absolute path.

### `agent branch update [branchName]`
Push a branch from your project to the agent mirror. Defaults to the current branch.

### `agent bug list`
Print a table of all bugs and their statuses.

### `agent bug fetch init <scriptPath>`
Register the script used to fetch bugs from your tracker.

### `agent bug fetch`
Run the fetch script and upsert results into the local bug database.

### `agent bug fix [bugIds...] --base <branch>`
Fix one or more bugs with Claude. For each bug:
1. Pushes `<branch>` to the agent mirror
2. Creates `fix/<branch>/<bugId>` in the mirror
3. Runs Claude to apply the fix
4. Commits with a Claude-generated message
5. Sets bug status to `review`

### `agent bug fix --all --base <branch>`
Fix all bugs with status `todo`.

### `agent bug fix init --prompt <path>`
Set a custom prompt file for the fix step.

### `agent bug review <bugId>`
Fetch the fix branch from the agent mirror and check it out locally for inspection.

### `agent bug close <bugId> --base <branch>`
Rebase the fix branch onto `<branch>`, fast-forward merge it in, and mark the bug as `done`.

### `agent bug status <bugId> <status>`
Manually set a bug's status. Valid values: `todo`, `in-progress`, `review`, `done`, `rejected`.

### `agent bug commit <bugId> [--resume <sessionId>]`
Commit staged changes in the current directory using Claude to generate the commit message.

### `agent bug commit init [--prompt <path>] [--script <path>]`
Configure the Claude prompt and optional transform script for commit messages.

---

## Bug statuses

| Status | Meaning |
|--------|---------|
| `todo` | Fetched, not yet fixed |
| `in-progress` | Claude is working on it |
| `review` | Fix committed, ready for review |
| `done` | Merged |
| `rejected` | Fix rejected |

Only bugs with status `todo` are processed by `agent bug fix`.
