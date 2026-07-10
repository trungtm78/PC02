/**
 * Helper thao tác UI dùng chung cho storyboard.
 * Bọc try/catch nhẹ để 1 thao tác lỗi không làm gãy cả clip (tinh thần best-effort).
 */

/** Gõ text từng ký tự cho tự nhiên vào input theo data-testid hoặc selector. */
export async function typeInto(page, selector, text, delay = 45) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click();
  await el.fill('');
  await el.pressSequentially(text, { delay });
  await page.waitForTimeout(150);
}

/** Chọn giá trị cho <select> native (enum-backed). */
export async function selectEnum(page, selector, value) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.selectOption(value).catch(async () => {
    // fallback: chọn theo label chứa value
    await el.selectOption({ label: value }).catch(() => {});
  });
  await page.waitForTimeout(200);
}

/** Chọn option "thật" đầu tiên của <select> (bỏ qua placeholder rỗng). */
export async function selectFirstReal(page, selector) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const val = await el.evaluate((sel) => {
    for (const o of sel.options) { if (o.value && !o.disabled) return o.value; }
    return '';
  });
  if (val) await el.selectOption(val).catch(() => {});
  await page.waitForTimeout(200);
  return val;
}

/**
 * Chọn option trong FKSelect/CrimeSelect (custom dropdown).
 * click trigger → (nếu có ô search & truyền `search` thì gõ để nạp option) → click option thứ index.
 * @param {object} opts { index=0, search }  — CrimeSelect cần `search` mới hiện option.
 */
export async function pickFK(page, testid, opts = {}) {
  const { index = 0, search } = opts;
  const trigger = page.locator(`[data-testid="${testid}-trigger"]`).first();
  if (!(await trigger.count())) return false;
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await trigger.click();
  await page.waitForTimeout(400);
  const searchBox = page.locator(`[data-testid="${testid}-search"]`).first();
  if (search && (await searchBox.count())) {
    await searchBox.fill(search);
    await page.waitForTimeout(900);
  }
  let opt = page.locator(`[data-testid^="${testid}-option-"]`).nth(index);
  if (!(await opt.count()) && (await searchBox.count()) && !search) {
    // FKSelect có search nhưng chưa nạp: gõ 1 ký tự phổ biến để bung danh sách
    await searchBox.fill('a');
    await page.waitForTimeout(800);
    opt = page.locator(`[data-testid^="${testid}-option-"]`).nth(index);
  }
  if (await opt.count()) {
    await opt.click().catch(() => {});
    await page.waitForTimeout(300);
    return true;
  }
  await page.keyboard.press('ArrowDown').catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
  return false;
}

/** Set giá trị input date/text trực tiếp (dùng khi pressSequentially không hợp cho date). */
export async function setValue(page, selector, value) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.fill(value).catch(() => {});
  await page.waitForTimeout(150);
}

/** Click nếu phần tử tồn tại & hiển thị; trả về true nếu đã click. */
export async function clickIfVisible(page, selector, timeout = 3000) {
  const el = page.locator(selector).first();
  try {
    await el.waitFor({ state: 'visible', timeout });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click();
    await page.waitForTimeout(300);
    return true;
  } catch (_e) {
    return false;
  }
}

/** Cuộn mượt tới vị trí y. */
export async function scrollTo(page, y) {
  await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'smooth' }), y);
  await page.waitForTimeout(500);
}

/** Mở hàng đầu tiên của danh sách (click link vào chi tiết). */
export async function openFirstRow(page, rowLinkSelector) {
  const row = page.locator(rowLinkSelector).first();
  await row.waitFor({ state: 'visible', timeout: 8000 });
  await row.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
}
