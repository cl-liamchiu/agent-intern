'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');
const { getAgentDir } = require('../../lib/paths');
const { getDb } = require('../../lib/db');

module.exports = function review(bugId) {
  const cwd = process.cwd();

  // Fetch latest branches from agent mirror
  console.log('Fetching from agent...');
  try {
    execFileSync('git', ['fetch', 'agent'], { cwd, stdio: 'inherit' });
  } catch (err) {
    console.error(`Error fetching from agent: ${err.message}`);
    process.exit(1);
  }

  // Find the remote tracking branch matching fix/*/<bugId>
  let remoteBranches;
  try {
    remoteBranches = execFileSync('git', ['branch', '-r'], { cwd, encoding: 'utf8' });
  } catch (err) {
    console.error(`Error listing remote branches: ${err.message}`);
    process.exit(1);
  }

  const match = remoteBranches
    .split('\n')
    .map(b => b.trim())
    .find(b => b === `agent/fix/${bugId}` || (b.startsWith('agent/fix/') && b.endsWith(`/${bugId}`)));

  if (!match) {
    console.error(`Error: no fix branch found for bug "${bugId}". Has it been fixed yet?`);
    process.exit(1);
  }

  const remoteBranch = match;
  const localBranch = remoteBranch.replace(/^agent\//, '');
  // Extract base branch from fix/<base>/<bugId>
  const baseBranch = localBranch.replace(/^fix\//, '').replace(`/${bugId}`, '');

  // Check if local branch already exists
  let localBranchList;
  try {
    localBranchList = execFileSync('git', ['branch'], { cwd, encoding: 'utf8' });
  } catch (err) {
    console.error(`Error listing local branches: ${err.message}`);
    process.exit(1);
  }

  const exists = localBranchList.split('\n').map(b => b.replace(/^\*?\s+/, '')).includes(localBranch);

  if (exists) {
    execFileSync('git', ['checkout', localBranch], { cwd, stdio: 'inherit' });
  } else {
    execFileSync('git', ['checkout', '-b', localBranch, remoteBranch], { cwd, stdio: 'inherit' });
  }

  // Get bug info from DB
  const db = getDb(cwd);
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(bugId);

  // Get commit log
  const commitLog = execFileSync(
    'git', ['log', `${baseBranch}..HEAD`, '--pretty=format:%H%n%s%n%b%n---'],
    { cwd, encoding: 'utf8' }
  ).trim();

  // Get diff
  const diff = execFileSync(
    'git', ['diff', `${baseBranch}..HEAD`],
    { cwd, encoding: 'utf8' }
  );

  // Generate HTML
  const html = buildHtml(bug, commitLog, diff);
  const outPath = path.join(getAgentDir(cwd), `review-${bugId}.html`);
  fs.writeFileSync(outPath, html);

  console.log(`\nReview page: ${outPath}`);

  // Open in browser
  const opener = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd'
    : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', outPath] : [outPath];
  spawn(opener, args, { detached: true, stdio: 'ignore' }).unref();
};

function buildHtml(bug, commitLog, diff) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Review: ${esc(bug?.id ?? 'Unknown')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f8fa; color: #1f2328; }
  .container { max-width: 960px; margin: 40px auto; padding: 0 24px 80px; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  .meta { font-size: 0.875rem; color: #656d76; margin-bottom: 24px; }
  .card { background: white; border: 1px solid #d0d7de; border-radius: 6px; margin-bottom: 24px; }
  .card-header { padding: 12px 16px; border-bottom: 1px solid #d0d7de; font-weight: 600; font-size: 0.875rem; background: #f6f8fa; border-radius: 6px 6px 0 0; }
  .card-body { padding: 16px; font-size: 0.875rem; white-space: pre-wrap; line-height: 1.6; }
  .diff-file { margin-bottom: 0; border-top: 1px solid #d0d7de; }
  .diff-file:first-child { border-top: none; }
  .diff-filename { padding: 8px 16px; font-size: 0.8rem; font-family: monospace; background: #f6f8fa; border-bottom: 1px solid #d0d7de; color: #656d76; }
  .diff-table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.8rem; }
  .diff-table td { padding: 1px 16px; white-space: pre; }
  .diff-table td.ln { width: 1%; color: #8c959f; user-select: none; padding: 1px 8px; text-align: right; min-width: 40px; }
  .added { background: #e6ffec; }
  .added .ln { background: #ccffd8; color: #57ab5a; }
  .removed { background: #ffebe9; }
  .removed .ln { background: #ffd7d5; color: #e5534b; }
  .hunk { background: #ddf4ff; color: #0969da; }
  .hunk td { padding: 2px 16px; }
</style>
</head>
<body>
<div class="container">
  <h1>${esc(bug?.title ?? bugId)}</h1>
  <p class="meta">${esc(bug?.id ?? '')} &middot; status: ${esc(bug?.status ?? '')}</p>

  ${bug?.description ? `
  <div class="card">
    <div class="card-header">Bug description</div>
    <div class="card-body">${esc(bug.description)}</div>
  </div>` : ''}

  <div class="card">
    <div class="card-header">Commit</div>
    <div class="card-body">${esc(commitLog)}</div>
  </div>

  <div class="card">
    <div class="card-header">Diff</div>
    ${parseDiff(diff)}
  </div>
</div>
</body>
</html>`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseDiff(diff) {
  if (!diff.trim()) return '<div class="card-body">No changes.</div>';

  const files = diff.split(/^(?=diff --git )/m).filter(Boolean);
  return files.map(file => {
    const lines = file.split('\n');
    const fileHeader = lines.find(l => l.startsWith('+++ b/'))?.slice(6) ?? lines[0];
    let leftLn = 0, rightLn = 0;

    const rows = lines.slice(4).map(line => {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
        if (m) { leftLn = parseInt(m[1]) - 1; rightLn = parseInt(m[2]) - 1; }
        return `<tr class="hunk"><td class="ln" colspan="2"></td><td>${esc(line)}</td></tr>`;
      }
      if (line.startsWith('+')) {
        rightLn++;
        return `<tr class="added"><td class="ln"></td><td class="ln">${rightLn}</td><td>${esc(line)}</td></tr>`;
      }
      if (line.startsWith('-')) {
        leftLn++;
        return `<tr class="removed"><td class="ln">${leftLn}</td><td class="ln"></td><td>${esc(line)}</td></tr>`;
      }
      leftLn++; rightLn++;
      return `<tr><td class="ln">${leftLn}</td><td class="ln">${rightLn}</td><td>${esc(line)}</td></tr>`;
    }).join('');

    return `<div class="diff-file">
  <div class="diff-filename">${esc(fileHeader)}</div>
  <table class="diff-table"><tbody>${rows}</tbody></table>
</div>`;
  }).join('');
}
