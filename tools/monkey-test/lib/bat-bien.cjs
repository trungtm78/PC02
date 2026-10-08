'use strict';
/**
 * BẤT BIẾN (oracle) — những điều PHẢI luôn đúng dù bấm bừa thế nào. Mỗi bất biến khai khi nào kiểm (`khiNao`) và trả
 * `null` (đạt) hoặc `{ chiTiet }` (vi phạm). Hồ sơ (`profiles/*.json`) chọn bất biến theo TÊN.
 *
 * Oracle lấy từ ĐẶC TẢ, không từ mã: "bôi chữ thì không chuyển trang", "mỗi dòng đúng một nút ⋮ ở điện thoại", "tab mới
 * mở ra không bắt đăng nhập lại". Một bất biến không đo được (thiếu phần tử) trả `{ khongDoDuoc: true }` — báo
 * CHƯA KIỂM, không bao giờ coi là đạt.
 */

/** Giá trị mọi ô nhập trong vùng nội dung (bỏ thanh đầu/menu) — để so trước/sau ở màn chỉ xem. */
function chupGiaTriOnhap() {
  const vung = document.querySelector('main') || document.body;
  return [...vung.querySelectorAll('input, textarea, select')]
    .filter((el) => !el.closest('header, aside, nav, [role="dialog"]') && el.type !== 'hidden' && el.type !== 'file')
    .map((el, i) => `${i}:${el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value}`);
}

const BAT_BIEN = {
  /** Kéo bôi chữ trong một dòng của bảng thì KHÔNG được chuyển trang (cán bộ bôi để chép). */
  url_khong_doi_khi_boi_chu: {
    khiNao: 'boi-chu',
    async kiem({ page, hd }) {
      if (!hd.daBoiChu) return null;
      const sau = page.url();
      if (sau !== hd.urlTruoc) return { chiTiet: `bôi "${hd.chu}" làm URL đổi: ${hd.urlTruoc} → ${sau}` };
      return null;
    },
  },

  /** Tab mới mở từ dòng (Ctrl/⌘+bấm, nút giữa) không được bắt đăng nhập lại khi tab gốc đang đăng nhập. */
  tab_moi_khong_bat_dang_nhap: {
    khiNao: 'tab-moi',
    async kiem({ tt }) {
      const loi = [];
      for (const p of tt.tabMoi) {
        try {
          await p.waitForLoadState('load', { timeout: 8000 });
          // ProtectedRoute chờ tối đa 500ms để xin phiên từ tab khác; chờ dư để thấy chuyển hướng nếu có.
          await p.waitForTimeout(1500);
          const duong = new URL(p.url()).pathname;
          if (duong.startsWith('/login')) loi.push(`tab mới (${p.url()}) bị đẩy sang /login`);
        } catch (e) {
          loi.push(`tab mới không đo được: ${String(e.message).slice(0, 80)}`);
        }
      }
      return loi.length ? { chiTiet: loi.join('; ') } : null;
    },
  },

  /** Màn CHỈ XEM: giá trị mọi ô không đổi dù gõ/dán/xoá. */
  o_xem_khong_sua_duoc: {
    khiNao: 'buoc',
    async kiem({ page, tt }) {
      if (!tt.dauVao) return null;
      const nay = await page.evaluate(chupGiaTriOnhap).catch(() => null);
      if (!nay) return null;
      const doi = nay.filter((v, i) => v !== tt.dauVao[i]);
      if (nay.length === tt.dauVao.length && doi.length) {
        // Báo MỘT lần cho mỗi lần đổi: đặt lại mốc để các bước sau không lặp lại cùng vi phạm.
        tt.dauVao = nay;
        return { chiTiet: `ô ở màn xem bị sửa: ${doi.slice(0, 3).join(' | ')}` };
      }
      return null;
    },
  },

  /** Điện thoại: mỗi dòng đúng MỘT nút ⋮ cỡ ≥44px nằm trọn trong ô, ô và tiêu đề Thao tác hẹp. */
  mot_nut_menu_moi_dong: {
    khiNao: 'buoc',
    async kiem({ page, vp }) {
      if (vp.width > 767) return null;
      const r = await page.evaluate(() => {
        const loi = [];
        let so = 0;
        for (const tr of [...document.querySelectorAll('tbody tr')].slice(0, 25)) {
          const nut = tr.querySelector('[data-testid^="btn-action-menu-"]');
          if (!nut) continue;
          so += 1;
          const o = nut.closest('td');
          const soNut = o ? o.querySelectorAll('button').length : 0;
          if (soNut !== 1) loi.push(`ô có ${soNut} nút (phải 1)`);
          const rc = nut.getBoundingClientRect();
          if (rc.width < 43.5 || rc.height < 43.5) loi.push(`nút ⋮ ${Math.round(rc.width)}×${Math.round(rc.height)} (<44px)`);
          const kh = o.getBoundingClientRect();
          if (rc.left < kh.left - 0.5 || rc.right > kh.right + 0.5) loi.push('nút ⋮ tràn khỏi ô');
          if (kh.width > 60) loi.push(`ô Thao tác rộng ${Math.round(kh.width)}px (>60px)`);
        }
        return { loi: [...new Set(loi)], so };
      });
      return r.loi.length ? { chiTiet: r.loi.join('; ') } : null;
    },
  },

  /** Điện thoại: trang không cuộn ngang ngoài ý muốn. */
  khong_tran_ngang: {
    khiNao: 'buoc',
    async kiem({ page, vp }) {
      if (vp.width > 767) return null;
      const tran = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      return tran > 1 ? { chiTiet: `trang tràn ngang ${tran}px` } : null;
    },
  },

  /** Bảng thao tác đáy: mở được; đóng bằng Escape thì hết hộp thoại, tiêu điểm về nút ⋮, cuộn nền mở khoá. */
  bang_dong_tra_tieu_diem: {
    khiNao: 'mo-bang',
    async kiem({ page, hd }) {
      if (!hd.daMo) return { chiTiet: 'bấm ⋮ không mở bảng thao tác' };
      const r = await page.evaluate(() => ({
        conHopThoai: !!document.querySelector('[role="dialog"]'),
        tieuDiemLaNutMenu: !!document.activeElement && document.activeElement.matches('[data-testid^="btn-action-menu-"]'),
        khoaCuon: document.body.style.overflow === 'hidden',
      }));
      const loi = [];
      if (r.conHopThoai) loi.push('Escape không đóng bảng');
      if (!r.tieuDiemLaNutMenu) loi.push('tiêu điểm không trả về nút ⋮');
      if (r.khoaCuon) loi.push('cuộn nền vẫn bị khoá sau khi đóng');
      return loi.length ? { chiTiet: loi.join('; ') } : null;
    },
  },

  /** Gợi ý tên người gửi: không gợi ý ở 1 ký tự hay >100 ký tự; không quá 12 dòng. */
  goi_y_ten_gioi_han: {
    khiNao: 'go-ten',
    async kiem({ hd }) {
      if (hd.soKyTu < 2 && hd.soGoiY > 0) return { chiTiet: `${hd.soGoiY} gợi ý với ${hd.soKyTu} ký tự (phải 0)` };
      if (hd.soKyTu > 100 && hd.soGoiY > 0) return { chiTiet: `${hd.soGoiY} gợi ý với ${hd.soKyTu} ký tự (>100, phải 0)` };
      if (hd.soGoiY > 12) return { chiTiet: `${hd.soGoiY} dòng gợi ý (tối đa 12)` };
      return null;
    },
  },

  /** Sau Escape không còn hộp chọn (listbox) nào kẹt mở. */
  phim_chon_khong_ket: {
    khiNao: 'buoc',
    async kiem({ page, hd }) {
      if (hd.ten !== 'phim' || hd.phim !== 'Escape') return null;
      await page.waitForTimeout(150);
      const ket = await page.evaluate(() =>
        [...document.querySelectorAll('[role="listbox"]')].some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        }),
      );
      return ket ? { chiTiet: 'sau Escape vẫn còn hộp chọn (listbox) hiện' } : null;
    },
  },

  /** "Tạo đơn mới từ đơn này": ngày tiếp nhận = hôm nay ngay sau khi chép. Chạy một lần ở đầu đường. */
  chep_don_ngay_hom_nay: {
    khiNao: 'dau-duong',
    async kiem({ page }) {
      const nut = page.locator('[data-testid="btn-chep-don"]').first();
      if (!(await nut.count())) return { khongDoDuoc: true, chiTiet: 'không thấy nút btn-chep-don trên màn này' };
      await nut.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const o = page.locator('[data-testid="field-receivedDate"]').first();
      if (!(await o.count())) return { khongDoDuoc: true, chiTiet: 'sau khi chép không thấy ô field-receivedDate' };
      const [giaTri, homNay] = await Promise.all([o.inputValue(), page.evaluate(() => new Date().toLocaleDateString('en-CA'))]);
      return giaTri === homNay ? null : { chiTiet: `ngày tiếp nhận sau khi chép = ${giaTri || '(rỗng)'}, phải là hôm nay ${homNay}` };
    },
  },
};

module.exports = { BAT_BIEN, chupGiaTriOnhap };
