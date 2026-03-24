/**
 * Terminal display utilities — chalk + ora based output.
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export function printSuccess(msg: string): void {
  console.log(`${chalk.green.bold('OK')} ${msg}`);
}

export function printWarning(msg: string): void {
  console.log(`${chalk.yellow.bold('WARN')} ${msg}`);
}

export function printError(msg: string): void {
  console.error(`${chalk.red.bold('ERR')} ${msg}`);
}

export function printInfo(msg: string): void {
  console.log(`${chalk.blue('>')} ${msg}`);
}

export function createSpinner(text: string): Ora {
  return ora({ text, color: 'cyan' });
}

export interface ReqSummary {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  DRAFT: chalk.dim,
  CONFIRMED: chalk.blue,
  DEV: chalk.yellow,
  DONE: chalk.green,
  DEPRECATED: chalk.dim.strikethrough,
  STALE: chalk.red,
};

const PRIORITY_COLORS: Record<string, (s: string) => string> = {
  HIGH: chalk.red,
  MEDIUM: chalk.yellow,
  LOW: chalk.dim,
};

export function printReqTable(reqs: ReqSummary[], title?: string): void {
  if (title) {
    console.log();
    console.log(`  ${chalk.bold(title)}`);
  }
  console.log();

  const idW = 10;
  const statusW = 12;
  const prioW = 8;

  console.log(
    `  ${chalk.dim(pad('ID', idW))}${chalk.dim(pad('Status', statusW))}${chalk.dim(pad('Prio', prioW))}${chalk.dim('Title')}`
  );
  console.log(`  ${chalk.dim('-'.repeat(60))}`);

  for (const req of reqs) {
    const statusFn = STATUS_COLORS[req.status ?? ''] ?? chalk.white;
    const prioFn = PRIORITY_COLORS[req.priority ?? ''] ?? chalk.white;
    console.log(
      `  ${chalk.cyan(pad(req.id, idW))}${statusFn(pad(req.status ?? '', statusW))}${prioFn(pad(req.priority ?? '', prioW))}${req.title ?? ''}`
    );
  }
}

export function printProgressBar(done: number, total: number, label: string = 'Progress'): void {
  if (total === 0) {
    console.log(`  ${label}: no items`);
    return;
  }
  const pct = done / total;
  const filled = Math.round(pct * 15);
  const bar = chalk.green('\u2588'.repeat(filled)) + '\u2591'.repeat(15 - filled);
  console.log(`  ${bar}  ${done}/${total} ${label} (${Math.round(pct * 100)}%)`);
}

interface Deliverable {
  name: string;
  icon: string;
  detail: string;
}

const STATUS_ICONS: Record<string, string> = {
  done: chalk.green('\u2713'),
  wip: chalk.yellow('\u25C9'),
  warn: chalk.yellow('\u25B3'),
  pending: chalk.dim('\u25CB'),
  stale: chalk.red('!'),
};

export function printDeliverableTree(deliverables: Record<string, Deliverable>): void {
  console.log();
  console.log(`  ${chalk.blue.bold('Deliverables')}`);
  console.log(`  ${chalk.dim('-'.repeat(50))}`);

  for (const [id, info] of Object.entries(deliverables)) {
    const icon = STATUS_ICONS[info.icon] ?? STATUS_ICONS.pending;
    console.log(`  ${chalk.cyan(pad(id, 6))}${pad(info.name, 25)}${icon} ${info.detail}`);
  }
  console.log();
}

function pad(s: string, width: number): string {
  return s.padEnd(width);
}
