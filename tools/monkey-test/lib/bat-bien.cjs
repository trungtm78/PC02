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

  /**
   * Điện thoại: mỗi dòng đúng MỘT nút ⋮ cỡ ≥32px (anh yêu cầu thu nhỏ 08/10/2026 từ 44px; WCAG 2.2 AA đòi ≥24px) nằm
   * trọn trong ô, ô Thao tác hẹp (≤44px: nút 32px + lề 2×4px).
   */
  mot_nut_menu_moi_dong: {
    khiNao: 'buoc',
    async kiem({ page, vp }) {
      if (vp.width > 767) return null;
      const do_ = () =>
        page.evaluate(() => {
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
          if (rc.width < 31.5 || rc.height < 31.5) loi.push(`nút ⋮ ${Math.round(rc.width)}×${Math.round(rc.height)} (<32px)`);
          const kh = o.getBoundingClientRect();
          if (rc.left < kh.left - 0.5 || rc.right > kh.right + 0.5) loi.push('nút ⋮ tràn khỏi ô');
          if (kh.width > 44) loi.push(`ô Thao tác rộng ${Math.round(kh.width)}px (>44px)`);
        }
        return { loi: [...new Set(loi)], so };
        });
      let r = await do_();
      // Giữa lúc chuyển trang không có dòng nào: chờ rồi đo lại MỘT lần trước khi kết luận không đo được.
      if (r.so === 0) {
        await page.waitForTimeout(700);
        r = await do_();
      }
      // Không thấy nút nào = KHÔNG ĐO ĐƯỢC (danh sách trống? đổi tên testid?) — tuyệt đối không được coi là đạt.
      if (r.so === 0) return { khongDoDuoc: true, chiTiet: 'không thấy nút btn-action-menu-* nào trên màn này (danh sách trống hoặc đã đổi testid?)' };
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

  /**
   * "Tạo đơn mới từ đơn này": ngày tiếp nhận = hôm nay VÀ giờ tiếp nhận = giờ hiện tại (±3 phút) ngay sau khi chép. Chạy một
   * lần ở đầu đường. Giờ chép từ đơn nguồn (khác giờ hiện tại) là lỗi: Giấy biên nhận sẽ ghi một giờ không bao giờ xảy ra.
   */
  chep_don_ngay_hom_nay: {
    khiNao: 'dau-duong',
    async kiem({ page, route }) {
      // Chỉ có nghĩa ở màn XEM một đơn (`/petitions/<mã>`); các màn khác của cùng hồ sơ (tạo mới, sửa) không áp dụng — bỏ qua,
      // KHÔNG tính là "chưa kiểm".
      if (!/^\/petitions\/[^/?]+$/.test(route.split('?')[0]) || route.startsWith('/petitions/new')) return null;
      const nut = page.locator('[data-testid="btn-chep-don"]').first();
      if (!(await nut.count())) return { khongDoDuoc: true, chiTiet: 'không thấy nút btn-chep-don trên màn này' };
      await nut.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const o = page.locator('[data-testid="field-receivedDate"]').first();
      if (!(await o.count())) return { khongDoDuoc: true, chiTiet: 'sau khi chép không thấy ô field-receivedDate' };
      const [giaTri, homNay] = await Promise.all([o.inputValue(), page.evaluate(() => new Date().toLocaleDateString('en-CA'))]);
      if (giaTri !== homNay) return { chiTiet: `ngày tiếp nhận sau khi chép = ${giaTri || '(rỗng)'}, phải là hôm nay ${homNay}` };
      const g = page.locator('[data-testid="field-gioTiepNhan"]').first();
      if (!(await g.count())) return { khongDoDuoc: true, chiTiet: 'sau khi chép không thấy ô field-gioTiepNhan' };
      const gio = await g.inputValue();
      const lech = await page.evaluate((v) => {
        const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
          .formatToParts(new Date())
          .reduce((m, x) => ({ ...m, [x.type]: x.value }), {});
        const bayGio = Number(p.hour) * 60 + Number(p.minute);
        const khai = Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
        // vòng quanh nửa đêm: 23:59 so với 00:01 chỉ lệch 2 phút
        const d = Math.abs(khai - bayGio);
        return Math.min(d, 1440 - d);
      }, gio);
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(gio) && lech <= 3
        ? null
        : { chiTiet: `giờ tiếp nhận sau khi chép = ${gio || '(rỗng)'}, phải là giờ hiện tại VN (±3 phút)` };
    },
  },

  /**
   * Ô Giờ tiếp nhận: sau khi gõ chuỗi bất kỳ rồi rời ô, giá trị phải LUÔN là một trong ba: rỗng, "HH:mm" hợp lệ, hoặc chữ
   * đang báo lỗi tại ô (không bao giờ im lặng giữ giá trị hỏng). Trong lúc gõ chỉ chứa chữ số và một dấu ":" (≤5 ký tự) —
   * ô không để lọt chữ cái hay chuỗi dài.
   */
  gio_tiep_nhan_dinh_dang: {
    khiNao: 'go-gio',
    async kiem({ page, hd }) {
      const r = await page.evaluate(() => {
        const o = document.querySelector('[data-testid="field-gioTiepNhan"]');
        return {
          co: !!o,
          giaTri: o ? o.value : '',
          baoLoi: !!document.querySelector('[data-testid="field-gioTiepNhan-loi"]'),
        };
      });
      if (!r.co) return { khongDoDuoc: true, chiTiet: 'không thấy ô field-gioTiepNhan' };
      if (!/^\d{0,2}(:\d{0,2})?$/.test(r.giaTri) || r.giaTri.length > 5) {
        return { chiTiet: `ô giờ chứa "${r.giaTri}" sau khi gõ "${hd.gio}" — chỉ được chữ số và một dấu ":"` };
      }
      const hopLe = r.giaTri === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(r.giaTri);
      if (!hopLe && !r.baoLoi) {
        return { chiTiet: `ô giờ giữ "${r.giaTri}" (không hợp lệ) sau khi rời ô mà KHÔNG báo lỗi — gõ "${hd.gio}"` };
      }
      return null;
    },
  },
};

module.exports = { BAT_BIEN, chupGiaTriOnhap };
