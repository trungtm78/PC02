import { useState } from 'react';
import { formatVNDate } from '@/lib/dates';
import { PETITION_STATUS_SHORT_LABEL } from '@/shared/enums/status-labels';
import type { PetitionStatus } from '@/shared/enums/generated';
import { useChuTran } from '@/components/shared/useChuTran';

/** Một hàng của `GET /petitions/goi-y-don-theo-ten`. */
export interface GoiYDon {
  id: string;
  stt: string;
  ten: string;
  /** `YYYY-MM-DD`. */
  ngayTiepNhan: string;
  /** Tóm tắt nội dung (cột `detailContent`), đã cắt ở máy chủ; null khi đơn không có. */
  tomTat: string | null;
  trangThai: string;
  /** Số đơn cùng tên trong phạm vi cán bộ đọc được. */
  soDonCungTen: number;
}

/**
 * Một hàng gợi ý của ô "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" (anh yêu cầu 08/10/2026).
 *
 * Không chỉ "tên + số đơn" như trước: mỗi hàng là MỘT ĐƠN kèm STT, ngày tiếp nhận, trạng thái và Tóm tắt nội
 * dung (kẹp 1 dòng, bung xem toàn bộ) để cán bộ nhận ra đúng người, đúng việc đã gửi trước đó.
 *
 * Hàng nằm trong danh sách chọn bằng `onMouseDown`, nên MỌI điều khiển bên trong (nút bung, liên kết mở) phải
 * chặn mouseDown lan lên: bấm "Xem thêm" mà chọn luôn gợi ý và điền tên vào ô thì hỏng đúng mục đích. Chặn cả
 * `preventDefault` để ô nhập không mất tiêu điểm (mất tiêu điểm là danh sách đóng).
 *
 * Hàng đang được TÔ bằng bàn phím thì TỰ BUNG, không cần phím ←/→ vì chúng đang là phím di chuyển con trỏ trong
 * ô nhập.
 */
export function GoiYDonThu({ don, dangTo }: { don: GoiYDon; dangTo: boolean }) {
  const [moTay, setMoTay] = useState(false);
  const bung = moTay || dangTo;
  const tomTat = don.tomTat ?? '';
  const { ref, coTran } = useChuTran<HTMLSpanElement>(tomTat, !bung);

  const nhanTrangThai = PETITION_STATUS_SHORT_LABEL[don.trangThai as PetitionStatus] ?? don.trangThai;
  const chanChon = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-0.5" data-testid={`goi-y-don-${don.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium">{don.ten}</span>
        <span className="text-xs text-slate-500">
          {don.stt} · {formatVNDate(don.ngayTiepNhan)}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-px text-[11px] text-slate-700">{nhanTrangThai}</span>
        {don.soDonCungTen > 1 && (
          <span className="text-xs text-slate-500">{don.soDonCungTen} đơn cùng tên</span>
        )}
        <a
          href={`/petitions/${don.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onMouseDown={(e) => e.stopPropagation()}
          className="ml-auto text-xs text-blue-600 hover:underline"
        >
          Mở ↗
        </a>
      </div>
      {tomTat !== '' && (
        <div>
          <span
            ref={ref}
            data-testid="goi-y-tom-tat"
            // KHÔNG kèm `block` khi đang kẹp: `line-clamp-1` cần display:-webkit-box, `block` đè mất kẹp.
            className={`text-xs text-slate-600 whitespace-pre-wrap break-words ${bung ? 'block' : 'line-clamp-1'}`}
          >
            {tomTat}
          </span>
          {/* Đang tự bung vì được tô thì không cần nút. */}
          {!dangTo && (coTran || moTay) && (
            <button
              type="button"
              aria-expanded={moTay}
              onMouseDown={chanChon}
              onClick={() => setMoTay((v) => !v)}
              className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              {moTay ? 'Thu gọn ▴' : 'Xem thêm ▾'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
