/**
 * AIOps agent — rule-based model assignment for each agent role.
 * No LLM needed — this is pure logic.
 */

import type { ModelsRegistry, ModelEntry } from '../core/project.js';
import type { AgentRole } from './conductor.js';
import { rankModels } from '../models/registry.js';

export interface ModelAssignment {
  agentName: string;
  agentType: string;
  assignedModel: string;
  reason: string;
}

/**
 * Assign models to agent roles based on rules:
 * - conductor/architect → most capable model
 * - domain-analyst → SLM first (cost optimization)
 * - auditor → different model from conductor (cross-validation)
 * - tester → SLM
 */
export function assignModels(
  roles: AgentRole[],
  registry: ModelsRegistry,
  conductorName: string,
): ModelAssignment[] {
  if (registry.models.length === 0) {
    throw new Error('No models registered. Run `fugue model add` first.');
  }

  const ranked = rankModels(registry);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  // Find a model different from the conductor for cross-validation
  const conductorEntry = registry.models.find((m) => m.name === conductorName);
  const crossValidator = ranked.find(
    (m) => m.name !== conductorName && m.provider !== conductorEntry?.provider,
  ) ?? (ranked.length > 1 ? ranked.find((m) => m.name !== conductorName) : ranked[0]);

  const assignments: ModelAssignment[] = [];

  for (const role of roles) {
    let assigned: ModelEntry;
    let reason: string;

    switch (role.type) {
      case 'architect':
        assigned = strongest;
        reason = 'Architecture analysis requires strongest reasoning';
        break;
      case 'auditor':
        assigned = crossValidator ?? strongest;
        reason = 'Cross-validation: using different model from conductor';
        break;
      case 'domain-analyst':
        if (role.recommended_tier === 'heavy') {
          assigned = strongest;
          reason = 'High complexity domain — heavy model assigned';
        } else {
          assigned = weakest;
          reason = 'SLM-first: lightweight parsing task';
        }
        break;
      case 'tester':
        assigned = weakest;
        reason = 'Test generation is repetitive — SLM sufficient';
        break;
      default:
        assigned = weakest;
        reason = 'Default: SLM assignment';
    }

    assignments.push({
      agentName: role.name,
      agentType: role.type,
      assignedModel: assigned.name,
      reason,
    });
  }

  return assignments;
}
