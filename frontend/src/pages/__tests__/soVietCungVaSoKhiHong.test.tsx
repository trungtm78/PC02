import { describe, it, expect } from 'vitest';

/**
 * Hai thứ một con số KHÔNG được phép là: viết cứng, và hiện khi chưa hỏi được máy chủ.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, chặn `**\/api/**` rồi đọc mọi ô chữ to đậm của 54 màn. Sau hai đợt vá,
 * 49/54 màn đã báo lỗi đúng (5 màn còn lại KHÔNG hỏi máy chủ lần nào nên im là đúng), nhưng
 * ba màn vẫn đưa ra con số:
 *
 *     /dashboard                  ["0","0","0","0"]   ← Tổng hồ sơ · Mới · Quá hạn · Đã xử lý
 *     /settings/overdue-records   ["0","0","0","0"]   ← Tổng trễ hạn · Nghiêm trọng · Cao · TB
 *     /activity-log               ["7"]               ← "Loại thao tác 7"
 *
 * Hai màn đầu báo lỗi ĐÚNG ở phía trên rồi vẫn để bốn số 0 ngay bên dưới — hai câu trái nhau
 * trên một màn, và mắt người đọc con số trước khi đọc câu cảnh báo.
 *
 * Số 7 ở màn thứ ba thuộc hạng khác: nó là hằng số viết thẳng trong JSX, không đến từ dữ liệu
 * lần nào. Cùng hạng ấy, nặng hơn nhiều, là bốn thẻ của báo cáo tháng và bốn thẻ của báo cáo quý:
 *
 *     change: "+12%"   change: "+8%"    change: "+15%"   change: "+10%"     (báo cáo tháng)
 *     change: "+18%"   change: "+17%"   change: "+5%"    change: "-12%"     (báo cáo quý)
 *
 * Máy chủ KHÔNG trả số kỳ trước (`reports-export.service.ts` chỉ có `totals` của kỳ hiện tại),
 * nên không có cách nào tính ra các tỷ lệ ấy. Chúng sai kể cả khi mọi thứ chạy tốt: mở báo cáo
 * tháng bất kỳ, năm bất kỳ, đơn vị bất kỳ — vẫn "+12%". Một báo cáo khoe tăng trưởng bịa là thứ
 * cán bộ mang đi họp.
 *
 * ── Luật ──
 *
 * Con số hiện cho người dùng phải đến từ dữ liệu. Không tính được thì KHÔNG hiện.
 */

const TEP = import.meta.glob('../**/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function bo(ten: string): boolean {
  return ten.includes('__tests__') || ten.includes('.test.');
}

describe('Không viết cứng con số cho người dùng đọc', () => {
  /**
   * Tỷ lệ phần trăm viết thẳng trong chuỗi. Loại trừ chuỗi lớp CSS (`w-1/2`, `translate-x-1/2`)
   * bằng cách chỉ bắt dấu `%` đứng ngay sau chữ số và có dấu cộng/trừ dẫn đầu.
   */
  it('không thẻ thống kê nào mang tỷ lệ tăng/giảm viết cứng', () => {
    const pham: string[] = [];
    for (const [ten, ma] of Object.entries(TEP)) {
      if (bo(ten)) continue;
      if (/(change|delta|trend)\s*:\s*["'][+-]\s*\d/.test(ma)) pham.push(ten);
    }
    expect(pham).toEqual([]);
  });

  /** Con số nằm thẳng trong JSX của một ô chữ to đậm — không đi qua biến nào. */
  it('không ô số liệu nào là hằng số viết thẳng trong JSX', () => {
    const pham: string[] = [];
    for (const [ten, ma] of Object.entries(TEP)) {
      if (bo(ten)) continue;
      if (/className="text-(2xl|3xl|4xl) font-bold[^"]*">\d+</.test(ma)) pham.push(ten);
    }
    expect(pham).toEqual([]);
  });
});

/**
 * Huy hiệu so sánh phải ĐI QUA hàm dựng câu, không được tự đặt chữ.
 *
 * Cổng này khác cổng "không viết cứng tỷ lệ" ở trên: chỗ kia cấm chuỗi `"+12%"`, chỗ này chặn
 * cách né — tự nối chuỗi `` `${x}%` `` ngay trong JSX của thẻ thống kê. Một khi đã nối tay thì
 * ba luật của `cauSoSanh` (nền 0, nền nhỏ, chiều tốt/xấu) đều bị bỏ qua, mà màn hình vẫn trông
 * đúng.
 */
describe('Huy hiệu so sánh đi qua hàm dựng câu', () => {
  it.each([['MonthlyReportPage.tsx'], ['QuarterlyReportPage.tsx']])(
    '%s — dùng HuyHieuSoSanh, không tự nối chuỗi phần trăm',
    (ten) => {
      const duong = Object.keys(TEP).find((k) => k.endsWith('/' + ten))!;
      const ma = TEP[duong];
      expect(ma).toMatch(/HuyHieuSoSanh/);
      // Bỏ qua hàm vẽ nhãn của biểu đồ (`label={({ percent }) => …%}`): đó là phần trăm của
      // TỔNG THỂ một lát bánh, không phải so sánh giữa hai kỳ. Cổng bắt nhầm là cổng sẽ bị tắt.
      const dong = ma
        .split(String.fromCharCode(10))
        .filter((l) => !/label=\{\(/.test(l))
        .filter((l) => /\$\{[^}]*\}%/.test(l));
      expect(dong).toEqual([]);
    },
  );
});

describe('Không hiện con số khi chưa hỏi được máy chủ', () => {
  /**
   * Hai màn này dựng thẻ từ một mảng `stats`/`cards` rồi `.map`. Cổng đọc mã: hễ tệp có phép
   * báo lỗi tải thì mọi ô chữ to đậm dựng từ mảng ấy phải đi qua `soLieuHienThi`.
   */
  it.each([['DashboardPage.tsx'], ['OverdueRecordsPage.tsx'], ['ActivityLogPage.tsx']])(
    '%s — ô số liệu đi qua soLieuHienThi',
    (ten) => {
      const duong = Object.keys(TEP).find((k) => k.endsWith('/' + ten));
      expect(duong, 'không tìm thấy ' + ten).toBeDefined();
      // `CHUA_BIET` là chính dấu gạch mà `soLieuHienThi` trả về — cùng một hàm ở `lib/`,
      // dùng trực tiếp khi ô số nằm trong một component con nhận sẵn `null`.
      expect(TEP[duong!]).toMatch(/soLieuHienThi|CHUA_BIET/);
    },
  );
});
