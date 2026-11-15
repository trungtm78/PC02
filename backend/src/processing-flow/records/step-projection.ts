/**
 * What a person who opened a record ONLY because a step names their unit receives: the record itself, without what hangs
 * on it (the people, the linked records, the history). Those keep their own policies, which this person does not meet.
 */
export function withoutKeys<T extends object>(record: T, keys: readonly string[]): T {
  const copy = { ...record } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy as T;
}

/** The relations of each kind of record that a step-only reader does not get. */
export const STEP_ONLY_WITHHELD = {
  PETITION: ['linkedCase', 'linkedIncident'],
  INCIDENT: ['petitions', 'statusHistory', 'linkedCase', 'mergedInto'],
  CASE: ['subjects', 'petitions', 'statistic', 'autoLinkedIncident'],
} as const;
