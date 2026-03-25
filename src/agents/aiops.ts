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
 * - domain-analyst → LLM (requires business logic understanding — SLM insufficient)
 * - auditor → different model from conductor (cross-validation)
 * - tester → SLM (pattern matching, repetitive — SLM OK)
 *
 * Principle: "SLM-first, not SLM-forced."
 * SLM for: test generation, JSON parsing, formatting, structuring
 * LLM for: domain analysis, requirement extraction, quality validation, architecture
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
      case 'domain-analyst': {
        // Domain analysis requires understanding business logic — always use LLM
        // SLM is insufficient for requirement extraction quality
        const secondStrongest = ranked.length > 1 ? ranked[1] : strongest;
        if (role.recommended_tier === 'heavy') {
          assigned = strongest;
          reason = 'High complexity domain — strongest model';
        } else {
          // Use second-strongest LLM, not SLM. Fall back to strongest if only 1 LLM available
          const llmModels = ranked.filter(m => m.provider !== 'ollama');
          assigned = llmModels.length > 1 ? llmModels[1] : (llmModels[0] ?? secondStrongest);
          reason = 'Domain analysis requires LLM — business logic understanding needed';
        }
        break;
      }
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
