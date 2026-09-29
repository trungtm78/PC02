const SYSTEM_METADATA_KEYS = new Set([
  'da_xoa',
  'da_nhan',
  'don_vi_id',
  'nguoi_them',
  '__v',
  'add_time',
  'update_time',
  'id',
  'loai',
]);

export function userEnteredLegacyMetadata(
  values: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key]) =>
        !/_search$/.test(key) &&
        !/^_/.test(key) &&
        !SYSTEM_METADATA_KEYS.has(key),
    ),
  );
}
