#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const init = require('../commands/init');
const update = require('../commands/update');
const bugFetch = require('../commands/bug/fetch');
const bugFetchInit = require('../commands/bug/fetchInit');
const bugCommit = require('../commands/bug/commit');
const bugCommitInit = require('../commands/bug/commitInit');
const bugFix = require('../commands/bug/fix');
const bugFixInit = require('../commands/bug/fixInit');
const bugList = require('../commands/bug/list');
const bugReview = require('../commands/bug/review');
const bugStatus = require('../commands/bug/status');
const bugClose = require('../commands/bug/close');

const program = new Command();

program
  .name('agent')
  .description('Manage agent git mirrors for your projects')
  .version('1.0.0');

program
  .command('init <projectName>')
  .description('Initialize an agent git mirror for an existing project')
  .action(init);

const branch = program.command('branch').description('Manage branches in the agent mirror');
branch
  .command('update [branchName]')
  .description('Push a branch to the agent mirror (defaults to current branch)')
  .action(update);

const bugCmd = program.command('bug').description('Manage bugs');

bugCmd.command('list').description('List all bugs and their statuses').action(bugList);
bugCmd.command('review <bugId>').description('Fetch fix branch from agent mirror and check it out locally').action(bugReview);
bugCmd.command('status <bugId> <status>').description('Set bug status (todo, in-progress, review, done, rejected)').action(bugStatus);
bugCmd
  .command('close <bugId>')
  .description('Rebase fix branch onto base and fast-forward merge into it')
  .option('--base <branch>', 'Base branch to merge into')
  .action(bugClose);

const fetchCmd = bugCmd.command('fetch').description('Fetch bugs from your tracker and store them locally');
fetchCmd.command('init <scriptPath>').description('Register the script used to fetch bugs').action(bugFetchInit);
fetchCmd.action(bugFetch);

const commitCmd = bugCmd.command('commit').description('Commit staged changes using Claude');
commitCmd
  .command('init')
  .description('Configure commit prompt and transform script')
  .option('--prompt <path>', 'Path to a file containing the Claude prompt')
  .option('--script <path>', 'Path to a script that transforms the Claude response into a commit message')
  .action(bugCommitInit);
commitCmd
  .argument('<bugId>', 'Bug ID to associate with this commit')
  .option('--resume <sessionId>', 'Resume a Claude session')
  .action(bugCommit);

const fixCmd = bugCmd.command('fix').description('Fix bugs using Claude');
fixCmd
  .command('init')
  .description('Configure the fix prompt')
  .option('--prompt <path>', 'Path to a file containing the Claude prompt')
  .action(bugFixInit);
fixCmd
  .argument('[bugIds...]', 'Bug IDs to fix')
  .option('--base <branch>', 'Base branch to branch off from (defaults to current branch)')
  .option('-a, --all', 'Fix all bugs with status "todo"')
  .action(bugFix);

program.parse(process.argv);
