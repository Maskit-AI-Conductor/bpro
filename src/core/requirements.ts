/**
 * Requirements management utilities.
 */

import { type ReqSpec } from './project.js';

export interface ReqCounts {
  total: number;
  done: number;
  dev: number;
  confirmed: number;
  draft: number;
  stale: number;
  deprecated: number;
}

export function countByStatus(reqs: ReqSpec[]): ReqCounts {
  const counts: ReqCounts = {
    total: reqs.length,
    done: 0,
    dev: 0,
    confirmed: 0,
    draft: 0,
    stale: 0,
    deprecated: 0,
  };

  for (const req of reqs) {
    switch (req.status) {
      case 'DONE': counts.done++; break;
      case 'DEV': counts.dev++; break;
      case 'CONFIRMED': counts.confirmed++; break;
      case 'DRAFT': counts.draft++; break;
      case 'STALE': counts.stale++; break;
      case 'DEPRECATED': counts.deprecated++; break;
    }
  }

  return counts;
}

export function formatReqId(n: number): string {
  return `REQ-${String(n).padStart(3, '0')}`;
}
