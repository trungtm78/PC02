import { describe, expect, it, vi } from 'vitest';
import { buildCasesAdapter } from '../adapters/cases';
import { buildIncidentsAdapter } from '../adapters/incidents';

describe('Word batch actions', () => {
  it.each([
    ['cases', buildCasesAdapter],
    ['incidents', buildIncidentsAdapter],
  ] as const)('%s captures selected IDs and opens template selection', async (_name, build) => {
    const onExportWord = vi.fn();
    const adapter = build({ onExportWord });
    const action = adapter.actions.find((item) => item.key === 'export-word');
    expect(action).toMatchObject({ allowsAllMatchingFilter: false, skipConfirm: true });
    await action?.execute({ ids: ['one', 'two'] });
    expect(onExportWord).toHaveBeenCalledWith(['one', 'two']);
  });
});
