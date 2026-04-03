/**
 * Prompts for plan decomposition workflow.
 */

import type { FugueConfig } from '../core/project.js';

export const DECOMPOSE_SYSTEM_PROMPT = `You are a requirements analyst. Extract functional requirements from a planning document.
Output ONLY a valid JSON array. No other text before or after.
Each requirement object has these fields:
- "id": sequential like "REQ-001", "REQ-002"
- "title": short name (under 60 chars)
- "priority": one of "HIGH", "MEDIUM", "LOW"
- "description": one sentence describing the testable behavior
- "source_section": which section of the document this came from

Additional rules:
- Keep each requirement ATOMIC: one testable behavior per REQ
- Description must be 50-150 chars with a verifiable condition
- Do NOT generate infrastructure/deployment requirements
- Do NOT generate duplicate requirements
- Priority distribution: aim for ~25% HIGH, ~50% MEDIUM, ~25% LOW
- If the input has severity/priority hints, inherit them
If the document is in Korean, keep title and description in Korean.
IMPORTANT: Output in Korean ONLY. Do NOT use Japanese, Chinese characters, or any non-Korean text in title or description.`;

/**
 * Build a system prompt enhanced with config-driven rules.
 * Falls back to the base DECOMPOSE_SYSTEM_PROMPT when no generation config exists.
 */
export function buildDecomposeSystemPrompt(config?: FugueConfig): string {
  let prompt = DECOMPOSE_SYSTEM_PROMPT;

  const gen = config?.generation;

  // Max total draft limit
  const maxTotal = gen?.limits?.max_total_draft ?? 200;
  prompt += `\n- Maximum ${maxTotal} requirements from this document`;

  // Area-prefixed naming
  if (gen?.req_naming?.areas) {
    const areas = gen.req_naming.areas;
    const areaList = Object.entries(areas)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    prompt += `\n- Use domain-prefixed IDs: REQ-PUB-001, REQ-ADM-001, etc.`;
    prompt += `\n- Area mapping: ${areaList}`;
  }

  return prompt;
}

/**
 * Detect document format (DCMP-001).
 * Returns a hint string that gets injected into the prompt.
 */
export function detectDocFormat(content: string): { format: string; hint: string } {
  const lines = content.split('\n');

  // Lean Canvas detection (9-block structure)
  const leanKeywords = ['문제', '고객', '솔루션', '가치제안', 'UVP', '채널', '수익', '비용', '핵심지표', '불공정우위'];
  const leanHits = leanKeywords.filter(kw => content.includes(kw)).length;
  if (leanHits >= 4) {
    return {
      format: 'lean-canvas',
      hint: 'This is a Lean Canvas document. Extract requirements from each of the 9 blocks. Focus on Solution, UVP, and Key Metrics blocks for functional requirements.',
    };
  }

  // Task checklist detection (- [ ] or - [x] patterns)
  const checkboxLines = lines.filter(l => /^\s*-\s*\[[ x]\]/.test(l)).length;
  if (checkboxLines >= 3) {
    return {
      format: 'task-checklist',
      hint: 'This is a task checklist. Each checked/unchecked item may represent a requirement. Group related items and extract atomic requirements.',
    };
  }

  // Milestone/phase document
  const milestoneKeywords = ['M1', 'M2', 'M3', 'Phase', 'Sprint', '마일스톤', '단계'];
  const milestoneHits = milestoneKeywords.filter(kw => content.includes(kw)).length;
  if (milestoneHits >= 2) {
    return {
      format: 'milestone',
      hint: 'This is a milestone/phase document. Extract requirements per milestone. Tag each requirement with source_section indicating which milestone it belongs to.',
    };
  }

  // Default: standard markdown
  return {
    format: 'markdown',
    hint: 'This is a standard markdown document. Extract requirements from each heading section.',
  };
}

export function buildDecomposePrompt(docContent: string, opts?: { dryRun?: boolean; existingReqIds?: string[] }): string {
  const { format, hint } = detectDocFormat(docContent);

  let prompt = `Extract requirements from this planning document.
Document format detected: ${format}
${hint}

---
${docContent}
---

Return a JSON array:
[{"id": "REQ-001", "title": "...", "priority": "HIGH", "description": "...", "source_section": "..."}]`;

  // DCMP-004: warn about existing REQs
  if (opts?.existingReqIds && opts.existingReqIds.length > 0) {
    prompt += `\n\nIMPORTANT: The following REQ IDs already exist as CONFIRMED. Do NOT generate duplicates:\n${opts.existingReqIds.join(', ')}`;
  }

  return prompt;
}
