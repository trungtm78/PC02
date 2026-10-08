import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useListboxNav, laDangGoDau } from '@/hooks/useListboxNav';

/**
 * Ô chữ TỰ DO có gợi ý theo dữ liệu đã có.
 *
 * Trích ra từ ô "Ghi chú trùng đơn" của form Đơn thư — nơi cùng một logic (ô chữ, hoãn 300 ms,
 * danh sách xổ xuống, chọn thì điền) đã chạy trên prod nhưng nằm nhúng thẳng trong một trang
 * 1.300 dòng, không tái dùng và không đo được. Anh yêu cầu 22/09/2026 thêm gợi ý cho ô "Tên cá
 * nhân, cơ quan, tổ chức cung cấp, bị hại"; mở rộng primitive sẵn có thay vì dựng hệ thứ hai.
 *
 * Bàn phím (↑ ↓ PgUp PgDn, Enter, Esc, Tab) dùng `useListboxNav` chung với FKSelect và
 * CrimeSelect. Riêng Enter: CHƯA tô gợi ý nào thì Enter đi tiếp như trước (gửi form), vì đây là ô chữ
 * tự do — chỉ khi cán bộ đã chỉ đích danh một gợi ý bằng mũi tên thì Enter mới chọn và bị chặn.
 *
 * BA ĐIỂM LÀ HỢP ĐỒNG, không phải chi tiết:
 *
 * 1. KHÔNG ÉP CHỌN, và CHỐT THEO TỪNG PHÍM. Gõ một giá trị chưa từng có luôn phải lưu được —
 *    dữ liệu thật có cả cụm "Trần Thị Châu Giang (đại diện theo uỷ quyền Công ty TNHH MTV AG
 *    Việt Nam)".
 *
 *    Bản đầu giữ chữ trong một ô đệm rồi mới chốt lúc RỜI Ô, chép theo ô "Ghi chú trùng đơn"
 *    có sẵn. Ca kiểm bắt ngay: gõ tên rồi bấm thẳng nút Lưu thì chữ chưa kịp chốt, form báo
 *    thiếu ô bắt buộc và KHÔNG gọi máy chủ — cán bộ thấy "chưa nhập tên" trong khi tên đang
 *    hiện trên màn. Cú bấm nút có làm ô mất tiêu điểm, nhưng phép hoãn 200 ms (để kịp bắt cú
 *    bấm vào một dòng gợi ý) chạy SAU trình xử lý của nút.
 *
 *    Nên không có ô đệm: mỗi phím gõ là một lần chốt, `value` là nguồn duy nhất.
 * 2. GỢI Ý HỎNG KHÔNG CHẶN NHẬP. Lời gọi mạng lỗi thì danh sách rỗng và ô vẫn gõ bình thường.
 * 3. DỌN HẸN GIỜ khi tháo component. Bỏ sót là một lượt gọi mạng chạy trên component đã tháo.
 */
export interface ONhapGoiYProps<T> {
  value: string;
  /** Gọi ở MỖI phím gõ, và khi chọn một gợi ý. Không có trạng thái đệm nào nằm lại bên trong. */
  onChange: (v: string) => void;
  /** Tra gợi ý. Ném lỗi thì coi như không có gợi ý nào. */
  timGoiY: (q: string) => Promise<T[]>;
  /** Khoá React của một dòng gợi ý. */
  khoa: (g: T) => string;
  /** Chữ sẽ điền vào ô khi cán bộ chọn dòng ấy. */
  nhan: (g: T) => string;
  /**
   * Cách vẽ một dòng gợi ý. `ngu.dangTo` cho biết dòng này đang được TÔ bằng bàn phím (↑ ↓) — để dòng tự bung
   * phần chi tiết thay vì bắt người dùng với tay lấy chuột. Tham số thứ hai tuỳ chọn: nơi gọi cũ bỏ qua được.
   */
  hien: (g: T, ngu: { dangTo: boolean }) => ReactNode;
  placeholder?: string;
  className?: string;
  testId?: string;
  /** Hoãn trước khi hỏi máy chủ, mặc định 300 ms. */
  doTre?: number;
  disabled?: boolean;
}

export function ONhapGoiY<T>({
  value,
  onChange,
  timGoiY,
  khoa,
  nhan,
  hien,
  placeholder,
  className,
  testId,
  doTre = 300,
  disabled,
}: ONhapGoiYProps<T>) {
  const [goiY, setGoiY] = useState<T[]>([]);
  const [moXo, setMoXo] = useState(false);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Chỉ nhận kết quả của lượt gõ MỚI NHẤT: lượt cũ về sau sẽ đè danh sách đúng bằng danh sách cũ.
  const luot = useRef(0);
  const maGoc = useId().replace(/:/g, '');
  const maDanhSach = `${maGoc}-ds`;
  const dangMo = moXo && goiY.length > 0;

  const chon = useCallback(
    (g: T) => {
      // Huỷ lượt đang bay: chọn xong mà kết quả cũ về sau sẽ mở lại danh sách.
      luot.current++;
      if (hen.current) clearTimeout(hen.current);
      onChange(nhan(g));
      setGoiY([]);
      setMoXo(false);
    },
    [onChange, nhan],
  );

  // Gợi ý mới về (khác bộ khoá) thì bỏ tô, để Enter không chọn nhầm dòng cũ.
  const khoaDanhSach = useMemo(() => goiY.map(khoa).join('\u0001'), [goiY, khoa]);

  const nav = useListboxNav({
    count: goiY.length,
    resetKey: khoaDanhSach,
    idPrefix: maGoc,
    chanEnterKhiChuaTo: false,
    onSelect: (i) => {
      const g = goiY[i];
      if (g !== undefined) chon(g);
    },
    onEscape: () => setMoXo(false),
    onTab: () => setMoXo(false),
  });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (laDangGoDau(e)) return;
    if (!dangMo) {
      // Danh sách đã đóng nhưng còn gợi ý: ↓ mở lại. Mọi phím khác đi tiếp bình thường.
      if (e.key === 'ArrowDown' && goiY.length > 0) {
        e.preventDefault();
        setMoXo(true);
      }
      return;
    }
    nav.onKeyDown(e);
  };

  useEffect(
    () => () => {
      if (hen.current) clearTimeout(hen.current);
    },
    [],
  );

  const goPhim = useCallback(
    (q: string) => {
      onChange(q);
      // Bỏ tô NGAY, không đợi gợi ý mới về: chữ đã đổi thì dòng tô trước đó không còn là điều cán bộ chỉ
      // tới. Để tới lúc gợi ý về mới bỏ thì Enter trong khoảng hoãn sẽ ghi đè chữ vừa gõ bằng gợi ý cũ.
      nav.reset();
      if (hen.current) clearTimeout(hen.current);
      /*
        TĂNG SỐ LƯỢT TRƯỚC mọi nhánh, kể cả nhánh xoá trắng.

        Bản đầu `return` sớm khi ô rỗng mà chưa tăng số lượt, nên lượt đang bay của chữ cũ về
        sau vẫn qua được phép kiểm và gọi `setMoXo(true)`: cán bộ xoá trắng ô rồi danh sách gợi
        ý của chữ vừa xoá TỰ BẬT LẠI. Cùng lỗi khi chọn xong một gợi ý.
      */
      const cuaToi = ++luot.current;
      if (!q.trim()) {
        setGoiY([]);
        setMoXo(false);
        return;
      }
      hen.current = setTimeout(async () => {
        try {
          const ra = await timGoiY(q);
          if (cuaToi !== luot.current) return;
          setGoiY(Array.isArray(ra) ? ra : []);
          setMoXo(true);
        } catch {
          if (cuaToi !== luot.current) return;
          setGoiY([]);
        }
      }, doTre);
    },
    [onChange, timGoiY, doTre, nav.reset],
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => goPhim(e.target.value)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={dangMo}
        aria-controls={dangMo ? maDanhSach : undefined}
        aria-activedescendant={dangMo ? nav.activeDescendantId : undefined}
        onFocus={() => goiY.length > 0 && setMoXo(true)}
        // Hoãn để cú bấm vào một dòng gợi ý kịp chạy trước khi danh sách đóng. Không chốt giá
        // trị ở đây — giá trị đã được chốt từng phím ở `goPhim`.
        onBlur={() => setTimeout(() => setMoXo(false), 200)}
        className={
          className ??
          'w-full px-4 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        }
        placeholder={placeholder}
        data-testid={testId}
      />
      {dangMo && (
        <div
          id={maDanhSach}
          role="listbox"
          className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-72 overflow-y-auto"
          data-testid={testId ? `${testId}-goi-y` : undefined}
        >
          {goiY.map((g, i) => (
            // <div role=option>, không phải <button>: hàng có thể chứa nút/liên kết riêng (vd "Xem thêm"),
            // mà <button> lồng <button> là HTML sai. Chọn bằng mouseDown (kịp trước khi ô mất tiêu điểm).
            <div
              key={khoa(g)}
              id={nav.optionId(i)}
              role="option"
              aria-selected={false}
              data-active={i === nav.activeIndex ? 'true' : undefined}
              className={`w-full cursor-pointer text-left px-4 py-2 text-sm ${
                i === nav.activeIndex ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-50'
              }`}
              onMouseDown={() => chon(g)}
            >
              {hien(g, { dangTo: i === nav.activeIndex })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
