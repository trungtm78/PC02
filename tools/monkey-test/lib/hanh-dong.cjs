'use strict';
/**
 * Thao tác ngẫu nhiên có trọng số. Mỗi thao tác nhận `{ page, ctx, rng, cfg, tt }` và trả về mô tả những gì đã làm
 * (`{ ten, ...chiTiet }`) để bất biến phía sau biết cần kiểm gì. Thao tác dùng TOẠ ĐỘ chứ không giữ handle phần tử:
 * trang dựng lại giữa chừng (React) thì handle cũ chết, còn toạ độ luôn nhắm vào thứ đang hiện trên màn hình.
 */

/** Nhãn nút nguy hiểm — chỉ bỏ qua khi KHÔNG được phép ghi (máy thật). Đăng xuất luôn bỏ qua: nó kết thúc phiên. */
const NHAN_NGUY_HIEM = /xo[áa]|lưu|ghi|duyệt|chuyển|khởi tố|đình chỉ|hủy|huỷ|gửi|xác nhận|tạo mới|thêm mới|nhập|import|khôi phục|phân công|in chứng từ/i;
const NHAN_DANG_XUAT = /đăng xuất|thoát|logout|sign out/i;

const CHUOI_GO = [
  'a',
  'Nguyễn',
  'Nguyễn Văn An',
  'Trần Thị Bình',
  'tiếng Việt có dấu ắằẳẵặ',
  '%',
  '_',
  '%_%',
  ' ',
  '😀',
  "'; DROP TABLE users;--",
  '<img src=x onerror=alert(1)>',
  'x'.repeat(101),
  'x'.repeat(260),
  '‮rtl',
  '0000-00-00',
  '99999999999999999999',
];

const PHIM = [
  'Tab',
  'Shift+Tab',
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageDown',
  'PageUp',
  'Enter',
  'Escape',
  'Space',
  'Backspace',
];

/** Phần tử hiện trên màn hình, nằm trong khung nhìn, kèm nhãn. Chạy trong trang. */
function layUngVien(selector) {
  const co = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return null;
    return r;
  };
  const kq = [];
  for (const el of document.querySelectorAll(selector)) {
    const r = co(el);
    if (!r) continue;
    const nhan = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.trim();
    kq.push({
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      trai: r.left,
      phai: r.right,
      nhan: nhan.slice(0, 80),
      the: el.tagName.toLowerCase(),
      kieu: el.getAttribute('type') || '',
    });
  }
  return kq;
}

async function ungVien(page, selector, cfg) {
  const ds = await page.evaluate(layUngVien, selector);
  return ds.filter((u) => !NHAN_DANG_XUAT.test(u.nhan) && (cfg.choGhi || !NHAN_NGUY_HIEM.test(u.nhan)));
}

const CHON_BAM = 'button, a[href], [role="tab"], [role="combobox"], [role="option"], [role="menuitem"], summary, label, tbody tr td, tbody tr';
const CHON_O_NHAP = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), textarea';

async function nhacPhim(page, tt, rng, cfg) {
  const k = rng.chon(PHIM);
  await page.keyboard.press(k).catch(() => {});
  return { ten: 'phim', phim: k };
}

const HANH_DONG = [
  {
    ten: 'bam',
    trongSo: 30,
    async chay({ page, rng, cfg }) {
      const u = rng.chon(await ungVien(page, CHON_BAM, cfg));
      if (!u) return null;
      await page.mouse.click(u.x, u.y).catch(() => {});
      return { ten: 'bam', nhan: u.nhan, the: u.the };
    },
  },
  {
    ten: 'bam-dup',
    trongSo: 6,
    async chay({ page, rng, cfg }) {
      const u = rng.chon(await ungVien(page, 'tbody tr td, tbody tr', cfg));
      if (!u) return null;
      await page.mouse.dblclick(u.x, u.y).catch(() => {});
      return { ten: 'bam-dup', nhan: u.nhan };
    },
  },
  {
    ten: 'bam-ctrl',
    trongSo: 6,
    async chay({ page, rng, cfg }) {
      const u = rng.chon(await ungVien(page, 'tbody tr td, tbody tr', cfg));
      if (!u) return null;
      await page.keyboard.down('Control');
      await page.mouse.click(u.x, u.y).catch(() => {});
      await page.keyboard.up('Control');
      return { ten: 'bam-ctrl', nhan: u.nhan, moTabMoi: true };
    },
  },
  {
    ten: 'bam-giua',
    trongSo: 4,
    async chay({ page, rng, cfg }) {
      const u = rng.chon(await ungVien(page, 'tbody tr td, tbody tr', cfg));
      if (!u) return null;
      await page.mouse.click(u.x, u.y, { button: 'middle' }).catch(() => {});
      return { ten: 'bam-giua', nhan: u.nhan, moTabMoi: true };
    },
  },
  {
    ten: 'boi-chu',
    trongSo: 10,
    async chay({ page, rng, cfg }) {
      const u = rng.chon((await ungVien(page, 'tbody tr td', cfg)).filter((x) => x.nhan.length > 3 && x.phai - x.trai > 40));
      if (!u) return null;
      const url = page.url();
      await page.mouse.move(u.trai + 4, u.y);
      await page.mouse.down();
      await page.mouse.move(u.phai - 4, u.y, { steps: 6 });
      await page.mouse.up();
      const chon = await page.evaluate(() => (window.getSelection() ? window.getSelection().toString() : ''));
      return { ten: 'boi-chu', urlTruoc: url, daBoiChu: chon.trim().length > 0, chu: chon.slice(0, 40) };
    },
  },
  {
    ten: 'phim',
    trongSo: 22,
    async chay({ page, tt, rng, cfg }) {
      return nhacPhim(page, tt, rng, cfg);
    },
  },
  {
    ten: 'go',
    trongSo: 12,
    async chay({ page, rng, cfg }) {
      const u = rng.chon(await ungVien(page, CHON_O_NHAP, cfg));
      if (!u) return null;
      await page.mouse.click(u.x, u.y).catch(() => {});
      const chuoi = rng.chon(CHUOI_GO);
      if (chuoi.length > 40) await page.keyboard.insertText(chuoi).catch(() => {});
      else await page.keyboard.type(chuoi, { delay: 0 }).catch(() => {});
      return { ten: 'go', chuoi: chuoi.slice(0, 20) };
    },
  },
  {
    ten: 'dan',
    trongSo: 3,
    async chay({ page, rng }) {
      await page.keyboard.insertText(rng.chon(CHUOI_GO)).catch(() => {});
      return { ten: 'dan' };
    },
  },
  {
    ten: 'cuon',
    trongSo: 4,
    async chay({ page, rng }) {
      await page.mouse.wheel(0, rng.chon([-800, -200, 200, 800])).catch(() => {});
      return { ten: 'cuon' };
    },
  },
  {
    ten: 'lui-tien',
    trongSo: 3,
    async chay({ page, rng }) {
      if (rng.so() < 0.6) await page.goBack({ timeout: 8000 }).catch(() => {});
      else await page.goForward({ timeout: 8000 }).catch(() => {});
      return { ten: 'lui-tien', lamMoiTrang: true };
    },
  },
  {
    ten: 'xoay-man-hinh',
    trongSo: 2,
    async chay({ page }) {
      const vp = page.viewportSize();
      if (!vp) return null;
      await page.setViewportSize({ width: vp.height, height: vp.width });
      await page.waitForTimeout(200);
      await page.setViewportSize(vp);
      return { ten: 'xoay-man-hinh' };
    },
  },
  {
    // Chỉ có nghĩa trên điện thoại: mở bảng thao tác đáy rồi đóng bằng Escape.
    ten: 'mo-bang-thao-tac',
    trongSo: 5,
    dieuKien: ({ vp }) => vp.width <= 767,
    async chay({ page }) {
      const nut = page.locator('tbody tr [data-testid^="btn-action-menu-"]').first();
      if (!(await nut.count())) return null;
      await nut.scrollIntoViewIfNeeded().catch(() => {});
      await nut.focus().catch(() => {});
      await nut.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(250);
      const mo = await page.getByRole('dialog').count();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      return { ten: 'mo-bang-thao-tac', daMo: mo > 0 };
    },
  },
  {
    ten: 'go-ten-nguoi-gui',
    trongSo: 8,
    dieuKien: ({ route }) => /\/petitions\/(new|[^/]+\/edit)/.test(route),
    async chay({ page, rng }) {
      const o = page.locator('[data-testid="field-senderName"]').first();
      if (!(await o.count())) return null;
      const chuoi = rng.chon(['a', 'N', 'Nguyễn', 'Nguyễn Văn An', '%', '_', 'x'.repeat(101), 'Trần']);
      await o.scrollIntoViewIfNeeded().catch(() => {});
      await o.fill('').catch(() => {});
      await o.click({ timeout: 4000 }).catch(() => {});
      await page.keyboard.insertText(chuoi).catch(() => {});
      await page.waitForTimeout(700);
      const soGoiY = await page.locator('[role="option"], [data-testid^="goi-y-don-"]').count();
      return { ten: 'go-ten-nguoi-gui', soKyTu: chuoi.length, soGoiY };
    },
  },
];

function chonHanhDong(rng, boiCanh) {
  const dung = HANH_DONG.filter((h) => !h.dieuKien || h.dieuKien(boiCanh));
  return rng.chonTheoTrongSo(dung);
}

module.exports = { HANH_DONG, chonHanhDong, ungVien, CHON_BAM, CHON_O_NHAP, NHAN_DANG_XUAT, NHAN_NGUY_HIEM };
