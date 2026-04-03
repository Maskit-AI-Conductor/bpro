/**
 * fugue agent — Agent management with detailed view.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { requireFugueDir, loadConfig, loadModels } from '../core/project.js';
import { loadAgentDefs, readAgentLogs, listLoggedAgents } from '../agents/runner.js';
import { printError, printInfo, printWarning, printSuccess } from '../utils/display.js';

export const agentCommand = new Command('agent')
  .description('Manage and inspect agents');

agentCommand
  .command('list')
  .description('List all agents with model assignments')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      const config = loadConfig(fugueDir);
      const registry = loadModels(fugueDir);
      const defs = await loadAgentDefs(fugueDir);
      const loggedAgents = listLoggedAgents(fugueDir);

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
        printInfo('No agents defined yet. Run `fugue snapshot` to auto-generate agents.');
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
          const logs = readAgentLogs(fugueDir, def.name);
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
          const logs = readAgentLogs(fugueDir, name);
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
      const fugueDir = requireFugueDir();
      const logs = readAgentLogs(fugueDir, name);

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
      const fugueDir = requireFugueDir();
      const defs = await loadAgentDefs(fugueDir);
      const loggedAgents = listLoggedAgents(fugueDir);

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
        const logs = readAgentLogs(fugueDir, name);
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

// --- agent guide (PMIF-003) ---

agentCommand
  .command('guide')
  .description('Generate MCP usage guide for a specific role')
  .requiredOption('--role <role>', 'Role: pm, dev, qa')
  .action(async (opts: { role: string }) => {
    const role = opts.role.toLowerCase();
    if (role === 'pm') {
      console.log('# Fugue MCP Usage Guide — PM Role\n');
      console.log('## Daily Routine\n');
      console.log('### 1. Morning Check (pm-daily workflow)');
      console.log('    fugue workflow run pm-daily');
      console.log('Shows: project status, quick audit, sync promotions.\n');
      console.log('### 2. Weekly Sync');
      console.log('    fugue sync');
      console.log('Maps commits with REQ-IDs to code_refs/test_refs.\n');
      console.log('### 3. Feature Completion Check');
      console.log('    fugue verify --since <last-release>');
      console.log('Shows which REQs were affected and whether tests exist.\n');
      console.log('## MCP Tools\n');
      console.log('  fugue_status    — project progress overview');
      console.log('  fugue_audit     — quality check');
      console.log('  fugue_sync      — sync commits to traceability matrix');
      console.log('  fugue_get_specs — list REQs with filters');
      console.log('  fugue_task_list — list tasks');
      console.log('  fugue_feedback  — accept/reject/comment on REQ');
      console.log('  fugue_confirm   — confirm accepted REQs\n');
      console.log('## Progressive Detail Levels\n');
      console.log('  L0: Commit tag only     → no action');
      console.log('  L1: REQ with desc       → review in pm-review');
      console.log('  L2: ai_context auto     → review summary, edit if needed');
      console.log('  L3: Policy generated    → review and confirm\n');
      console.log('On sync promotion suggestion:');
      console.log('  fugue enrich <REQ-ID>          → accept L2');
      console.log('  fugue policy generate <REQ-ID> → accept L3');
      console.log('  (or ignore to dismiss)\n');
      printSuccess('PM guide generated.');
    } else {
      printWarning(`Role '${role}' guide not yet available. Supported: pm`);
    }
  });
