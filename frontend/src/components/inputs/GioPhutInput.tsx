import { useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Clock } from 'lucide-react';
import { useCheDoXem } from '../form/CheDoXem';
import { buocGioPhut, chuanHoaKhiRoiO, dinhDangKhiGo, gioHienTaiVN, laGioPhutHopLe } from '@/lib/gioPhut';

export interface GioPhutInputProps {
  /** Giá trị hiện tại: "" (chưa có) hoặc đang gõ dở ("8:3") hoặc "HH:mm" chuẩn. */
  value: string;
  onValueChange: (v: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Lỗi từ bước kiểm của form (vd "giờ ở tương lai"): hiện dưới ô, cùng chỗ với lỗi định dạng của chính ô. */
  loiNgoai?: string | null;
  'data-testid'?: string;
}

/**
 * Ô "Giờ tiếp nhận" — chữ + mặt nạ 24 giờ, KHÔNG dùng `<input type="time">` (hiện AM/PM theo máy, chưa có cổng WebKit).
 *
 * Nhập nhanh: gõ liền `0830` → `08:30`; `830` → `8:30` rồi `08:30` khi rời ô; dán `8h30` / `8 giờ 30` / `0830`. Giờ>23 hay phút>59
 * báo lỗi tại ô, KHÔNG tự sửa (số liệu trên văn bản tố tụng). ↑/↓ ±1 phút, Shift+↑/↓ ±1 giờ; nút đồng hồ = giờ hiện tại.
 * Chế độ xem của form (`useCheDoXem`): chỉ đọc, vẫn bôi/chép được, ẩn nút "Bây giờ".
 */
export function GioPhutInput({
  value,
  onValueChange,
  id,
  className,
  disabled,
  loiNgoai,
  'data-testid': testId = 'field-gioTiepNhan',
}: GioPhutInputProps) {
  const chiXem = useCheDoXem();
  const [loiRiengCuaO, setLoi] = useState<string | null>(null);
  const loi = loiRiengCuaO ?? loiNgoai ?? null;
  const khoa = chiXem || !!disabled;

  const doi = (s: string) => {
    setLoi(null);
    onValueChange(s);
  };

  const khiDoi = (e: ChangeEvent<HTMLInputElement>) => doi(dinhDangKhiGo(e.target.value));

  // Dán: chặn mặc định và tự chuẩn hoá toàn bộ nội dung dán ("8h30", "08.30", "0830"…) — dán chồng lên vùng đang bôi được.
  const khiDan = (e: ClipboardEvent<HTMLInputElement>) => {
    const chu = e.clipboardData.getData('text');
    if (!chu) return;
    e.preventDefault();
    const r = chuanHoaKhiRoiO(chu);
    doi(r.giaTri);
    if (r.loi) setLoi(r.loi);
  };

  const khiRoiO = () => {
    const r = chuanHoaKhiRoiO(value);
    onValueChange(r.giaTri);
    setLoi(r.loi);
  };

  const khiBamPhim = (e: KeyboardEvent<HTMLInputElement>) => {
    if (khoa || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const huong = e.key === 'ArrowUp' ? 1 : -1;
    // Ô rỗng hoặc đang gõ dở: bắt đầu từ giờ hiện tại thay vì đoán số người dùng chưa gõ xong.
    const goc = laGioPhutHopLe(value) ? value : gioHienTaiVN();
    doi(buocGioPhut(goc, huong * (e.shiftKey ? 60 : 1)));
  };

  const maLoi = `${testId}-loi`;
  return (
    <div>
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={5}
          placeholder="HH:MM"
          value={value}
          onChange={khiDoi}
          onPaste={khiDan}
          onBlur={khiRoiO}
          onKeyDown={khiBamPhim}
          readOnly={khoa || undefined}
          aria-invalid={loi ? true : undefined}
          aria-describedby={loi ? maLoi : undefined}
          className={
            className ??
            `w-full pl-9 ${khoa ? 'pr-4' : 'pr-10'} py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              loi ? 'border-red-400' : 'border-slate-300'
            }`
          }
          data-testid={testId}
        />
        {!khoa && (
          <button
            type="button"
            tabIndex={-1}
            title="Đặt giờ hiện tại"
            aria-label="Đặt giờ hiện tại"
            data-testid={`${testId}-bay-gio`}
            onClick={() => doi(gioHienTaiVN())}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
          >
            Bây giờ
          </button>
        )}
      </div>
      {loi && (
        <p id={maLoi} role="alert" data-testid={maLoi} className="mt-1 text-xs text-red-600">
          {loi}
        </p>
      )}
    </div>
  );
}
