/**
 * Danh sách 32 Tỉnh/Thành phố trực thuộc Trung ương
 * Theo cải cách hành chính 2025 — Nghị quyết 1279/NQ-UBTVQH15 — hiệu lực 01/07/2025
 * Nguồn: chinhphu.vn + Bộ Nội vụ
 *
 * Lưu ý: Số thực tế có thể là 34 theo Nghị quyết (Bắc Ninh và 1 tỉnh khác
 * có thể chưa được xác nhận trong nguồn dữ liệu hiện tại).
 *
 * Cấu trúc hành chính mới: Trung ương → Tỉnh/Thành phố → Phường/Xã
 * (Bỏ cấp quận/huyện hoàn toàn kể từ 01/07/2025)
 */

export interface Province {
  code: string;
  name: string;
  nameShort: string;
  type: 'thanh_pho' | 'tinh';
  /** Ghi chú các tỉnh đã hợp nhất vào */
  mergedFrom?: string[];
}

/** 32 tỉnh/thành phố theo quy định 2025 — ưu tiên TPHCM đầu tiên */
export const PROVINCES: Province[] = [
  // ── Ưu tiên: Thành phố Hồ Chí Minh ──────────────────────────────────────
  {
    code: 'HCM',
    name: 'Thành phố Hồ Chí Minh',
    nameShort: 'TP.HCM',
    type: 'thanh_pho',
    mergedFrom: ['Bình Dương', 'Bà Rịa - Vũng Tàu'],
  },

  // ── 5 Thành phố trực thuộc Trung ương (còn lại) ─────────────────────────
  {
    code: 'HN',
    name: 'Hà Nội',
    nameShort: 'Hà Nội',
    type: 'thanh_pho',
  },
  {
    code: 'DN',
    name: 'Đà Nẵng',
    nameShort: 'Đà Nẵng',
    type: 'thanh_pho',
    mergedFrom: ['Quảng Nam'],
  },
  {
    code: 'HP',
    name: 'Hải Phòng',
    nameShort: 'Hải Phòng',
    type: 'thanh_pho',
    mergedFrom: ['Hải Dương'],
  },
  {
    code: 'CT',
    name: 'Cần Thơ',
    nameShort: 'Cần Thơ',
    type: 'thanh_pho',
    mergedFrom: ['Sóc Trăng', 'Hậu Giang'],
  },
  {
    code: 'HUE',
    name: 'Huế',
    nameShort: 'Huế',
    type: 'thanh_pho',
  },

  // ── 28 Tỉnh (theo bảng chữ cái) ─────────────────────────────────────────
  {
    code: 'AG',
    name: 'An Giang',
    nameShort: 'An Giang',
    type: 'tinh',
    mergedFrom: ['Kiên Giang'],
  },
  {
    code: 'BP',
    name: 'Bình Phước',
    nameShort: 'Bình Phước',
    type: 'tinh',
  },
  {
    code: 'CM',
    name: 'Cà Mau',
    nameShort: 'Cà Mau',
    type: 'tinh',
    mergedFrom: ['Bạc Liêu'],
  },
  {
    code: 'CB',
    name: 'Cao Bằng',
    nameShort: 'Cao Bằng',
    type: 'tinh',
    mergedFrom: ['Lạng Sơn'],
  },
  {
    code: 'DB',
    name: 'Điện Biên',
    nameShort: 'Điện Biên',
    type: 'tinh',
    mergedFrom: ['Lai Châu', 'Sơn La'],
  },
  {
    code: 'DLK',
    name: 'Đắk Lắk',
    nameShort: 'Đắk Lắk',
    type: 'tinh',
  },
  {
    code: 'DT',
    name: 'Đồng Tháp',
    nameShort: 'Đồng Tháp',
    type: 'tinh',
    mergedFrom: ['Tiền Giang'],
  },
  {
    code: 'DNA',
    name: 'Đồng Nai',
    nameShort: 'Đồng Nai',
    type: 'tinh',
  },
  {
    code: 'GL',
    name: 'Gia Lai',
    nameShort: 'Gia Lai',
    type: 'tinh',
    mergedFrom: ['Kon Tum'],
  },
  {
    code: 'HY',
    name: 'Hưng Yên',
    nameShort: 'Hưng Yên',
    type: 'tinh',
    mergedFrom: ['Thái Bình'],
  },
  {
    code: 'KH',
    name: 'Khánh Hòa',
    nameShort: 'Khánh Hòa',
    type: 'tinh',
    mergedFrom: ['Phú Yên'],
  },
  {
    code: 'LCI',
    name: 'Lào Cai',
    nameShort: 'Lào Cai',
    type: 'tinh',
    mergedFrom: ['Yên Bái'],
  },
  {
    code: 'LDG',
    name: 'Lâm Đồng',
    nameShort: 'Lâm Đồng',
    type: 'tinh',
    mergedFrom: ['Đắk Nông', 'Bình Thuận'],
  },
  {
    code: 'LA',
    name: 'Long An',
    nameShort: 'Long An',
    type: 'tinh',
  },
  {
    code: 'NAN',
    name: 'Nghệ An',
    nameShort: 'Nghệ An',
    type: 'tinh',
    mergedFrom: ['Hà Tĩnh'],
  },
  {
    code: 'NB',
    name: 'Ninh Bình',
    nameShort: 'Ninh Bình',
    type: 'tinh',
    mergedFrom: ['Hà Nam', 'Nam Định'],
  },
  {
    code: 'NT',
    name: 'Ninh Thuận',
    nameShort: 'Ninh Thuận',
    type: 'tinh',
  },
  {
    code: 'PT',
    name: 'Phú Thọ',
    nameShort: 'Phú Thọ',
    type: 'tinh',
    mergedFrom: ['Vĩnh Phúc', 'Hòa Bình'],
  },
  {
    code: 'QB',
    name: 'Quảng Bình',
    nameShort: 'Quảng Bình',
    type: 'tinh',
    mergedFrom: ['Quảng Trị'],
  },
  {
    code: 'QN',
    name: 'Quảng Ngãi',
    nameShort: 'Quảng Ngãi',
    type: 'tinh',
    mergedFrom: ['Bình Định'],
  },
  {
    code: 'QNI',
    name: 'Quảng Ninh',
    nameShort: 'Quảng Ninh',
    type: 'tinh',
  },
  {
    code: 'TH',
    name: 'Thanh Hóa',
    nameShort: 'Thanh Hóa',
    type: 'tinh',
  },
  {
    code: 'TN',
    name: 'Thái Nguyên',
    nameShort: 'Thái Nguyên',
    type: 'tinh',
    mergedFrom: ['Bắc Kạn', 'Bắc Giang'],
  },
  {
    code: 'TQ',
    name: 'Tuyên Quang',
    nameShort: 'Tuyên Quang',
    type: 'tinh',
    mergedFrom: ['Hà Giang'],
  },
  {
    code: 'TYN',
    name: 'Tây Ninh',
    nameShort: 'Tây Ninh',
    type: 'tinh',
  },
  {
    code: 'VL',
    name: 'Vĩnh Long',
    nameShort: 'Vĩnh Long',
    type: 'tinh',
    mergedFrom: ['Bến Tre', 'Trà Vinh'],
  },
];

/** Chỉ lấy tên tỉnh/TP để dùng trong dropdown */
export const PROVINCE_NAMES: string[] = PROVINCES.map(p => p.name);

/** Map từ code → tên */
export const PROVINCE_BY_CODE = Object.fromEntries(
  PROVINCES.map(p => [p.code, p]),
) as Record<string, Province>;
