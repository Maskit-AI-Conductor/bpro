/**
 * bpro agent — Agent management with detailed view.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { requireBproDir, loadConfig, loadModels } from '../core/project.js';
import { loadAgentDefs, readAgentLogs, listLoggedAgents } from '../agents/runner.js';
import { printError, printInfo, printWarning } from '../utils/display.js';

export const agentCommand = new Command('agent')
  .description('Manage and inspect agents');

agentCommand
  .command('list')
  .description('List all agents with model assignments')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      const config = loadConfig(bproDir);
      const registry = loadModels(bproDir);
      const defs = await loadAgentDefs(bproDir);
      const loggedAgents = listLoggedAgents(bproDir);

      console.log();

      // Show conductor info
      if (config.conductor) {
        const conductorModel = registry.models.find(m => m.name === config.conductor);
        const conductorName = config.conductor_name ?? 'conductor';
        console.log(`  ${chalk.yellow.bold('★ Conductor')}: ${chalk.yellow(conductorName)}`);
        console.log(`    Model: ${chalk.cyan(config.conductor)} (${conductorModel?.provider ?? 'unknown'}${conductorModel?.subscription ? ', subscription' : ''})`);
        console.log(`    Role:  orchestrates all agents, assigns tasks`);
        console.log();
      }

      if (defs.length === 0 && loggedAgents.length === 0) {
        printInfo('No agents defined yet. Run `bpro snapshot` to auto-generate agents.');
        return;
      }

      // Group agents by type
      const typeOrder = ['architect', 'domain-analyst', 'auditor', 'tester', 'other'];
      const grouped = new Map<string, typeof defs>();
      for (const def of defs) {
        const type = typeOrder.includes(def.type) ? def.type : 'other';
        if (!grouped.has(type)) grouped.set(type, []);
        grouped.get(type)!.push(def);
      }

      const typeLabels: Record<string, string> = {
        'architect': '🏗  Architects',
        'domain-analyst': '🔍 Domain Analysts',
        'auditor': '🛡  Auditors',
        'tester': '🧪 Testers',
        'other': '📋 Other',
      };

      for (const type of typeOrder) {
        const agents = grouped.get(type);
        if (!agents || agents.length === 0) continue;

        console.log(`  ${chalk.bold(typeLabels[type] ?? type)}`);

        for (const def of agents) {
          const logs = readAgentLogs(bproDir, def.name);
          const logCount = logs.length;
          const successCount = logs.filter(l => l.status === 'success').length;
          const rate = logCount > 0 ? Math.round((successCount / logCount) * 100) : 0;

          console.log(`    ${chalk.cyan(def.name)}`);
          console.log(`      Model: ${chalk.yellow(def.assigned_model)}  |  Runs: ${logCount}  |  Success: ${logCount > 0 ? `${rate}%` : '-'}`);
          if (def.scope) {
            console.log(`      Scope: ${chalk.dim(def.scope)}`);
          }
          if (def.never && def.never.length > 0) {
            console.log(`      Never: ${chalk.red(def.never.join(', '))}`);
          }
        }
        console.log();
      }

      // Show agents with logs but no definition
      const orphanAgents = loggedAgents.filter(name => !defs.find(d => d.name === name));
      if (orphanAgents.length > 0) {
        console.log(`  ${chalk.bold('Unregistered (has logs)')}`);
        for (const name of orphanAgents) {
          const logs = readAgentLogs(bproDir, name);
          console.log(`    ${chalk.dim(name)} — ${logs.length} runs`);
        }
        console.log();
      }

      // Summary
      const totalModels = new Set(defs.map(d => d.assigned_model)).size;
      console.log(`  ${chalk.dim(`Total: ${defs.length} agents, ${totalModels} distinct model(s)`)}`);
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

      const allAgents = new Set([...defs.map(d => d.name), ...loggedAgents]);

      if (allAgents.size === 0) {
        printInfo('No agents to evaluate.');
        return;
      }

      console.log();
      console.log(`  ${chalk.bold('Agent Evaluation')}`);
      console.log(`  ${chalk.dim('-'.repeat(60))}`);

      for (const name of allAgents) {
        const def = defs.find(d => d.name === name);
        const logs = readAgentLogs(bproDir, name);
        const total = logs.length;
        const success = logs.filter(l => l.status === 'success').length;
        const failures = logs.filter(l => l.status === 'failure').length;
        const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

        const rateColor = successRate >= 90 ? chalk.green : successRate >= 70 ? chalk.yellow : chalk.red;
        const model = def ? chalk.dim(`[${def.assigned_model}]`) : '';

        console.log(
          `  ${chalk.cyan(name.padEnd(22))}runs: ${String(total).padEnd(5)} success: ${rateColor(`${successRate}%`.padEnd(6))} failures: ${failures}  ${model}`,
        );
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
