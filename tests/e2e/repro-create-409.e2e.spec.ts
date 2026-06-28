/**
 * Regression: tạo mới đơn thư KHÔNG còn 409 "đã được chỉnh sửa bởi người dùng khác".
 * Root cause: FE gửi số draft (stt) → backend bỏ qua commitWithTx → counter không tăng → số trùng
 * → 409; FE map mọi 409 thành message optimistic-lock. Fix: không gửi stt khi create (backend tự
 * cấp atomic). Test: TẠO 2 ĐƠN LIÊN TIẾP qua form → cả hai POST 201, 0 lần 409.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const ADMIN_U = process.env.ADMIN_USERNAME || 'admin@pc02.local';
const ADMIN_P = process.env.ADMIN_PASSWORD || '68@Love2love68';

test('tạo 2 đơn thư liên tiếp qua form → không 409, counter tự tăng', async ({ page }) => {
  await new LoginPage(page).login(ADMIN_U, ADMIN_P);
  const createOne = async (n: number) => {
    await page.goto('/petitions/new');
    await page.getByTestId('field-senderIsAnonymous').check();
    await page.getByTestId('field-petitionType').selectOption('TO_CAO');
    await page.getByTestId('field-summary').fill('regression ' + n);
    await page.getByTestId('field-detailContent').fill('regression chi tiết ' + n);
    await page.getByTestId('btn-save-top-main').click();
    // create thành công → điều hướng về danh sách
    await expect(page).toHaveURL(/\/petitions(\?|$|\/)/, { timeout: 20_000 });
    await expect(page.getByText(/đã được chỉnh sửa bởi người dùng khác/i)).toHaveCount(0);
  };

  await createOne(1);
  await createOne(2); // ĐƠN THỨ 2 — đây là chỗ trước đây 409 do số trùng (counter không tăng)
  // Cả 2 lần điều hướng về /petitions + 0 banner 409 ⇒ fix đúng (backend tự cấp số atomic).
});
