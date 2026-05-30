/**
 * v0.62 PR1a — Typed list-filter registry primitive.
 *
 * FilterField<TValue> declares one filter input: key (into the typed value
 * shape), label, type, URL key for round-trip, optional options for enums.
 *
 * Smart `<Filters>` component consumes registry + value/onChange to render
 * responsive grid. useListFilters hook syncs to URLSearchParams.
 *
 * Per Claude eng review #6: reuse useListPageUrlState pattern, do NOT
 * write a parallel URL serializer.
 */
export type FilterFieldType = 'text' | 'date' | 'enumSelect' | 'fkSelect';

export interface EnumOption {
  value: string;
  label: string;
}

export interface FilterField<TValue> {
  key: keyof TValue & string;
  label: string;
  type: FilterFieldType;
  urlKey: string;
  testid: string;
  placeholder?: string;
  /** Enum options when type === 'enumSelect'. */
  options?: EnumOption[];
  /** Directory type for FKSelect when type === 'fkSelect'. */
  directoryType?: string;
}

export interface ListFilterRegistry<TValue> {
  register: (field: FilterField<TValue>) => ListFilterRegistry<TValue>;
  registerMany: (fields: FilterField<TValue>[]) => ListFilterRegistry<TValue>;
  all: () => ReadonlyArray<FilterField<TValue>>;
}

export function createListFilterRegistry<TValue>(): ListFilterRegistry<TValue> {
  const fields: FilterField<TValue>[] = [];
  const registry: ListFilterRegistry<TValue> = {
    register(field) {
      fields.push(field);
      return registry;
    },
    registerMany(xs) {
      fields.push(...xs);
      return registry;
    },
    all() {
      return fields;
    },
  };
  return registry;
}
