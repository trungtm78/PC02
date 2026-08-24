import { AlertTriangle } from 'lucide-react';
import { formatVNDate } from '@/lib/dates';

/**
 * Khoảng năm coi là hợp lý cho một mốc thời gian nghiệp vụ.
 * Phải KHỚP với biểu thức của cột sinh `petitions.sortReceivedDate`
 * (migration 20260824120000) — nếu lệch, hồ sơ sẽ bị đẩy xuống cuối mà KHÔNG
 * được đánh dấu, và cán bộ không hiểu vì sao nó nằm dưới cùng.
 */
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function isImplausibleDate(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y < MIN_YEAR || y >= MAX_YEAR;
}

/**
 * Ô ngày trong bảng danh sách. Ngày phi lý được đánh dấu rõ.
 *
 * Vì sao cần: đợt di trú để lọt 9 đơn thư có ngày nhận năm 3023, 2925, 2205, 0225...
 * Hệ thống đã đẩy chúng xuống cuối khi sắp xếp, nhưng nếu không đánh dấu thì cán bộ
 * mở ra chỉ thấy một ngày lạ mà không biết đó là dữ liệu hỏng cần sửa.
 */
export function DateCell({ value }: { value?: string | null }) {
  if (!value) return <>—</>;

  if (isImplausibleDate(value)) {
    return (
      <span
        className="inline-flex items-center gap-1 text-amber-700 font-medium"
        title="Ngày không hợp lệ — cần rà lại hồ sơ gốc"
      >
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        {formatVNDate(value)}
        <span className="sr-only">(ngày không hợp lệ, cần rà lại)</span>
      </span>
    );
  }

  return <>{formatVNDate(value)}</>;
}
