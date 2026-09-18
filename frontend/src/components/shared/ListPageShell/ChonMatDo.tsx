import { A11Y_FOCUS_RING } from '@/constants/styles';
import type { MatDo } from './matDo';

const LUA_CHON: { giaTri: MatDo; nhan: string; goiY: string }[] = [
  { giaTri: 'gon', nhan: 'Gọn', goiY: 'Mỗi ô một dòng — xem được nhiều hồ sơ nhất' },
  { giaTri: 'doc', nhan: 'Đọc', goiY: 'Tóm tắt 5 dòng, các cột xuống dòng (mặc định)' },
  { giaTri: 'day-du', nhan: 'Đầy đủ', goiY: 'Hiện toàn bộ nội dung, không cần bấm "Xem thêm"' },
];

/**
 * Bộ chọn mật độ dòng, đặt cạnh nút "Cột" (18/09/2026, PR-F2 — mẫu Airtable "row height"). Nhóm nút bật/tắt
 * (`aria-pressed`) chứ không phải ô chọn: ba lựa chọn nhìn thấy cùng lúc, một cú bấm là đổi.
 */
export function ChonMatDo({ giaTri, onDoi }: { giaTri: MatDo; onDoi: (moi: MatDo) => void }) {
  return (
    <div
      role="group"
      aria-label="Mật độ dòng"
      data-testid="chon-mat-do"
      className="inline-flex rounded-md border border-slate-300 bg-white p-0.5"
    >
      {LUA_CHON.map((l) => {
        const dangChon = l.giaTri === giaTri;
        return (
          <button
            key={l.giaTri}
            type="button"
            aria-pressed={dangChon}
            title={l.goiY}
            onClick={() => onDoi(l.giaTri)}
            className={`${A11Y_FOCUS_RING} px-2.5 py-1.5 text-xs font-medium rounded ${
              dangChon ? 'bg-[#003973] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {l.nhan}
          </button>
        );
      })}
    </div>
  );
}
