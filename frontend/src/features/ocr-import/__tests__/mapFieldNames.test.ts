import { describe, expect, it } from 'vitest';
import { mapFieldNames } from '../mapFieldNames';
import type { OcrAnalysisView } from '../ocrApi';

const analysis = {
  id: 'a1',
  projection: {
    fills: [
      {
        field: 'tenCungCap',
        value: 'x',
        policy: 'AI_FILL',
        provenance: { claimKind: 'QUOTED', pageId: null, quote: null },
        warnings: [],
      },
    ],
    skips: [{ field: 'tenCungCap', reason: 'NO_DATA' }],
  },
} as unknown as OcrAnalysisView;

describe('mapFieldNames', () => {
  it('translates the field to the form name and remembers the server name', () => {
    const mapped = mapFieldNames(analysis, (field) => (field === 'tenCungCap' ? 'senderName' : field));
    expect(mapped.projection.fills[0]).toMatchObject({ field: 'senderName', source: 'tenCungCap' });
    expect(mapped.projection.skips[0].field).toBe('senderName');
  });
});
