/**
 * fugue plan — Forward path: planning doc -> REQ IDs -> development.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireFugueDir,
  loadConfig,
  saveConfig,
  loadModels,
  loadSpecs,
  saveSpec,
  saveMatrix,
  type ReqSpec,
} from '../core/project.js';
import { getConductorAdapter } from '../models/registry.js';
import { createEmptyMatrix } from '../core/matrix.js';
import { DECOMPOSE_SYSTEM_PROMPT, buildDecomposePrompt } from '../prompts/decompose.js';
import { printSuccess, printError, printInfo, printWarning, createSpinner, printReqTable } from '../utils/display.js';

export const planCommand = new Command('plan')
  .description('Forward path: planning doc -> REQ IDs -> development');

planCommand
  .command('import <source>')
  .description('Import a planning document (Markdown file or Notion URL)')
  .action(async (source: string) => {
    try {
      const fugueDir = requireFugueDir();
      const isNotion = source.includes('notion.so') || source.includes('notion.site');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      let destPath: string;
      let lineCount: number;
      let displayName: string;

      if (isNotion) {
        // Notion URL → fetch and convert to markdown
        const spinner = createSpinner('Fetching from Notion...');
        spinner.start();

        try {
          const { notionPageToMarkdown } = await import('../core/notion.js');
          const { title, markdown } = await notionPageToMarkdown(source);

          const safeName = title.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 50);
          const destName = `${safeName}_${timestamp}.md`;
          destPath = path.join(fugueDir, 'plans', destName);
          fs.mkdirSync(path.join(fugueDir, 'plans'), { recursive: true });
          fs.writeFileSync(destPath, markdown, 'utf-8');

          lineCount = markdown.split('\n').length;
          displayName = title;
          spinner.succeed(`Fetched "${title}" from Notion (${lineCount} lines)`);
        } catch (err: unknown) {
          spinner.fail('Failed to fetch from Notion');
          printError(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      } else {
        // Local file
        const srcPath = path.resolve(source);

        if (!fs.existsSync(srcPath)) {
          printError(`File not found: ${source}`);
          process.exit(1);
        }

        const ext = path.extname(srcPath).toLowerCase();
        if (!['.md', '.txt', '.markdown'].includes(ext)) {
          printWarning(`Expected Markdown file, got ${ext}. Importing anyway.`);
        }

        const destName = `${path.parse(srcPath).name}_${timestamp}${ext}`;
        destPath = path.join(fugueDir, 'plans', destName);
        fs.mkdirSync(path.join(fugueDir, 'plans'), { recursive: true });
        fs.copyFileSync(srcPath, destPath);

        lineCount = fs.readFileSync(destPath, 'utf-8').split('\n').length;
        displayName = path.basename(srcPath);
      }

      // Update config
      const config = loadConfig(fugueDir);
      if (!config.plan) config.plan = {};
      config.plan.source = path.relative(fugueDir, destPath);
      config.plan.imported_at = new Date().toISOString();
      config.plan.original_path = isNotion ? source : path.resolve(source);
      saveConfig(fugueDir, config);

      printSuccess(`Imported ${displayName} (${lineCount} lines)`);
      console.log(`  ${chalk.dim(`Saved to .fugue/plans/${path.basename(destPath)}`)}`);
      console.log();
      console.log(`  ${chalk.dim('Next:')} ${chalk.cyan('fugue plan decompose')} — extract REQ IDs`);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

planCommand
  .command('decompose')
  .description('Decompose planning doc into REQ IDs using conductor model')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      const config = loadConfig(fugueDir);
      const registry = loadModels(fugueDir);

      const planSource = config.plan?.source;
      if (!planSource) {
        printError('No planning doc imported. Run `fugue plan import <file>` first.');
        process.exit(1);
      }

      const docPath = path.join(fugueDir, planSource);
      if (!fs.existsSync(docPath)) {
        printError(`Planning doc not found: ${docPath}`);
        process.exit(1);
      }

      const docContent = fs.readFileSync(docPath, 'utf-8');

      // Get conductor
      const adapter = getConductorAdapter(config.conductor, registry);
      printInfo(`Decomposing with ${chalk.yellow(adapter.name)}...`);

      const spinner = createSpinner('Extracting requirements...');
      spinner.start();

      const healthy = await adapter.checkHealth();
      if (!healthy) {
        spinner.fail('Conductor model is not reachable');
        process.exit(1);
      }

      let reqsData: Array<Record<string, unknown>>;
      try {
        const prompt = buildDecomposePrompt(docContent);
        reqsData = await adapter.generateJSON<Array<Record<string, unknown>>>(prompt, {
          system: DECOMPOSE_SYSTEM_PROMPT,
          maxTokens: 4096,
          temperature: 0.2,
        });
      } catch (err: unknown) {
        spinner.fail('Decomposition failed');
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      if (!Array.isArray(reqsData)) {
        spinner.fail('Model returned unexpected format');
        printError('Expected JSON array.');
        process.exit(1);
      }

      spinner.succeed(`${reqsData.length} requirements extracted`);

      // Save REQs
      const now = new Date().toISOString();
      const saved: ReqSpec[] = [];

      for (const raw of reqsData) {
        if (!raw.id) continue;
        const req: ReqSpec = {
          id: String(raw.id),
          title: String(raw.title ?? ''),
          priority: String(raw.priority ?? 'MEDIUM'),
          description: String(raw.description ?? ''),
          status: 'DRAFT',
          created: now,
          code_refs: [],
          test_refs: [],
          source: {
            file: planSource,
            section: String(raw.source_section ?? ''),
          },
        };
        saveSpec(fugueDir, req);
        saved.push(req);
      }

      console.log();
      printReqTable(saved, `Requirements (${saved.length})`);
      console.log();
      console.log(`  ${chalk.dim('Review the REQs above, then:')} ${chalk.cyan('fugue plan confirm')}`);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

planCommand
  .command('confirm')
  .description('Confirm all DRAFT REQs and start development phase')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      const reqs = loadSpecs(fugueDir);
      const draftReqs = reqs.filter((r) => r.status === 'DRAFT');

      if (draftReqs.length === 0) {
        printWarning('No DRAFT requirements to confirm.');
        const confirmed = reqs.filter((r) => r.status === 'CONFIRMED');
        if (confirmed.length > 0) {
          printInfo(`${confirmed.length} REQs already confirmed.`);
        }
        return;
      }

      printReqTable(draftReqs, `Confirming ${draftReqs.length} REQs`);
      console.log();

      // Prompt for confirmation
      const { confirm } = await import('@inquirer/prompts');
      const ok = await confirm({
        message: `Confirm all ${draftReqs.length} requirements?`,
        default: true,
      });

      if (!ok) {
        printInfo('Cancelled.');
        return;
      }

      // Update status
      const now = new Date().toISOString();
      for (const req of draftReqs) {
        req.status = 'CONFIRMED';
        req.confirmed_at = now;
        saveSpec(fugueDir, req);
      }

      // Create traceability matrix
      const matrix = createEmptyMatrix(draftReqs);
      saveMatrix(fugueDir, matrix);

      printSuccess(`${draftReqs.length} REQs confirmed. Development phase started.`);
      console.log();
      console.log(`  ${chalk.dim('Next:')}`);
      console.log(`  ${chalk.cyan('fugue status')}            — check progress`);
      console.log(`  ${chalk.cyan('fugue audit --quick')}     — run first audit`);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
