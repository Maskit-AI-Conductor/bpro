/**
 * fugue policy — L3 Policy document generation and import.
 *
 * generate: code → Policy MD reverse-generation
 * import:   Policy MD → REQ YAML + ai_context extraction
 *
 * REQs: PDET-004, PDET-009~012
 */

import fs from 'node:fs';
import path from 'node:path';
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
// Policy generation prompt (PDET-009)
// =============================================

const POLICY_SYSTEM_PROMPT = `You are a technical documentation expert. Given source code files that implement a requirement, generate a policy document in Markdown.

The document structure must be:
1. YAML frontmatter with: id, title, domain, version (1.0.0), decision_status (draft), code_refs, ai_context (summary, key_rules, common_mistakes)
2. Overview section (1 paragraph)
3. Business Rules section — each rule as a subsection with:
   - Rule ID (POL-{DOMAIN}-{NNN})
   - Condition → Action → Result format
   - Code snippet (2-5 lines of the most relevant code)
   - File:line reference
4. Error Cases section — known edge cases and how the code handles them
5. Related Policies section (empty if none)

Rules:
- Extract rules from ACTUAL code behavior
- Code snippets must be real excerpts, not fabricated
- If the requirement is in Korean, write the document in Korean
- Keep it concise: aim for 80-150 lines total
- Output ONLY the markdown document, no wrapping`;

function buildPolicyPrompt(req: ReqSpec, codeContents: string): string {
  const domain = req.id.match(/^REQ-([A-Z]+)-/)?.[1] ?? 'GENERAL';
  return `Requirement: ${req.id} — ${req.title}
Description: ${req.description}
Domain: ${domain}

Source code (${(req.code_refs ?? []).length} files):

${codeContents}

Generate the policy document.`;
}

// =============================================
// Policy import prompt (PDET-004)
// =============================================

const IMPORT_SYSTEM_PROMPT = `You are a requirements analyst. Given a policy document, extract a JSON object with:
- "title": requirement title (under 60 chars)
- "description": one sentence describing the testable behavior
- "priority": HIGH, MEDIUM, or LOW
- "ai_context": { "summary": string, "key_rules": string[], "common_mistakes": string[] }

Output ONLY the JSON object.`;

// =============================================
// CLI command
// =============================================

export const policyCommand = new Command('policy')
  .description('Policy document generation and import (PDET-004, 009~012)');

// --- policy generate ---

policyCommand
  .command('generate [req-id]')
  .description('Generate Policy MD from code (L3)')
  .option('--all', 'Generate for all REQs exceeding L3 threshold')
  .option('--force', 'Overwrite existing policies')
  .action(async (reqId: string | undefined, opts: { all?: boolean; force?: boolean }) => {
    try {
      const fuguePath = requireFugueDir();
      const config = loadConfig(fuguePath);
      const models = loadModels(fuguePath);
      const specs = loadSpecs(fuguePath);

      const l3Threshold = config.progressive_detail?.l3_threshold ?? 10;

      let targets: ReqSpec[];
      if (reqId) {
        const found = specs.find(s => s.id === reqId);
        if (!found) { printError(`REQ ${reqId} not found.`); process.exit(1); }
        targets = [found];
      } else if (opts.all) {
        targets = specs.filter(s => {
          const codeRefCount = (s.code_refs ?? []).length;
          const hasPolicy = s.policy_ref && !opts.force;
          return codeRefCount >= l3Threshold && !hasPolicy;
        });
      } else {
        const candidates = specs.filter(s => {
          const level = s.detail_level ?? 1;
          const codeRefCount = (s.code_refs ?? []).length;
          return level < 3 && codeRefCount >= l3Threshold;
        });
        if (candidates.length === 0) {
          printInfo('No REQs eligible for L3 policy generation.');
          return;
        }
        printInfo(`${candidates.length} REQs eligible:`);
        for (const c of candidates) {
          console.log(`  ${chalk.cyan(c.id)}: ${c.title} ${chalk.dim(`(code_refs: ${(c.code_refs ?? []).length})`)}`);
        }
        console.log(chalk.dim('\n  Run fugue policy generate <REQ-ID> or fugue policy generate --all'));
        return;
      }

      if (targets.length === 0) {
        printInfo('No REQs to generate policies for.');
        return;
      }

      const adapter = getConductorAdapter(config.conductor, models);
      const policiesDir = path.join(fuguePath, 'policies');

      let generated = 0;
      for (const target of targets) {
        const spinner = createSpinner(`Generating policy for ${target.id}...`);
        spinner.start();

        try {
          const codeRefs = target.code_refs ?? [];
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

          if (!codeContents.trim()) {
            spinner.warn(`${target.id}: no readable code files, skipped`);
            continue;
          }

          const prompt = buildPolicyPrompt(target, codeContents);
          const policyContent = await adapter.generate(prompt, { system: POLICY_SYSTEM_PROMPT });

          // Save policy (PDET-012: DRAFT status)
          const domain = (target.id.match(/^REQ-([A-Z]+)-/)?.[1] ?? 'general').toLowerCase();
          const domainDir = path.join(policiesDir, domain);
          fs.mkdirSync(domainDir, { recursive: true });

          const policyName = target.id.toLowerCase().replace(/^req-/, '').replace(/-/g, '_');
          const policyPath = path.join(domainDir, `${policyName}.md`);

          if (fs.existsSync(policyPath) && !opts.force) {
            spinner.warn(`${target.id}: policy exists, skipping (use --force)`);
            continue;
          }

          fs.writeFileSync(policyPath, policyContent, 'utf-8');

          // Update REQ
          const relPath = path.relative(fuguePath, policyPath);
          target.policy_ref = relPath;
          target.detail_level = 3;
          saveSpec(fuguePath, target, 'fugue-policy');

          spinner.succeed(`${target.id}: ${relPath}`);
          generated++;
        } catch (err: unknown) {
          spinner.fail(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      printSuccess(`${generated} policies generated in .fugue/policies/`);
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// --- policy import (PDET-004) ---

policyCommand
  .command('import <file>')
  .description('Import existing Policy MD → extract REQ + ai_context')
  .action(async (file: string) => {
    try {
      const fuguePath = requireFugueDir();
      const config = loadConfig(fuguePath);
      const models = loadModels(fuguePath);

      if (!fs.existsSync(file)) {
        printError(`File not found: ${file}`);
        process.exit(1);
      }

      const content = fs.readFileSync(file, 'utf-8');
      printInfo(`Importing policy from ${file} (${content.split('\n').length} lines)`);

      const adapter = getConductorAdapter(config.conductor, models);
      const spinner = createSpinner('Extracting REQ from policy...');
      spinner.start();

      const raw = await adapter.generate(
        `Policy document:\n\n${content}\n\nExtract the requirement JSON.`,
        { system: IMPORT_SYSTEM_PROMPT },
      );

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        spinner.fail('Could not parse JSON from model response');
        process.exit(1);
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        title: string;
        description: string;
        priority: string;
        ai_context: AiContext;
      };

      // Generate REQ ID from filename
      const basename = path.basename(file, '.md').replace(/[^a-zA-Z0-9-]/g, '-').toUpperCase();
      const reqId = `REQ-${basename}-001`;

      const req: ReqSpec = {
        id: reqId,
        title: parsed.title,
        priority: parsed.priority ?? 'MEDIUM',
        description: parsed.description,
        status: 'DRAFT',
        created: new Date().toISOString(),
        detail_level: 3,
        ai_context: { ...parsed.ai_context, auto_generated: true },
        policy_ref: path.relative(fuguePath, path.resolve(file)),
        code_refs: [],
        test_refs: [],
      };

      saveSpec(fuguePath, req);
      spinner.succeed(`Created ${req.id}: ${req.title}`);
      printInfo(`Policy linked: ${req.policy_ref}`);
      printSuccess('Import complete. Review and adjust the REQ ID if needed.');
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// --- policy list ---

policyCommand
  .command('list')
  .description('List all policy documents')
  .action(async () => {
    try {
      const fuguePath = requireFugueDir();
      const policiesDir = path.join(fuguePath, 'policies');

      if (!fs.existsSync(policiesDir)) {
        printInfo('No policies directory. Run fugue policy generate to create policies.');
        return;
      }

      const domains = fs.readdirSync(policiesDir).filter(d =>
        fs.statSync(path.join(policiesDir, d)).isDirectory(),
      );

      let total = 0;
      for (const domain of domains) {
        const files = fs.readdirSync(path.join(policiesDir, domain)).filter(f => f.endsWith('.md'));
        if (files.length === 0) continue;
        console.log(`\n  ${chalk.bold(domain.toUpperCase())} (${files.length})`);
        for (const file of files) {
          console.log(`    ${chalk.dim('policies/' + domain + '/')}${file}`);
          total++;
        }
      }

      if (total === 0) {
        printInfo('No policies found.');
      } else {
        console.log(`\n  Total: ${total} policies`);
      }
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
    }
  });
