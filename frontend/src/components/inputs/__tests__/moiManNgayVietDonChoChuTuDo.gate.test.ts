import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  CỔNG PHẠM VI: cả ba màn có ô "Ngày viết đơn" đều phải bật chế độ chữ tự do.

  Ca hỏng 21/09/2026 chỉ lộ ở Đơn thư vì đó là màn cán bộ đang nhập. Vụ việc và Vụ án có CÙNG ô
  ấy và còn tệ hơn: trước hôm nay chúng dựng ô ngày TRƠN nên ngày thiếu thành phần mất hẳn.

  Ô nhập tự nó đã có ca kiểm (`PartialDateInputChuTuDo.test.tsx`). Cổng này canh mắt xích KHÁC:
  các màn có THẬT SỰ bật cờ không. Gỡ `chuTuDo` khỏi một màn là ô ấy lặng lẽ quay về chặn, mà
  mọi ca kiểm khác vẫn xanh.
*/
const GOC = join(__dirname, '..', '..', '..', 'pages');
const MAN: { ten: string; tep: string; truong: string }[] = [
  { ten: 'Đơn thư', tep: 'petitions/PetitionFormPage/index.tsx', truong: 'petitionDate' },
  { ten: 'Vụ việc', tep: 'incidents/IncidentFormPage.tsx', truong: 'ngayVietDon' },
  { ten: 'Vụ án', tep: 'cases/CaseFormPage/tabs.tsx', truong: 'ngayVietDon' },
];

/** Khối khai ô `<truong>: (label) => (...)` cho tới lời gọi `PartialDateInput` gần nhất sau nó. */
function khoiO(than: string, truong: string): string {
  const i = than.indexOf(`${truong}: (label) => (`);
  if (i === -1) return '';
  const j = than.indexOf('/>', i);
  return j === -1 ? '' : than.slice(i, j);
}

describe('Mọi màn có ô Ngày viết đơn đều bật chuTuDo', () => {
  const doc = MAN.map((m) => ({
    ...m,
    khoi: khoiO(readFileSync(join(GOC, m.tep), 'utf8'), m.truong),
  }));

  /** Cổng quét 0 màn mà xanh là cổng rỗng — lớp hỏng kho mã này đã vấp sáu lần. */
  it('tìm thấy khối khai ô ở CẢ BA màn', () => {
    expect(doc.filter((d) => !d.khoi).map((d) => d.ten)).toEqual([]);
  });

  it('cả ba đều dùng PartialDateInput với chuTuDo', () => {
    const thieu = doc
      .filter((d) => !d.khoi.includes('PartialDateInput') || !d.khoi.includes('chuTuDo'))
      .map((d) => d.ten);
    expect(thieu).toEqual([]);
  });

  /*
    Bật cờ mà quên truyền `valueChu` thì mở hồ sơ cũ ra ô hiện bản DỰNG LẠI chứ không hiện chữ
    đã lưu — cán bộ bấm Lưu là chữ nguyên văn bị thay bằng `__/05/2026`. Mất dữ liệu, im lặng.
  */
  it('cả ba đều truyền valueChu và onDoc', () => {
    const thieu = doc
      .filter((d) => !d.khoi.includes('valueChu') || !d.khoi.includes('onDoc'))
      .map((d) => d.ten);
    expect(thieu).toEqual([]);
  });
});
