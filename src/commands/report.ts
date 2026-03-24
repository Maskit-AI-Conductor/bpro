/**
 * bpro report — Generate HTML progress report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireBproDir,
  loadConfig,
  loadSpecs,
  loadMatrix,
} from '../core/project.js';
import { countByStatus } from '../core/requirements.js';
import { getMatrixCoverage } from '../core/matrix.js';
import { buildDeliverables } from '../core/deliverables.js';
import { printSuccess, printError } from '../utils/display.js';

export const reportCommand = new Command('report')
  .description('Generate HTML progress report')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      const config = loadConfig(bproDir);
      const reqs = loadSpecs(bproDir);
      const matrix = loadMatrix(bproDir);
      const counts = countByStatus(reqs);
      const coverage = getMatrixCoverage(matrix);
      const deliverables = buildDeliverables(bproDir, config, reqs, matrix);

      const date = new Date().toISOString().slice(0, 10);
      const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bpro Report — ${config.project_name} (${date})</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #333; background: #fafafa; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; }
    .subtitle { color: #888; margin-bottom: 24px; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card h2 { font-size: 1.1rem; margin-bottom: 12px; color: #555; }
    .progress-bar { background: #e5e5e5; border-radius: 4px; height: 24px; overflow: hidden; margin-bottom: 8px; }
    .progress-fill { background: #22c55e; height: 100%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e5e5; color: #888; font-weight: 600; }
    td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
    .status { font-weight: 600; font-size: 0.8rem; text-transform: uppercase; }
    .status-done { color: #22c55e; }
    .status-dev { color: #eab308; }
    .status-confirmed { color: #3b82f6; }
    .status-draft { color: #999; }
    .status-stale { color: #ef4444; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .metric { text-align: center; }
    .metric .value { font-size: 2rem; font-weight: 700; color: #111; }
    .metric .label { font-size: 0.8rem; color: #888; }
    .del-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
    .del-icon { width: 20px; text-align: center; }
    .del-id { color: #3b82f6; font-weight: 600; width: 40px; }
    .del-name { flex: 1; }
    .del-detail { color: #888; font-size: 0.85rem; }
    footer { text-align: center; color: #aaa; font-size: 0.8rem; margin-top: 40px; padding: 20px 0; }
  </style>
</head>
<body>
  <h1>${config.project_name}</h1>
  <div class="subtitle">bpro Report — Generated ${date}</div>

  <div class="card">
    <h2>Progress</h2>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${pct}%">${pct}%</div>
    </div>
    <div class="grid" style="margin-top: 16px;">
      <div class="metric"><div class="value">${counts.done}/${counts.total}</div><div class="label">REQs Done</div></div>
      <div class="metric"><div class="value">${coverage.codeMapped}/${coverage.total}</div><div class="label">Code Mapped</div></div>
      <div class="metric"><div class="value">${coverage.testMapped}/${coverage.total}</div><div class="label">Tests Mapped</div></div>
      <div class="metric"><div class="value">${counts.stale}</div><div class="label">Stale</div></div>
    </div>
  </div>

  <div class="card">
    <h2>Deliverables</h2>
    ${Object.entries(deliverables).map(([id, d]) => {
      const iconMap: Record<string, string> = { done: '\u2713', wip: '\u25C9', warn: '\u25B3', pending: '\u25CB', stale: '!' };
      return `<div class="del-row"><span class="del-icon">${iconMap[d.icon] ?? '\u25CB'}</span><span class="del-id">${id}</span><span class="del-name">${d.name}</span><span class="del-detail">${d.detail}</span></div>`;
    }).join('\n    ')}
  </div>

  <div class="card">
    <h2>Requirements</h2>
    <table>
      <thead><tr><th>ID</th><th>Status</th><th>Priority</th><th>Title</th></tr></thead>
      <tbody>
        ${reqs.map((r) => {
          const cls = `status-${r.status.toLowerCase()}`;
          return `<tr><td>${r.id}</td><td class="status ${cls}">${r.status}</td><td>${r.priority}</td><td>${r.title}</td></tr>`;
        }).join('\n        ')}
      </tbody>
    </table>
  </div>

  <footer>Generated by bpro v0.2.0 — Beyond Prototype</footer>
</body>
</html>`;

      const reportsDir = path.join(bproDir, 'reports');
      fs.mkdirSync(reportsDir, { recursive: true });
      const reportPath = path.join(reportsDir, `${date}-progress.html`);
      fs.writeFileSync(reportPath, html, 'utf-8');

      printSuccess(`Report generated: .bpro/reports/${date}-progress.html`);
      console.log();
      console.log(`  ${chalk.cyan(`open ${reportPath}`)}`);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
