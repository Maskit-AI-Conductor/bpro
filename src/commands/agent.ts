/**
 * bpro agent — Agent management.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { requireBproDir } from '../core/project.js';
import { loadAgentDefs, readAgentLogs, listLoggedAgents } from '../agents/runner.js';
import { printError, printInfo, printWarning } from '../utils/display.js';

export const agentCommand = new Command('agent')
  .description('Manage and inspect agents');

agentCommand
  .command('list')
  .description('List defined agents')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      const defs = await loadAgentDefs(bproDir);
      const loggedAgents = listLoggedAgents(bproDir);

      if (defs.length === 0 && loggedAgents.length === 0) {
        printInfo('No agents defined. Run `bpro snapshot` to auto-generate agents.');
        return;
      }

      console.log();
      console.log(`  ${chalk.bold('Agents')}`);
      console.log(`  ${chalk.dim('-'.repeat(60))}`);

      for (const def of defs) {
        const logs = readAgentLogs(bproDir, def.name);
        const logCount = logs.length;
        const lastRun = logs.length > 0 ? logs[logs.length - 1].completed_at : 'never';

        console.log(
          `  ${chalk.cyan(def.name.padEnd(22))}${chalk.dim(def.type.padEnd(18))}${chalk.yellow(def.assigned_model.padEnd(20))}${chalk.dim(`${logCount} runs, last: ${lastRun.slice(0, 10)}`)}`,
        );
        if (def.scope) {
          console.log(`  ${' '.repeat(22)}${chalk.dim(def.scope)}`);
        }
      }

      // Show agents with logs but no definition
      for (const name of loggedAgents) {
        if (!defs.find((d) => d.name === name)) {
          const logs = readAgentLogs(bproDir, name);
          console.log(
            `  ${chalk.cyan(name.padEnd(22))}${chalk.dim('(no def)'.padEnd(18))}${chalk.dim(`${logs.length} runs`)}`,
          );
        }
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

agentCommand
  .command('log <name>')
  .description('View agent work log')
  .action(async (name: string) => {
    try {
      const bproDir = requireBproDir();
      const logs = readAgentLogs(bproDir, name);

      if (logs.length === 0) {
        printWarning(`No logs found for agent '${name}'.`);
        return;
      }

      console.log();
      console.log(`  ${chalk.bold(`Logs for ${name}`)} (${logs.length} entries)`);
      console.log(`  ${chalk.dim('-'.repeat(60))}`);

      for (const log of logs.slice(-20)) {
        const date = log.completed_at.slice(0, 10);
        const statusColor = log.status === 'success' ? chalk.green : log.status === 'failure' ? chalk.red : chalk.yellow;
        console.log(
          `  ${chalk.dim(date)} ${statusColor(log.status.padEnd(8))} ${log.action.padEnd(25)} ${chalk.dim(log.model)} — ${log.output_summary}`,
        );
      }

      if (logs.length > 20) {
        console.log(`  ${chalk.dim(`... ${logs.length - 20} older entries`)}`);
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

agentCommand
  .command('eval')
  .description('Evaluate agent performance')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      const defs = await loadAgentDefs(bproDir);
      const loggedAgents = listLoggedAgents(bproDir);

      const allAgents = new Set([...defs.map((d) => d.name), ...loggedAgents]);

      if (allAgents.size === 0) {
        printInfo('No agents to evaluate.');
        return;
      }

      console.log();
      console.log(`  ${chalk.bold('Agent Evaluation')}`);
      console.log(`  ${chalk.dim('-'.repeat(60))}`);

      for (const name of allAgents) {
        const logs = readAgentLogs(bproDir, name);
        const total = logs.length;
        const success = logs.filter((l) => l.status === 'success').length;
        const failures = logs.filter((l) => l.status === 'failure').length;
        const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

        const rateColor = successRate >= 90 ? chalk.green : successRate >= 70 ? chalk.yellow : chalk.red;

        console.log(
          `  ${chalk.cyan(name.padEnd(22))}runs: ${String(total).padEnd(5)} success: ${rateColor(`${successRate}%`.padEnd(6))} failures: ${failures}`,
        );
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
