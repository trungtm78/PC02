/**
 * UAT HỢP NHẤT FIELD — Lớp GIAO DIỆN (Gate 2, Playwright Chromium)
 * Oracle: docs/uat/consolidate-fields/_plan-scope.md
 *
 * Đây là tầng DUY NHẤT kiểm được cam kết cốt lõi của kế hoạch:
 * "mỗi khái niệm = 1 ô form (nhãn native)". Một khoá dữ liệu tồn tại trong mã nguồn
 * KHÔNG chứng minh có hay không có ô nhập cho người dùng — chỉ màn hình thật mới trả lời.
 */
import { test, expect, Page } from '@playwright/test';
import { loginToPage } from '../helpers/auth';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require(require('path').resolve(__dirname, '../../backend/node_modules/pg'));

function dbUrl(): string {
  const env = fs.readFileSync(path.resolve(__dirname, '../../backend/.env'), 'utf-8');
  return (env.match(/^DATABASE_URL="?([^"\n\r]+)"?/m) || [])[1] || '';
}
async function q<T = any>(sql: string): Promise<T[]> {
  const c = new Client({ connectionString: dbUrl() });
  await c.connect();
  try {
    return (await c.query(sql)).rows as T[];
  } finally {
    await c.end();
  }
}

/** Thu thập nhãn của MỌI ô nhập đang hiển thị trên màn hình (mọi tab đã mở). */
async function visibleFieldLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const isShown = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const s = getComputedStyle(el as HTMLElement);
      return s.display !== 'none' && s.visibility !== 'hidden' && (r.width > 0 || r.height > 0);
    };
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      const inp = el as HTMLInputElement;
      if (inp.type === 'hidden' || !isShown(el)) return;
      let label = '';
      const id = inp.getAttribute('id');
      if (id) {
        const l = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (l) label = (l.textContent || '').trim();
      }
      if (!label) {
        const wrap = inp.closest('label');
        if (wrap) label = (wrap.textContent || '').trim();
      }
      if (!label) label = inp.getAttribute('aria-label') || inp.getAttribute('placeholder') || '';
      if (!label) {
        const prev = inp.parentElement?.previousElementSibling;
        if (prev) label = (prev.textContent || '').trim();
      }
      out.push(label.replace(/\s+/g, ' ').trim());
    });
    return out;
  });
}

/** Mở hết các tab/section có thể bấm để không bỏ sót ô nào. */
async function expandEverything(page: Page): Promise<void> {
  const tabs = page.getByRole('tab');
  const n = await tabs.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

const RUN = `UATE2E-${Date.now().toString(36)}`;

test.describe('F9/F5 — Cam kết "mỗi khái niệm một ô" trên form Vụ án', () => {
  test('TC-139-E2E: Quét toàn form — đếm số ô nhập cho từng khái niệm trong 8 cặp đã gộp', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await expect(page).toHaveURL(/\/cases\/new/);
    await expandEverything(page);

    const labels = (await visibleFieldLabels(page)).filter(Boolean);
    expect(labels.length, 'form phải render được ô nhập').toBeGreaterThan(5);

    // Mỗi khái niệm: các mẫu nhãn coi là "cùng nghĩa" theo bảng A1 của kế hoạch
    // Loại nhãn thuộc khái niệm KHÁC để không đếm nhầm (ngày/nơi cấp là cụm định danh,
    // ô tìm kiếm không phải ô nhập dữ liệu hồ sơ, chủ thể khác là thực thể khác).
    // Hiệu chỉnh theo NHÃN THẬT đọc được từ màn hình đang chạy (44 ô).
    // Mỗi khái niệm của bảng A1 ứng với đúng một nhãn nghiệp vụ; nếu khớp nhiều hơn
    // một ô nghĩa là cam kết "một khái niệm một ô" chưa đạt.
    const CONCEPTS: Array<[string, RegExp]> = [
      ['Người tố cáo/Báo tin', /^họ và tên$|người báo tin|người tố cáo|tên cung cấp/i],
      ['Số CCCD', /^số cccd|^số căn cước|^số cmnd/i],
      ['Ngày sinh', /^ngày sinh$|^năm sinh$|sinh năm/i],
      ['Số điện thoại', /^số điện thoại$|^sđt$/i],
      ['Địa chỉ người báo tin', /^địa chỉ thường trú$|^địa chỉ liên hệ$|địa chỉ người/i],
      ['Tóm tắt nội dung', /^mô tả chi tiết$|^tóm tắt nội dung$/i],
      ['Số tiền thiệt hại', /^thiệt hại ước tính|^số tiền thiệt hại/i],
      ['Nơi xảy ra', /^nơi xảy ra$/i],
      ['Bị hại', /^bị hại$/i],
      ['Điều tra viên hệ cũ', /điều tra viên \(hệ cũ/i],
      ['Tội danh ban đầu', /^tội danh ban đầu$/i],
      ['Tình trạng hồ sơ', /^tình trạng hồ sơ$/i],
    ];

    const rows: Array<{ concept: string; count: number; labels: string[] }> = [];
    for (const [name, re] of CONCEPTS) {
      const hit = labels.filter((l) => re.test(l.replace(/\s*\*\s*$/, '').trim()));
      rows.push({ concept: name, count: hit.length, labels: hit });
    }
    console.log('\n[TC-139] Số ô nhập theo từng khái niệm (form TẠO MỚI vụ án):');
    for (const r of rows) console.log(`  ${r.concept.padEnd(24)} ${r.count} ô  ${r.labels.length ? '→ ' + r.labels.join(' | ') : ''}`);

    // Bộ dò phải THỰC SỰ thấy các ô — 0 ô nghĩa là phép đo hỏng, không phải form đúng.
    const notFound = rows.filter((r) => r.count === 0).map((r) => r.concept);
    expect(
      notFound,
      `Phép đo hỏng hoặc form thiếu ô: không tìm thấy ô nào cho ${notFound.join(', ')}`,
    ).toEqual([]);

    const duplicated = rows.filter((r) => r.count > 1);
    expect(
      duplicated.map((d) => `${d.concept}(${d.count}): ${d.labels.join(' | ')}`),
      'PLAN mục tiêu cuối: "mỗi khái niệm = 1 ô form" — các khái niệm dưới đây còn nhiều hơn một ô',
    ).toEqual([]);
  });

  test('TC-197-E2E: DRIFT-2 — form còn ô "năm sinh" riêng bên cạnh ô "ngày sinh" không', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await expandEverything(page);
    const labels = (await visibleFieldLabels(page)).filter(Boolean);
    const ngaySinh = labels.filter((l) => /ngày sinh/i.test(l));
    const namSinh = labels.filter((l) => /(năm sinh|sinh năm)/i.test(l));
    console.log(`\n[TC-197] ô "ngày sinh"=${ngaySinh.length} ${JSON.stringify(ngaySinh)} | ô "năm sinh"=${namSinh.length} ${JSON.stringify(namSinh)}`);
    expect(
      namSinh.length,
      'PLAN-A1-03: năm sinh hệ cũ và ngày sinh phải GỘP thành một ô (canonical là ngày sinh kiểu ngày)',
    ).toBe(0);
  });

  test('TC-140-E2E: Nhãn ô mang tên nghiệp vụ dễ hiểu, không phải tên trường hệ cũ', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await expandEverything(page);
    const labels = (await visibleFieldLabels(page)).filter(Boolean);
    const raw = labels.filter((l) => /^(tenCungCap|cccdCungCap|sdtCungCap|diaChiCungCap|moTaChiTiet|noiXayRa|deXuatXuLy|dieuTraVienText)$/i.test(l.trim()));
    console.log(`\n[TC-140] tổng ${labels.length} ô; nhãn còn để tên kỹ thuật: ${raw.length ? raw.join(', ') : 'không có'}`);
    expect(raw, 'PLAN-A1 cột "Nhãn form": ô phải mang nhãn nghiệp vụ, không phải tên trường').toEqual([]);
  });
});

test.describe('F9 — Bố cục theo dòng tố tụng (PLAN-C)', () => {
  test('TC-133-E2E: Số CCCD, ngày cấp và nơi cấp nằm liền kề nhau', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await expandEverything(page);
    const labels = (await visibleFieldLabels(page)).filter(Boolean);
    const idx = (re: RegExp) => labels.findIndex((l) => re.test(l));
    const iSo = idx(/(số\s*)?(cccd|căn cước|cmnd)/i);
    const iNgay = idx(/ngày cấp/i);
    const iNoi = idx(/nơi cấp/i);
    console.log(`\n[TC-133] vị trí: số CCCD=${iSo}, ngày cấp=${iNgay}, nơi cấp=${iNoi} (trong ${labels.length} ô)`);
    test.skip(iSo < 0 || iNgay < 0 || iNoi < 0, 'form tạo mới chưa hiển thị đủ cụm CCCD');
    const spread = Math.max(iSo, iNgay, iNoi) - Math.min(iSo, iNgay, iNoi);
    expect(spread, 'PLAN-C nguyên tắc: "CCCD số/ngày/nơi liền nhau" — có ô khác chen giữa').toBeLessThanOrEqual(3);
  });

  test('TC-137-E2E: Trường giai đoạn sau KHÔNG đứng trước trường tiếp nhận', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await expandEverything(page);
    const labels = (await visibleFieldLabels(page)).filter(Boolean);
    const iTiepNhan = labels.findIndex((l) => /(ngày tiếp nhận|tiếp nhận)/i.test(l));
    const iKetQua = labels.findIndex((l) => /(bản án|đình chỉ|khởi tố|kết quả xử lý)/i.test(l));
    console.log(`\n[TC-137] vị trí tiếp nhận=${iTiepNhan}, giai đoạn sau=${iKetQua}`);
    test.skip(iTiepNhan < 0 || iKetQua < 0, 'không đủ trường để so trình tự trên form tạo mới');
    expect(iKetQua, 'PLAN-C: "không để field giai-đoạn-sau trước tiếp-nhận" (AUTH-02 trình tự TT28)').toBeGreaterThan(iTiepNhan);
  });
});

test.describe('F2/F8 — Hồ sơ đã di trú: đọc từ cột, giữ bản gốc', () => {
  test('TC-019-E2E: Mở hồ sơ đã chuẩn hoá — ô hiển thị đúng giá trị của CỘT', async ({ page }) => {
    const rows = await q<any>(
      `SELECT id, "tenCungCap" AS v FROM cases WHERE "tenCungCap" IS NOT NULL AND name NOT LIKE 'UAT%' LIMIT 1`);
    test.skip(rows.length === 0, 'không có hồ sơ đã chuẩn hoá');
    const { id, v } = rows[0];
    await loginToPage(page, `/cases/${id}/edit`);
    await expandEverything(page);
    // React gán value qua thuộc tính DOM → KHÔNG xuất hiện trong HTML tuần tự hoá.
    // Phải đọc value/textContent thật.
    const shown = await page.evaluate(() => {
      const vals: string[] = [];
      document.querySelectorAll('input, textarea').forEach((el) => vals.push((el as HTMLInputElement).value || ''));
      vals.push(document.body.innerText || '');
      return vals;
    });
    const found = shown.some((x) => x.includes(v));
    console.log(`
[TC-019] hồ sơ ${id}: giá trị cột "${v}" hiện trên màn hình sửa: ${found}`);
    expect(found, `PLAN-B4: giá trị cột "${v}" phải hiện trên màn hình sửa hồ sơ`).toBe(true);
  });

  test('TC-127-E2E: Trường đã thăng KHÔNG xuất hiện lần hai ở khu dữ liệu hệ cũ', async ({ page }) => {
    const rows = await q<any>(
      `SELECT id FROM cases WHERE "soHoSoCu" IS NOT NULL AND "tenCungCap" IS NOT NULL AND name NOT LIKE 'UAT%' LIMIT 1`);
    test.skip(rows.length === 0, 'không có hồ sơ di trú');
    await loginToPage(page, `/cases/${rows[0].id}/edit`);
    await expandEverything(page);
    const labels = (await visibleFieldLabels(page)).filter(Boolean);
    const NOT_SAME = /(nơi cấp|ngày cấp|để tìm|tìm kiếm|tra cứu|đối tượng|nguyên đơn|bị đơn|thường trú)/i;
    const dupes: string[] = [];
    for (const [name, re] of [
      ['Người tố cáo', /(người tố cáo|người báo tin|tên cung cấp|người cung cấp)/i],
      ['Số CCCD', /(số\s*cccd|căn cước)/i],
      ['Số điện thoại', /(điện thoại|sđt)/i],
      ['Nơi xảy ra', /(nơi xảy ra|địa điểm xảy ra)/i],
    ] as Array<[string, RegExp]>) {
      const n = labels.filter((l) => re.test(l) && !NOT_SAME.test(l)).length;
      if (n > 1) dupes.push(`${name}: ${n} ô`);
    }
    console.log(`\n[TC-127] ô trùng trên màn hình SỬA hồ sơ di trú: ${dupes.length ? dupes.join('; ') : 'không có'}`);
    expect(dupes, 'PLAN-B4: "tránh 2 nguồn cùng ghi 1 cột"').toEqual([]);
  });

  test('TC-123-E2E: Bảng dữ liệu gốc hệ cũ hiển thị được', async ({ page }) => {
    const rows = await q<any>(`SELECT id FROM cases WHERE "soHoSoCu" IS NOT NULL AND metadata IS NOT NULL AND name NOT LIKE 'UAT%' LIMIT 1`);
    test.skip(rows.length === 0, 'không có hồ sơ di trú');
    await loginToPage(page, `/cases/${rows[0].id}/edit`);
    await expandEverything(page);
    const body = await page.textContent('body');
    const found = /dữ liệu gốc|hệ cũ|bản gốc|dữ liệu hệ thống cũ/i.test(body || '');
    console.log(`\n[TC-123] tìm thấy khu dữ liệu gốc: ${found}`);
    expect(found, 'PLAN-V5: "LegacyRawPanel hiện bản gốc"').toBe(true);
  });

  test('TC-124-E2E: Số hồ sơ hệ cũ hiển thị trên màn hình', async ({ page }) => {
    const rows = await q<any>(`SELECT id, "soHoSoCu" AS v FROM cases WHERE "soHoSoCu" IS NOT NULL AND name NOT LIKE 'UAT%' LIMIT 1`);
    test.skip(rows.length === 0, 'không có hồ sơ di trú');
    await loginToPage(page, `/cases/${rows[0].id}`);
    const body = (await page.textContent('body')) || '';
    console.log(`\n[TC-124] số hệ cũ = ${rows[0].v}, hiện trên màn hình: ${body.includes(rows[0].v)}`);
    expect(body.includes(rows[0].v), 'PLAN-C cluster G: sttCu/soHoSoCu phải xem được').toBe(true);
  });
});

test.describe('F12 — Vụ việc: phần giai đoạn tự mở đúng trạng thái (PLAN-A4-03)', () => {
  // Trạng thái CÓ THẬT trong khối dữ liệu: TIEP_NHAN (4.962), TAM_DINH_CHI (119),
  // PHUC_HOI_NGUON_TIN (1). Không dựng trạng thái giả — đo trên dữ liệu thật.
  const PHASES: Array<[string, string]> = [
    ['TC-173', 'TIEP_NHAN'],
    ['TC-176', 'TAM_DINH_CHI'],
    ['TC-176b', 'PHUC_HOI_NGUON_TIN'],
  ];
  for (const [tc, status] of PHASES) {
    test(`${tc}-E2E: Mở vụ việc trạng thái ${status} — không lỗi, mở đúng phần giai đoạn`, async ({ page }) => {
      const rows = await q<any>(`SELECT id, status FROM incidents WHERE status = '${status}' LIMIT 1`);
      test.skip(rows.length === 0, `không có vụ việc trạng thái ${status}`);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await loginToPage(page, `/incidents/${rows[0].id}/edit`);
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      const body = (await page.textContent('body')) || '';
      console.log(`\n[${tc}] vụ việc ${rows[0].id} trạng thái ${status} — lỗi trang: ${errors.length}`);
      expect(errors, 'PLAN-A4-03: mở hồ sơ không được lỗi').toEqual([]);
      expect(body.length, 'màn hình phải render nội dung').toBeGreaterThan(200);
    });
  }

  test('TC-178-E2E: Mở form TẠO MỚI vụ việc — không lỗi do chưa có trạng thái', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loginToPage(page, '/incidents/new');
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    console.log(`\n[TC-178] lỗi trang khi tạo mới vụ việc: ${errors.length ? errors.join(' | ') : 'không có'}`);
    expect(errors, 'PLAN-A4-03: bản sửa lỗi phải an toàn cả ở chế độ tạo mới').toEqual([]);
  });
});

test.describe('F11 — Đơn thư', () => {
  test('TC-163-E2E: Form Đơn thư — mỗi khái niệm một ô', async ({ page }) => {
    await loginToPage(page, '/petitions/new');
    await expandEverything(page);
    const labels = (await visibleFieldLabels(page)).filter(Boolean);
    const NOT_SAME = /(nơi cấp|ngày cấp|để tìm|tìm kiếm|tra cứu|đối tượng|nguyên đơn|bị đơn|thường trú|tiền án)/i;
    const rows: string[] = [];
    for (const [name, re] of [
      ['Người gửi đơn', /(người gửi|người tố cáo|người báo tin|tên cung cấp)/i],
      ['Số CCCD', /(số\s*cccd|căn cước)/i],
      ['Số điện thoại', /(điện thoại|sđt)/i],
      ['Địa chỉ', /(địa chỉ)/i],
    ] as Array<[string, RegExp]>) {
      const hit = labels.filter((l) => re.test(l) && !NOT_SAME.test(l));
      if (hit.length > 1) rows.push(`${name}: ${hit.length} ô → ${hit.join(' | ')}`);
    }
    console.log(`\n[TC-163] form Đơn thư có ${labels.length} ô; khái niệm trùng: ${rows.length ? rows.join('; ') : 'không có'}`);
    expect(rows, 'PLAN-A4-01: áp cam kết 1 ô/khái niệm cho cả Đơn thư').toEqual([]);
  });
});

test.describe('F9 — Phản hồi và tiếp cận', () => {
  test('TC-142-E2E: Lưu thành công có phản hồi rõ ràng cho người dùng', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await expandEverything(page);
    const nameBox = page.locator('input:visible').first();
    await nameBox.fill(`${RUN}-phanhoi`);
    const saveBtn = page.getByRole('button', { name: /lưu|tạo|thêm/i }).first();
    const hasSave = await saveBtn.count();
    test.skip(hasSave === 0, 'không tìm thấy nút lưu');
    await saveBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const body = (await page.textContent('body')) || '';
    const feedback = /thành công|đã lưu|đã tạo|bắt buộc|vui lòng|lỗi/i.test(body);
    console.log(`\n[TC-142] có phản hồi sau khi bấm lưu: ${feedback}`);
    expect(feedback, 'Nielsen #1: thao tác lưu phải có phản hồi, không im lặng').toBe(true);
  });

  test('TC-144-E2E: Ô nhập mới có nhãn liên kết cho công nghệ trợ giúp', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await expandEverything(page);
    const unlabeled = await page.evaluate(() => {
      let n = 0;
      document.querySelectorAll('input, textarea, select').forEach((el) => {
        const inp = el as HTMLInputElement;
        if (inp.type === 'hidden' || (inp as any).offsetParent === null) return;
        const id = inp.getAttribute('id');
        const hasFor = id ? !!document.querySelector(`label[for="${CSS.escape(id)}"]`) : false;
        const hasAria = !!(inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby'));
        const wrapped = !!inp.closest('label');
        if (!hasFor && !hasAria && !wrapped) n++;
      });
      return n;
    });
    console.log(`\n[TC-144] số ô KHÔNG có nhãn liên kết: ${unlabeled}`);
    expect(unlabeled, 'WCAG 2.2 — 1.3.1 / 3.3.2: mọi ô nhập phải có nhãn liên kết').toBe(0);
  });
});
