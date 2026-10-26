import type { MappingRule } from './settings.js';

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim().toLowerCase();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue).join(',').trim().toLowerCase();
  }
  return '';
}

function parseCriteria(raw: string): string[] {
  return raw
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);
}

export function selectBestRule(frontmatter: Record<string, unknown>, rules: MappingRule[]) {
  let bestRule: MappingRule | null = null;
  let bestSpecificity = -1;

  for (const rule of rules) {
    const propertyList = parseCriteria(rule.property);
    const valueList = parseCriteria(rule.value);

    if (propertyList.length === 0 || valueList.length === 0) {
      continue;
    }

    if (propertyList.length !== valueList.length) {
      continue;
    }

    let matchedCount = 0;
    let allMatch = true;

    for (let index = 0; index < propertyList.length; index += 1) {
      const propertyName = propertyList[index];
      if (!propertyName) {
        allMatch = false;
        break;
      }

      const expectedValue = normalizeValue(valueList[index]);
      const actualValue = normalizeValue(frontmatter[propertyName]);

      if (actualValue === expectedValue) {
        matchedCount += 1;
      } else {
        allMatch = false;
        break;
      }
    }

    if (!allMatch) continue;

    if (matchedCount > bestSpecificity) {
      bestSpecificity = matchedCount;
      bestRule = rule;
    }
  }

  return bestRule;
}
