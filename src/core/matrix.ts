/**
 * Traceability matrix utilities.
 */

import type { TraceMatrix, ReqSpec } from './project.js';

export function createEmptyMatrix(reqs: ReqSpec[]): TraceMatrix {
  const entries: TraceMatrix['entries'] = {};
  for (const req of reqs) {
    entries[req.id] = {
      code_refs: req.code_refs ?? [],
      test_refs: req.test_refs ?? [],
    };
  }
  return {
    version: 1,
    created: new Date().toISOString(),
    entries,
  };
}

export function getMatrixCoverage(matrix: TraceMatrix | null): {
  codeMapped: number;
  testMapped: number;
  total: number;
} {
  if (!matrix || !matrix.entries) {
    return { codeMapped: 0, testMapped: 0, total: 0 };
  }

  const entries = Object.values(matrix.entries);
  return {
    codeMapped: entries.filter((e) => e.code_refs?.length > 0).length,
    testMapped: entries.filter((e) => e.test_refs?.length > 0).length,
    total: entries.length,
  };
}
