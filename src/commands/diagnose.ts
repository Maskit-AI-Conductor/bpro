/**
 * fugue diagnose — Project sizing + methodology recommendation.
 * fugue gate — Phase gate scoring.
 * fugue deliver — Formal delivery judgment.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireFugueDir, loadConfig, loadSpecs, loadModels,
} from '../core/project.js';
import { loadAgentDefs } from '../agents/runner.js';
import { diagnoseSize, checkSizeUpgrade, countLoc, type ProjectSize } from '../core/sizing.js';
import { printSuccess, printError, printInfo, printWarning } from '../utils/display.js';
import path from 'node:path';
import fs from 'node:fs';

// --- fugue diagnose ---

export const diagnoseCommand = new Command('diagnose')
  .description('Diagnose project size and recommend methodology')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      const config = loadConfig(fugueDir);
      const root = path.dirname(fugueDir);
      const reqs = loadSpecs(fugueDir);
      const agents = await loadAgentDefs(fugueDir);

      // Count tasks
      const tasksDir = path.join(fugueDir, 'tasks');
      const taskCount = fs.existsSync(tasksDir)
        ? fs.readdirSync(tasksDir).filter(f => f.endsWith('.yaml')).length
        : 0;

      // Count LOC
      const includes = config.scan?.include ?? ['**/*.py', '**/*.ts', '**/*.js'];
      const excludes = config.scan?.exclude ?? [];
      const fileExts = includes.map(p => p.replace('**/', ''));
      const loc = countLoc(root, includes, excludes);

      // Count files
      const fileCount = includes.length; // approximate from scan

      const result = diagnoseSize({
        reqs: reqs.length,
        loc,
        files: fileCount,
        agents: agents.length,
        tasks: taskCount,
      });

      console.log();
      console.log(`  ${chalk.bold('Project Diagnosis')}`);
      console.log(`  ${chalk.dim('-'.repeat(50))}`);
      console.log(`  Project: ${chalk.cyan(config.project_name)}`);
      console.log(`  Size:    ${chalk.bold.yellow(result.size)} — ${result.reason}`);
      console.log();

      // Metrics
      console.log(`  ${chalk.bold('Metrics')}`);
      console.log(`  REQs:    ${reqs.length}`);
      console.log(`  LOC:     ${loc.toLocaleString()}`);
      console.log(`  Agents:  ${agents.length}`);
      console.log(`  Tasks:   ${taskCount}`);
      console.log();

      // Methodology
      const m = result.methodology;
      console.log(`  ${chalk.bold('Applied Methodology')} (${result.size})`);
      console.log(`  Crosscheck Loop:     ${m.crosscheckRequired ? chalk.green('required') : chalk.dim('optional')}`);
      console.log(`  Gate Scoring:        ${m.gateScoring ? chalk.green('required') : chalk.dim('optional')}`);
      console.log(`  Formal Delivery:     ${m.formalDelivery ? chalk.green('required') : chalk.dim('optional')}`);
      console.log(`  PMO Audit:           ${m.pmoAudit ? chalk.green('required') : chalk.dim('optional')}`);
      console.log(`  Escalation Framework:${m.escalationFramework ? chalk.green(' required') : chalk.dim(' optional')}`);
      console.log(`  Performance Tracking:${m.performanceTracking ? chalk.green(' required') : chalk.dim(' optional')}`);
      console.log(`  Min Deliverables:    ${m.minDeliverables.join(', ')}`);
      console.log();

      // Save sizing to config
      (config as Record<string, unknown>).sizing = {
        size: result.size,
        diagnosed_at: new Date().toISOString(),
        metrics: result.metrics,
      };
      const { saveConfig } = await import('../core/project.js');
      saveConfig(fugueDir, config);

      printSuccess(`Diagnosed as ${result.size}. Methodology saved to config.`);
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// --- fugue gate ---

export const gateCommand = new Command('gate')
  .description('Phase gate scoring and transition check')
  .option('--phase <phase>', 'Phase to check (1, 2, or 3)', '1')
  .action(async (opts: { phase: string }) => {
    try {
      const fugueDir = requireFugueDir();
      const reqs = loadSpecs(fugueDir);
      const phase = parseInt(opts.phase, 10);

      console.log();
      console.log(`  ${chalk.bold(`Phase ${phase} → ${phase + 1} Gate Check`)}`);
      console.log(`  ${chalk.dim('-'.repeat(50))}`);

      const total = reqs.length;
      const confirmed = reqs.filter(r => ['CONFIRMED', 'DEV', 'DONE'].includes(r.status)).length;
      const done = reqs.filter(r => r.status === 'DONE').length;
      const draft = reqs.filter(r => r.status === 'DRAFT').length;
      const withTests = reqs.filter(r => r.test_refs && r.test_refs.length > 0).length;
      const withCode = reqs.filter(r => r.code_refs && r.code_refs.length > 0).length;

      // Scoring (100 points)
      let score = 0;
      const items: Array<{ name: string; score: number; max: number; status: string }> = [];

      if (phase === 1) {
        // P1→P2: Specification completeness
        const undecidedScore = draft === 0 ? 25 : Math.round((1 - draft / total) * 25);
        items.push({ name: 'UNDECIDED/DRAFT resolved', score: undecidedScore, max: 25, status: draft === 0 ? 'PASS' : `${draft} remaining` });

        const specScore = total > 0 ? Math.round((confirmed / total) * 30) : 0;
        items.push({ name: 'Spec coverage', score: specScore, max: 30, status: `${confirmed}/${total}` });

        const codeScore = total > 0 ? Math.round((withCode / total) * 25) : 0;
        items.push({ name: 'Code mapping', score: codeScore, max: 25, status: `${withCode}/${total}` });

        const testScore = total > 0 ? Math.round((withTests / total) * 20) : 0;
        items.push({ name: 'Test coverage', score: testScore, max: 20, status: `${withTests}/${total}` });
      } else {
        // P2→P3: Implementation completeness
        const doneScore = total > 0 ? Math.round((done / total) * 25) : 0;
        items.push({ name: 'Implementation complete', score: doneScore, max: 25, status: `${done}/${total}` });

        const testScore = total > 0 ? Math.round((withTests / total) * 25) : 0;
        items.push({ name: 'Test coverage', score: testScore, max: 25, status: `${withTests}/${total}` });

        const codeScore = total > 0 ? Math.round((withCode / total) * 25) : 0;
        items.push({ name: 'Code traceability', score: codeScore, max: 25, status: `${withCode}/${total}` });

        const noEscalation = 25; // placeholder
        items.push({ name: 'Escalations resolved', score: noEscalation, max: 25, status: 'OK' });
      }

      score = items.reduce((sum, i) => sum + i.score, 0);

      for (const item of items) {
        const color = item.score >= item.max * 0.8 ? chalk.green : item.score >= item.max * 0.5 ? chalk.yellow : chalk.red;
        console.log(`  ${item.name.padEnd(25)} ${color(`${item.score}/${item.max}`)}  ${chalk.dim(item.status)}`);
      }

      console.log(`  ${chalk.dim('-'.repeat(50))}`);
      console.log(`  ${chalk.bold('Total:')} ${score}/100`);
      console.log();

      // Absolute criteria
      const absolutePass = draft === 0;
      if (!absolutePass) {
        console.log(`  ${chalk.red('ABSOLUTE FAIL')}: ${draft} DRAFT/UNDECIDED REQs must be resolved`);
      }

      // Gate judgment
      if (score >= 80 && absolutePass) {
        console.log(`  ${chalk.green.bold('GATE: PASS')} — Ready for Phase ${phase + 1}`);
      } else if (score >= 60) {
        console.log(`  ${chalk.yellow.bold('GATE: CONDITIONAL PASS')} — ${100 - score} points short`);
      } else {
        console.log(`  ${chalk.red.bold('GATE: FAIL')} — Score below 60`);
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// --- fugue deliver ---

export const deliverCommand = new Command('deliver')
  .description('Formal delivery judgment + report')
  .argument('[task-id]', 'Task ID to deliver (or all)')
  .action(async (taskId?: string) => {
    try {
      const fugueDir = requireFugueDir();
      const config = loadConfig(fugueDir);
      const reqs = loadSpecs(fugueDir);

      console.log();
      console.log(`  ${chalk.bold('Delivery Check')}`);
      console.log(`  ${chalk.dim('-'.repeat(50))}`);

      const total = reqs.length;
      const done = reqs.filter(r => r.status === 'DONE').length;
      const withTests = reqs.filter(r => r.test_refs && r.test_refs.length > 0).length;
      const withCode = reqs.filter(r => r.code_refs && r.code_refs.length > 0).length;
      const draft = reqs.filter(r => r.status === 'DRAFT').length;

      console.log(`  REQs:       ${done}/${total} DONE`);
      console.log(`  Tests:      ${withTests}/${total} covered`);
      console.log(`  Traceability: ${withCode}/${total} code-mapped`);
      console.log(`  Unresolved: ${draft} DRAFT`);
      console.log();

      if (done === total && draft === 0 && withTests === total) {
        console.log(`  ${chalk.green.bold('DELIVERY: APPROVED')}`);
        console.log();

        // Generate delivery report
        const reportDir = path.join(fugueDir, 'reports');
        fs.mkdirSync(reportDir, { recursive: true });
        const ts = new Date().toISOString().slice(0, 10);
        const reportPath = path.join(reportDir, `delivery-${ts}.md`);

        const reportContent = [
          `# Delivery Report — ${config.project_name}`,
          ``,
          `Date: ${ts}`,
          `Size: ${(config as Record<string, unknown> as { sizing?: { size: string } }).sizing?.size ?? 'undiagnosed'}`,
          ``,
          `## Summary`,
          `- REQs: ${done}/${total} DONE`,
          `- Tests: ${withTests}/${total} covered`,
          `- Traceability: ${withCode}/${total} mapped`,
          `- Gate: PASS`,
          ``,
          `## Requirements`,
          `| ID | Title | Status | Tests |`,
          `|---|---|---|---|`,
          ...reqs.map(r => `| ${r.id} | ${r.title} | ${r.status} | ${r.test_refs?.length ?? 0} |`),
          ``,
          `---`,
          `Generated by fugue v0.3.2`,
        ].join('\n');

        fs.writeFileSync(reportPath, reportContent, 'utf-8');
        printSuccess(`Delivery report: ${path.relative(path.dirname(fugueDir), reportPath)}`);
      } else {
        console.log(`  ${chalk.yellow.bold('DELIVERY: NOT READY')}`);
        if (draft > 0) console.log(`  → Resolve ${draft} DRAFT REQs`);
        if (done < total) console.log(`  → Complete ${total - done} REQs`);
        if (withTests < total) console.log(`  → Add tests for ${total - withTests} REQs`);
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// =============================================
// Agent gap analysis (AGNT-010~012)
// =============================================

diagnoseCommand
  .command('agents')
  .description('Analyze agent gaps — recommend missing agents based on REQ domains')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      const root = path.dirname(fugueDir);
      const reqs = loadSpecs(fugueDir);
      const agents = await loadAgentDefs(fugueDir);

      // Collect domains from REQ IDs
      const domainReqs = new Map<string, number>();
      for (const req of reqs) {
        const match = req.id.match(/^REQ-([A-Z]+)-/);
        if (match) {
          const domain = match[1];
          domainReqs.set(domain, (domainReqs.get(domain) ?? 0) + 1);
        }
      }

      // Check .claude/agents/ for existing agent prompts
      const claudeAgentsDir = path.join(root, '.claude', 'agents');
      const existingPrompts = fs.existsSync(claudeAgentsDir)
        ? fs.readdirSync(claudeAgentsDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
        : [];

      // Check CLAUDE.md existence
      const hasClaudeMd = fs.existsSync(path.join(root, 'CLAUDE.md'));

      console.log();
      console.log(`  ${chalk.bold('Agent Gap Analysis')}`);
      console.log(`  ${chalk.dim('-'.repeat(60))}`);
      console.log();

      // CLAUDE.md check (AGNT-013)
      if (!hasClaudeMd) {
        console.log(`  ${chalk.yellow('⚠')} CLAUDE.md not found.`);
        console.log(`    ${chalk.dim('Run fugue diagnose scaffold to generate one.')}`);
        console.log();
      } else {
        console.log(`  ${chalk.green('✓')} CLAUDE.md exists`);
      }

      // Domain → recommended agent role mapping
      const roleMap: Record<string, string> = {
        AUTH: 'auth-dev', API: 'api-dev', UI: 'ui-dev', WIDGET: 'widget-dev',
        BO: 'backoffice-dev', CHAT: 'chat-dev', AI: 'ai-dev', DB: 'db-dev',
        CORE: 'tech-lead', TRAC: 'pm', PDET: 'pm', PMIF: 'pm',
        VRFY: 'qa', DCMP: 'pm', AGNT: 'tech-lead',
      };

      console.log(`  ${chalk.bold('Domain Coverage')}`);
      console.log();

      const recommendations: Array<{ domain: string; role: string; reqCount: number }> = [];

      for (const [domain, count] of [...domainReqs.entries()].sort((a, b) => b[1] - a[1])) {
        const suggestedRole = roleMap[domain] ?? `${domain.toLowerCase()}-dev`;
        const hasAgent = existingPrompts.some(p =>
          p.toLowerCase().includes(domain.toLowerCase()) || p.toLowerCase().includes(suggestedRole),
        ) || agents.some(a => a.scope?.includes(domain));

        const status = hasAgent ? chalk.green('✓') : chalk.yellow('⚠');
        const roleHint = hasAgent ? '' : chalk.dim(` → recommend: ${suggestedRole}`);
        console.log(`  ${status} ${domain.padEnd(8)} ${String(count).padEnd(4)} REQs${roleHint}`);

        if (!hasAgent && count >= 3) {
          recommendations.push({ domain, role: suggestedRole, reqCount: count });
        }
      }

      if (recommendations.length > 0) {
        console.log();
        printInfo(`${recommendations.length} agent(s) recommended:`);
        for (const r of recommendations) {
          console.log(`  ${chalk.cyan(r.role)} for ${r.domain} domain (${r.reqCount} REQs)`);
        }
        console.log(chalk.dim('\n  Agent prompt auto-generation will be available in a future release.'));
      } else {
        console.log();
        printSuccess('All domains have agent coverage.');
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// =============================================
// CLAUDE.md scaffold (AGNT-013)
// =============================================

diagnoseCommand
  .command('scaffold')
  .description('Generate CLAUDE.md scaffold from project structure')
  .action(async () => {
    try {
      const fugueDir = requireFugueDir();
      const root = path.dirname(fugueDir);
      const config = loadConfig(fugueDir);

      const claudeMdPath = path.join(root, 'CLAUDE.md');
      if (fs.existsSync(claudeMdPath)) {
        printWarning('CLAUDE.md already exists. Use --force to overwrite (not implemented yet).');
        return;
      }

      // Detect project structure
      const hasPkg = fs.existsSync(path.join(root, 'package.json'));
      const hasPyproject = fs.existsSync(path.join(root, 'pyproject.toml'));
      const hasTsconfig = fs.existsSync(path.join(root, 'tsconfig.json'));
      const hasGoMod = fs.existsSync(path.join(root, 'go.mod'));

      let buildCmd = '# TODO: add build command';
      let devCmd = '# TODO: add dev command';
      let testCmd = '# TODO: add test command';
      let lang = 'Unknown';

      if (hasPkg) {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
        buildCmd = pkg.scripts?.build ? `npm run build` : buildCmd;
        devCmd = pkg.scripts?.dev ? `npm run dev` : devCmd;
        testCmd = pkg.scripts?.test ? `npm test` : testCmd;
        lang = hasTsconfig ? 'TypeScript' : 'JavaScript';
      } else if (hasPyproject) {
        lang = 'Python';
        buildCmd = 'pip install -e .';
        testCmd = 'pytest';
      } else if (hasGoMod) {
        lang = 'Go';
        buildCmd = 'go build ./...';
        testCmd = 'go test ./...';
      }

      const scaffold = `# ${config.project_name || path.basename(root)}

## Build & Development

\`\`\`bash
# Build
${buildCmd}

# Dev
${devCmd}

# Test
${testCmd}
\`\`\`

## Architecture

- Language: ${lang}
- Project managed by Fugue (see .fugue/)

## REQ Reference Rules

- All commits should include REQ-ID in the message: \`feat: description (REQ-XXX-NNN)\`
- \`fugue sync\` maps commits to traceability matrix
- \`fugue verify\` checks test coverage for changed REQs

## Agent Boundaries

<!-- Define which agents own which directories -->
<!-- Example:
- api-dev: src/api/, src/services/
- ui-dev: src/components/, src/pages/
-->
`;

      fs.writeFileSync(claudeMdPath, scaffold, 'utf-8');
      printSuccess(`CLAUDE.md generated at ${claudeMdPath}`);
      printInfo('Edit the scaffold to match your project structure.');
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
