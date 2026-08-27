import { describe, it, expect } from 'vitest';
import nguonDonThu from '@/pages/petitions/PetitionListPageShell.tsx?raw';
import nguonVuViec from '@/pages/incidents/IncidentListPageShell.tsx?raw';
import nguonVuAn from '@/pages/cases/CaseListPageShell.tsx?raw';
import { cotTheoNhan } from '@/features/legacy-form/registry';

/**
 * CỔNG: cột trên danh sách phải đọc ĐÚNG cột mà ô cùng nhãn trên form ghi vào.
 *
 * Hai lớp ấy nằm ở hai tệp khác nhau và mỗi lớp tự nhất quán, nên khi chúng lệch thì không
 * ca kiểm khứ hồi nào thấy: form ghi cột A rồi đọc lại cột A, danh sách đọc cột B rồi hiện
 * cột B. Chỉ đối chiếu với DỮ LIỆU THẬT mới lộ.
 *
 * Đo trên máy chạy 27/08/2026, ba nhãn đang lệch:
 *
 *   • Đơn thư · "Ngày đề xuất" đọc `receivedDate` (ngày TIẾP NHẬN) — lệch 29.026/46.499 hồ sơ.
 *   • Vụ việc · "Tên cá nhân…" đọc `doiTuongCaNhan` (ĐỐI TƯỢNG BỊ TỐ) — khớp bản gốc 0%.
 *   • Vụ án  · "Tên cá nhân…" đọc `name` (TÊN VỤ ÁN) — khớp bản gốc 0%.
 *
 * Bản đầu của cổng này chốt đúng MỘT nhãn ("Đơn vị giải quyết") nên ba nhãn trên vẫn lọt.
 * Nay tra bảng `cotTheoNhan` cho mọi nhãn — thêm nhãn mới là tự được gác.
 *
 * Đọc mã nguồn dạng văn bản: dựng cây React lên chỉ thấy ô đang mở, không thấy khai báo cột.
 */

interface Man {
  ten: string;
  thucThe: string;
  nguon: string;
}

const BANG: Man[] = [
  { ten: 'Đơn thư', thucThe: 'petition', nguon: nguonDonThu },
  { ten: 'Vụ việc', thucThe: 'incident', nguon: nguonVuViec },
  { ten: 'Vụ án', thucThe: 'case', nguon: nguonVuAn },
];

/**
 * Nhãn KHÔNG thuộc bố cục hệ cũ, hoặc không đọc thẳng một cột.
 *
 * Khai tường minh kèm lý do — im lặng bỏ qua là cách một cột lệch trốn được cổng.
 */
const MIEN_TRU: Readonly<Record<string, string>> = {
  'Thao tác': 'nút bấm, không phải dữ liệu',
  'Trạng thái': 'trạng thái hệ mới, hệ cũ không có cột này',
  'Điều tra viên': 'quan hệ người dùng của hệ mới',
  'Người nhập': 'quan hệ người dùng, đọc qua `enteredBy`/`canBoNhap`',
  'Hạn xử lý': 'thời hạn hệ mới tự tính, hệ cũ không có',
  'Ngày tạo': 'mốc kỹ thuật của hệ mới',
  'Đối tượng bị tố': 'cột ẩn của hệ mới, không nằm trong bộ cột hệ cũ',
  'Đối tượng bị can': 'danh sách bị can dựng từ quan hệ, không đọc một cột',
  STT: 'mã hồ sơ, mỗi thực thể một tên cột riêng (`stt`/`code`/`caseCode`)',
};

/**
 * Nhãn trên DANH SÁCH viết ngắn hơn nhãn trên FORM — hệ cũ cũng làm vậy.
 *
 * Cột danh sách chỉ rộng vài chữ nên hệ cũ rút "Ngày/Tháng/Năm đề xuất" thành "Ngày đề xuất".
 * Không nối hai chữ ấy lại thì cổng tưởng nhãn không có trong bố cục và bỏ qua — đúng cách
 * cột "Ngày đề xuất" của Đơn thư lệch mà không ai thấy.
 */
const NHAN_FORM_CUA_NHAN_DANH_SACH: Readonly<Record<string, string>> = {
  'Ngày đề xuất': 'Ngày/Tháng/Năm đề xuất',
};

/** Cột form ứng với một nhãn trên danh sách. */
function cotFormCuaNhan(thucThe: string, nhan: string): string | null {
  return cotTheoNhan(thucThe, NHAN_FORM_CUA_NHAN_DANH_SACH[nhan] ?? nhan);
}

/**
 * Bỏ chú thích trước khi dò cột.
 *
 * Chú thích hay nhắc tên cột CŨ để giải thích vì sao đổi, và cổng dò `r.<tên>` đầu tiên sẽ vớ
 * đúng cái tên bị nhắc ấy — báo lệch trong khi mã chạy thật đã đúng. Chiều ngược nguy hơn:
 * một chú thích nhắc đúng tên cột mới có thể che một dòng mã vẫn còn đọc cột sai.
 */
function boChuThich(ma: string): string {
  return ma.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Cặp (nhãn cột, cột mà ô cột ấy đọc từ bản ghi) khai trong tệp dựng danh sách. */
function cotCuaDanhSach(nguon: string): { nhan: string; doc: string | null }[] {
  const ra: { nhan: string; doc: string | null }[] = [];
  const re = /header: '([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(nguon))) {
    // Khối khai cột bắt đầu ở dấu `{` gần nhất phía trước, kết thúc khi độ sâu về 0.
    const mo = nguon.lastIndexOf('{', m.index);
    let i = mo + 1;
    let sau = 1;
    while (i < nguon.length && sau > 0) {
      if (nguon[i] === '{') sau++;
      else if (nguon[i] === '}') sau--;
      i++;
    }
    const doc = /\br\.(\w+)/.exec(boChuThich(nguon.slice(mo, i)));
    ra.push({ nhan: m[1], doc: doc ? doc[1] : null });
  }
  return ra;
}

describe.each(BANG.map((m) => [m.ten, m] as const))(
  'GATE %s — cột danh sách đọc đúng cột mà ô cùng nhãn trên form ghi',
  (_ten, man) => {
    const cot = cotCuaDanhSach(man.nguon);

    it('đọc được danh sách cột, không rơi về rỗng', () => {
      expect(cot.length).toBeGreaterThan(8);
    });

    it('mọi nhãn đều hoặc có trong bố cục hệ cũ, hoặc được miễn trừ có lý do', () => {
      const la = cot
        .map((c) => c.nhan)
        .filter((n) => !(n in MIEN_TRU) && cotFormCuaNhan(man.thucThe, n) === null);
      expect(la).toEqual([]);
    });

    it('nhãn nào có trong bố cục hệ cũ thì cột danh sách phải trỏ đúng cột form ghi', () => {
      const lech = cot
        .filter((c) => !(c.nhan in MIEN_TRU))
        .map((c) => ({ nhan: c.nhan, danhSach: c.doc, form: cotFormCuaNhan(man.thucThe, c.nhan) }))
        .filter((c) => c.form !== null && c.danhSach !== c.form);
      expect(lech).toEqual([]);
    });
  },
);
