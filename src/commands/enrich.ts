/**
 * fugue enrich — L2 ai_context auto-generation.
 *
 * Reads code_refs source files, sends to Conductor model,
 * generates summary + key_rules + common_mistakes.
 *
 * REQs: PDET-005~008
 */

import fs from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireFugueDir,
  loadConfig,
  loadModels,
  loadSpecs,
  saveSpec,
  type ReqSpec,
  type AiContext,
} from '../core/project.js';
import { getConductorAdapter } from '../models/registry.js';
import { printSuccess, printError, printInfo, printWarning, createSpinner } from '../utils/display.js';

// =============================================
// Prompt
// =============================================

const ENRICH_SYSTEM_PROMPT = `You are a code analyst. Given source code files that implement a requirement, generate a concise AI context object.

Output ONLY valid JSON with these fields:
- "summary": one-line description of what this requirement does (under 100 chars, in the same language as the requirement title)
- "key_rules": array of 3-5 core business rules extracted from the code. Each rule should be a concise sentence describing a specific behavior or constraint.
- "common_mistakes": array of 2-4 common mistakes developers make when modifying this code. Each should warn about a specific pitfall.

Rules:
- Keep everything concise and actionable
- Extract rules from actual code behavior, not assumptions
- common_mistakes should be based on code complexity and edge cases you observe
- If the requirement title/description is in Korean, output in Korean
- Output ONLY the JSON object, no markdown, no explanation`;

function buildEnrichPrompt(req: ReqSpec, codeContents: string): string {
  return `Requirement: ${req.id} — ${req.title}
Description: ${req.description}

Source code files (${(req.code_refs ?? []).length} files):

${codeContents}

Generate the ai_context JSON for this requirement.`;
}

// =============================================
// Enrich engine
// =============================================

async function enrichReq(
  req: ReqSpec,
  conductorAdapter: { generate: (prompt: string, options?: { system?: string }) => Promise<string> },
): Promise<AiContext | null> {
  const codeRefs = req.code_refs ?? [];
  if (codeRefs.length === 0) return null;

  // Read code files (truncate large files)
  const maxPerFile = 3000;
  const codeContents = codeRefs
    .filter(ref => fs.existsSync(ref))
    .map(ref => {
      const content = fs.readFileSync(ref, 'utf-8');
      const truncated = content.length > maxPerFile
        ? content.slice(0, maxPerFile) + '\n// ... (truncated)'
        : content;
      return `--- ${ref} ---\n${truncated}`;
    })
    .join('\n\n');

  if (!codeContents.trim()) return null;

  const prompt = buildEnrichPrompt(req, codeContents);
  const raw = await conductorAdapter.generate(prompt, { system: ENRICH_SYSTEM_PROMPT });

  // Parse JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as AiContext;
    parsed.auto_generated = true;
    return parsed;
  } catch {
    return null;
  }
}

// =============================================
// CLI command
// =============================================

export const enrichCommand = new Command('enrich')
  .description('Generate ai_context for REQs from code analysis (PDET-005~008)')
  .argument('[req-id]', 'Specific REQ-ID to enrich')
  .option('--all', 'Enrich all REQs that exceed L2 threshold')
  .option('--dry-run', 'Show what would be enriched without saving')
  .option('--force', 'Overwrite existing ai_context (even manually edited)')
  .action(async (reqId: string | undefined, opts: { all?: boolean; dryRun?: boolean; force?: boolean }) => {
    try {
      const fuguePath = requireFugueDir();
      const config = loadConfig(fuguePath);
      const models = loadModels(fuguePath);
      const specs = loadSpecs(fuguePath);

      const l2Threshold = config.progressive_detail?.l2_threshold ?? 5;

      // Determine target REQs
      let targets: ReqSpec[];
      if (reqId) {
        const found = specs.find(s => s.id === reqId);
        if (!found) { printError(`REQ ${reqId} not found.`); process.exit(1); }
        targets = [found];
      } else if (opts.all) {
        targets = specs.filter(s => {
          const codeRefCount = (s.code_refs ?? []).length;
          const hasContext = s.ai_context && !opts.force;
          return codeRefCount >= l2Threshold && !hasContext;
        });
      } else {
        // Default: suggest candidates
        const candidates = specs.filter(s => {
          const level = s.detail_level ?? 1;
          const codeRefCount = (s.code_refs ?? []).length;
          return level < 2 && codeRefCount >= l2Threshold;
        });
        if (candidates.length === 0) {
          printInfo('No REQs eligible for enrichment.');
          return;
        }
        printInfo(`${candidates.length} REQs eligible for L2 enrichment:`);
        for (const c of candidates) {
          console.log(`  ${chalk.cyan(c.id)}: ${c.title} ${chalk.dim(`(code_refs: ${(c.code_refs ?? []).length})`)}`);
        }
        console.log(chalk.dim('\n  Run fugue enrich <REQ-ID> or fugue enrich --all'));
        return;
      }

      if (targets.length === 0) {
        printInfo('No REQs to enrich.');
        return;
      }

      // Skip manually edited ai_context unless --force (PDET-008)
      if (!opts.force) {
        targets = targets.filter(t => {
          if (t.ai_context && !t.ai_context.auto_generated) {
            printWarning(`${t.id}: ai_context manually edited, skipping (use --force to overwrite)`);
            return false;
          }
          return true;
        });
      }

      printInfo(`Enriching ${targets.length} REQ(s) with ${config.conductor ?? 'default'} model...`);
      const adapter = getConductorAdapter(config.conductor, models);

      let enriched = 0;
      for (const target of targets) {
        const spinner = createSpinner(`Enriching ${target.id}...`);
        spinner.start();

        try {
          const aiContext = await enrichReq(target, adapter);
          if (aiContext) {
            if (opts.dryRun) {
              spinner.succeed(`${target.id}: ${chalk.yellow('[dry-run]')}`);
              console.log(chalk.dim(JSON.stringify(aiContext, null, 2)));
            } else {
              target.ai_context = aiContext;
              target.detail_level = 2;
              saveSpec(fuguePath, target, 'fugue-enrich');
              spinner.succeed(`${target.id}: ai_context generated`);
            }
            enriched++;
          } else {
            spinner.warn(`${target.id}: no code files readable, skipped`);
          }
        } catch (err: unknown) {
          spinner.fail(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      printSuccess(`${enriched}/${targets.length} REQs enriched to L2`);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

export { enrichReq, ENRICH_SYSTEM_PROMPT };
