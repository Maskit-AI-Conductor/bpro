/**
 * Deliverable tree computation.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { BproConfig, ReqSpec, TraceMatrix } from './project.js';
import { countByStatus } from './requirements.js';
import { getMatrixCoverage } from './matrix.js';

export interface Deliverable {
  name: string;
  icon: string;
  detail: string;
}

export function buildDeliverables(
  bproPath: string,
  config: BproConfig,
  reqs: ReqSpec[],
  matrix: TraceMatrix | null,
): Record<string, Deliverable> {
  const counts = countByStatus(reqs);
  const coverage = getMatrixCoverage(matrix);
  const confirmed = counts.confirmed + counts.dev + counts.done;
  const hasPlan = Boolean(config.plan?.source);
  const hasSpecs = counts.total > 0;
  const hasConfirmed = confirmed > 0;

  // Check audit reports
  const reportsDir = path.join(bproPath, 'reports');
  let hasAudit = false;
  if (fs.existsSync(reportsDir)) {
    hasAudit = fs.readdirSync(reportsDir).some((f) => f.startsWith('audit-'));
  }

  return {
    'D.01': {
      name: 'Planning Doc',
      icon: hasPlan ? 'done' : 'pending',
      detail: hasPlan ? 'imported' : 'not imported',
    },
    'D.02': {
      name: 'Requirements',
      icon: hasConfirmed ? 'done' : hasSpecs ? 'wip' : 'pending',
      detail: hasConfirmed
        ? `${confirmed} confirmed`
        : hasSpecs
          ? `${counts.total} draft`
          : 'none',
    },
    'D.03': {
      name: 'Traceability Matrix',
      icon: coverage.codeMapped > 0 ? 'wip' : 'pending',
      detail: counts.total > 0 ? `${coverage.codeMapped}/${counts.total} mapped` : 'empty',
    },
    'D.04': {
      name: 'Design Doc',
      icon: 'pending',
      detail: 'optional',
    },
    'D.05': {
      name: 'Implementation',
      icon: counts.done > 0 ? 'wip' : 'pending',
      detail: counts.total > 0 ? `${counts.done}/${counts.total} done` : '--',
    },
    'D.06': {
      name: 'Tests',
      icon:
        coverage.testMapped > 0 && coverage.testMapped < counts.total
          ? 'warn'
          : coverage.testMapped === counts.total && counts.total > 0
            ? 'done'
            : 'pending',
      detail: counts.total > 0 ? `${coverage.testMapped}/${counts.total} pass` : '--',
    },
    'D.07': {
      name: 'Audit Report',
      icon: hasAudit ? 'done' : 'pending',
      detail: hasAudit ? 'gate run' : 'gate not run',
    },
    'D.08': {
      name: 'Progress Report',
      icon: 'pending',
      detail: 'not generated',
    },
  };
}
