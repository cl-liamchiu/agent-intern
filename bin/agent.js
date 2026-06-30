#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const init = require('../commands/init');
const fetch = require('../commands/fetch');
const commit = require('../commands/commit');
const fix = require('../commands/fix');
const list = require('../commands/list');
const review = require('../commands/review');
const status = require('../commands/status');
const close = require('../commands/close');

const program = new Command();

program
  .name('agent')
  .description('Let an AI agent fix bugs while you review and approve')
  .version('1.0.0');

program
  .command('init <project>')
  .description('Initialize an agent mirror for an existing project')
  .action(init);

program.command('list').description('List all bugs and their statuses').action(list);
program.command('fetch').description('Fetch bugs from your tracker').action(fetch);

program
  .command('fix [bugIds...]')
  .description('Fix bugs using Claude')
  .option('--base <branch>', 'Base branch to branch off from')
  .option('-a, --all', 'Fix all bugs with status "todo"')
  .action(fix);

program.command('review <bugId>').description('Check out a fix branch locally for inspection').action(review);

program
  .command('close <bugId>')
  .description('Rebase and fast-forward merge a fix branch into the base branch')
  .option('--base <branch>', 'Base branch to merge into')
  .action(close);

program.command('status <bugId> <status>').description('Set bug status (todo, in-progress, review, done, rejected)').action(status);

program
  .command('commit <bugId>')
  .description('Commit staged changes using Claude')
  .option('--resume <sessionId>', 'Resume a Claude session')
  .action(commit);

program.parse(process.argv);
