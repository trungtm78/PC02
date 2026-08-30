import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cauSoSanh, type KetQuaSoSanh } from '@/lib/soSanhKy';

/**
 * Huy hiệu "so với kỳ nền" cho thẻ thống kê.
 *
 * ── Thay cho cái gì ──
 *
 * Chỗ này trước đây là `change: "+12%"` — một chuỗi viết thẳng trong mã, hiện y hệt ở mọi
 * tháng, mọi năm, mọi đơn vị, kể cả khi số liệu tải về bình thường. Nó nằm trên tờ báo cáo cán
 * bộ mang đi họp.
 *
 * ── Ba luật của huy hiệu này ──
 *
 * 1. **Không có gì trung thực để nói thì KHÔNG hiện.** Thà thiếu một huy hiệu còn hơn để nó
 *    khẳng định một điều không tính được.
 * 2. **Màu theo NGHĨA, không theo dấu.** Tô xanh cho mọi dấu cộng là cách nhanh nhất để màn
 *    hình chúc mừng cán bộ vì số hồ sơ quá hạn vừa tăng. Chiều tốt/xấu do máy chủ khai theo
 *    từng chỉ tiêu; chỉ tiêu trung tính thì để xám.
 * 3. **Tỷ lệ dựa trên nền nhỏ phải TỰ KHAI.** Kèm dấu cảnh báo và nói ra trong tooltip.
 */
interface Props {
  ketQua: KetQuaSoSanh | undefined;
  /** Nhãn kỳ nền, ví dụ "tháng 8/2025" — để câu chữ nói rõ đang so với gì. */
  nenNhan: string | undefined;
  'data-testid'?: string;
}

export function HuyHieuSoSanh({ ketQua, nenNhan, 'data-testid': testId }: Props) {
  const c = cauSoSanh(ketQua, nenNhan);
  if (!c.nhan) return null;

  const mau =
    c.tot === true
      ? 'bg-green-50 text-green-700 border-green-200'
      : c.tot === false
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  const Icon =
    ketQua?.chieu === 'TANG' ? TrendingUp : ketQua?.chieu === 'GIAM' ? TrendingDown : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border ${mau} ${c.daoDong ? 'opacity-80' : ''}`}
      title={c.giaiThich}
      data-testid={testId}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {c.nhan}
      {c.daoDong && <AlertTriangle className="w-3 h-3" aria-hidden="true" />}
      <span className="sr-only">{c.giaiThich}</span>
    </span>
  );
}
