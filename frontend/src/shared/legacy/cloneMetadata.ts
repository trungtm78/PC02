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

export function isSystemMetadataKey(key: string): boolean {
  return /_search$/.test(key) || /^_/.test(key) || SYSTEM_METADATA_KEYS.has(key);
}

/** Deep-copy user-entered legacy metadata while removing ownership/search/import artifacts. */
export function cloneUserMetadata(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(structuredClone(values)).filter(([key]) => !isSystemMetadataKey(key)),
  );
}
