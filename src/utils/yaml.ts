/**
 * YAML read/write utilities.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export function loadYaml<T = Record<string, unknown>>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return (yaml.load(content) as T) ?? null;
}

export function saveYaml(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = yaml.dump(data, {
    flowLevel: -1,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}
