import { buildCaseStatistic } from './legacy-mapper';

/**
 * Tính phần cần bù cho một dòng `case_statistics` từ bản gốc hệ cũ.
 *
 * Vì sao cần riêng: `backfill-parity.ts` chỉ đi trên ba bảng chính (đơn thư, vụ việc, vụ
 * án). Bảy mốc thời gian của tab "TK 48 trường" lại nằm ở `case_statistics`, nên với hồ sơ
 * đã di trú trước khi builder biết đọc chúng, các ô ấy vĩnh viễn trắng nếu không có bước
 * này — dù dữ liệu vẫn nằm nguyên trong `legacy_raw`.
 *
 * Quy tắc an toàn giống hệt `backfill-parity.ts`: CHỈ điền ô đang trống, không đè giá trị
 * cán bộ đã sửa tay. Với cột đúng-sai, `false` được coi là ĐÃ CÓ giá trị — không phải ô
 * trống — nên không bị ghi đè.
 */

/** Cột đúng-sai của `case_statistics` mang mặc định `false` ở lược đồ. */
const COT_DUNG_SAI_MAC_DINH_FALSE = new Set([
  'coGhiAmGhiHinh',
  'laVuAnGhiAmGhiHinh',
  'vksYeuCauGhiAm',
  'coVPHC',
  'coBangNhom',
  'vuAnDaDuocXetXu',
]);

export interface StatisticBackfillPatch {
  /** Ô cần điền. Rỗng nghĩa là không có gì để bù. */
  data: Record<string, unknown>;
  /** true khi hồ sơ chưa có dòng thống kê nào và bản gốc có dữ liệu để tạo. */
  canTaoMoi: boolean;
}

export function statisticBackfillPatch(
  hienCo: Record<string, unknown> | null | undefined,
  legacyRaw: Record<string, unknown> | null | undefined,
): StatisticBackfillPatch {
  if (!legacyRaw) return { data: {}, canTaoMoi: false };

  const suyRa = buildCaseStatistic(legacyRaw);
  if (!suyRa || Object.keys(suyRa).length === 0) return { data: {}, canTaoMoi: false };

  if (!hienCo) return { data: suyRa, canTaoMoi: true };

  const data: Record<string, unknown> = {};
  for (const [cot, giaTri] of Object.entries(suyRa)) {
    if (giaTri === undefined || giaTri === null) continue;
    const dangCo = hienCo[cot];
    // Cột đúng-sai mặc định `false`: `false` là giá trị thật, không phải ô trống. Coi nó là
    // trống thì mỗi lần chạy lại sẽ ghi đè lựa chọn của cán bộ.
    const oTrong =
      dangCo === null ||
      dangCo === undefined ||
      (COT_DUNG_SAI_MAC_DINH_FALSE.has(cot) && dangCo === false && giaTri === true);
    if (oTrong) data[cot] = giaTri;
  }
  return { data, canTaoMoi: false };
}
