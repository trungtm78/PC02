/**
 * Known legal-source domains. Used by the frontend `DocumentUrlInput` to render
 * a green hint chip when admin pastes a URL matching one of these hosts.
 * `official: true` = government domain trusted as primary audit source.
 *
 * Backend exposes this constant via the deadline-rules module so the same
 * source list informs server-side analytics if we add domain breakdown later.
 * For now it is reference-only — DTO accepts ANY valid public URL.
 */
export interface LawSourceHint {
  readonly domain: string;
  readonly label: string;
  readonly official: boolean;
}

export const LAW_SOURCE_HINTS: readonly LawSourceHint[] = [
  { domain: 'vbpl.vn',            label: 'Cơ sở dữ liệu pháp luật quốc gia', official: true  },
  { domain: 'chinhphu.vn',        label: 'Cổng Chính phủ',                   official: true  },
  { domain: 'quochoi.vn',         label: 'Quốc hội Việt Nam',                official: true  },
  { domain: 'vksndtc.gov.vn',     label: 'Viện kiểm sát ND tối cao',         official: true  },
  { domain: 'tandtc.gov.vn',      label: 'Tòa án ND tối cao',                official: true  },
  { domain: 'thuvienphapluat.vn', label: 'Thư viện Pháp luật (tham khảo)',   official: false },
] as const;

export interface MigratedRuleHint {
  readonly docType: string;
  readonly number: string;
  readonly issuer: string;
  readonly date: string; // ISO YYYY-MM-DD
  readonly url: string;
}

/**
 * Pre-fill suggestions for the 12 v1 migration rules. Surfaced on the
 * MigrationCleanupPage as a dismissible "Dùng đề xuất" banner — admin must
 * click to accept, never silently auto-fills.
 *
 * Stale-data risk: if BLTTHS or related laws are amended, this file requires
 * a code deploy to update. Threshold for migrating to a DB seed table: 20
 * entries (currently 10 with documented hints; 2 rules use BCA internal
 * regulations and intentionally omit a public URL).
 */
export const MIGRATED_RULE_URL_HINTS: Readonly<Record<string, MigratedRuleHint>> = {
  // BLTTHS 2015 — 8 rules share the same source document
  THOI_HAN_XAC_MINH:     { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_GIA_HAN_1:    { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_GIA_HAN_2:    { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_TOI_DA:       { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_PHUC_HOI:     { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_PHAN_LOAI:    { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  SO_LAN_GIA_HAN_TOI_DA: { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_GUI_QD_VKS:   { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  // Luật Tố cáo + Khiếu nại
  THOI_HAN_TO_CAO:       { docType: 'Khác',   number: '25/2018/QH14', issuer: 'Quốc hội', date: '2018-06-12', url: 'https://vbpl.vn/luat-to-cao-2018' },
  THOI_HAN_KHIEU_NAI:    { docType: 'Khác',   number: '02/2011/QH13', issuer: 'Quốc hội', date: '2011-11-11', url: 'https://vbpl.vn/luat-khieu-nai-2011' },
  // THOI_HAN_KIEN_NGHI và THOI_HAN_PHAN_ANH = quy chế nội bộ BCA — admin tự điền
  // số quyết định cụ thể của đơn vị, không có URL chung.
};
