import { useContext, useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react';
import { LOP_KEP, MatDoContext, SO_DONG_TOM_TAT } from './matDo';

/**
 * Ô "Tóm tắt nội dung" — cột cán bộ đọc nhiều nhất ở hệ cũ.
 *
 * Anh yêu cầu 18/09/2026: hiện 5 DÒNG; "Xem thêm" bung TẠI CHỖ, không nhảy sang màn xem.
 *
 * - Kẹp bằng CSS (`line-clamp-5`) chứ không cắt chữ: toàn văn luôn nằm trong ô (chép/tìm trên trang được),
 *   và 5 dòng là 5 dòng thật theo bề rộng cột — cắt theo số ký tự thì cột rộng vẫn hụt, cột hẹp vẫn tràn.
 * - "Xem thêm" chỉ hiện khi chữ TRÀN thật (cao nội dung > cao khung), đo lại khi cột đổi bề rộng.
 * - Nút chặn lan cả chuột lẫn phím: ô nằm trong `<tr onClick/onKeyDown>` mở hồ sơ — không chặn thì bấm
 *   "Xem thêm" là nhảy sang màn xem (lỗi anh báo ở cả 3 màn).
 * - Có "Thu gọn": hệ cũ mở rồi không đóng lại được.
 * - Số dòng theo MẬT ĐỘ của bảng (context, PR-F2): Gọn 1 · Đọc 5 (mặc định) · Đầy đủ không kẹp, không nút.
 */
export function SummaryCell({ value }: { value?: string | null }) {
  const [moRong, setMoRong] = useState(false);
  const [coTran, setCoTran] = useState(false);
  const chuRef = useRef<HTMLSpanElement>(null);

  const soDong = SO_DONG_TOM_TAT[useContext(MatDoContext)];
  const text = (value ?? '').trim();
  const kep = soDong !== null && !moRong;

  useLayoutEffect(() => {
    const el = chuRef.current;
    // Không kẹp (đang bung, hoặc mật độ "Đầy đủ") thì không đo — giữ nguyên "có tràn" để nút "Thu gọn" còn đó.
    if (!el || !kep) return;
    const doLai = () => setCoTran(el.scrollHeight > el.clientHeight + 1);
    doLai();
    if (typeof ResizeObserver === 'undefined') return;
    const quanSat = new ResizeObserver(doLai);
    quanSat.observe(el);
    return () => quanSat.disconnect();
  }, [text, kep]);

  if (!text) {
    return (
      <span data-testid="summary-text" className="text-slate-400">
        —
      </span>
    );
  }

  const chanLan = (e: SyntheticEvent) => e.stopPropagation();

  return (
    // `w-full` chứ không phải trần riêng: bề rộng do CỘT quyết (khai ở `columns` của từng
    // trang, lấy từ số đo dữ liệu thật). Đặt thêm một trần ở đây là hai nguồn sự thật cho
    // cùng một con số, và cái nhỏ hơn sẽ âm thầm thắng.
    <div className="w-full">
      <span
        ref={chuRef}
        data-testid="summary-text"
        // KHÔNG kèm `block` khi đang kẹp: `line-clamp-5` cần `display:-webkit-box`, `block` đè mất và ô hiện hết
        // mọi dòng (bấm thử Chrome 18/09/2026 — ô cao 13 dòng; jsdom không tính CSS nên ca kiểm không thấy).
        className={`font-doc text-[0.906rem] leading-relaxed text-slate-700 whitespace-pre-wrap break-words ${kep ? LOP_KEP[soDong] : 'block'}`}
      >
        {text}
      </span>
      {soDong !== null && (coTran || moRong) && (
        <button
          type="button"
          aria-expanded={moRong}
          onClick={(e) => {
            chanLan(e);
            setMoRong((v) => !v);
          }}
          onKeyDown={chanLan}
          className="mt-0.5 text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          {moRong ? 'Thu gọn ▴' : 'Xem thêm ▾'}
        </button>
      )}
    </div>
  );
}
