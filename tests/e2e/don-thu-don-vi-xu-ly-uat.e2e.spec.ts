/**
 * UAT — ô "Đơn vị xử lý" trên form Đơn thư (anh báo lỗi 20/09/2026).
 *
 * Hai lỗi đã vá, và ca kiểm này giữ cho chúng không sống lại:
 *  1. Danh sách Tổ/Nhóm đổ cả 166 công an phường/xã vào (191 mục cho một ô nhãn "Chọn Tổ/Nhóm").
 *  2. Hồ sơ hệ cũ có đơn vị KHÔNG khớp tổ nào — 30.285/47.484 đơn — hiện ra như ô RỖNG, nên
 *     cán bộ chọn tổ khác và đè mất đơn vị gốc mà không ai chủ ý.
 */
import { test, expect } from '@playwright/test';
import { loginToPage, getAuthToken } from '../helpers/auth';

const API = (process.env.BASE_URL_API || 'http://127.0.0.1:3000') + '/api/v1';
const O = 'field-donViGiaiQuyet';

test.describe('Đơn vị xử lý — hướng NỘI BỘ (Giao đơn)', () => {
  test.beforeEach(async ({ page }) => {
    await loginToPage(page, '/petitions/new');
    await expect(page.getByTestId('field-huongXuLy-GIAO_DON')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('field-huongXuLy-GIAO_DON').click();
  });

  test('chỉ liệt kê Tổ/Nhóm nội bộ, KHÔNG có công an phường/xã', async ({ page }) => {
    await page.getByTestId(`${O}-trigger`).click();
    await expect(page.getByTestId(`${O}-dropdown`)).toBeVisible();

    const tong = await page.getByTestId(`${O}-dropdown`).getByRole('option').count();
    expect(tong, 'danh sách rỗng thì không kiểm được gì').toBeGreaterThan(0);
    expect(
      tong,
      `${tong} mục — tổ địa bàn đang lọt vào ô nhãn "Chọn Tổ/Nhóm xử lý"`,
    ).toBeLessThan(60);

    await page.getByTestId(`${O}-search`).fill('Công an Phường');
    await expect
      .poll(() => page.getByTestId(`${O}-dropdown`).getByRole('option').count(), {
        message: 'công an phường/xã vẫn còn trong danh sách Tổ/Nhóm',
      })
      .toBe(0);
  });

  test('TẠO MỚI được ngay ở đây, và mục mới vào DANH MỤC chứ không đẻ ra Tổ', async ({
    page,
  }) => {
    /*
      Anh chốt lần hai ngày 20/09: phải tạo mới được ở cả Giao đơn và Trả đơn/Lưu đơn.

      Mục mới ghi vào danh mục đơn vị (`DON_VI`), KHÔNG tạo một Tổ thật — Tổ gắn với thành viên,
      quyền và phạm vi dữ liệu, nên tạo từ form đơn thư sẽ sinh ra tổ rỗng không ai thuộc về.
    */
    const chi = page.getByTestId('chi-dan-don-vi-xu-ly');
    await expect(chi).toBeVisible();
    await expect(chi).toContainText('danh mục');

    const ten = `Don vi thu nghiem ${Date.now()}`;
    await page.getByTestId(`${O}-trigger`).click();
    await page.getByTestId(`${O}-search`).fill(ten);
    await expect(
      page.getByTestId(`${O}-create-new`),
      'không có lối tạo mới thì cán bộ kẹt đúng như anh báo',
    ).toBeVisible({ timeout: 10_000 });

    await page.getByTestId(`${O}-create-new`).click();
    const hop = page.getByTestId('quick-create-directory-modal');
    await expect(hop).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('quick-create-directory-name')).toHaveValue(ten);

    await page.getByTestId('quick-create-directory-save').click();
    await expect(hop).toBeHidden({ timeout: 15_000 });
    await expect(
      page.getByTestId(`${O}-trigger`),
      'tạo xong phải chọn luôn, không bắt cán bộ đi tìm lại',
    ).toContainText(ten);
  });

  test('Trả đơn/Lưu đơn cũng tạo mới được', async ({ page }) => {
    await page.getByTestId('field-huongXuLy-TRA_LUU_DON').click();
    await page.getByTestId(`${O}-trigger`).click();
    await page.getByTestId(`${O}-search`).fill(`Don vi la ${Date.now()}`);
    await expect(page.getByTestId(`${O}-create-new`)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Đơn vị xử lý — hướng Chuyển đơn', () => {
  test('tạo mới được, và không hiện câu chỉ đường', async ({ page }) => {
    await loginToPage(page, '/petitions/new');
    await expect(page.getByTestId('field-huongXuLy-CHUYEN_DON')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('field-huongXuLy-CHUYEN_DON').click();

    await expect(page.getByTestId('chi-dan-don-vi-xu-ly')).toHaveCount(0);
    await page.getByTestId(`${O}-trigger`).click();
    await page.getByTestId(`${O}-search`).fill(`Don vi la ${Date.now()}`);
    await expect(page.getByTestId(`${O}-create-new`)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Hồ sơ hệ cũ — đơn vị ngoài danh sách KHÔNG được hiện rỗng', () => {
  test('ô hiện đúng giá trị đang lưu, kèm nhãn nói rõ nằm ngoài danh sách', async ({ page }) => {
    const tok = getAuthToken();
    const H = { Authorization: `Bearer ${tok}` };

    // Tìm một hồ sơ THẬT có đơn vị không khớp tổ nội bộ nào.
    const rt = await page.request.get(`${API}/teams`, { headers: H });
    const bt = await rt.json();
    const to = new Set(
      (Array.isArray(bt) ? bt : (bt.data ?? []))
        .filter((t: { isActive?: boolean; wardId?: string | null }) => t.isActive !== false && t.wardId == null)
        .map((t: { name: string }) => t.name.trim()),
    );

    let muc: { id: string; dv: string } | null = null;
    for (let off = 0; off < 300 && !muc; off += 100) {
      const r = await page.request.get(`${API}/petitions?limit=100&offset=${off}`, { headers: H });
      for (const p of ((await r.json()).data ?? []) as Array<{ id: string }>) {
        const ct = await page.request.get(`${API}/petitions/${p.id}`, { headers: H });
        if (ct.status() !== 200) continue;
        const d = (await ct.json()).data ?? {};
        const dv = String(d.donViGiaiQuyet ?? '').trim();
        if (dv && !to.has(dv)) { muc = { id: p.id, dv }; break; }
      }
    }
    expect(muc, 'không tìm thấy hồ sơ hệ cũ nào — mệnh đề CHƯA kiểm được').not.toBeNull();

    await loginToPage(page, `/petitions/${muc!.id}/edit`);
    await expect(page.getByTestId('field-huongXuLy-GIAO_DON')).toBeVisible({ timeout: 45_000 });
    await expect(
      page.getByTestId(`${O}-trigger`),
      'ô hiện rỗng thì cán bộ chọn tổ khác và ĐÈ MẤT đơn vị gốc',
    ).toContainText(muc!.dv);
  });
});
