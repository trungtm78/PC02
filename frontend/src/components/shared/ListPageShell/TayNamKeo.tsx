import { useCallback, useRef, useState } from 'react';

/**
 * Tay nắm kéo giãn bề rộng cột, đặt ở mép phải ô tiêu đề.
 *
 * ── Vì sao báo MỘT LẦN lúc thả tay ──
 *
 * Một lần kéo sinh hàng chục sự kiện di chuyển. Gửi mỗi cái lên máy chủ là hàng chục lượt ghi
 * cho một thao tác, và bảng nhấp nháy theo từng vòng tải lại. Trong lúc kéo chỉ đổi trạng
 * thái cục bộ để vẽ tức thì; chốt lại đúng một lần khi nhả chuột.
 *
 * ── Vì sao dùng Pointer Capture ──
 *
 * Không bắt con trỏ thì kéo nhanh ra ngoài tay nắm là mất luôn chuỗi sự kiện, và cột kẹt ở
 * một bề rộng dở dang mà người dùng không hiểu vì sao.
 *
 * ── Vì sao chặn lan ──
 *
 * Nút sắp xếp nằm CÙNG ô tiêu đề. Không chặn thì mỗi lần kéo cho rộng ra là một lần bảng nhảy
 * thứ tự, và cán bộ mất chỗ đang đọc giữa 46.000 hồ sơ.
 */

/** Trùng với ngưỡng máy chủ (`bo-cuc-cot.util.ts`) — kẹp ở đây để đỡ một vòng gọi vô ích. */
export const BE_RONG_TOI_THIEU = 60;
export const BE_RONG_TOI_DA = 1200;
/** Một nhịp phím mũi tên. Đủ thấy đổi, đủ nhỏ để chỉnh tinh. */
const BUOC_PHIM = 16;

function kep(n: number): number {
  return Math.round(Math.min(BE_RONG_TOI_DA, Math.max(BE_RONG_TOI_THIEU, n)));
}

export function TayNamKeo({
  tenCot,
  nhanCot,
  beRongHienTai,
  onXong,
  onVeMacDinh,
}: {
  tenCot: string;
  /** Nhãn cột, chỉ dùng cho trình đọc màn hình. */
  nhanCot: string;
  beRongHienTai: number;
  /** Gọi ĐÚNG MỘT LẦN khi kết thúc một thao tác chỉnh. */
  onXong: (px: number) => void;
  onVeMacDinh?: () => void;
}) {
  const [dangKeo, setDangKeo] = useState(false);
  const moc = useRef<{ x: number; w: number } | null>(null);

  const batDau = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      moc.current = { x: e.clientX, w: beRongHienTai };
      setDangKeo(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [beRongHienTai],
  );

  const diChuyen = useCallback((e: React.PointerEvent) => {
    if (!moc.current) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const ketThuc = useCallback(
    (e: React.PointerEvent) => {
      const m = moc.current;
      moc.current = null;
      setDangKeo(false);
      if (!m) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      const moi = kep(m.w + (e.clientX - m.x));
      // Bấm rồi thả tại chỗ là một CÚ BẤM, không phải một lần kéo — đừng ghi gì cả.
      if (moi === m.w) return;
      onXong(moi);
    },
    [onXong],
  );

  const phim = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        onXong(kep(beRongHienTai + (e.key === 'ArrowRight' ? BUOC_PHIM : -BUOC_PHIM)));
        return;
      }
      if (e.key === 'Home' && onVeMacDinh) {
        e.preventDefault();
        e.stopPropagation();
        onVeMacDinh();
      }
    },
    [beRongHienTai, onXong, onVeMacDinh],
  );

  return (
    <div
      data-testid={`tay-nam-keo-${tenCot}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Kéo giãn cột ${nhanCot}`}
      tabIndex={0}
      onPointerDown={batDau}
      onPointerMove={diChuyen}
      onPointerUp={ketThuc}
      onPointerCancel={ketThuc}
      onKeyDown={phim}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onVeMacDinh?.();
      }}
      // Chặn cú bấm tổng hợp sau khi thả tay: không chặn thì trình duyệt vẫn bắn `click` lên ô
      // tiêu đề và bảng nhảy thứ tự ngay sau mỗi lần kéo.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      title={`Kéo để đổi bề rộng cột ${nhanCot}. Bấm đúp để về mặc định.`}
      className={[
        'absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none',
        // `touch-none` để trên máy bảng thao tác kéo không bị hiểu thành cuộn trang.
        'touch-none',
        dangKeo ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-300',
        'focus:outline-none focus:bg-blue-400',
      ].join(' ')}
    />
  );
}
