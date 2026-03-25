/**
 * fugue init — Initialize project + auto-setup models & conductor.
 */

import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, initProject } from '../core/project.js';
import { printSuccess, printWarning, printError } from '../utils/display.js';
import { runSetup } from './setup.js';

export const initCommand = new Command('init')
  .description('Initialize fugue in the current directory')
  .option('--force', 'Reinitialize existing .fugue/')
  .option('--skip-setup', 'Skip model detection and conductor selection')
  .action(async (opts: { force?: boolean; skipSetup?: boolean }) => {
    const root = process.cwd();

    if (findProjectRoot(root) && !opts.force) {
      printWarning('.fugue/ already exists. Use --force to reinitialize.');
      return;
    }

    try {
      initProject(root, opts.force);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    printSuccess(`Initialized .fugue/ in ${path.basename(root)}/`);

    if (!opts.skipSetup) {
      try {
        await runSetup(path.join(root, '.fugue'));
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'ExitPromptError') {
          // User cancelled setup — that's fine
          console.log();
          printWarning('Setup skipped. Run `fugue setup` later.');
          return;
        }
        // Non-fatal — init succeeded, setup failed
        printWarning('Model setup failed. Run `fugue setup` to try again.');
      }
    } else {
      console.log();
      console.log('  Next:');
      console.log(`  ${chalk.cyan('fugue setup')}  — detect models and pick conductor`);
      console.log();
    }
  });
