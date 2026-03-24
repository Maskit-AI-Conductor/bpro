/**
 * Prompts for audit workflow.
 */

export const AUDIT_SYSTEM_PROMPT = `You are a software quality auditor. Given requirements and their associated code/test references, evaluate coverage and quality.

Output ONLY valid JSON matching this schema:
{
  "findings": [
    {
      "req_id": "string",
      "severity": "PASS" | "WARN" | "FAIL",
      "message": "string",
      "recommendation": "string"
    }
  ],
  "gate": "PASS" | "CONDITIONAL" | "FAIL",
  "summary": "string"
}`;

export function buildAuditPrompt(
  requirements: Array<{ id: string; title: string; code_refs?: string[]; test_refs?: string[] }>,
): string {
  const reqList = requirements
    .map((r) => `- ${r.id}: ${r.title} (code: ${r.code_refs?.join(', ') || 'none'}, tests: ${r.test_refs?.join(', ') || 'none'})`)
    .join('\n');

  return `Audit these requirements for coverage and quality:

${reqList}

Evaluate each requirement and provide gate judgment.
Return ONLY valid JSON.`;
}
