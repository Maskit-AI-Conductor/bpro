/**
 * fugue verify — Regression detection.
 *
 * Maps changed files back to REQs, warns about missing tests.
 *
 * REQs: VRFY-001~003
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  requireFugueDir,
  loadSpecs,
  type ReqSpec,
} from '../core/project.js';
import { printSuccess, printError, printInfo, printWarning } from '../utils/display.js';

// =============================================
// Changed file detection
// =============================================

function getChangedFiles(since?: string): string[] {
  const sinceArg = since ? `${since}..HEAD` : 'HEAD~10..HEAD';
  try {
    const output = execSync(
      `git diff --name-only ${sinceArg}`,
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
    );
    return output.split('\n').filter(Boolean);
  } catch {
    // Fallback: unstaged changes
    try {
      const output = execSync('git diff --name-only', { encoding: 'utf-8' });
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

// =============================================
// Reverse mapping: file → REQs (VRFY-002)
// =============================================

interface VerifyResult {
  reqId: string;
  title: string;
  changedFiles: string[];
  testStatus: 'HAS_TESTS' | 'NO_TEST';
  testRefs: string[];
}

function reverseMap(specs: ReqSpec[], changedFiles: string[]): VerifyResult[] {
  const results: VerifyResult[] = [];
  const changedSet = new Set(changedFiles);

  for (const spec of specs) {
    const codeRefs = spec.code_refs ?? [];
    const affected = codeRefs.filter(ref => changedSet.has(ref));

    if (affected.length > 0) {
      const testRefs = spec.test_refs ?? [];
      results.push({
        reqId: spec.id,
        title: spec.title,
        changedFiles: affected,
        testStatus: testRefs.length > 0 ? 'HAS_TESTS' : 'NO_TEST',
        testRefs,
      });
    }
  }

  return results;
}

// =============================================
// CLI command
// =============================================

export const verifyCommand = new Command('verify')
  .description('Check regression risk — map changed files to REQs and test coverage (VRFY-001~003)')
  .option('--since <commit>', 'Check changes since this commit (default: HEAD~10)')
  .action(async (opts: { since?: string }) => {
    try {
      const fuguePath = requireFugueDir();
      const specs = loadSpecs(fuguePath);

      // VRFY-003: check if matrix has any data
      const hasAnyRefs = specs.some(s => (s.code_refs ?? []).length > 0);
      if (!hasAnyRefs) {
        printWarning('No code_refs in any REQ. Run fugue sync first to populate the traceability matrix.');
        return;
      }

      printInfo('Detecting changed files...');
      const changedFiles = getChangedFiles(opts.since);

      if (changedFiles.length === 0) {
        printInfo('No changed files detected.');
        return;
      }

      printInfo(`${changedFiles.length} files changed`);

      const results = reverseMap(specs, changedFiles);

      if (results.length === 0) {
        printSuccess('No REQs affected by recent changes.');
        return;
      }

      // Display results
      console.log();
      const noTest = results.filter(r => r.testStatus === 'NO_TEST');
      const hasTest = results.filter(r => r.testStatus === 'HAS_TESTS');

      for (const r of hasTest) {
        console.log(`  ${chalk.green('✅')} ${r.reqId}: ${r.title} ${chalk.dim(`(${r.testRefs.length} tests)`)}`);
      }
      for (const r of noTest) {
        console.log(`  ${chalk.red('⚠')}  ${r.reqId}: ${r.title} ${chalk.red('NO_TEST')}`);
        for (const f of r.changedFiles) {
          console.log(`     ${chalk.dim(f)}`);
        }
      }

      console.log();
      printSuccess(
        `${results.length} REQs affected, ` +
        `${hasTest.length} with tests, ` +
        `${noTest.length} NO_TEST`,
      );

      if (noTest.length > 0) {
        printWarning(`Add tests for: ${noTest.map(r => r.reqId).join(', ')}`);
      }
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// Export for MCP reuse
export { getChangedFiles, reverseMap, type VerifyResult };
