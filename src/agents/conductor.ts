/**
 * Conductor agent — orchestrates project analysis via the selected conductor model.
 */

import type { ModelAdapter } from '../models/adapter.js';
import { SNAPSHOT_SYSTEM_PROMPT, buildSnapshotPrompt } from '../prompts/snapshot.js';

export interface ConductorAnalysis {
  domains: DomainInfo[];
  architecture: {
    type: string;
    description: string;
    layers?: string[];
  };
  agent_roles: AgentRole[];
}

export interface DomainInfo {
  name: string;
  description: string;
  files: string[];
  complexity: 'high' | 'medium' | 'low';
}

export interface AgentRole {
  name: string;
  type: 'architect' | 'domain-analyst' | 'auditor' | 'tester';
  scope: string;
  recommended_tier: 'heavy' | 'medium' | 'light';
}

/**
 * Run conductor analysis on a project.
 */
export async function runConductorAnalysis(
  adapter: ModelAdapter,
  fileList: Array<{ path: string; content: string }>,
  projectName: string,
): Promise<ConductorAnalysis> {
  const prompt = buildSnapshotPrompt(fileList, projectName);

  const result = await adapter.generateJSON<ConductorAnalysis>(prompt, {
    system: SNAPSHOT_SYSTEM_PROMPT,
    maxTokens: 4096,
    temperature: 0.3,
  });

  // Validate basic structure
  if (!result || typeof result !== 'object') {
    throw new Error('Conductor returned invalid response');
  }
  if (!Array.isArray(result.domains)) {
    // Wrap single-domain response
    (result as ConductorAnalysis).domains = [];
  }
  if (!Array.isArray(result.agent_roles)) {
    (result as ConductorAnalysis).agent_roles = [];
  }

  return result;
}

/**
 * Have conductor extract requirements from code files.
 */
export async function extractRequirements(
  adapter: ModelAdapter,
  files: Array<{ path: string; content: string }>,
  startId: number,
): Promise<Array<Record<string, unknown>>> {
  const fileBlock = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  const prompt = `Extract functional requirements from these source files:

${fileBlock}

Return a JSON array:
[{"id": "REQ-${String(startId).padStart(3, '0')}", "title": "...", "priority": "HIGH", "description": "...", "source_files": ["..."]}]

Start numbering from REQ-${String(startId).padStart(3, '0')}.`;

  const system = `You are a reverse-engineering analyst. Given source code files, extract the functional requirements that the code implements.
Output ONLY a valid JSON array. No other text before or after.
Each requirement object has:
- "id": sequential like "REQ-001", "REQ-002"
- "title": short name (under 60 chars)
- "priority": one of "HIGH", "MEDIUM", "LOW" (based on how critical the functionality seems)
- "description": one sentence describing the testable behavior
- "source_files": list of filenames that implement this requirement

Focus on user-facing behaviors and business logic, not internal utilities or boilerplate.
If the code contains Korean comments or identifiers, keep title and description in Korean.`;

  // Try JSON mode first, fallback to plain text + repair
  try {
    return await adapter.generateJSON<Array<Record<string, unknown>>>(prompt, {
      system,
      maxTokens: 4096,
      temperature: 0.2,
    });
  } catch {
    // Fallback: generate plain text and attempt repair
    const raw = await adapter.generate(prompt, {
      system,
      maxTokens: 4096,
      temperature: 0.2,
    });
    const { parseJsonResponse } = await import('../utils/json-repair.js');
    return parseJsonResponse<Array<Record<string, unknown>>>(raw);
  }
}
