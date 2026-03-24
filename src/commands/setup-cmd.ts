/**
 * bpro setup — Standalone command to (re)detect models and pick conductor.
 */

import { Command } from 'commander';
import { requireBproDir } from '../core/project.js';
import { printError } from '../utils/display.js';
import { runSetup } from './setup.js';

export const setupCommand = new Command('setup')
  .description('Detect available models, register them, and pick conductor')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      await runSetup(bproDir);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'ExitPromptError') return;
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
