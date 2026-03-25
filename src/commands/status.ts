/**
 * fugue status — Project overview.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireFugueDir,
  loadConfig,
  loadSpecs,
  loadMatrix,
  loadModels,
} from '../core/project.js';
import { countByStatus } from '../core/requirements.js';
import { getMatrixCoverage } from '../core/matrix.js';
import { buildDeliverables } from '../core/deliverables.js';
import { printError, printInfo, printProgressBar, printReqTable, printDeliverableTree } from '../utils/display.js';

export const statusCommand = new Command('status')
  .description('Show project status')
  .option('--deliverables', 'Show deliverable tree (D.01-D.08)')
  .action(async (opts: { deliverables?: boolean }) => {
    try {
      const fugueDir = requireFugueDir();
      const config = loadConfig(fugueDir);
      const reqs = loadSpecs(fugueDir);
      const matrix = loadMatrix(fugueDir);
      const registry = loadModels(fugueDir);

      console.log();
      console.log(`  ${chalk.bold(config.project_name || 'unnamed')}`);

      if (config.conductor) {
        console.log(`  ${chalk.dim('conductor:')} ${chalk.yellow(config.conductor)} ${chalk.dim(`| ${registry.models.length} models registered`)}`);
      }
      console.log();

      if (reqs.length === 0) {
        printInfo('No requirements yet.');
        console.log(`  ${chalk.cyan('fugue plan import <file>')}  — start from planning doc`);
        console.log(`  ${chalk.cyan('fugue snapshot')}            — reverse-engineer code`);
        return;
      }

      const counts = countByStatus(reqs);
      printProgressBar(counts.done, counts.total, 'REQs done');
      console.log();

      // Status summary line
      const parts: string[] = [];
      for (const [label, count] of [
        ['DONE', counts.done],
        ['DEV', counts.dev],
        ['CONFIRMED', counts.confirmed],
        ['DRAFT', counts.draft],
        ['STALE', counts.stale],
        ['DEPRECATED', counts.deprecated],
      ] as const) {
        if (count > 0) parts.push(`${label}: ${count}`);
      }
      console.log(`  ${parts.join(' | ')}`);
      console.log();

      // Matrix coverage
      const coverage = getMatrixCoverage(matrix);
      if (coverage.total > 0) {
        console.log(`  Code mapped: ${coverage.codeMapped}/${coverage.total} | Tests mapped: ${coverage.testMapped}/${coverage.total}`);
        console.log();
      }

      if (opts.deliverables) {
        const deliverables = buildDeliverables(fugueDir, config, reqs, matrix);
        printDeliverableTree(deliverables);
      } else {
        const display = reqs.slice(0, 15);
        printReqTable(display, `Requirements (${reqs.length} total)`);
        if (reqs.length > 15) {
          console.log(`  ${chalk.dim(`... and ${reqs.length - 15} more. Use \`fugue status --deliverables\` for full view.`)}`);
        }
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
