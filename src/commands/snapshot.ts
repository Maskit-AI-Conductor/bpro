/**
 * bpro snapshot — Conductor-based reverse-engineering.
 *
 * Workflow:
 * 1. conductor analyzes project structure + code
 * 2. aiops assigns models to generated agent roles
 * 3. domain-analyst agents extract REQs per domain
 * 4. auditor cross-validates
 * 5. results saved to .bpro/
 */

import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireBproDir,
  loadConfig,
  loadModels,
  saveSpec,
  saveMatrix,
  type ReqSpec,
  type TraceMatrix,
} from '../core/project.js';
import { getConductorAdapter, getAdapter } from '../models/registry.js';
import { runConductorAnalysis, extractRequirements } from '../agents/conductor.js';
import { assignModels } from '../agents/aiops.js';
import { saveAgentDef, appendAgentLog } from '../agents/runner.js';
import { printSuccess, printError, printInfo, createSpinner, printReqTable } from '../utils/display.js';
import { minimatch } from '../utils/glob.js';

const MAX_FILE_SIZE = 50_000;
const MAX_BATCH_CHARS = 15_000;

export const snapshotCommand = new Command('snapshot')
  .description('Reverse-engineer codebase into requirements (conductor-based)')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      const config = loadConfig(bproDir);
      const registry = loadModels(bproDir);
      const root = path.dirname(bproDir);

      // 1. Get conductor
      const conductorAdapter = getConductorAdapter(config.conductor, registry);
      printInfo(`Conductor: ${chalk.yellow(conductorAdapter.name)}`);

      // 2. Scan files
      const files = scanFiles(root, config);
      if (files.length === 0) {
        printError('No source files found. Check scan.include in .bpro/config.yaml');
        process.exit(1);
      }
      printInfo(`Found ${files.length} source files`);

      // 3. Health check
      const healthSpinner = createSpinner('Checking conductor...');
      healthSpinner.start();
      const healthy = await conductorAdapter.checkHealth();
      if (!healthy) {
        healthSpinner.fail('Conductor model is not reachable');
        process.exit(1);
      }
      healthSpinner.succeed('Conductor ready');

      // 4. Conductor analyzes project
      const analysisSpinner = createSpinner('Conductor analyzing project structure...');
      analysisSpinner.start();
      const startTime = new Date().toISOString();

      const fileContents = files.map((f) => ({
        path: path.relative(root, f),
        content: fs.readFileSync(f, 'utf-8'),
      }));

      let analysis;
      try {
        analysis = await runConductorAnalysis(conductorAdapter, fileContents, config.project_name);
        analysisSpinner.succeed(`Identified ${analysis.domains.length} domains, ${analysis.agent_roles.length} agent roles`);
      } catch (err: unknown) {
        analysisSpinner.fail('Conductor analysis failed');
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      // Log conductor
      appendAgentLog(bproDir, {
        agent: 'conductor',
        action: 'snapshot-analysis',
        model: conductorAdapter.name,
        started_at: startTime,
        completed_at: new Date().toISOString(),
        status: 'success',
        output_summary: `${analysis.domains.length} domains, ${analysis.agent_roles.length} roles`,
        details: analysis,
      });

      // 5. AIOps assigns models
      const assignments = assignModels(analysis.agent_roles, registry, config.conductor!);
      printInfo('Model assignments:');
      for (const a of assignments) {
        console.log(`  ${chalk.cyan(a.agentName.padEnd(20))} -> ${chalk.yellow(a.assignedModel)} (${chalk.dim(a.reason)})`);
      }

      // Save agent definitions
      for (const a of assignments) {
        const role = analysis.agent_roles.find((r) => r.name === a.agentName);
        saveAgentDef(bproDir, {
          name: a.agentName,
          type: a.agentType,
          scope: role?.scope ?? '',
          assigned_model: a.assignedModel,
          created_at: new Date().toISOString(),
        });
      }

      // 6. Extract requirements per domain
      const allReqs: ReqSpec[] = [];
      let reqCounter = 1;

      for (const domain of analysis.domains) {
        const domainAnalyst = assignments.find(
          (a) => a.agentType === 'domain-analyst' && a.agentName.includes(domain.name),
        ) ?? assignments.find((a) => a.agentType === 'domain-analyst');

        const adapterName = domainAnalyst?.assignedModel ?? config.conductor!;
        const adapter = getAdapter(registry, adapterName);

        const domainFiles = fileContents.filter((f) =>
          domain.files.some((df) => {
            const fBase = path.basename(f.path);
            const dfBase = path.basename(df);
            return f.path.includes(df) || df.includes(f.path) || fBase === dfBase;
          }),
        );

        // If no files matched by name, assign all files to this domain as fallback
        const filesToAnalyze = domainFiles.length > 0 ? domainFiles : fileContents;
        if (domainFiles.length === 0 && analysis.domains.indexOf(domain) > 0) continue;

        const domainSpinner = createSpinner(`Analyzing domain: ${domain.name}...`);
        domainSpinner.start();

        const batches = batchFiles(filesToAnalyze);
        for (const batch of batches) {
          try {
            const batchReqs = await extractRequirements(adapter, batch, reqCounter);
            if (Array.isArray(batchReqs)) {
              for (const raw of batchReqs) {
                const req: ReqSpec = {
                  id: `REQ-${String(reqCounter).padStart(3, '0')}`,
                  title: String(raw.title ?? ''),
                  priority: String(raw.priority ?? 'MEDIUM'),
                  description: String(raw.description ?? ''),
                  status: 'DRAFT',
                  created: new Date().toISOString(),
                  code_refs: (raw.source_files as string[]) ?? [],
                  test_refs: [],
                  assigned_model: adapterName,
                };
                reqCounter++;
                allReqs.push(req);
              }
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            printInfo(`Batch error [${domain.name}]: ${msg.slice(0, 300)}`);
          }
        }

        domainSpinner.succeed(`${domain.name}: ${allReqs.filter((r) => r.assigned_model === adapterName).length} REQs`);

        appendAgentLog(bproDir, {
          agent: domainAnalyst?.agentName ?? 'domain-analyst',
          action: 'extract-requirements',
          model: adapterName,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          status: 'success',
          output_summary: `${domain.name}: ${domainFiles.length} files analyzed`,
        });
      }

      // If domains had no file matches, fallback to batch-all
      if (allReqs.length === 0 && fileContents.length > 0) {
        const fallbackSpinner = createSpinner('Fallback: analyzing all files...');
        fallbackSpinner.start();

        const batches = batchFiles(fileContents);
        for (const batch of batches) {
          try {
            const batchReqs = await extractRequirements(conductorAdapter, batch, reqCounter);
            if (Array.isArray(batchReqs)) {
              for (const raw of batchReqs) {
                const req: ReqSpec = {
                  id: `REQ-${String(reqCounter).padStart(3, '0')}`,
                  title: String(raw.title ?? ''),
                  priority: String(raw.priority ?? 'MEDIUM'),
                  description: String(raw.description ?? ''),
                  status: 'DRAFT',
                  created: new Date().toISOString(),
                  code_refs: (raw.source_files as string[]) ?? [],
                  test_refs: [],
                };
                reqCounter++;
                allReqs.push(req);
              }
            }
          } catch (err: unknown) {
            printInfo(`Fallback error: ${err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300)}`);
          }
        }
        fallbackSpinner.succeed(`Extracted ${allReqs.length} REQs`);
      }

      if (allReqs.length === 0) {
        printError('No requirements extracted. Try with different source files.');
        process.exit(1);
      }

      // 7. Save everything
      for (const req of allReqs) {
        saveSpec(bproDir, req);
      }

      const matrix: TraceMatrix = {
        version: 1,
        created: new Date().toISOString(),
        entries: Object.fromEntries(
          allReqs.map((r) => [r.id, { code_refs: r.code_refs ?? [], test_refs: [] }]),
        ),
      };
      saveMatrix(bproDir, matrix);

      console.log();
      printSuccess(`${allReqs.length} requirements reverse-engineered`);
      printReqTable(allReqs);
      console.log();
      console.log(`  ${chalk.dim('Review the REQs, then:')} ${chalk.cyan('bpro plan confirm')}`);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// --- Helpers ---

function scanFiles(root: string, config: { scan?: { include?: string[]; exclude?: string[] } }): string[] {
  const includes = config.scan?.include ?? ['**/*.py'];
  const excludes = config.scan?.exclude ?? [];
  const files: Set<string> = new Set();

  for (const pattern of includes) {
    for (const f of globSync(root, pattern)) {
      if (!fs.statSync(f).isFile()) continue;
      if (fs.statSync(f).size > MAX_FILE_SIZE) continue;
      const rel = path.relative(root, f);
      if (excludes.some((ex) => minimatch(rel, ex))) continue;
      files.add(f);
    }
  }

  return [...files].sort();
}

function globSync(root: string, pattern: string): string[] {
  // Simple recursive glob implementation
  const results: string[] = [];
  const parts = pattern.split('/');

  function walk(dir: string, partIdx: number): void {
    if (partIdx >= parts.length) return;

    const part = parts[partIdx];
    const isLast = partIdx === parts.length - 1;

    if (part === '**') {
      // Match any depth
      walk(dir, partIdx + 1);
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full, partIdx); // ** stays
          }
        }
      } catch {
        // permission error
      }
    } else {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (minimatch(entry.name, part)) {
            if (isLast) {
              results.push(full);
            } else if (entry.isDirectory()) {
              walk(full, partIdx + 1);
            }
          }
        }
      } catch {
        // permission error
      }
    }
  }

  walk(root, 0);
  return results;
}

function batchFiles(
  files: Array<{ path: string; content: string }>,
): Array<Array<{ path: string; content: string }>> {
  const batches: Array<Array<{ path: string; content: string }>> = [];
  let current: Array<{ path: string; content: string }> = [];
  let currentSize = 0;

  for (const f of files) {
    const entrySize = f.content.length + f.path.length + 50;
    if (currentSize + entrySize > MAX_BATCH_CHARS && current.length > 0) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(f);
    currentSize += entrySize;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
