/**
 * fugue workflow — Run, list, define, and show repeatable multi-step workflows.
 *
 * Subcommands:
 *   fugue workflow run <name> [file] [--requester <name>]
 *   fugue workflow list
 *   fugue workflow define <name>
 *   fugue workflow show <name>
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireFugueDir,
} from '../core/project.js';
import {
  BUILTIN_WORKFLOWS,
  getWorkflow,
  listCustomWorkflows,
  saveCustomWorkflow,
  actionToCommands,
  type WorkflowDef,
  type WorkflowStep,
} from '../core/workflow.js';
import { printSuccess, printError, printInfo, printWarning } from '../utils/display.js';

// =============================================
// Main command
// =============================================

export const workflowCommand = new Command('workflow')
  .description('Repeatable multi-step workflows');

// =============================================
// workflow run <name> [file] [--requester <name>]
// =============================================

workflowCommand
  .command('run <name> [file]')
  .description('Run a workflow')
  .option('--requester <name>', 'Name of the requester')
  .action(async (name: string, file: string | undefined, opts: { requester?: string }) => {
    try {
      const fugueDir = requireFugueDir();
      const workflow = getWorkflow(name, fugueDir);

      if (!workflow) {
        printError(`Workflow "${name}" not found. Run \`fugue workflow list\` to see available workflows.`);
        process.exit(1);
      }

      // Validate: workflows with new+import need a file argument
      const needsFile = workflow.steps.some((s) => s.action === 'new+import');
      if (needsFile && !file) {
        printError(`Workflow "${name}" requires a file argument for the new+import step.`);
        console.log(`  Usage: ${chalk.cyan(`fugue workflow run ${name} <file> [--requester <name>]`)}`);
        process.exit(1);
      }

      // Header
      console.log();
      console.log(`  ${chalk.bold(`Workflow: ${workflow.name}`)} ${chalk.dim(`(${workflow.description})`)}`);
      console.log(`  ${chalk.dim(`Steps: ${workflow.steps.length}`)}`);
      console.log(`  ${chalk.dim('\u2500'.repeat(40))}`);
      console.log();

      let taskId = '';

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepNum = i + 1;
        const total = workflow.steps.length;
        const typeTag = step.type === 'auto'
          ? chalk.green('[auto]')
          : step.type === 'gate'
            ? chalk.yellow('[gate]')
            : chalk.magenta('[manual]');

        console.log(`  ${chalk.bold(`Step ${stepNum}/${total}`)}: ${step.description} ${typeTag}`);

        // Build commands
        const commands = actionToCommands(step.action, taskId, {
          file: file ? path.resolve(file) : undefined,
          requester: opts.requester,
        });

        // Special handling for new+import: need to capture taskId from first command
        if (step.action === 'new+import') {
          const success = await runNewImportStep(commands, file!, opts.requester);
          if (!success.ok) {
            printError(`Step ${stepNum} failed.`);
            console.log();
            return;
          }
          taskId = success.taskId;
          console.log(`  ${chalk.green('\u2714')} ${chalk.cyan(taskId)} created, doc imported`);
          console.log();
          continue;
        }

        // Special handling for assign: prompt for assignee
        if (step.action === 'assign') {
          const assignee = await promptAssignee();
          if (!assignee) {
            printWarning('No assignee provided. Workflow paused.');
            console.log();
            return;
          }
          const assignCmds = actionToCommands('assign', taskId, { assignee });
          for (const cmd of assignCmds) {
            console.log(`  ${chalk.dim('\u2192')} ${chalk.dim(cmd)}`);
            const ok = runActionInteractive(cmd);
            if (!ok) {
              printError(`Step ${stepNum} failed.`);
              console.log();
              return;
            }
          }
          console.log();
          // For manual type, still need confirmation
          if (step.type === 'manual') {
            // assign already done, just continue
          }
          continue;
        }

        // Run commands
        for (const cmd of commands) {
          console.log(`  ${chalk.dim('\u2192')} ${chalk.dim(cmd)}`);
          const ok = runActionInteractive(cmd);
          if (!ok) {
            printError(`Step ${stepNum} failed.`);
            console.log();

            if (step.type === 'gate') {
              const proceed = await promptGate();
              if (proceed === 'skip') {
                printInfo('Skipping this step.');
                break;
              } else if (!proceed) {
                printInfo('Workflow stopped.');
                return;
              }
            } else {
              return;
            }
          }
        }

        // Type-based flow control
        if (step.type === 'gate') {
          const proceed = await promptGate();
          if (proceed === 'skip') {
            printInfo('Skipping this step.');
          } else if (!proceed) {
            printInfo('Workflow stopped.');
            console.log();
            return;
          }
        } else if (step.type === 'manual') {
          const done = await promptManual(step);
          if (!done) {
            printInfo('Workflow stopped.');
            console.log();
            return;
          }
        }

        console.log();
      }

      // Done
      console.log(`  ${chalk.dim('\u2500'.repeat(40))}`);
      if (taskId) {
        printSuccess(`Workflow complete! ${chalk.cyan(taskId)} delivered.`);
      } else {
        printSuccess('Workflow complete!');
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// =============================================
// workflow list
// =============================================

workflowCommand
  .command('list')
  .description('List available workflows')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      const custom = listCustomWorkflows(fugueDir);

      console.log();
      console.log(`  ${chalk.bold('Built-in Workflows')}`);
      console.log(`  ${chalk.dim('-'.repeat(60))}`);

      for (const wf of BUILTIN_WORKFLOWS) {
        console.log(
          `  ${chalk.cyan(wf.name.padEnd(14))} ${wf.description.padEnd(40)} ${chalk.dim(`${wf.steps.length} steps`)}`,
        );
      }

      if (custom.length > 0) {
        console.log();
        console.log(`  ${chalk.bold('Custom Workflows')}`);
        console.log(`  ${chalk.dim('-'.repeat(60))}`);

        for (const wf of custom) {
          console.log(
            `  ${chalk.cyan(wf.name.padEnd(14))} ${(wf.description ?? '').padEnd(40)} ${chalk.dim(`${wf.steps.length} steps`)}`,
          );
        }
      }

      console.log();
      console.log(`  ${chalk.dim('Run:')} ${chalk.cyan('fugue workflow run <name> [file]')}`);
      console.log(`  ${chalk.dim('Show:')} ${chalk.cyan('fugue workflow show <name>')}`);
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// =============================================
// workflow define <name>
// =============================================

workflowCommand
  .command('define <name>')
  .description('Define a custom workflow (interactive)')
  .action(async (name: string) => {
    try {
      const fugueDir = requireFugueDir();

      // Check if name conflicts with built-in
      const existing = BUILTIN_WORKFLOWS.find((w) => w.name === name);
      if (existing) {
        printError(`"${name}" is a built-in workflow and cannot be overridden.`);
        process.exit(1);
      }

      const { input, select, confirm } = await import('@inquirer/prompts');

      const description = await input({
        message: 'Workflow description:',
        default: `Custom workflow: ${name}`,
      });

      const steps: WorkflowStep[] = [];
      let addMore = true;

      const KNOWN_ACTIONS = [
        'new+import', 'validate', 'decompose', 'confirm', 'assign',
        'done', 'deliver', 'snapshot', 'snapshot-review', 'snapshot-apply',
        'diagnose', 'audit', 'report',
      ];

      while (addMore) {
        const stepNum = steps.length + 1;
        console.log();
        console.log(`  ${chalk.bold(`Step ${stepNum}`)}`);

        const action = await select({
          message: 'Action:',
          choices: [
            ...KNOWN_ACTIONS.map((a) => ({ value: a, name: a })),
            { value: '__custom__', name: '(custom command)' },
          ],
        });

        let finalAction = action;
        if (action === '__custom__') {
          finalAction = await input({
            message: 'Custom action command:',
          });
        }

        const type = await select<'auto' | 'gate' | 'manual'>({
          message: 'Step type:',
          choices: [
            { value: 'auto', name: 'auto  — run and continue' },
            { value: 'gate', name: 'gate  — run, then ask to continue' },
            { value: 'manual', name: 'manual — wait for human completion' },
          ],
        });

        const desc = await input({
          message: 'Step description:',
          default: finalAction,
        });

        steps.push({ action: finalAction, type, description: desc });

        addMore = await confirm({
          message: 'Add another step?',
          default: true,
        });
      }

      if (steps.length === 0) {
        printWarning('No steps defined. Cancelled.');
        return;
      }

      const workflow: WorkflowDef = {
        name,
        description,
        steps,
      };

      saveCustomWorkflow(fugueDir, workflow);
      printSuccess(`Saved to .fugue/workflows/${name}.yaml (${steps.length} steps)`);
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// =============================================
// workflow show <name>
// =============================================

workflowCommand
  .command('show <name>')
  .description('Show workflow steps')
  .action(async (name: string) => {
    try {
      const fugueDir = requireFugueDir();
      const workflow = getWorkflow(name, fugueDir);

      if (!workflow) {
        printError(`Workflow "${name}" not found. Run \`fugue workflow list\` to see available workflows.`);
        process.exit(1);
      }

      const isBuiltin = BUILTIN_WORKFLOWS.some((w) => w.name === name);

      console.log();
      console.log(`  ${chalk.bold(workflow.name)} ${isBuiltin ? chalk.dim('(built-in)') : chalk.dim('(custom)')}`);
      console.log(`  ${chalk.dim(workflow.description)}`);
      console.log();

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const typeTag = step.type === 'auto'
          ? chalk.green('[auto]')
          : step.type === 'gate'
            ? chalk.yellow('[gate]')
            : chalk.magenta('[manual]');

        console.log(
          `  ${chalk.bold(`${i + 1}.`)} ${chalk.cyan(step.action.padEnd(18))} ${typeTag}  ${step.description}`,
        );
      }

      console.log();
      console.log(`  ${chalk.dim('Run:')} ${chalk.cyan(`fugue workflow run ${name} [file] [--requester <name>]`)}`);
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// =============================================
// Helpers
// =============================================

/**
 * Run a command interactively (stdio: 'inherit').
 * Returns true on success, false on failure.
 */
function runActionInteractive(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle new+import: run task new (capture output for taskId), then task import.
 */
async function runNewImportStep(
  commands: string[],
  file: string,
  requester?: string,
): Promise<{ ok: boolean; taskId: string }> {
  if (commands.length < 2) {
    return { ok: false, taskId: '' };
  }

  // Run "task new" and capture output to extract task ID
  const newCmd = commands[0];
  console.log(`  ${chalk.dim('\u2192')} ${chalk.dim(newCmd)}`);

  let taskId = '';
  try {
    const output = execSync(newCmd, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    // Parse output for TASK-NNN pattern
    const match = output.match(/TASK-\d{3}/);
    if (match) {
      taskId = match[0];
    }
    // Print the captured output
    process.stdout.write(output);
  } catch (err) {
    const errOutput = err instanceof Error ? (err as { stdout?: string }).stdout ?? '' : '';
    if (errOutput) process.stdout.write(errOutput);
    return { ok: false, taskId: '' };
  }

  if (!taskId) {
    printError('Could not determine task ID from `task new` output.');
    return { ok: false, taskId: '' };
  }

  // Run "task import TASK-NNN <file>"
  const importCmd = `fugue task import ${taskId} "${path.resolve(file)}"`;

  console.log(`  ${chalk.dim('\u2192')} ${chalk.dim(importCmd)}`);

  const ok = runActionInteractive(importCmd);
  return { ok, taskId };
}

/**
 * Prompt for gate step: Continue? [Y/n/skip]
 */
async function promptGate(): Promise<boolean | 'skip'> {
  const { select } = await import('@inquirer/prompts');
  const answer = await select<'yes' | 'no' | 'skip'>({
    message: 'Continue?',
    choices: [
      { value: 'yes', name: 'Yes — proceed to next step' },
      { value: 'skip', name: 'Skip — skip this step' },
      { value: 'no', name: 'No — stop workflow' },
    ],
    default: 'yes',
  });

  if (answer === 'skip') return 'skip';
  return answer === 'yes';
}

/**
 * Prompt for manual step: Done? [Y/n]
 */
async function promptManual(step: WorkflowStep): Promise<boolean> {
  const { confirm } = await import('@inquirer/prompts');
  return confirm({
    message: `"${step.description}" — Done?`,
    default: true,
  });
}

/**
 * Prompt for assignee name.
 */
async function promptAssignee(): Promise<string | null> {
  const { input } = await import('@inquirer/prompts');
  const assignee = await input({
    message: 'Assign to:',
  });
  return assignee.trim() || null;
}
