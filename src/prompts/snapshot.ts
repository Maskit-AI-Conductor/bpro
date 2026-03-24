/**
 * Prompts for the snapshot (reverse-engineering) workflow.
 */

export const SNAPSHOT_SYSTEM_PROMPT = `You are a senior software architect conducting a reverse-engineering analysis.
Given a project's file structure and source code, you must:
1. Identify the main domains/modules
2. For each domain, define an analyst agent role
3. Assign appropriate model types (heavy reasoning vs lightweight parsing)
4. Extract high-level architecture

Output ONLY valid JSON matching this schema:
{
  "domains": [
    {
      "name": "string",
      "description": "string",
      "files": ["string"],
      "complexity": "high" | "medium" | "low"
    }
  ],
  "architecture": {
    "type": "string (e.g. monolith, microservice, layered)",
    "description": "string",
    "layers": ["string"]
  },
  "agent_roles": [
    {
      "name": "string",
      "type": "architect" | "domain-analyst" | "auditor" | "tester",
      "scope": "string",
      "recommended_tier": "heavy" | "medium" | "light"
    }
  ]
}`;

export function buildSnapshotPrompt(
  files: Array<{ path: string; content: string }>,
  projectName: string,
): string {
  const fileList = files.map((f) => f.path).join('\n');
  const codeBlocks = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');

  return `Analyze this project "${projectName}":

File structure:
${fileList}

Source code:
${codeBlocks}

Identify domains, architecture, and define agent roles for analysis.
Return ONLY valid JSON.`;
}
