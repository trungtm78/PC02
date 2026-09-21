import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  CỔNG: cột ngày SỔ SÁCH phải khai rõ có vào dòng "tất cả các cột" hay không.

  Dòng ấy fan-out sang MỌI trường `kieu: 'ngay'`. Với Nhật ký thì `createdAt` chính là ngày
  nghiệp vụ — gõ ngày ra đúng dòng nhật ký hôm ấy. Với Đơn thư thì KHÔNG: 45.459 hồ sơ di trú
  mang CÙNG một `createdAt` (ngày chạy di trú), nên gõ tháng ấy là trả về cả kho.

  Vậy không có luật nào suy được từ tên cột. Phải khai, và cổng này chặn việc quên khai: thêm
  một khai mới có cột sổ sách mà không quyết định là ĐỎ, chứ không phải âm thầm nhận mặc định.
*/
const COT_SO_SACH = ['createdAt', 'updatedAt', 'deadline'];
const THU_MUC = join(__dirname, 'khai');

/**
 * Khối khai `{ ... }` bao quanh mỗi chỗ nhắc `cot: '<ten>'`.
 *
 * Quét chuỗi, KHÔNG dùng biểu thức chính quy. Bản đầu của cổng này dùng regex và các dấu gạch
 * chéo bị nuốt lúc ghi tệp, thành `cot:s*'deadline'` — không khớp gì, nên cổng XANH trong khi
 * khai đã hỏng. Gieo lỗi lộ ra ngay. Một cổng không đỏ được là một cổng không tồn tại.
 */
function khoiChua(than: string, cot: string): string[] {
  const ra: string[] = [];
  const khoa = `cot: '${cot}'`;
  for (let i = than.indexOf(khoa); i !== -1; i = than.indexOf(khoa, i + 1)) {
    const mo = than.lastIndexOf('{', i);
    const dong = than.indexOf('}', i);
    if (mo === -1 || dong === -1) continue;
    const khoi = than.slice(mo, dong + 1);
    // Có `{` khác nằm giữa nghĩa là ta đã bắt nhầm khối cha — bỏ.
    if (khoi.indexOf('{', 1) !== -1) continue;
    ra.push(khoi);
  }
  return ra;
}

describe('Cột ngày sổ sách phải khai vaoTatCa', () => {
  const tep = readdirSync(THU_MUC).filter((t) => t.endsWith('.khai.ts'));

  it('có tệp khai để quét', () => {
    expect(tep.length).toBeGreaterThan(10);
  });

  /** Cổng phải THẤY được khai đúng, nếu không "không tìm thấy vi phạm" là vô nghĩa. */
  it('quét được ít nhất 10 khối cột sổ sách — cổng quét 0 khối mà xanh là cổng rỗng', () => {
    const tong = tep
      .flatMap((t) => {
        const than = readFileSync(join(THU_MUC, t), 'utf8');
        return COT_SO_SACH.flatMap((c) => khoiChua(than, c));
      })
      .filter((k) => k.includes("kieu: 'ngay'"));
    expect(tong.length).toBeGreaterThanOrEqual(10);
  });

  it('mọi trường ngày trên cột sổ sách đều khai vaoTatCa', () => {
    const thieu: string[] = [];
    for (const ten of tep) {
      const than = readFileSync(join(THU_MUC, ten), 'utf8');
      for (const cot of COT_SO_SACH) {
        for (const khoi of khoiChua(than, cot)) {
          if (!khoi.includes("kieu: 'ngay'")) continue;
          if (!khoi.includes('vaoTatCa: true') && !khoi.includes('vaoTatCa: false'))
            thieu.push(`${ten}: ${khoi.replace(/\s+/g, ' ').slice(0, 90)}`);
        }
      }
    }
    expect(thieu).toEqual([]);
  });
});

/*
  CỔNG: danh sách thực thể có nhãn Trạng thái cho dòng "tất cả các cột" phải TƯỜNG MINH.

  `nhanhNgoaiCotGhep` chạy cho MỌI thực thể, nhưng nửa trạng thái chỉ sống ở thực thể nào khai
  `nhanGiaTri`. Anh chốt ba màn chính, nên chín thực thể còn lại KHÔNG có là đúng phạm vi —
  nhưng "đúng phạm vi" và "quên mất" nhìn giống hệt nhau trong mã.

  Cổng này không cấm gì; nó bắt danh sách phải khớp. Thêm hay bớt một thực thể là phải sửa ở đây,
  tức là một quyết định có chữ ký, không phải một sự im lặng.
*/
describe('Thực thể có nhãn Trạng thái cho "*"', () => {
  const CO_NHAN = ['don-thu.khai.ts', 'vu-viec.khai.ts', 'vu-an.khai.ts'];

  it('đúng ba màn chính, không hơn không kém', () => {
    const that = readdirSync(THU_MUC)
      .filter((t) => t.endsWith('.khai.ts'))
      .filter((t) => /nhanGiaTri:/.test(readFileSync(join(THU_MUC, t), 'utf8')));
    expect(that.sort()).toEqual([...CO_NHAN].sort());
  });
});
