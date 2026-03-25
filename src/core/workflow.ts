/**
 * Workflow engine — define and run repeatable multi-step processes.
 *
 * Built-in workflows: feature, bugfix, reverse, review.
 * Custom workflows: .fugue/workflows/<name>.yaml
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadYaml, saveYaml } from '../utils/yaml.js';

// =============================================
// Types
// =============================================

export interface WorkflowStep {
  action: string;
  type: 'auto' | 'gate' | 'manual';
  description: string;
}

export interface WorkflowDef {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

// =============================================
// Built-in workflows
// =============================================

export const BUILTIN_WORKFLOWS: WorkflowDef[] = [
  {
    name: 'feature',
    description: 'New feature request workflow',
    steps: [
      { action: 'new+import', type: 'auto', description: 'Create task and import planning doc' },
      { action: 'validate', type: 'gate', description: 'Validate planning doc quality. Pause if issues found.' },
      { action: 'decompose', type: 'gate', description: 'Decompose into REQ IDs. Review before proceeding.' },
      { action: 'confirm', type: 'manual', description: 'Requester confirms REQs.' },
      { action: 'assign', type: 'manual', description: 'Assign worker(s).' },
      { action: 'done', type: 'gate', description: 'Auto-verify REQs. Review results.' },
      { action: 'deliver', type: 'auto', description: 'Generate delivery report.' },
    ],
  },
  {
    name: 'bugfix',
    description: 'Bug fix workflow (lighter process)',
    steps: [
      { action: 'new+import', type: 'auto', description: 'Create task and import planning doc' },
      { action: 'decompose', type: 'gate', description: 'Decompose into REQ IDs. Review before proceeding.' },
      { action: 'confirm', type: 'manual', description: 'Requester confirms REQs.' },
      { action: 'assign', type: 'manual', description: 'Assign worker(s).' },
      { action: 'done', type: 'gate', description: 'Auto-verify REQs. Review results.' },
      { action: 'deliver', type: 'auto', description: 'Generate delivery report.' },
    ],
  },
  {
    name: 'reverse',
    description: 'Reverse-engineer existing codebase',
    steps: [
      { action: 'snapshot', type: 'auto', description: 'Run snapshot analysis on codebase' },
      { action: 'snapshot-review', type: 'gate', description: 'Review staging changes vs existing specs' },
      { action: 'snapshot-apply', type: 'auto', description: 'Apply staging to specs' },
      { action: 'diagnose', type: 'auto', description: 'Diagnose project size and methodology' },
    ],
  },
  {
    name: 'review',
    description: 'Regular audit and report',
    steps: [
      { action: 'audit', type: 'auto', description: 'Run audit with gate scoring' },
      { action: 'report', type: 'auto', description: 'Generate report' },
    ],
  },
];

// =============================================
// Workflow loading
// =============================================

/**
 * Get a workflow by name. Checks built-in first, then custom.
 */
export function getWorkflow(name: string, fugueDir: string): WorkflowDef | null {
  // Check built-in
  const builtin = BUILTIN_WORKFLOWS.find((w) => w.name === name);
  if (builtin) return builtin;

  // Check custom
  return loadCustomWorkflow(name, fugueDir);
}

/**
 * Load a custom workflow from .fugue/workflows/<name>.yaml
 */
export function loadCustomWorkflow(name: string, fugueDir: string): WorkflowDef | null {
  const filePath = path.join(fugueDir, 'workflows', `${name}.yaml`);
  return loadYaml<WorkflowDef>(filePath);
}

/**
 * List all custom workflows from .fugue/workflows/
 */
export function listCustomWorkflows(fugueDir: string): WorkflowDef[] {
  const workflowsDir = path.join(fugueDir, 'workflows');
  if (!fs.existsSync(workflowsDir)) return [];

  const files = fs.readdirSync(workflowsDir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();

  const workflows: WorkflowDef[] = [];
  for (const file of files) {
    const wf = loadYaml<WorkflowDef>(path.join(workflowsDir, file));
    if (wf && wf.name && wf.steps) {
      workflows.push(wf);
    }
  }
  return workflows;
}

/**
 * Save a custom workflow to .fugue/workflows/<name>.yaml
 */
export function saveCustomWorkflow(fugueDir: string, workflow: WorkflowDef): void {
  const workflowsDir = path.join(fugueDir, 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });
  saveYaml(path.join(workflowsDir, `${workflow.name}.yaml`), workflow);
}

// =============================================
// Action-to-command mapping
// =============================================

/**
 * Build the CLI command string for a given action.
 * Returns null if the action requires special handling (e.g., new+import needs two commands).
 */
export function actionToCommands(
  action: string,
  taskId?: string,
  extraArgs?: { file?: string; requester?: string; assignee?: string },
): string[] {
  const tid = taskId ?? '';

  switch (action) {
    case 'new+import': {
      const title = extraArgs?.file ? path.parse(extraArgs.file).name : 'untitled';
      const requesterArg = extraArgs?.requester ? ` --requester "${extraArgs.requester}"` : '';
      // new+import returns two commands; the caller must capture taskId from the first
      return [
        `fugue task new "${title}"${requesterArg}`,
        `fugue task import ${tid} "${extraArgs?.file ?? ''}"`,
      ];
    }
    case 'validate':
      return [`fugue task validate ${tid}`];
    case 'decompose':
      return [`fugue task decompose ${tid}`];
    case 'confirm':
      return [`fugue task confirm ${tid}`];
    case 'assign': {
      const assigneeArg = extraArgs?.assignee ? ` --to "${extraArgs.assignee}"` : '';
      return [`fugue task assign ${tid}${assigneeArg}`];
    }
    case 'done':
      return [`fugue task done ${tid}`];
    case 'deliver':
      return [`fugue task report ${tid}`];
    case 'snapshot':
      return ['fugue snapshot'];
    case 'snapshot-review':
      return ['fugue snapshot review'];
    case 'snapshot-apply':
      return ['fugue snapshot apply'];
    case 'diagnose':
      return ['fugue diagnose'];
    case 'audit':
      return ['fugue gate'];
    case 'report':
      return ['fugue deliver'];
    default:
      // Custom action — try running as-is
      return [`fugue ${action} ${tid}`.trim()];
  }
}
