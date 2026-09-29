import { userEnteredLegacyMetadata } from './legacy-metadata';

describe('userEnteredLegacyMetadata', () => {
  it('keeps business metadata and removes system, ownership and search artifacts', () => {
    expect(
      userEnteredLegacyMetadata({
        ghi_chu: 'keep',
        id: 'legacy-id',
        nguoi_them: 'legacy-owner',
        ten_search: 'search shadow',
        _internal: true,
      }),
    ).toEqual({ ghi_chu: 'keep' });
  });
});
