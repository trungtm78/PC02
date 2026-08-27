/**
 * Bảng tra đặc tả bố cục theo thực thể.
 *
 * Panel "Thông tin nghiệp vụ bổ sung" cần biết form đã sở hữu cột nào để KHÔNG dựng ô thứ
 * hai. Trước 26/08/2026 nó rẽ nhánh `entity === "case"` viết cứng, nên thực thể nào dựng theo
 * đặc tả sau đó cũng phải nhớ sửa chỗ này — mà quên thì hỏng im lặng: hai ô cùng ghi một cột,
 * panel gộp vào payload SAU nên panel THẮNG, cán bộ gõ trong tab rồi bấm Lưu là mất.
 *
 * Tra bảng thay cho rẽ nhánh: thêm một thực thể vào đây là mọi nơi tự đúng theo.
 */
import { CASE_LEGACY_SPEC } from '@/features/cases/legacy-form-layout.def';
import { INCIDENT_LEGACY_SPEC } from '@/features/incidents/legacy-form-binding';
import { PETITION_LEGACY_SPEC } from '@/features/petitions/legacy-form-binding';
import { columnForCaption, ownedColumns, type LegacyEntity } from './types';

const KHONG_CO: ReadonlySet<string> = new Set();

/** Thực thể đã dựng form theo đặc tả bố cục hệ cũ. */
const DAC_TA_THEO_THUC_THE = {
  case: CASE_LEGACY_SPEC,
  petition: PETITION_LEGACY_SPEC,
  incident: INCIDENT_LEGACY_SPEC,
} as const;

/**
 * Tập cột mà form của thực thể đã có ô nhập ở đúng vị trí hệ cũ.
 *
 * Thực thể chưa dựng theo đặc tả trả về tập rỗng — panel giữ nguyên đường cũ.
 */
export function ownedColumnsFor(entity: LegacyEntity | string): ReadonlySet<string> {
  const spec = (DAC_TA_THEO_THUC_THE as Record<string, unknown>)[entity];
  return spec ? ownedColumns(spec as never) : KHONG_CO;
}

/**
 * Cột mà ô mang nhãn ấy của thực thể ghi vào — `null` nếu bố cục hệ cũ không có nhãn ấy.
 *
 * Cổng "cột danh sách phải trỏ đúng cột form" tra bảng này cho MỌI nhãn, thay vì chốt từng
 * nhãn một như bản đầu (chỉ gác được "Đơn vị giải quyết", nên ba nhãn khác lệch mà vẫn lọt).
 */
export function cotTheoNhan(entity: LegacyEntity | string, nhan: string): string | null {
  const spec = (DAC_TA_THEO_THUC_THE as Record<string, unknown>)[entity];
  return spec ? columnForCaption(spec as never, nhan) : null;
}
