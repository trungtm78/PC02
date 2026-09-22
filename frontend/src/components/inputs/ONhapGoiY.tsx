import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Ô chữ TỰ DO có gợi ý theo dữ liệu đã có.
 *
 * Trích ra từ ô "Ghi chú trùng đơn" của form Đơn thư — nơi cùng một logic (ô chữ, hoãn 300 ms,
 * danh sách xổ xuống, chọn thì điền) đã chạy trên prod nhưng nằm nhúng thẳng trong một trang
 * 1.300 dòng, không tái dùng và không đo được. Anh yêu cầu 22/09/2026 thêm gợi ý cho ô "Tên cá
 * nhân, cơ quan, tổ chức cung cấp, bị hại"; mở rộng primitive sẵn có thay vì dựng hệ thứ hai.
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
  /** Cách vẽ một dòng gợi ý. */
  hien: (g: T) => ReactNode;
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

  useEffect(
    () => () => {
      if (hen.current) clearTimeout(hen.current);
    },
    [],
  );

  const goPhim = useCallback(
    (q: string) => {
      onChange(q);
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
    [onChange, timGoiY, doTre],
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => goPhim(e.target.value)}
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
      {moXo && goiY.length > 0 && (
        <div
          className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto"
          data-testid={testId ? `${testId}-goi-y` : undefined}
        >
          {goiY.map((g) => (
            <button
              key={khoa(g)}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
              onMouseDown={() => {
                // Huỷ lượt đang bay: chọn xong mà kết quả cũ về sau sẽ mở lại danh sách.
                luot.current++;
                if (hen.current) clearTimeout(hen.current);
                onChange(nhan(g));
                setGoiY([]);
                setMoXo(false);
              }}
            >
              {hien(g)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
