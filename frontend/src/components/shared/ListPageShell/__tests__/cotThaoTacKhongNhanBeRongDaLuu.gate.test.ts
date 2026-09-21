import { describe, it, expect } from 'vitest';
import { apDungBoCuc } from '../boCucCot';
import type { ColumnDef } from '../Table';

/*
  HOTFIX 21/09/2026 — nút "In chứng từ" và nút ⋮ biến mất khỏi danh sách Đơn thư trên prod.

  Đo bằng chính tài khoản báo lỗi (ADMIN, đủ 56 quyền). Nút CÓ trong DOM — nó bị CẮT:

      màn Đơn thư   ô "Thao tác" 113px   btn-print 413..441, btn-menu 445..477  → ngoài mép ô (414)
      màn Vụ việc   ô "Thao tác" 192px   không nút nào tràn
      màn Vụ án     ô "Thao tác" 192px   không nút nào tràn

  Bố cục cột đã lưu của người dùng ấy, đọc từ API prod:

      petitions -> actions: { width: 113 }
      cases     -> actions: (không có)

  113px là bề rộng người dùng kéo TỪ TRƯỚC KHI có nút In. Nó được lưu theo tài khoản, đè lên
  `12rem` khai trong mã, và KHÔNG BAO GIỜ tự cập nhật khi ta thêm một nút vào cột ấy.

  Lớp lỗi: một giá trị người dùng lưu hôm qua quyết định bố cục của tính năng thêm hôm nay. Nó
  im lặng theo đúng nghĩa xấu nhất — mỗi lần thêm nút là âm thầm làm hỏng cho đúng những người
  đã từng tuỳ chỉnh, và không cổng nào thấy vì mã nguồn vẫn khai `12rem`.

  Cột "Thao tác" chứa các nút ICON cỡ cố định, số lượng do ta quyết chứ không do dữ liệu. Nó
  không có lý do gì để người dùng đặt bề rộng. Nên: bỏ hẳn bề rộng đã lưu cho cột ấy.
*/
interface R { id: string }
const COT: ColumnDef<R>[] = [
  { key: 'actions', header: 'Thao tác', width: '12rem', khongDoiBeRong: true, render: () => 'x' },
  { key: 'stt', header: 'STT', width: '6rem', render: () => 'y' },
];

const beRong = (cot: ColumnDef<R>[], key: string) =>
  cot.find((c) => c.key === key)?.width;

describe('Cột khai khongDoiBeRong KHÔNG nhận bề rộng đã lưu', () => {
  it('bỏ qua bề rộng đã lưu cho cột Thao tác — đúng ca hỏng trên prod', () => {
    const ra = apDungBoCuc(COT, { actions: { width: 113 } });
    expect(beRong(ra, 'actions')).toBe('12rem');
  });

  it('cột thường VẪN nhận bề rộng đã lưu — không làm hỏng tính năng kéo cột', () => {
    const ra = apDungBoCuc(COT, { stt: { width: 200 } });
    expect(beRong(ra, 'stt')).toBe('200px');
  });

  /*
    Người dùng đã lưu CẢ HAI: cột Thao tác phải về mặc định, cột kia giữ nguyên lựa chọn của họ.
    Vá thô bạo (xoá sạch bố cục) là lấy mất tuỳ chỉnh người ta cố ý đặt.
  */
  it('lưu cả hai → chỉ cột Thao tác về mặc định, cột kia giữ nguyên', () => {
    const ra = apDungBoCuc(COT, { actions: { width: 113 }, stt: { width: 200 } });
    expect(beRong(ra, 'actions')).toBe('12rem');
    expect(beRong(ra, 'stt')).toBe('200px');
  });

  /*
    Cột "Thao tác" vốn đã không đổi chỗ được (`sticky` + không khai `optional`). Khẳng định
    điều ấy ở đây để bản vá bề rộng không vô tình mở ra đường đổi chỗ.
  */
  it('bố cục lưu cả position cũng không dời được cột Thao tác, và bề rộng vẫn bị bỏ qua', () => {
    const ra = apDungBoCuc(
      [{ ...COT[0], sticky: true }, { ...COT[1], optional: 'show' }],
      { actions: { width: 113, position: 1 }, stt: { position: 0 } },
    );
    expect(ra.map((c) => c.key)).toEqual(['actions', 'stt']);
    expect(beRong(ra, 'actions')).toBe('12rem');
  });
});

/*
  CỔNG PHẠM VI: mọi màn danh sách có cột "Thao tác" đều phải khai `khongDoiBeRong`.

  Vá một màn là vá cho một biểu hiện. Lỗi 21/09/2026 chỉ lộ ở Đơn thư vì chỉ người ấy từng kéo
  cột ở màn ấy — ba màn kia có CÙNG cấu trúc và chỉ đang may mắn. Cổng này bắt màn mới thêm về
  sau phải khai, chứ không đợi tới lúc có người kéo rồi mới biết.
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GOC = join(__dirname, '..', '..', '..', '..', 'pages');

function tepTsx(thuMuc: string): string[] {
  return readdirSync(thuMuc).flatMap((ten) => {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) return tepTsx(duong);
    return ten.endsWith('.tsx') && !ten.includes('.test.') ? [duong] : [];
  });
}

describe('Mọi cột Thao tác đều khai khongDoiBeRong', () => {
  const dung = tepTsx(GOC)
    .map((d) => ({ d, than: readFileSync(d, 'utf8') }))
    .filter((x) => x.than.includes('width: BE_RONG_COT_THAO_TAC'));

  it('quét được ít nhất 4 màn — cổng quét 0 màn mà xanh là cổng rỗng', () => {
    expect(dung.length).toBeGreaterThanOrEqual(4);
  });

  it('không màn nào thiếu khai', () => {
    const thieu = dung
      .filter((x) => {
        const i = x.than.indexOf('width: BE_RONG_COT_THAO_TAC');
        // Cắt tới cuối khối khai cột, không đếm ký tự: khai cột nằm sát nhau nên cửa sổ đếm
        // ký tự sẽ mượn `khongDoiBeRong` của cột bên cạnh và cổng xanh giả.
        const con = x.than.slice(i);
        const het = con.indexOf('\n      },');
        return !con.slice(0, het === -1 ? 400 : het).includes('khongDoiBeRong: true');
      })
      .map((x) => x.d.split(/[\/]/).pop());
    expect(thieu).toEqual([]);
  });
});
