/**
 * UAT nhóm D/E — Vụ án và Vụ việc, đợt 20/09/2026.
 *
 * Anh chốt ô chọn cán bộ gom nhóm áp cho MỌI nơi chọn cán bộ (Đ3), và danh mục Nguồn đơn áp
 * cho Đơn thư + Vụ án (Đ2). Hai màn này không nằm trong mô tả ban đầu nhưng nằm trong phạm vi
 * quyết định, nên phải có bằng chứng riêng — dùng chung một thành phần KHÔNG bảo đảm hai chỗ
 * gọi đều truyền đúng tham số.
 *
 * Oracle: `docs/uat/dot-2009/_domain-pack.md` mục R1-*, R2-SCOPE.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginToPage } from '../helpers/auth';

/**
 * Chuyển sang một TAB của form (không phải thanh điều hướng của ứng dụng).
 *
 * Cả hai form đều 10+ tab và ô cần kiểm không nằm ở tab mặc định — có trong DOM nhưng bị ẩn,
 * nên bộ dò chờ "visible" sẽ hết giờ mà không nói được vì sao.
 */
/**
 * Chờ form dựng xong.
 *
 * `loginToPage` nay dừng ở `domcontentloaded` (bỏ `networkidle` vì SSE làm mạng không bao giờ
 * lắng), nên phần chờ chuyển sang từng ca — nếu dò ngay thì nút tab và nút "Mở rộng" chưa có
 * trong DOM và ca đỏ vì sớm một nhịp, không vì mệnh đề nào sai.
 */
async function choFormDung(page: Page) {
  await expect(
    page.locator('button').filter({ hasText: /^(Lưu hồ sơ|Lưu vụ việc|Lưu tạm)$/ }).first(),
    'form chưa dựng xong',
  ).toBeVisible({ timeout: 45_000 });
}

async function sangTab(page: Page, ten: string) {
  // KHÔNG thu hẹp vào `main`/`form`: tab của form nằm ngoài hai thẻ ấy trên cả hai màn.
  /*
    Dò theo CHỮ, và chờ bằng `scrollIntoViewIfNeeded` thay vì `toBeVisible`.

    Nút tab nằm dưới đáy một form 10+ tab. `toBeVisible` của Playwright đúng là không đòi phần
    tử phải nằm trong khung nhìn — nhưng nó cũng không CUỘN tới, nên lượt bấm ngay sau đó chờ
    tính khả thao tác rồi hết giờ. Cuộn tới trước là làm đúng thứ cán bộ làm.
  */
  const nut = page.locator('button').filter({ hasText: ten }).first();
  try {
    await nut.scrollIntoViewIfNeeded({ timeout: 20_000 });
  } catch {
    // Hỏng thì NÓI RA thấy gì, đừng bắt người đọc đoán: bộ dò không khớp và danh sách rỗng
    // trông giống hệt nhau trong bảng kết quả.
    const co = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .map((b) => (b.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 40),
    );
    throw new Error(`Không thấy tab "${ten}". Các nút đang có: ${JSON.stringify(co)}`);
  }
  await nut.click();
}

/**
 * Bung các khối "bổ sung" của form.
 *
 * Ô "Điều tra viên chính" của Vụ án nằm trong khối Thông tin bổ sung, mặc định THU. Có trong
 * DOM nhưng `display:none`, nên bộ dò chờ "visible" hết giờ mà không nói được vì sao — đúng
 * thao tác cán bộ phải làm là bấm "Mở rộng".
 */
async function moRong(page: Page) {
  const nut = page.locator('button').filter({ hasText: /^Mở rộng$/ }).first();
  await expect(nut, 'không thấy nút "Mở rộng"').toBeVisible({ timeout: 30_000 });
  await nut.click();
}

async function moOChon(page: Page, testId: string) {
  await page.getByTestId(`${testId}-trigger`).click();
  await expect(page.getByTestId(`${testId}-dropdown`)).toBeVisible({ timeout: 15_000 });
}

function nhomTrong(page: Page, testId: string) {
  return page.getByTestId(`${testId}-dropdown`).getByRole('group');
}

/** Mệnh đề dùng chung cho mọi ô chọn cán bộ: gom nhóm, và tổ địa bàn chỉ chiếm MỘT nhóm. */
async function kiemOChonCanBo(page: Page, testId: string) {
  await moOChon(page, testId);

  const soNhom = await nhomTrong(page, testId).count();
  expect(soNhom, `ô ${testId} không gom nhóm theo tổ`).toBeGreaterThan(0);

  for (const n of await nhomTrong(page, testId).all()) {
    expect(await n.getAttribute('aria-label'), 'nhóm không có tên').toBeTruthy();
  }

  const soDiaBan = await page
    .locator('[role="group"][aria-label="Công an phường/xã"]')
    .count();
  expect(soDiaBan, 'tổ địa bàn phải gộp làm ĐÚNG MỘT nhóm').toBeLessThanOrEqual(1);
  expect(
    soNhom,
    `${soNhom} nhóm ở ô ${testId} — tổ địa bàn đang không được gộp`,
  ).toBeLessThan(60);

  // Chuẩn WAI-ARIA: phần bấm mở phải là combobox và Tab tới được.
  const nut = page.getByTestId(`${testId}-trigger`);
  await expect(nut).toHaveAttribute('role', 'combobox');
  await expect(nut).toHaveAttribute('aria-expanded', 'true');
}

test.describe('D · Form Vụ án', () => {
  test('D1 — ô "Điều tra viên chính" gom nhóm theo Tổ', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await choFormDung(page);
    await moRong(page);
    await expect(page.getByTestId('fk-handler-trigger')).toBeVisible({ timeout: 30_000 });
    await kiemOChonCanBo(page, 'fk-handler');
  });

  test('D2 — ô "Nguồn đơn" là ô CHỌN có tìm kiếm và có lối tạo mới', async ({ page }) => {
    /*
      Danh mục NGUON_DON gần như RỖNG trên bản đang chạy (CLI nạp còn chờ anh duyệt). Đổi ô chữ
      tự do thành ô chọn mà KHÔNG có đường tạo mới nghĩa là một ô vốn điền được cho hàng nghìn
      vụ án bỗng không điền được, và không có thông báo nào nói vì sao.
    */
    await loginToPage(page, '/cases/new');
    await choFormDung(page);
    await expect(page.getByTestId('field-nguonDon-trigger')).toBeVisible({ timeout: 30_000 });

    await moOChon(page, 'field-nguonDon');
    await expect(page.getByTestId('field-nguonDon-search')).toBeVisible();

    await page.getByTestId('field-nguonDon-search').fill(`UAT nguon la ${Date.now()}`);
    await expect(
      page.getByTestId('field-nguonDon-create-new'),
      'không có lối tạo mới thì ô này CHẾT sau deploy',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D5 — tab Thông tin của Vụ án vẫn dựng được, không vỡ bố cục', async ({ page }) => {
    await loginToPage(page, '/cases/new');
    await choFormDung(page);
    // Ô Nguồn đơn nằm trong lưới chung; nó hiện được nghĩa là tab dựng xong không ném lỗi.
    await expect(page.getByTestId('field-nguonDon-trigger')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('fk-handler-trigger')).toBeVisible();
  });
});

test.describe('E · Form Vụ việc', () => {
  test('E1 — ô "Điều tra viên" gom nhóm theo Tổ', async ({ page }) => {
    await loginToPage(page, '/incidents/new');
    await choFormDung(page);
    await moRong(page);
    await expect(page.getByTestId('field-investigatorId-trigger')).toBeVisible({ timeout: 30_000 });
    await kiemOChonCanBo(page, 'field-investigatorId');
  });

  test('E2 — ô "Cán bộ nhập" gom nhóm theo Tổ', async ({ page }) => {
    await loginToPage(page, '/incidents/new');
    await choFormDung(page);
    await moRong(page);
    await expect(page.getByTestId('field-canBoNhapId-trigger')).toBeVisible({ timeout: 30_000 });
    await kiemOChonCanBo(page, 'field-canBoNhapId');
  });

  test('L1 — ô "Nguồn phát tin" của Vụ việc GIỮ NGUYÊN, không bị kéo sang danh mục', async ({
    page,
  }) => {
    // Anh chốt phạm vi danh mục là Đơn thư + Vụ án. Vụ việc là khái niệm khác; gộp vào khi
    // chưa đo là làm bẩn danh mục.
    await loginToPage(page, '/incidents/new');
    await choFormDung(page);
    await moRong(page);
    await expect(page.getByTestId('field-nguonPhatTin')).toBeVisible({ timeout: 30_000 });
  });
});
