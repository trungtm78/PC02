import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Khai một nhóm ô gập được trong bố cục hệ cũ.
 *
 * `o` phải là các ô LIỀN NHAU trong đặc tả — cổng `nhomPhaiLienNhau` chặn điều này. Lý do:
 * bố cục là một lưới phẳng hai cột đặt theo thứ tự DOM, nên gom một tập ô RỜI buộc ô xen giữa
 * phải dời chỗ, và thẻ nhóm chiếm trọn bề ngang còn làm lệch cột của mọi ô phía sau.
 */
export interface NhomOKhai<TForm = unknown> {
  khoa: string;
  nhan: string;
  o: readonly string[];
  /**
   * Chỉ áp cho tab này. Bắt buộc khai khi các ô có bản GƯƠNG ở tab khác: bố cục hệ cũ cố ý
   * hiện lại một ô ở nhiều tab, và tab khác có thể chỉ có MỘT trong các ô của nhóm — gom ở
   * đó là gom một tập không đầy đủ.
   */
  tab?: string;
  /** Luật bung riêng của nhóm — vd "Nguồn đơn là nộp trực tiếp". */
  moKhi?: (formData: TForm) => boolean;
}

interface Props {
  nhan: string;
  khoa: string;
  /** Tổng số ô trong nhóm. */
  soO: number;
  /** Số ô đã có giá trị — hiện ngay trên tiêu đề để dữ liệu ẩn vẫn nhìn thấy được. */
  soODaNhap: number;
  /** Trong nhóm có ô bắt buộc — đánh dấu để cán bộ biết trong đó có thứ chặn Lưu. */
  coOBatBuoc: boolean;
  /** Trong nhóm có ô đang báo lỗi. */
  coLoi: boolean;
  /** Bung sẵn khi mở form (có dữ liệu, có lỗi, hoặc luật riêng). */
  moSan: boolean;
  children: ReactNode;
}

/**
 * Nhóm ô gập được.
 *
 * KHÔNG dùng `<details>`: nội dung vẫn nằm trong DOM khi đóng, nên ca kiểm tìm thấy ô và báo
 * xanh trong khi cán bộ không nhìn thấy gì — đã gặp thật.
 *
 * Nặng hơn tiêu đề nhóm của cây điều hướng (DESIGN.md §4.3): nhóm này chứa ô người ta gõ vào
 * và có thể chứa ô chặn Lưu, nên có vỏ thẻ riêng, bộ đếm, và trạng thái lỗi nhìn thấy được.
 */
export function NhomOGap({
  nhan,
  khoa,
  soO,
  soODaNhap,
  coOBatBuoc,
  coLoi,
  moSan,
  children,
}: Props) {
  const [nguoiDungMo, setNguoiDungMo] = useState<boolean | null>(null);
  // Bấm tay thắng trong phiên; luật tự-bung giành lại khi điều kiện đổi (vd đổi Nguồn đơn).
  const mo = nguoiDungMo ?? moSan;

  return (
    <div
      className={`md:col-span-2 rounded-lg border bg-white ${
        coLoi ? "border-red-300" : "border-slate-200"
      }`}
      data-testid={`nhom-${khoa}`}
    >
      <button
        type="button"
        onClick={() => setNguoiDungMo(!mo)}
        aria-expanded={mo}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors rounded-lg"
        data-testid={`nhom-${khoa}-nut`}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {mo ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          {coLoi && <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />}
          {nhan}
          {coOBatBuoc && <span className="text-red-500">*</span>}
        </span>
        {/*
          Bộ đếm là phần quan trọng nhất của tiêu đề: thu gọn mà giấu mất dữ liệu ĐÃ CÓ là
          kiểu hỏng tệ nhất của nhóm gập. Có nó thì dữ liệu ẩn vẫn nhìn thấy được.
        */}
        <span className="text-xs text-slate-500">
          {soO} ô{soODaNhap > 0 ? ` · ${soODaNhap} đã nhập` : ""}
        </span>
      </button>
      {mo && (
        <div className="border-t border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {children}
        </div>
      )}
    </div>
  );
}
