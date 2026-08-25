import { useState } from 'react';

/**
 * Ô "Tóm tắt nội dung" — cột cán bộ đọc nhiều nhất ở hệ cũ.
 *
 * Hệ mới không hiện cột này, dù dữ liệu có ở 99,99% đơn thư, 99,98% vụ việc và 98% vụ án.
 * Hệ quả: muốn biết hồ sơ nói gì phải mở từng cái, trong khi hệ cũ đọc thẳng trên danh
 * sách. Đó là lý do thật đằng sau yêu cầu "danh sách cần giống hệ cũ".
 *
 * Hành vi theo hệ cũ: cắt ngắn kèm liên kết "Xem thêm" mở rộng tại chỗ. Thêm "Thu gọn" vì
 * hệ cũ mở rồi không đóng lại được — cán bộ bấm nhầm một dòng phải tải lại trang.
 */

/** Ngưỡng cắt. Đủ để nắm ý, không phá bố cục bảng chín cột. */
const NGUONG = 150;

/** Cắt ở ranh giới TỪ — cắt giữa chữ làm chữ cuối vô nghĩa và khó đọc. */
export function catTheoTu(s: string, nguong: number): string {
  if (s.length <= nguong) return s;
  const cat = s.slice(0, nguong);
  const khoangTrangCuoi = cat.lastIndexOf(' ');
  return khoangTrangCuoi > 0 ? cat.slice(0, khoangTrangCuoi) : cat;
}

export function SummaryCell({ value }: { value?: string | null }) {
  const [moRong, setMoRong] = useState(false);

  const text = (value ?? '').trim();
  if (!text) {
    return (
      <span data-testid="summary-text" className="text-slate-400">
        —
      </span>
    );
  }

  const canCat = text.length > NGUONG;
  const hienThi = !canCat || moRong ? text : `${catTheoTu(text, NGUONG)}…`;

  return (
    // `w-full` chứ không phải trần riêng: bề rộng do CỘT quyết (khai ở `columns` của từng
    // trang, lấy từ số đo dữ liệu thật). Đặt thêm một trần ở đây là hai nguồn sự thật cho
    // cùng một con số, và cái nhỏ hơn sẽ âm thầm thắng.
    <div className="w-full">
      <span data-testid="summary-text" className="text-slate-700 whitespace-pre-wrap">
        {hienThi}
      </span>
      {canCat && (
        <button
          type="button"
          onClick={() => setMoRong((v) => !v)}
          className="ml-1 text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          {moRong ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </div>
  );
}
