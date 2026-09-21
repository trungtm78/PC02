import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  CỔNG: mọi thực thể có "Ngày viết đơn" phải GHI đủ cột chữ ở CẢ đường tạo lẫn đường sửa.

  VÌ SAO TỒN TẠI. 21/09/2026 lượt soát bắt một lỗi P1 mà bộ ca kiểm không thấy: giao diện Vụ
  việc/Vụ án gửi đủ `ngayVietDon` + `ngayVietDonEdtf` + `ngayVietDonChu`, nhưng service chỉ ghi
  cột ngày trơn. DTO đã khai hai cột kia nên `forbidNonWhitelisted` cho qua — không 400, không
  log, chỉ MẤT.

  Và nó không dừng ở "tính năng không chạy": ô nhập ghi `ngayVietDon = ""` khi chữ không đọc ra
  ngày, nên cán bộ mở hồ sơ CÓ ngày, gõ "Không ghi ngày" rồi Lưu là ngày cũ bị xoá NULL còn chữ
  thay thế không được ghi. Mất dữ liệu, im lặng.

  Cổng phía giao diện (`moiManNgayVietDonChoChuTuDo.gate.test.ts`) chỉ đọc tệp React — không ca
  nào chạm máy chủ. Đó chính là khe hở. Cổng này đứng ở phía máy chủ.

  KHÔNG DÙNG REGEX. Bản đầu dùng `new RegExp(\`\bdto\.${'${cot}'}\b\`)`, và trong template
  literal thì `\b` là ký tự LÙI chứ không phải ranh giới từ — mẫu khớp 0 chỗ mà cổng vẫn xanh.
  Đây là lần thứ bảy kho mã này vấp cùng nguyên nhân. Quét chuỗi thuần thì không có gì để nuốt.
*/
const GOC = join(__dirname, '..', '..');
const KY_TU_TU = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';

interface Man {
  ten: string;
  tep: string;
  /**
   * Số lần đường GHI nhắc `dto.ngayVietDonChu`, ĐẾM CHÍNH XÁC chứ không "ít nhất".
   *
   * "Ít nhất" nghe an toàn hơn nhưng lại rỗng: một đường ghi nhắc DTO hai lần
   * (`dto.x !== undefined && { x: dto.x?.trim() }`), nên xoá hẳn một đường ghi của Vụ án vẫn
   * còn 2 — vừa đủ ngưỡng, cổng vẫn xanh, mà sửa hồ sơ thì mất chữ.
   *
   * Số chính xác nên đổi đường ghi là cổng ĐỎ và người sửa phải đọc lại chỗ này. Đó là chủ ý:
   * thêm/bớt đường ghi cho cột này là việc cần một quyết định có chữ ký, không phải việc lặng
   * lẽ trôi qua.
   */
  soLanNhac: number;
}

const MAN: Man[] = [
  // tạo (1) + sửa (2, vì `!== undefined` rồi `?.trim()`)
  { ten: 'Đơn thư', tep: 'petitions/petition-data.builder.ts', soLanNhac: 3 },
  // tạo (2) + sửa (2) — hai nhánh cùng hình dạng `!== undefined && { ... }`
  { ten: 'Vụ án', tep: 'cases/cases.service.ts', soLanNhac: 4 },
  // tạo (1) + sửa (2)
  { ten: 'Vụ việc', tep: 'incidents/incidents.service.ts', soLanNhac: 3 },
];

/**
 * Đếm chỗ ĐỌC `dto.<cột>` — tức đường GHI.
 *
 * `dto.` loại được dòng `select: { ngayVietDonChu: true }`, vốn làm phép đếm bản đầu tưởng đủ
 * khi đã xoá mất một đường ghi. Hậu tố là ký tự từ thì không tính: `dto.ngayVietDonChuXX` là
 * một tên KHÁC, và đổi tên cột mà cổng vẫn xanh là đúng lỗ hổng gieo lỗi đã lộ.
 */
function demGhi(than: string, cot: string): number {
  const khoa = `dto.${cot}`;
  let n = 0;
  for (let i = than.indexOf(khoa); i !== -1; i = than.indexOf(khoa, i + 1)) {
    if (!KY_TU_TU.includes(than[i + khoa.length] ?? '')) n += 1;
  }
  return n;
}

describe('Ngày viết đơn — máy chủ ghi đủ cột chữ ở mọi đường ghi', () => {
  const doc = MAN.map((m) => ({ ...m, than: readFileSync(join(GOC, m.tep), 'utf8') }));

  /** Cổng quét tệp rỗng mà xanh là cổng rỗng. */
  it('đọc được cả ba tệp service', () => {
    expect(doc.filter((d) => d.than.length < 1000).map((d) => d.ten)).toEqual([]);
  });

  /** Và phải THẤY được ít nhất một chỗ — đếm ra 0 ở mọi màn nghĩa là phép đếm hỏng, không phải mã hỏng. */
  it('phép đếm THẤY được đường ghi (không phải mẫu hỏng)', () => {
    expect(doc.map((d) => demGhi(d.than, 'ngayVietDonChu')).filter((n) => n > 0).length).toBe(3);
  });

  it.each(MAN.map((m) => m.ten))('%s: ghi cột chữ ở ĐỦ số đường ghi', (ten) => {
    const d = doc.find((x) => x.ten === ten)!;
    expect(`${ten} nhắc ${demGhi(d.than, 'ngayVietDonChu')} lần`).toBe(
      `${ten} nhắc ${d.soLanNhac} lần`,
    );
  });
});
