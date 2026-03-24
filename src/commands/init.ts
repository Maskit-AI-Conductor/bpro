/**
 * bpro init — Initialize project.
 */

import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, initProject } from '../core/project.js';
import { printSuccess, printWarning, printError } from '../utils/display.js';

export const initCommand = new Command('init')
  .description('Initialize bpro in the current directory')
  .option('--force', 'Reinitialize existing .bpro/')
  .action(async (opts: { force?: boolean }) => {
    const root = process.cwd();

    if (findProjectRoot(root) && !opts.force) {
      printWarning('.bpro/ already exists. Use --force to reinitialize.');
      return;
    }

    try {
      initProject(root, opts.force);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    printSuccess(`Initialized .bpro/ in ${path.basename(root)}/`);
    console.log();
    console.log('  Next steps:');
    console.log(`  ${chalk.cyan('bpro model add ollama:qwen2.5:7b')}       — register a model`);
    console.log(`  ${chalk.cyan('bpro config set conductor <model>')}      — pick conductor`);
    console.log(`  ${chalk.cyan('bpro snapshot')}                          — reverse-engineer code`);
    console.log(`  ${chalk.cyan('bpro plan import ./planning-doc.md')}     — start from plan`);
    console.log();
  });
