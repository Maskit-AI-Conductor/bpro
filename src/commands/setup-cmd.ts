/**
 * fugue setup — Standalone command to (re)detect models and pick conductor.
 */

import { Command } from 'commander';
import { requireFugueDir } from '../core/project.js';
import { printError } from '../utils/display.js';
import { runSetup } from './setup.js';

export const setupCommand = new Command('setup')
  .description('Detect available models, register them, and pick conductor')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      await runSetup(fugueDir);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'ExitPromptError') return;
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
