#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const init = require('../commands/init');
const update = require('../commands/update');
const bugFetch = require('../commands/bug/fetch');
const bugCommit = require('../commands/bug/commit');
const bugFix = require('../commands/bug/fix');
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

bugCmd.command('fetch').description('Fetch bugs from your tracker and store them locally').action(bugFetch);

bugCmd
  .command('commit <bugId>')
  .description('Commit staged changes using Claude')
  .option('--resume <sessionId>', 'Resume a Claude session')
  .action(bugCommit);

bugCmd
  .command('fix [bugIds...]')
  .description('Fix bugs using Claude')
  .option('--base <branch>', 'Base branch to branch off from')
  .option('-a, --all', 'Fix all bugs with status "todo"')
  .action(bugFix);

program.parse(process.argv);
