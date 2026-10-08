import { validateFieldDefinition } from '../governance/configuration.validation';
import type { FieldDefinition } from '../governance/configuration.validation';
import {
  isPublishedFieldSchema,
  nativePolicyAliases,
} from '../governance/case-native-field-policy';

/** Compatibility inspects policy only. It never authorizes Case values or returns them. */
export function legacyDefinitionAllowsBytes(
  pinnedId: string | null,
  row: {
    status: string;
    publishedAt?: Date | null;
    definition: unknown;
  } | null,
): boolean {
  if (!pinnedId) return true;
  if (!row || !isPublishedFieldSchema(row)) return false;
  try {
    validateFieldDefinition(row.definition);
  } catch {
    return false;
  }
  const definition = row.definition as FieldDefinition;
  return (
    !definition.fields.some((field) => field.sensitivity === 'RESTRICTED') &&
    !(definition.fieldPolicies ?? []).some(
      (policy) =>
        policy.sensitivity === 'RESTRICTED' || policy.exportable === false,
    )
  );
}
export function definitionAllowsCaseNameSearch(
  row: { status: string; publishedAt?: Date | null; definition: unknown },
  sensitive: boolean,
): boolean {
  if (!isPublishedFieldSchema(row)) return false;
  try {
    validateFieldDefinition(row.definition);
  } catch {
    return false;
  }
  return !(row.definition as FieldDefinition).fieldPolicies?.some(
    (policy) =>
      nativePolicyAliases(policy.key).includes('name') &&
      (policy.searchable === false ||
        (!sensitive && policy.sensitivity === 'RESTRICTED')),
  );
}
