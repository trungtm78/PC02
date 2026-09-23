import { Pencil } from 'lucide-react';
import type { SyntheticEvent } from 'react';
import { A11Y_FOCUS_RING } from '@/constants/styles';

/**
 * Ô trong bảng cho SỬA NHANH giá trị ngay tại chỗ, không rời màn danh sách.
 *
 * Anh báo 23/09/2026: chỗ bấm sửa nhanh ở cột "Kết quả xử lý" rất khó nhìn. Đo lại thì không
 * phải icon xấu — KHÔNG CÓ ICON NÀO: bản trước bọc cả ô trong một `<button>` và dựa vào
 * `hover:underline decoration-dotted`, tức gạch chân chấm chỉ lộ ra khi rê chuột. Trên bảng 50
 * dòng, không ai rê từng ô để khám phá xem ô nào bấm được.
 *
 * Ba luật của ô này, mỗi luật có lý do đo được:
 *
 * 1. LUÔN HIỆN, không hover-only. Kho mã đã ghi chuẩn vùng chạm WCAG 2.5.8 (`styles.ts:340`) —
 *    affordance chỉ-hiện-khi-rê là không dùng được trên máy tính bảng và điện thoại.
 *
 * 2. CHỮ KHÔNG PHẢI NÚT. `DESIGN.md §11.2` đã ghi luật cho ô cùng loại (`SummaryCell`): "Bấm
 *    vào CHỮ (ngoài nút) vẫn mở hồ sơ như mọi ô khác." Bọc cả ô làm cột này cư xử khác mọi cột
 *    còn lại của bảng.
 *
 * 3. Ô RỖNG mời nhập, không hiện dấu gạch trơn. Đo bản sao prod 23/09/2026 trên cột "Kết quả xử
 *    lý": 76% ô rỗng (11.225/46.741 có chữ). Ô rỗng mới là ca dùng chính — nó là chỗ cán bộ cần
 *    nhập, chứ không phải chỗ báo "không có gì".
 *
 * Chặn lan CẢ `click` LẪN `keydown`, chép `chanLan` của `SummaryCell.tsx:66`: ô nằm trong
 * `<tr onClick>` mở hồ sơ. Hôm nay dòng chưa nhận phím nên nhánh `keydown` chưa lộ ra, nhưng đi
 * lệch nếp nhà là để sẵn một cái bẫy cho ngày nào đó bảng nhận phím.
 */
export interface OSuaNhanhProps {
  /** Giá trị đang có. Rỗng/`null` → trạng thái mời nhập. */
  giaTri?: string | null;
  /** Nhãn hiện ở ô RỖNG, vd "Nhập kết quả". */
  nhanThem: string;
  /** Mô tả để dựng `aria-label` — phải nói được ĐÂY LÀ HỒ SƠ NÀO; cột có 50 nút giống nhau. */
  moTa: string;
  /** Không có quyền ghi: hiện chữ trơn, không nút. Máy chủ vẫn chặn 403 như cũ. */
  chiXem?: boolean;
  onSua: () => void;
  testId?: string;
}

/** Ô nằm trong `<tr onClick>` mở hồ sơ — nút phải chặn cả chuột lẫn phím. */
const chanLan = (e: SyntheticEvent) => e.stopPropagation();

export function OSuaNhanh({
  giaTri,
  nhanThem,
  moTa,
  chiXem = false,
  onSua,
  testId,
}: OSuaNhanhProps) {
  const chu = (giaTri ?? '').trim();

  if (chiXem) {
    return chu ? (
      <span className="whitespace-pre-wrap break-words">{chu}</span>
    ) : (
      <span className="text-slate-400">—</span>
    );
  }

  const nut = (
    <button
      type="button"
      onClick={(e) => {
        chanLan(e);
        onSua();
      }}
      onKeyDown={chanLan}
      // Cùng bộ lớp nút của `SummaryCell.tsx:85-96` — một cách vẽ nút-trong-ô cho cả bảng.
      /*
        `p-1` + `min-w-6 min-h-6` là VÙNG CHẠM, không phải trang trí.

        Bản đầu để nút đúng bằng icon 14×14px — trong khi chú thích ngay trên lại viện chuẩn
        vùng chạm WCAG 2.5.8 làm lý do cho "luôn hiện". Bấm trượt một nút 14px không phải là
        không có gì xảy ra: nó rơi xuống `<tr onClick>` và NHẢY SANG MÀN SỬA.

        `flex-shrink-0` để chữ dài không đẩy nút ra khỏi cột 10rem rồi bị `overflow-hidden` của
        ô cắt mất — mất luôn chỗ bấm.
      */
      className={`inline-flex flex-shrink-0 items-center justify-center gap-1 min-w-6 min-h-6 p-1 -m-1 rounded text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none ${A11Y_FOCUS_RING}`}
      aria-label={chu ? `Sửa nhanh ${moTa}` : `${nhanThem} — ${moTa}`}
      title={chu ? `Sửa nhanh ${moTa}` : `${nhanThem} — ${moTa}`}
      data-testid={testId}
    >
      {/* `Pencil` là icon "sửa" chuẩn của dự án (`commonResourceActions.ts:48`). Cỡ w-3.5 là cỡ
          dùng trong ngữ cảnh dày (`CaseObjectsTab.tsx:736`). */}
      <Pencil className="w-3.5 h-3.5 flex-shrink-0" />
      {chu ? null : nhanThem}
    </button>
  );

  // Ô rỗng: nút LÀ nội dung của ô — không còn dấu gạch, vì ô rỗng là chỗ cần nhập.
  if (!chu) return nut;

  return (
    // `min-w-0` trên ô chữ: chữ dài không ngắt được (mã hồ sơ, đường dẫn) có bề rộng tối
    // thiểu TỰ NHIÊN lớn hơn cột, và `break-words` một mình không hạ nó xuống.
    <span className="flex w-full items-start gap-1.5">
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{chu}</span>
      {nut}
    </span>
  );
}
