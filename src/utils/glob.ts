/**
 * Simple glob/minimatch utility.
 * Supports: *, **, ?, [chars]
 */

export function minimatch(str: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches everything including /
        regexStr += '.*';
        i += 2;
        if (pattern[i] === '/') i++; // skip trailing slash
        continue;
      }
      // * matches everything except /
      regexStr += '[^/]*';
    } else if (c === '?') {
      regexStr += '[^/]';
    } else if (c === '[') {
      // Character class
      const close = pattern.indexOf(']', i);
      if (close === -1) {
        regexStr += '\\[';
      } else {
        regexStr += pattern.slice(i, close + 1);
        i = close;
      }
    } else if (c === '.') {
      regexStr += '\\.';
    } else if (c === '(' || c === ')' || c === '{' || c === '}' || c === '+' || c === '^' || c === '$' || c === '|') {
      regexStr += '\\' + c;
    } else {
      regexStr += c;
    }
    i++;
  }

  try {
    return new RegExp(`^${regexStr}$`).test(str);
  } catch {
    return false;
  }
}
