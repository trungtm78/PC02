export const PROCESSING_QUERY_KEYS = {
  flows: ['processing-flow', 'list'] as const,
  flowList: (includeArchived: boolean) => ['processing-flow', 'list', includeArchived] as const,
  templates: ['processing-flow', 'templates'] as const,
  flow: (id: string) => ['processing-flow', 'flow', id] as const,
  teams: ['processing-flow', 'teams'] as const,
  calendarYears: ['processing-calendar', 'years'] as const,
  calendarYear: (year: number) => ['processing-calendar', 'year', year] as const,
};
