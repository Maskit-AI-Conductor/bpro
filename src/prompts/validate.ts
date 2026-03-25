/**
 * Prompts for plan document quality validation.
 */

export const VALIDATE_SYSTEM_PROMPT = `You are a requirements quality auditor. Given a planning document, you check for quality issues that would block development.

Output ONLY a valid JSON object. No other text before or after.

The JSON object has these fields:
- "pass": boolean — true if no blocking issues found
- "issues": array of issue objects, each with:
  - "type": one of "AMBIGUOUS" | "MISSING_DECISION" | "MISSING_DEPENDENCY" | "TERM_INCONSISTENCY"
  - "severity": one of "ERROR" | "WARN"
  - "location": string — section or line reference in the document
  - "description": string — what the problem is
  - "suggestion": string — how to fix it

Rules:
1. AMBIGUOUS: Detect vague expressions like "적절히", "필요시", "등", "기타", "빠르게", "효율적으로" — anything not testable.
2. MISSING_DECISION: Detect if/else branches that are mentioned but not fully defined. E.g. "취소 시 환불" without specifying partial cancel, refund timing, etc.
3. MISSING_DEPENDENCY: Detect references to external systems (PG, API, DB, etc.) without integration details.
4. TERM_INCONSISTENCY: Detect when the same concept is called different names in different places.

If the document is in Korean, write descriptions and suggestions in Korean.
Be strict but fair — only flag real issues, not stylistic preferences.`;

export function buildValidatePrompt(docContent: string): string {
  return `Validate the quality of this planning document for development readiness:

---
${docContent}
---

Return a JSON object:
{"pass": true/false, "issues": [{"type": "...", "severity": "...", "location": "...", "description": "...", "suggestion": "..."}]}`;
}

/** Structured result from validation. */
export interface ValidationResult {
  pass: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'AMBIGUOUS' | 'MISSING_DECISION' | 'MISSING_DEPENDENCY' | 'TERM_INCONSISTENCY';
  severity: 'ERROR' | 'WARN';
  location: string;
  description: string;
  suggestion: string;
}
