import {
  DATE_RANGE_PRESETS,
  tinhKhoangThoiGian,
  type KhoangThoiGian,
} from '@/components/shared/ListPageShell/dateRangePresets';
import { A11Y_FOCUS_RING } from '@/constants/styles';

/**
 * Chip đặt nhanh khoảng thời gian — nằm ngay dưới hai ô Từ ngày / Đến ngày trong CÙNG mặt
 * lọc, vì nó ghi vào đúng hai ô ấy.
 *
 * Vì sao là chip chứ không phải menu thả xuống: menu tốn hai lần bấm và nút của nó cao gấp
 * đôi vì nhãn "Chọn khoảng thời gian" dài phải xuống dòng. Năm nhãn ngắn nằm gọn một hàng,
 * bấm MỘT lần, và thấy hết lựa chọn mà không phải mở.
 *
 * Phần tính mốc dùng lại `dateRangePresets.ts` đã có và đã kiểm (10 ca) — không viết lại.
 */
export function DateRangePresets({
  onPick,
  today,
}: {
  /** Nhận CẢ HAI mốc trong một lần gọi — hai lần gọi rời nhau thì mốc sau ghi đè mốc trước. */
  onPick: (khoang: KhoangThoiGian) => void;
  /** Mốc "hôm nay". Tách ra để ca kiểm cố định được thời điểm. */
  today?: Date;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-xs font-medium text-slate-500">Nhanh:</span>
      {DATE_RANGE_PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          data-testid={`preset-${p.key}`}
          onClick={() => {
            const khoang = tinhKhoangThoiGian(p.key, today ?? new Date());
            if (khoang) onPick(khoang);
          }}
          className={`rounded px-2 py-0.5 text-xs font-medium text-[#003973] hover:bg-[#003973]/10 ${A11Y_FOCUS_RING}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
