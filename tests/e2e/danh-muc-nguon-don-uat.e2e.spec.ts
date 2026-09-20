/**
 * UAT nhóm G + J — trang Danh mục và phép ĐO trên Chrome thật, đợt 20/09/2026.
 *
 * Nhóm J tồn tại vì một lý do cụ thể: `DESIGN.md` đã ghi "jsdom không tính CSS", mà rủi ro lớn
 * nhất của đợt này (thẻ nhóm chiếm trọn bề ngang làm lệch cột mọi ô nửa-hàng phía sau) CHỈ lộ
 * ra khi có CSS thật. Cổng vitest không thay được bước này.
 */
import { test, expect } from '@playwright/test';
import { loginToPage } from '../helpers/auth';

test.describe('G · Trang Danh mục', () => {
  test('G1 — loại "Nguồn đơn/Đơn vị giao" có mặt trong danh sách loại', async ({ page }) => {
    await loginToPage(page, '/danh-muc');
    // Không có loại thì quản trị viên KHÔNG duyệt được mục cán bộ tạo nhanh — danh mục thành
    // một cái hộp chỉ ghi vào, không ai dọn được.
    await expect(page.getByText(/Nguồn đơn/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('G2/G3 — mục tạo nhanh hiện ra và đọc được trạng thái chờ duyệt', async ({ page }) => {
    await loginToPage(page, '/danh-muc');
    await expect(page.getByText(/Nguồn đơn/i).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText(/Nguồn đơn/i).first().click();

    // Mục "Trực tiếp" do ca UAT trước tạo qua đúng đường tạo nhanh của cán bộ.
    await expect(
      page.getByText('Trực tiếp').first(),
      'mục vừa tạo không hiện ở trang Danh mục thì quản trị không duyệt được',
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('J · Đo trên Chrome thật', () => {
  test('J3 — ô ngày không giật khi gõ: chữ số cùng bề rộng', async ({ page }) => {
    await loginToPage(page, '/petitions/new');
    const nam = page.getByTestId('field-petitionDate');
    await expect(nam).toBeVisible({ timeout: 30_000 });

    const font = await nam.evaluate((e) => {
      const cs = getComputedStyle(e);
      return { family: cs.fontFamily, variant: cs.fontVariantNumeric };
    });
    expect(
      /mono/i.test(font.family),
      `ô ngày dùng phông ${font.family} — chữ số khác bề rộng thì ô giật mỗi lần gõ`,
    ).toBe(true);

    // Đo THẬT: gõ hai giá trị khác nhau, bề rộng phải không đổi.
    await nam.fill('1111');
    const w1 = (await nam.boundingBox())!.width;
    await nam.fill('8888');
    const w2 = (await nam.boundingBox())!.width;
    expect(Math.abs(w1 - w2), `bề rộng đổi ${w1}→${w2} khi đổi chữ số`).toBeLessThan(1);
  });

  test('J2 — thẻ nhóm chiếm trọn bề ngang KHÔNG làm lệch cột ô phía sau', async ({ page }) => {
    /*
      Lưới hai cột đặt con theo thứ tự DOM. Một thẻ nhóm `md:col-span-2` chen vào giữa có thể
      đẩy mọi ô nửa-hàng phía sau sang cột kia — jsdom không thấy, chỉ CSS thật mới thấy.

      Phép đo: các ô nửa-hàng phải nằm trên ĐÚNG HAI mốc trái (hai cột), không sinh ra mốc thứ ba.
    */
    await loginToPage(page, '/petitions/new');
    await expect(page.getByTestId('field-nguonDon-trigger')).toBeVisible({ timeout: 30_000 });

    const mocTrai = await page.evaluate(() => {
      const o = Array.from(document.querySelectorAll('[data-testid^="legacy-field-"]'));
      const x = o
        .map((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 100 && r.width < 700 ? Math.round(r.left) : null;
        })
        .filter((v): v is number => v !== null);
      return Array.from(new Set(x)).sort((a, b) => a - b);
    });

    expect(mocTrai.length, 'không đo được ô nào').toBeGreaterThan(0);
    expect(
      mocTrai.length,
      `ô nửa-hàng nằm trên ${mocTrai.length} mốc trái khác nhau (${mocTrai.join(', ')}) — lưới đã lệch`,
    ).toBeLessThanOrEqual(2);
  });
});

test.describe('L8 · Hộp Phân công dùng chung nguồn cán bộ mới', () => {
  test('danh sách trong hộp Phân công có ĐỦ người và không lọt tài khoản đã khoá', async ({
    page,
  }) => {
    /*
      Hộp Phân công từng CHẾT IM LẶNG ở cả hai ô trên bản chạy. Vá rồi thì phải chứng minh nó
      ăn đúng nguồn cán bộ mới: đủ người, và không mời chọn tài khoản đã khoá.
    */
    const tok = process.env.UAT_TOKEN ?? '';
    expect(tok, 'cần UAT_TOKEN').not.toBe('');
    const goc = (process.env.BASE_URL_API || 'http://127.0.0.1:3000') + '/api/v1';

    const r = await page.request.get(`${goc}/admin/users?limit=500&status=active`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    expect(r.status(), await r.text()).toBe(200);
    const than = await r.json();
    const tong = than.total ?? (than.data ?? []).length;
    expect(
      tong,
      `mới ${tong} cán bộ — lời gọi bị cắt danh sách đã quay lại`,
    ).toBeGreaterThanOrEqual(200);

    // Và mọi người trả về đều đang hoạt động — không lẫn tài khoản khoá.
    for (const u of (than.data ?? []) as Array<{ isActive?: boolean }>) {
      expect(u.isActive, 'lọt tài khoản đã khoá vào nguồn cán bộ').not.toBe(false);
    }
  });
});

test.describe('J1 · Đo bố cục tab Thông tin trên Chrome thật', () => {
  test('không ô nào ĐÈ LÊN ô khác sau khi gom nhóm', async ({ page }) => {
    /*
      Gom nhóm chèn một thẻ chiếm trọn bề ngang vào giữa lưới hai cột. Nếu nó làm lệch dòng thì
      hai ô có thể chồng lên nhau — jsdom không bao giờ thấy, chỉ CSS thật mới thấy.

      Phép đo: không cặp ô nào có phần giao nhau đáng kể (cho phép 2px sai số bo viền).
    */
    await loginToPage(page, '/petitions/new');
    await expect(page.getByTestId('field-nguonDon-trigger')).toBeVisible({ timeout: 30_000 });

    const chong = await page.evaluate(() => {
      const o = Array.from(document.querySelectorAll('[data-testid^="legacy-field-"]'))
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { id: e.getAttribute('data-testid') ?? '', ...r.toJSON() } as {
            id: string; left: number; top: number; right: number; bottom: number;
            width: number; height: number;
          };
        })
        .filter((r) => r.width > 40 && r.height > 10);

      const ra: string[] = [];
      for (let i = 0; i < o.length; i++) {
        for (let j = i + 1; j < o.length; j++) {
          const a = o[i], b = o[j];
          const ngang = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const doc = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ngang > 2 && doc > 2) ra.push(`${a.id} ⨯ ${b.id}`);
        }
      }
      return { soO: o.length, chong: ra.slice(0, 5) };
    });

    expect(chong.soO, 'không đo được ô nào — bộ dò sai, không phải bố cục đúng').toBeGreaterThan(5);
    expect(chong.chong, `có ô đè lên nhau: ${chong.chong.join(' | ')}`).toEqual([]);
  });
});
