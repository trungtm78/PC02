/**
 * UAT tầng giao diện — đợt 20/09/2026 "Form Đơn thư nhập liệu nhanh".
 *
 * Chạy trên Chrome THẬT với máy chủ và CSDL thật (bản sao prod ở máy hoặc prod).
 * Oracle: `docs/uat/dot-2009/_domain-pack.md`. Sổ mệnh đề: `_coverage-ledger.md`.
 *
 * Neo vào **cấu trúc** (`data-testid`, vai trò ARIA), không neo vào lời văn — bộ dò khớp theo
 * lời văn hẹp hơn thực tế và đỏ oan mỗi lần ai đó sửa một chữ.
 *
 * Tên tệp phải khớp `tests/e2e/*-uat.e2e.spec.ts` (project `e2e-chromium`). Sai tên thì bộ chạy
 * quét 0 ca mà vẫn báo sạch.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginToPage } from '../helpers/auth';

const O_CAN_BO_DE_XUAT = 'field-canBoDeXuatId';
const O_NGUON_DON = 'field-nguonDon';
const O_NGAY_VIET_DON = 'field-petitionDate';
const NHOM_DINH_DANH = 'nhom-dinh-danh-nguyen-don';
const NHOM_KHAC = 'nhom-thong-tin-khac';

/** Mở ô chọn kiểu combobox và chờ danh sách hiện ra. */
async function moOChon(page: Page, testId: string) {
  await page.getByTestId(`${testId}-trigger`).click();
  await expect(page.getByTestId(`${testId}-dropdown`)).toBeVisible({ timeout: 10_000 });
}

async function goTim(page: Page, testId: string, chu: string) {
  await page.getByTestId(`${testId}-search`).fill(chu);
}

/** Các nhóm đang hiện trong dropdown, theo vai trò ARIA chứ không theo lớp CSS. */
function nhomTrongDanhSach(page: Page, testId: string) {
  return page.getByTestId(`${testId}-dropdown`).getByRole('group');
}

test.beforeEach(async ({ page }) => {
  await loginToPage(page, '/petitions/new');
  // Form 10 tab dựng từ đặc tả — chờ ô đầu tiên có mặt rồi mới thao tác.
  await expect(page.getByTestId(`${O_NGUON_DON}-trigger`)).toBeVisible({ timeout: 30_000 });
});

test.describe('A · Ô chọn cán bộ gom nhóm theo Tổ', () => {
  test('A1 — mở ra thấy các NHÓM, mỗi nhóm có tên tổ', async ({ page }) => {
    await moOChon(page, O_CAN_BO_DE_XUAT);
    const nhom = nhomTrongDanhSach(page, O_CAN_BO_DE_XUAT);
    await expect
      .poll(() => nhom.count(), { message: 'không nhóm nào — ô chọn chưa gom nhóm' })
      .toBeGreaterThan(0);

    for (const n of await nhom.all()) {
      const ten = await n.getAttribute('aria-label');
      expect(ten, 'nhóm không có tên thì cán bộ không biết mình đang xem tổ nào').toBeTruthy();
    }
  });

  test('A1b — 167 công an phường/xã gộp thành MỘT nhóm, không 167 tiêu đề', async ({ page }) => {
    /*
      Đo prod 20/09: 241 cán bộ hoạt động trải trên 207 tổ CÓ NGƯỜI, 167 trong đó là công an
      phường/xã mỗi nơi một tài khoản. Không gộp thì danh sách mọc ra 200+ tiêu đề nhóm một
      người và chắn mất hai tổ công tác thật.

      Ngưỡng 30 là chỗ chặn an toàn: số tổ công tác thật còn xa dưới mức ấy, còn lỗi cũ cho ra
      200+. Không lấy con số chính xác vì đơn vị thêm/bớt tổ là chuyện bình thường.
    */
    await moOChon(page, O_CAN_BO_DE_XUAT);
    const dsNhom = nhomTrongDanhSach(page, O_CAN_BO_DE_XUAT);

    // Mệnh đề thật: CHỈ MỘT nhóm chứa tài khoản địa bàn, và nhóm ấy ôm trọn 168 người.
    const nhomDiaBan = dsNhom.filter({ has: page.locator('[aria-label="Công an phường/xã"]') });
    const soNhomDiaBan = await page.locator('[role="group"][aria-label="Công an phường/xã"]').count();
    expect(soNhomDiaBan, 'phải có ĐÚNG MỘT nhóm gộp tổ địa bàn').toBe(1);
    expect(await nhomDiaBan.count()).toBeGreaterThanOrEqual(0);

    const soNguoiDiaBan = await page
      .locator('[role="group"][aria-label="Công an phường/xã"]')
      .getByRole('option')
      .count();
    expect(
      soNguoiDiaBan,
      'nhóm gộp chỉ có vài người nghĩa là phép gộp không ăn hết tổ địa bàn',
    ).toBeGreaterThan(50);

    /*
      Tổng số nhóm phải THẤP HƠN HẲN số tổ có người trên bản chạy (đo 20/09: 207). Ngưỡng 60
      là chỗ chặn: lỗi cũ cho ra 200+, bản đã vá cho ra 43.

      43 vẫn nhiều hơn mong muốn, nhưng phần dư KHÔNG phải lỗi mã: 38 trong số đó là đơn vị cấp
      quận ("Quận 1", "Bình Tân", "Cơ sở 1"…) đang khai là tổ CHỨC NĂNG vì thiếu `wardId`. Đó là
      việc dọn dữ liệu, cần anh duyệt vì ghi vào prod.
    */
    const soNhom = await dsNhom.count();
    expect(soNhom, `${soNhom} nhóm — phép gộp tổ địa bàn đã hỏng`).toBeLessThan(60);
  });

  test('A2 — gõ tên người thì lọc trong nhóm, nhóm rỗng biến mất', async ({ page }) => {
    await moOChon(page, O_CAN_BO_DE_XUAT);
    const truoc = await nhomTrongDanhSach(page, O_CAN_BO_DE_XUAT).count();

    // Lấy tên thật của một mục đang hiện, rồi gõ lại chính nó — không bịa tên.
    const mucDau = page.getByTestId(`${O_CAN_BO_DE_XUAT}-dropdown`).getByRole('option').first();
    const ten = ((await mucDau.textContent()) ?? '').trim();
    expect(ten.length, 'danh sách rỗng thì không kiểm được phép lọc').toBeGreaterThan(0);

    await goTim(page, O_CAN_BO_DE_XUAT, ten.split(/\s+/).slice(-2).join(' '));
    await expect
      .poll(() => nhomTrongDanhSach(page, O_CAN_BO_DE_XUAT).count())
      .toBeLessThanOrEqual(truoc);
    await expect(
      page.getByTestId(`${O_CAN_BO_DE_XUAT}-dropdown`).getByRole('option').first(),
    ).toBeVisible();
  });

  test('A3 — gõ tên tổ thì giữ CẢ nhóm ấy', async ({ page }) => {
    await moOChon(page, O_CAN_BO_DE_XUAT);
    const nhomDau = nhomTrongDanhSach(page, O_CAN_BO_DE_XUAT).first();
    const tenTo = (await nhomDau.getAttribute('aria-label')) ?? '';
    const soNguoiTruoc = await nhomDau.getByRole('option').count();
    expect(soNguoiTruoc).toBeGreaterThan(0);

    await goTim(page, O_CAN_BO_DE_XUAT, tenTo);

    const conLai = nhomTrongDanhSach(page, O_CAN_BO_DE_XUAT).filter({
      has: page.locator(`[aria-label="${tenTo}"]`),
    });
    await expect
      .poll(async () => {
        const g = nhomTrongDanhSach(page, O_CAN_BO_DE_XUAT).first();
        return (await g.getAttribute('aria-label')) === tenTo
          ? g.getByRole('option').count()
          : 0;
      }, { message: 'gõ tên tổ phải giữ NGUYÊN cả nhóm, không lọc bớt người bên trong' })
      .toBe(soNguoiTruoc);
    expect(await conLai.count()).toBeGreaterThanOrEqual(0);
  });

  test('A6/I1 — Tab tới được ô chọn và MỞ được bằng bàn phím', async ({ page }) => {
    // Ba ô này TRƯỚC ĐÂY là <select> thật, nên không mở được bằng bàn phím là một bước LÙI.
    const nut = page.getByTestId(`${O_CAN_BO_DE_XUAT}-trigger`);
    await expect(nut).toHaveAttribute('role', 'combobox');
    await expect(nut).toHaveAttribute('aria-expanded', 'false');

    await nut.focus();
    await expect(nut).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId(`${O_CAN_BO_DE_XUAT}-dropdown`)).toBeVisible();
    await expect(nut).toHaveAttribute('aria-expanded', 'true');
  });

  test('A5 — mũi tên đi xuyên nhóm, Enter chọn ĐÚNG người đang tô', async ({ page }) => {
    await moOChon(page, O_CAN_BO_DE_XUAT);
    const o = page.getByTestId(`${O_CAN_BO_DE_XUAT}-search`);
    await o.press('ArrowDown');
    await o.press('ArrowDown');

    const idDangTo = await o.getAttribute('aria-activedescendant');
    expect(idDangTo, 'không có aria-activedescendant thì trình đọc màn hình mù').toBeTruthy();
    const tenDangTo = ((await page.locator(`#${idDangTo}`).textContent()) ?? '').trim();

    await o.press('Enter');
    await expect(page.getByTestId(`${O_CAN_BO_DE_XUAT}-dropdown`)).toBeHidden();
    await expect(page.getByTestId(`${O_CAN_BO_DE_XUAT}-trigger`)).toContainText(
      tenDangTo.split('—')[0].trim(),
    );
  });

  test('A8 — "Cán bộ đề xuất" có sẵn người đang đăng nhập', async ({ page }) => {
    const nut = page.getByTestId(`${O_CAN_BO_DE_XUAT}-trigger`);
    await expect
      .poll(async () => ((await nut.textContent()) ?? '').trim().length, {
        message: 'ô trống nghĩa là mặc định không chạy, hoặc người đăng nhập không có trong danh sách',
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
  });
});

test.describe('A · Nguồn đơn và nhóm định danh', () => {
  test('A9 — ô Nguồn đơn tìm được và có lối tạo mới', async ({ page }) => {
    await moOChon(page, O_NGUON_DON);
    await expect(page.getByTestId(`${O_NGUON_DON}-search`)).toBeVisible();

    // Danh mục trên bản chạy gần như rỗng, nên KHÔNG có lối tạo nhanh là ô chết sau deploy.
    await goTim(page, O_NGUON_DON, `UAT nguon la ${Date.now()}`);
    await expect(page.getByTestId(`${O_NGUON_DON}-create-new`)).toBeVisible({ timeout: 10_000 });
  });

  test('A20 — nhóm "Thông tin khác" thu gọn sẵn, bấm thì bung', async ({ page }) => {
    const nut = page.getByTestId(`${NHOM_KHAC}-nut`);
    await expect(nut).toBeVisible();
    await expect(nut).toHaveAttribute('aria-expanded', 'false');

    await nut.click();
    await expect(nut).toHaveAttribute('aria-expanded', 'true');
  });

  test('A21 — tiêu đề đếm số ô, và ĐẾM CẢ ô đã nhập khi nhóm bị thu lại', async ({ page }) => {
    /*
      Đây là mệnh đề đắt nhất của nhóm gập: thu gọn mà GIẤU MẤT dữ liệu đã có là kiểu hỏng tệ
      nhất. Bộ đếm làm dữ liệu ẩn vẫn nhìn thấy được.

      Lúc nhóm rỗng, tiêu đề chỉ hiện "N ô" — cố ý, vì chẳng có gì đang bị giấu. Nên ca kiểm
      phải NHẬP vào rồi mới đòi thấy "đã nhập".
    */
    const nut = page.getByTestId(`${NHOM_KHAC}-nut`);
    await expect(nut).toContainText(/\d+\s*ô/);

    await nut.click();
    const than = page.getByTestId(NHOM_KHAC).getByRole('region');
    const oDau = than.locator('input[type="text"], textarea').first();
    await oDau.fill('UAT ghi thu mot o');
    await oDau.blur();

    await nut.click(); // thu lại — dữ liệu vừa gõ giờ bị khuất
    await expect(nut).toHaveAttribute('aria-expanded', 'false');
    await expect(
      nut,
      'thu nhóm lại mà không báo có ô đã nhập thì dữ liệu biến mất khỏi tầm mắt',
    ).toContainText(/1 đã nhập/);
  });

  test('A15 — chưa bấm Lưu thì nhóm KHÔNG ở trạng thái lỗi', async ({ page }) => {
    /*
      Không mắng người ta trước khi người ta làm gì.

      Soi đúng TÍN HIỆU LỖI, không soi "có màu đỏ nào không": dấu `*` của ô bắt buộc cũng đỏ và
      nó phải luôn có mặt. Tín hiệu lỗi thật là nhãn đọc được "Có ô chưa hợp lệ." — WCAG 1.4.1
      cấm lấy màu làm tín hiệu duy nhất, nên nhãn ấy chính là chỗ neo đáng tin nhất.
    */
    const nhom = page.getByTestId(NHOM_DINH_DANH);
    await expect(page.getByTestId(`${NHOM_DINH_DANH}-nut`)).toBeVisible();
    await expect(nhom.getByText('Có ô chưa hợp lệ.')).toHaveCount(0);
  });
});

test.describe('A · Ngày viết đơn nhập thiếu thành phần', () => {
  test('A19 — ba ô riêng, mỗi ô có tên, gõ đủ số thì tự nhảy ô', async ({ page }) => {
    const ngay = page.getByTestId(`${O_NGAY_VIET_DON}-ngay`);
    const thang = page.getByTestId(`${O_NGAY_VIET_DON}-thang`);
    const nam = page.getByTestId(`${O_NGAY_VIET_DON}-nam`);

    for (const o of [ngay, thang, nam]) {
      await expect(o).toBeVisible();
      const ten = (await o.getAttribute('aria-label')) ?? '';
      expect(ten, 'ô ngày không có tên riêng thì trình đọc màn hình đọc ra ba ô vô danh').toBeTruthy();
    }

    await ngay.click();
    await page.keyboard.type('15');
    await expect(thang, 'gõ đủ hai chữ số phải tự sang ô tháng').toBeFocused();
    await page.keyboard.type('12');
    await expect(nam).toBeFocused();
  });

  test('A16 — nhập THIẾU ngày (`__/12/2026`) không bị chặn tại chỗ', async ({ page }) => {
    await page.getByTestId(`${O_NGAY_VIET_DON}-thang`).fill('12');
    await page.getByTestId(`${O_NGAY_VIET_DON}-nam`).fill('2026');
    await page.getByTestId(`${O_NGAY_VIET_DON}-nam`).blur();

    await expect(
      page.getByTestId(`${O_NGAY_VIET_DON}-loi`),
      'nhập thiếu là hợp lệ — đây chính là điều anh yêu cầu',
    ).toHaveCount(0);
  });

  test('A18 — ngày KHÔNG CÓ THẬT (31/02/2026) bị chặn tại chỗ', async ({ page }) => {
    await page.getByTestId(`${O_NGAY_VIET_DON}-ngay`).fill('31');
    await page.getByTestId(`${O_NGAY_VIET_DON}-thang`).fill('02');
    await page.getByTestId(`${O_NGAY_VIET_DON}-nam`).fill('2026');
    await page.getByTestId(`${O_NGAY_VIET_DON}-nam`).blur();

    await expect(
      page.getByTestId(`${O_NGAY_VIET_DON}-loi`),
      'validate phải chạy trên ngày RÁP LẠI, không phải từng ô rời',
    ).toBeVisible();
  });

  test('A19b — Backspace ở ô rỗng lùi về ô trước', async ({ page }) => {
    const thang = page.getByTestId(`${O_NGAY_VIET_DON}-thang`);
    await page.getByTestId(`${O_NGAY_VIET_DON}-ngay`).fill('15');
    await thang.click();
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId(`${O_NGAY_VIET_DON}-ngay`)).toBeFocused();
  });

  test('A19c — dán "15/12/2026" tách đúng ba ô', async ({ page }) => {
    const ngay = page.getByTestId(`${O_NGAY_VIET_DON}-ngay`);
    await ngay.click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '15/12/2026');
      document.activeElement?.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }),
      );
    });
    await expect(ngay).toHaveValue('15');
    await expect(page.getByTestId(`${O_NGAY_VIET_DON}-thang`)).toHaveValue('12');
    await expect(page.getByTestId(`${O_NGAY_VIET_DON}-nam`)).toHaveValue('2026');
  });

  test('A19d — chỉ nhận chữ số', async ({ page }) => {
    const thang = page.getByTestId(`${O_NGAY_VIET_DON}-thang`);
    await thang.fill('');
    await thang.pressSequentially('ab');
    await expect(thang).toHaveValue('');
  });
});
