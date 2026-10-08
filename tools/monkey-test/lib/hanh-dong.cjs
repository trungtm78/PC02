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
    async chay({ page, tt }) {
      // A sheet left open by an earlier random action is modal: forcing focus onto a button BEHIND it is a state no user can
      // reach (the sheet traps focus), and Escape then rightly does nothing. Close it the way a user does and skip this turn.
      if ((await page.getByRole('dialog').count()) > 0) {
        await page.locator('[data-testid="bang-thao-tac-duoi-huy"]').first().click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(250);
        return null;
      }
      const nut = page.locator('tbody tr [data-testid^="btn-action-menu-"]').first();
      if (!(await nut.count())) return null;
      await nut.scrollIntoViewIfNeeded().catch(() => {});
      await nut.focus().catch(() => {});
      // A click Playwright could not land (button covered by another panel, scrolled under a sticky header) says nothing about
      // the product: only a click that LANDED and opened no sheet is a finding.
      const bam = async () => {
        let cham = true;
        await nut.click({ timeout: 4000 }).catch(() => {
          cham = false;
        });
        if (!cham) return null;
        await page.waitForTimeout(250);
        return page.getByRole('dialog').count();
      };
      let mo = await bam();
      if (mo === null) {
        await page.keyboard.press('Escape');
        return null;
      }
      // After a MIDDLE click on a row, Chromium (Windows) is in auto-scroll mode and swallows the next click just to leave it
      // (reproduced by hand 09/10/2026). Retry ONLY in that known case: any other time, a sheet that needs two clicks to open
      // is a real defect and must be reported.
      if (mo === 0 && tt && tt.truoc === 'bam-giua') {
        await nut.focus().catch(() => {});
        const lanHai = await bam();
        if (lanHai === null) {
          await page.keyboard.press('Escape');
          return null;
        }
        mo = lanHai;
      }
      // State at the moment the sheet failed to open, so the finding can be replayed by hand instead of guessed at.
      const chanDoan =
        mo > 0
          ? null
          : await page
              .evaluate(() => {
                const nut = document.querySelector('tbody tr [data-testid^="btn-action-menu-"]');
                const rc = nut ? nut.getBoundingClientRect() : null;
                const diem = rc ? document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2) : null;
                return {
                  url: location.pathname + location.search,
                  hopThoai: document.querySelectorAll('[role="dialog"]').length,
                  vungBang: !!document.querySelector('[data-testid="bang-thao-tac-duoi-vung"]'),
                  khoaCuon: document.body.style.overflow,
                  tieuDiem: (document.activeElement && (document.activeElement.getAttribute('data-testid') || document.activeElement.tagName)) || null,
                  nutToaDo: rc ? [Math.round(rc.left), Math.round(rc.top), Math.round(rc.width), Math.round(rc.height)] : null,
                  phanTuTaiDiem: diem ? (diem.getAttribute('data-testid') || diem.tagName) : null,
                  nutCuaDong: !!(diem && nut && (diem === nut || nut.contains(diem))),
                  soDong: document.querySelectorAll('tbody tr').length,
                };
              })
              .catch(() => null);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      return { ten: 'mo-bang-thao-tac', daMo: mo > 0, chanDoan };
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
  {
    // Gõ chuỗi bất kỳ vào ô "Giờ tiếp nhận" bằng PHÍM THẬT (từng ký tự, như người gõ) rồi rời ô bằng Tab.
    ten: 'go-gio-tiep-nhan',
    trongSo: 10,
    dieuKien: ({ route }) => /\/petitions\/(new|[^/]+\/edit)/.test(route),
    async chay({ page, rng }) {
      const o = page.locator('[data-testid="field-gioTiepNhan"]').first();
      if (!(await o.count())) return null;
      const gio = rng.chon([
        '0830', '830', '9', '14', '1430', '2359', '0000', '2450', '0875', '99', '29', '08:30', '8:3', '8h30', '8 giờ 30',
        '', 'abc', ':', '08:', '0a8b3c0', '123456789',
      ]);
      await o.scrollIntoViewIfNeeded().catch(() => {});
      await o.fill('').catch(() => {});
      await o.click({ timeout: 4000 }).catch(() => {});
      await page.keyboard.type(gio, { delay: 0 }).catch(() => {});
      await page.keyboard.press('Tab').catch(() => {});
      await page.waitForTimeout(150);
      return { ten: 'go-gio-tiep-nhan', gio };
    },
  },
];

function chonHanhDong(rng, boiCanh) {
  const dung = HANH_DONG.filter((h) => !h.dieuKien || h.dieuKien(boiCanh));
  return rng.chonTheoTrongSo(dung);
}

module.exports = { HANH_DONG, chonHanhDong, ungVien, CHON_BAM, CHON_O_NHAP, NHAN_DANG_XUAT, NHAN_NGUY_HIEM };
