/**
 * bpro init — Initialize project + auto-setup models & conductor.
 */

import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, initProject } from '../core/project.js';
import { printSuccess, printWarning, printError } from '../utils/display.js';
import { runSetup } from './setup.js';

export const initCommand = new Command('init')
  .description('Initialize bpro in the current directory')
  .option('--force', 'Reinitialize existing .bpro/')
  .option('--skip-setup', 'Skip model detection and conductor selection')
  .action(async (opts: { force?: boolean; skipSetup?: boolean }) => {
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

    if (!opts.skipSetup) {
      try {
        await runSetup(path.join(root, '.bpro'));
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'ExitPromptError') {
          // User cancelled setup — that's fine
          console.log();
          printWarning('Setup skipped. Run `bpro setup` later.');
          return;
        }
        // Non-fatal — init succeeded, setup failed
        printWarning('Model setup failed. Run `bpro setup` to try again.');
      }
    } else {
      console.log();
      console.log('  Next:');
      console.log(`  ${chalk.cyan('bpro setup')}  — detect models and pick conductor`);
      console.log();
    }
  });
