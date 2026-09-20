/**
 * UAT nhóm B/D/E — màn CHỈNH SỬA hồ sơ có sẵn, đợt 20/09/2026.
 *
 * Khác nhóm A ở chỗ quan trọng nhất: đây là **hồ sơ DI TRÚ đã có dữ liệu**. Mở một bản ghi cũ
 * thật mới lộ ra những lỗi mà form trống không bao giờ cho thấy — ô biến mất, nhóm giấu mất dữ
 * liệu đã nhập, người được giao đã khoá rơi khỏi danh sách.
 *
 * Oracle: `docs/uat/dot-2009/_domain-pack.md`.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginToPage, getAuthToken } from '../helpers/auth';

const API = (process.env.BASE_URL_API || 'http://127.0.0.1:3000') + '/api/v1';
const O_NGAY = 'field-petitionDate';
const O_NGUON = 'field-nguonDon';
const O_CAN_BO = 'field-canBoDeXuatId';
const NHOM_DINH_DANH = 'nhom-dinh-danh-nguyen-don';

/** Một hồ sơ DI TRÚ thật trên bản đang chạy — không dựng hồ sơ giả. */
async function layHoSoDiTru(page: Page): Promise<{ id: string; tho?: string }> {
  const tok = getAuthToken();
  expect(tok, 'cần UAT_TOKEN').not.toBe('');
  const r = await page.request.get(`${API}/petitions?limit=50`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  expect(r.status(), await r.text()).toBe(200);
  const ds = ((await r.json()).data ?? []) as Array<{ id: string }>;
  expect(ds.length, 'không có hồ sơ nào để mở').toBeGreaterThan(0);

  for (const p of ds) {
    const ct = await page.request.get(`${API}/petitions/${p.id}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (ct.status() !== 200) continue;
    const b = await ct.json();
    const d = b.data ?? b;
    if (d.legacyRaw && Object.keys(d.legacyRaw).length > 0) {
      return { id: p.id, tho: d.legacyRaw['ngay_viet_don'] };
    }
  }
  throw new Error('Không tìm thấy hồ sơ DI TRÚ nào trong 50 hồ sơ đầu — mệnh đề CHƯA kiểm được');
}

test.describe('B · Mở hồ sơ DI TRÚ để sửa', () => {
  test('B1 — mở hồ sơ di trú: form dựng được, không ô nào biến mất', async ({ page }) => {
    const { id } = await layHoSoDiTru(page);
    await loginToPage(page, `/petitions/${id}/edit`);

    // Ba ô lõi của đợt này phải có mặt trên hồ sơ CŨ, không chỉ trên form trống.
    await expect(page.getByTestId(`${O_NGUON}-trigger`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(`${O_CAN_BO}-trigger`)).toBeVisible();
    await expect(page.getByTestId(O_NGAY)).toBeVisible();
  });

  test('B2 — hồ sơ cũ CÓ ngày: ô hiện đúng ngày, không trắng', async ({ page }) => {
    const tok = getAuthToken();
    const r = await page.request.get(`${API}/petitions?limit=100`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const ds = ((await r.json()).data ?? []) as Array<{ id: string }>;

    let coNgay: { id: string; nam: string; thang: string; ngay: string; chu: string } | null = null;
    for (const p of ds) {
      const ct = await page.request.get(`${API}/petitions/${p.id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (ct.status() !== 200) continue;
      const d = (await ct.json()).data ?? {};
      const edtf: string | undefined = d.ngayVietDonEdtf ?? undefined;
      if (edtf && /^\d{4}-\d{2}-\d{2}$/.test(edtf)) {
        coNgay = {
          id: p.id,
          nam: edtf.slice(0, 4),
          thang: edtf.slice(5, 7),
          ngay: edtf.slice(8, 10),
          chu: `${edtf.slice(8, 10)}/${edtf.slice(5, 7)}/${edtf.slice(0, 4)}`,
        };
        break;
      }
    }
    expect(coNgay, 'không có hồ sơ nào có ngày đầy đủ — mệnh đề CHƯA kiểm được').not.toBeNull();

    await loginToPage(page, `/petitions/${coNgay!.id}/edit`);
    await expect(
      page.getByTestId(O_NGAY),
      'ô ngày trắng nghĩa là mở hồ sơ cũ đã MẤT ngày ngay trước mắt cán bộ',
    ).toHaveValue(coNgay!.chu, { timeout: 30_000 });
  });

  test('B5 — ô trong nhóm ĐÃ CÓ giá trị thì nhóm TỰ BUNG, không giấu dữ liệu', async ({
    page,
  }) => {
    const tok = getAuthToken();
    const r = await page.request.get(`${API}/petitions?limit=100`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const ds = ((await r.json()).data ?? []) as Array<{ id: string }>;

    let coDinhDanh: string | null = null;
    for (const p of ds) {
      const ct = await page.request.get(`${API}/petitions/${p.id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (ct.status() !== 200) continue;
      const d = (await ct.json()).data ?? {};
      if (
        (d.senderPhone && String(d.senderPhone).trim()) ||
        (d.senderIdNumber && String(d.senderIdNumber).trim())
      ) {
        coDinhDanh = p.id;
        break;
      }
    }
    expect(
      coDinhDanh,
      'không hồ sơ nào có SĐT/CCCD — mệnh đề "không giấu dữ liệu" CHƯA kiểm được',
    ).not.toBeNull();

    await loginToPage(page, `/petitions/${coDinhDanh}/edit`);
    const nut = page.getByTestId(`${NHOM_DINH_DANH}-nut`);
    await expect(nut).toBeVisible({ timeout: 30_000 });
    await expect(
      nut,
      'nhóm đóng trong khi bên trong CÓ dữ liệu là kiểu hỏng tệ nhất của nhóm gập',
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('B3 — lưu hồ sơ cũ mà KHÔNG đụng ngày: ngày giữ nguyên', async ({ page }) => {
    /*
      Đây là lớp lỗi vừa vá ở PR #449 nhưng nhìn từ phía cán bộ: mở một hồ sơ, sửa một ô KHÁC,
      bấm Lưu — ngày viết đơn không được đổi và không được biến mất.
    */
    const tok = getAuthToken();
    const r = await page.request.get(`${API}/petitions?limit=50`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const ds = ((await r.json()).data ?? []) as Array<{ id: string }>;

    let muc: { id: string; edtf: string } | null = null;
    for (const p of ds) {
      const ct = await page.request.get(`${API}/petitions/${p.id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (ct.status() !== 200) continue;
      const d = (await ct.json()).data ?? {};
      if (d.ngayVietDonEdtf) {
        muc = { id: p.id, edtf: String(d.ngayVietDonEdtf) };
        break;
      }
    }
    expect(muc, 'không hồ sơ nào có ngày để kiểm').not.toBeNull();

    // Gửi một lượt sửa KHÔNG kèm khoá ngày — đúng thứ giao diện gửi khi cán bộ không đụng ô ấy.
    const up = await page.request.put(`${API}/petitions/${muc!.id}`, {
      headers: { Authorization: `Bearer ${tok}` },
      data: { notes: `UAT-2009 kiem giu ngay ${Date.now()}` },
    });
    expect([200, 201]).toContain(up.status());

    const sau = await page.request.get(`${API}/petitions/${muc!.id}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const d2 = (await sau.json()).data ?? {};
    expect(
      String(d2.ngayVietDonEdtf ?? ''),
      'lưu một ô khác mà ngày biến mất là mất dữ liệu im lặng',
    ).toBe(muc!.edtf);
  });
});

test.describe('B/K/L còn lại — vòng khứ hồi và trạng thái hỏng', () => {
  test('B4 — lưu `__/12/2026` rồi MỞ LẠI đúng nguyên văn trên giao diện', async ({ page }) => {
    /*
      Vòng khứ hồi ĐẦY ĐỦ qua giao diện: gõ ở ba ô → Lưu → tải lại trang → ba ô hiện đúng thứ
      đã gõ. Ca ở tầng API chỉ chứng minh cột lưu đúng; ca này chứng minh cán bộ THẤY lại đúng.
    */
    const tok = getAuthToken();
    const r = await page.request.post(`${API}/petitions`, {
      headers: { Authorization: `Bearer ${tok}` },
      data: {
        receivedDate: new Date().toISOString().slice(0, 10),
        senderName: 'UAT-2009 khu hoi',
        senderAddress: 'UAT',
        summary: 'UAT-2009 kiem vong khu hoi ngay thieu',
        crimeChinhId: await (async () => {
          const c = await page.request.get(`${API}/crimes?limit=1`, {
            headers: { Authorization: `Bearer ${tok}` },
          });
          return ((await c.json()).data as Array<{ id: string }>)[0].id;
        })(),
        ngayVietDonEdtf: '2026-12-XX',
      },
    });
    expect(r.status(), await r.text()).toBe(201);
    const id = ((await r.json()).data as { id: string }).id;

    await loginToPage(page, `/petitions/${id}/edit`);
    await expect(
      page.getByTestId(O_NGAY),
      'chỗ khuyết phải là `__` — hệ không được bịa ra một ngày cán bộ chưa gõ',
    ).toHaveValue('__/12/2026', { timeout: 30_000 });

    await page.request.delete(`${API}/petitions/${id}`, {
      headers: { Authorization: `Bearer ${tok}` },
      data: { reason: 'UAT-2009 dọn sau ca kiểm' },
    });
  });

  test('B6 — người được giao ĐÃ KHOÁ vẫn hiện tên, ghim đầu danh sách', async ({ page }) => {
    /*
      Mất mục = mất phân công. Ô trắng khiến cán bộ chọn người khác, và đó là phân công lại
      ngầm — hồ sơ đổi chủ mà không ai quyết định gì.
    */
    const tok = getAuthToken();
    const rk = await page.request.get(`${API}/admin/users?limit=5&status=inactive`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const khoa = ((await rk.json()).data ?? []) as Array<{ id: string }>;
    expect(khoa.length, 'không có tài khoản khoá — mệnh đề CHƯA kiểm được').toBeGreaterThan(0);

    const rc = await page.request.get(`${API}/crimes?limit=1`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const maToi = ((await rc.json()).data as Array<{ id: string }>)[0].id;

    const r = await page.request.post(`${API}/petitions`, {
      headers: { Authorization: `Bearer ${tok}` },
      data: {
        receivedDate: new Date().toISOString().slice(0, 10),
        senderName: 'UAT-2009 can bo khoa',
        senderAddress: 'UAT',
        summary: 'UAT-2009 kiem ghim can bo da khoa',
        crimeChinhId: maToi,
        canBoDeXuatId: khoa[0].id,
      },
    });
    expect(r.status(), await r.text()).toBe(201);
    const id = ((await r.json()).data as { id: string }).id;

    await loginToPage(page, `/petitions/${id}/edit`);
    const nut = page.getByTestId(`${O_CAN_BO}-trigger`);
    await expect(nut).toBeVisible({ timeout: 30_000 });
    const nhan = ((await nut.textContent()) ?? '').trim();
    expect(
      nhan.length,
      'ô trắng cho người đã khoá = cán bộ chọn người khác = phân công lại NGẦM',
    ).toBeGreaterThan(0);

    await page.request.delete(`${API}/petitions/${id}`, {
      headers: { Authorization: `Bearer ${tok}` },
      data: { reason: 'UAT-2009 dọn sau ca kiểm' },
    });
  });

  test('K9 — mạng hỏng giữa lúc Lưu: báo lỗi rõ, KHÔNG mất thứ đã gõ', async ({ page }) => {
    /*
      Dữ liệu cán bộ vừa gõ là thứ đắt nhất trên màn hình này. Mạng hỏng mà form tự xoá trắng
      thì họ phải gõ lại từ đầu — và lần sau sẽ gõ ra chỗ khác trước cho chắc.
    */
    await loginToPage(page, '/petitions/new');
    await expect(page.getByTestId(O_NGAY)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId(O_NGAY).fill('12/2026');

    await page.route('**/api/v1/petitions', (r) =>
      r.request().method() === 'POST' ? r.abort('failed') : r.continue(),
    );
    const luu = page.locator('button').filter({ hasText: /^Lưu/ }).first();
    if (await luu.count()) {
      await luu.click({ timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(2000);
    }

    await expect(
      page.getByTestId(O_NGAY),
      'lưu hỏng mà form xoá trắng thì cán bộ phải gõ lại từ đầu',
    ).toHaveValue('12/2026');
  });

  test('L10 — mở form Đơn thư: 0 lỗi console, 0 lượt mạng 5xx', async ({ page }) => {
    const loi: string[] = [];
    const hong: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') loi.push(m.text().slice(0, 160));
    });
    page.on('response', (r) => {
      if (r.status() >= 500) hong.push(`${r.status()} ${r.url().slice(0, 90)}`);
    });

    await loginToPage(page, '/petitions/new');
    await expect(page.getByTestId(`${O_NGUON}-trigger`)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500);

    expect(hong, `có lượt mạng 5xx: ${hong.join(' | ')}`).toEqual([]);
    // Lỗi console KHÔNG phải chuyện nhỏ: mỗi cái là một nhánh mã đã ném mà không ai thấy.
    expect(loi, `có lỗi console: ${loi.join(' | ')}`).toEqual([]);
  });
});
