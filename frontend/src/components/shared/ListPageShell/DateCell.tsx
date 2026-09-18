import { AlertTriangle } from 'lucide-react';
import { formatVNDate } from '@/lib/dates';
import { isImplausibleDate } from './implausibleDate';

/**
 * Chữ ô ngày: MỘT dòng, mono, số `tnum` để các ngày thẳng cột (DESIGN §11). Bảng danh sách nay xuống dòng —
 * thiếu `whitespace-nowrap` thì sau khi đổi font "27/08/2026" bị bẻ thành "27/08/202 | 6" (bấm thử 18/09/2026).
 */
const CHU_SO = 'font-mono tabular-nums text-[0.8125rem]';
const CHU_NGAY = `${CHU_SO} whitespace-nowrap`;

/**
 * Ô ngày trong bảng danh sách — MỌI cột ngày của 3 màn đi qua đây (một cách vẽ). Ngày phi lý được đánh dấu rõ.
 *
 * Vì sao cần đánh dấu: đợt di trú để lọt 9 đơn thư có ngày nhận năm 3023, 2925, 2205, 0225...
 * Hệ thống đã đẩy chúng xuống cuối khi sắp xếp, nhưng nếu không đánh dấu thì cán bộ
 * mở ra chỉ thấy một ngày lạ mà không biết đó là dữ liệu hỏng cần sửa.
 */
export function DateCell({
  value,
  quaHan,
  title,
}: {
  value?: string | null;
  /** Hạn xử lý đã qua → chữ đỏ đậm. */
  quaHan?: boolean;
  /** Chú giải khi rê chuột (vd "Ngày tạo" của hồ sơ di trú). */
  title?: string;
}) {
  if (!value) return <>—</>;

  if (isImplausibleDate(value)) {
    return (
      <span
        // ĐƯỢC xuống dòng: biểu tượng + ngày (~96px) dài hơn chỗ chữ của cột ngày (80px) — cấm xuống dòng thì
        // đè sang cột bên. Không tô đỏ "quá hạn": màu hổ phách đã nói ngày này hỏng, hạn tính từ nó vô nghĩa.
        className={`inline-flex flex-wrap items-center gap-1 text-amber-700 font-medium ${CHU_SO}`}
        title="Ngày không hợp lệ — cần rà lại hồ sơ gốc"
      >
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        {formatVNDate(value)}
        <span className="sr-only">(ngày không hợp lệ, cần rà lại)</span>
      </span>
    );
  }

  return (
    <span className={`${CHU_NGAY} ${quaHan ? 'text-red-700 font-semibold' : ''}`.trim()} title={title}>
      {formatVNDate(value)}
    </span>
  );
}
