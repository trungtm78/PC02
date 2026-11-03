/**
 * Checks that a JSON Schema stays inside the subset every supported provider accepts for
 * structured output (Gemini `responseSchema`, OpenAI strict `json_schema`, Anthropic tool input).
 *
 * The subset is the intersection of what they accept: objects with every property required and no
 * unknown keys, arrays, enums, primitives, integers, and "value or null" unions. Anything else
 * (patterns, formats, references, free unions, optional properties) works on one provider and is
 * refused by another, so it is rejected here, in CI, instead of failing on a live call.
 */

type JsonSchema = Record<string, unknown>;

const UNSUPPORTED_KEYWORDS = [
  '$ref',
  '$defs',
  'definitions',
  'oneOf',
  'allOf',
  'not',
  'if',
  'then',
  'else',
  'patternProperties',
  'pattern',
  'format',
  'propertyNames',
  'dependentRequired',
  'unevaluatedProperties',
] as const;

const isRecord = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isNullable(branches: unknown[]): boolean {
  return (
    branches.length === 2 &&
    branches.some((b) => isRecord(b) && b.type === 'null')
  );
}

function visit(node: unknown, path: string, issues: string[]): void {
  if (!isRecord(node)) return;

  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (keyword in node) {
      issues.push(
        `${path}: keyword "${keyword}" is not supported by every provider`,
      );
    }
  }

  if (Array.isArray(node.anyOf)) {
    if (!isNullable(node.anyOf)) {
      issues.push(`${path}: anyOf is only allowed as "value or null"`);
    }
    node.anyOf.forEach((branch, i) =>
      visit(branch, `${path}/anyOf/${i}`, issues),
    );
  }

  const properties = node.properties;
  if (isRecord(properties)) {
    if (node.additionalProperties !== false) {
      issues.push(`${path}: additionalProperties must be false`);
    }
    const required = Array.isArray(node.required) ? node.required : [];
    for (const name of Object.keys(properties)) {
      if (!required.includes(name))
        issues.push(`${path}: property "${name}" is not required`);
      visit(properties[name], `${path}/properties/${name}`, issues);
    }
  } else if (node.type === 'object' && node.additionalProperties !== false) {
    issues.push(`${path}: additionalProperties must be false`);
  }

  if (isRecord(node.items)) visit(node.items, `${path}/items`, issues);
}

/** Returns one message per unsupported part; an empty array means every provider accepts the schema. */
export function findProviderUnsafeParts(schema: JsonSchema): string[] {
  const issues: string[] = [];
  visit(schema, '#', issues);
  return issues;
}
