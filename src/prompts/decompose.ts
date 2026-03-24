/**
 * Prompts for plan decomposition workflow.
 */

export const DECOMPOSE_SYSTEM_PROMPT = `You are a requirements analyst. Extract functional requirements from a planning document.
Output ONLY a valid JSON array. No other text before or after.
Each requirement object has these fields:
- "id": sequential like "REQ-001", "REQ-002"
- "title": short name (under 60 chars)
- "priority": one of "HIGH", "MEDIUM", "LOW"
- "description": one sentence describing the testable behavior
- "source_section": which section of the document this came from

Keep each requirement atomic — one testable behavior per REQ.
If the document is in Korean, keep title and description in Korean.`;

export function buildDecomposePrompt(docContent: string): string {
  return `Extract requirements from this planning document:

---
${docContent}
---

Return a JSON array:
[{"id": "REQ-001", "title": "...", "priority": "HIGH", "description": "...", "source_section": "..."}]`;
}
