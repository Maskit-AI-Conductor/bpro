/**
 * JSON repair utilities for SLM output parsing.
 * Handles common issues: markdown code blocks, trailing commas, partial JSON,
 * and SLM wrapping arrays in objects.
 */

export function parseJsonResponse<T = unknown>(raw: string): T {
  // Try direct parse
  try {
    return unwrapIfNeeded(JSON.parse(raw)) as T;
  } catch {
    // continue
  }

  // Extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return unwrapIfNeeded(JSON.parse(codeBlockMatch[1])) as T;
    } catch {
      // continue
    }
  }

  // Try to find JSON array or object
  for (const pattern of [/\[[\s\S]*\]/, /\{[\s\S]*\}/]) {
    const match = raw.match(pattern);
    if (match) {
      try {
        return unwrapIfNeeded(JSON.parse(match[0])) as T;
      } catch {
        // continue
      }
    }
  }

  // Fix trailing commas
  const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
  try {
    return unwrapIfNeeded(JSON.parse(cleaned)) as T;
  } catch {
    // continue
  }

  throw new Error(`Failed to parse JSON from model response:\n${raw.slice(0, 500)}`);
}

/**
 * If the parsed value is an object with a single key whose value is an array,
 * unwrap it. Common SLM pattern: {"array": [...]} or {"requirements": [...]}.
 */
function unwrapIfNeeded(parsed: unknown): unknown {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Case 1: Object wrapping an array — {"array": [...]} or {"requirements": [...]}
    if (keys.length === 1) {
      const value = obj[keys[0]];
      if (Array.isArray(value)) {
        return value;
      }
    }

    // Case 2: Single item that looks like a REQ — wrap in array
    if (obj.id && typeof obj.id === 'string') {
      return [obj];
    }

    // Case 3: Object keyed by IDs — {"REQ-001": {...}, "REQ-002": {...}}
    if (keys.length > 0 && keys.every((k) => k.match(/^REQ-\d+$/i) || (typeof obj[k] === 'object' && obj[k] !== null))) {
      const values = Object.values(obj);
      if (values.length > 0 && values.every((v) => v && typeof v === 'object' && !Array.isArray(v) && (v as Record<string, unknown>).id)) {
        return values;
      }
    }
  }
  return parsed;
}
