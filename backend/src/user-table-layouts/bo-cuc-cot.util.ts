/**
 * Chuẩn hoá bố cục cột do người dùng tự chỉnh, trước khi cho vào cơ sở dữ liệu.
 *
 * Bố cục lưu thành một khối JSON, mà cột JSON không tự bảo vệ mình. Một payload méo lọt qua
 * sẽ nằm luôn trong bảng và làm hỏng giao diện của chính người ấy ở MỌI lần mở sau — không
 * lỗi, không nhật ký, chỉ là bảng hiện sai mãi mà không rõ vì sao. Nên đây là cổng duy nhất.
 *
 * ── Chỉ lưu thứ người dùng ĐÃ ĐỔI ──
 *
 * Giữ đúng triết lý của `useColumnVisibility.ts:12-16` và `UserShortcut`
 * (`schema.prisma:2163-2168`): cột vắng mặt trong khối nghĩa là "lấy theo khai báo trong mã",
 * không phải "người dùng đã tắt". Lưu trạng thái đầy đủ thì không phân biệt được hai thứ ấy,
 * và mỗi lần lập trình viên thêm một cột mới là một lần bảng của mọi người hiện sai.
 *
 * ── Vì sao KẸP thay vì TỪ CHỐI ──
 *
 * Người dùng kéo quá tay là chuyện thường; từ chối cả khối vì một con số lệch nghĩa là mất
 * luôn những thay đổi hợp lệ khác trong cùng lần lưu. Kẹp vào biên cho ra kết quả dùng được
 * ngay. Ngược lại, dữ liệu SAI KIỂU (chuỗi thay vì số) là dấu hiệu hỏng chứ không phải kéo
 * quá tay — thứ ấy bỏ hẳn.
 */

/** Dưới mức này thì cột hẹp tới mức không bấm lại được để kéo ra. */
export const BE_RONG_TOI_THIEU = 60;
/** Trên mức này thì một số vô lý đẩy bảng rộng hàng vạn điểm ảnh và treo trình duyệt. */
export const BE_RONG_TOI_DA = 1200;
export const SO_COT_TOI_DA = 100;
const DAI_TEN_TOI_DA = 64;
const VI_TRI_TOI_DA = 99;

/** Tên cột hợp lệ — đủ cho khoá dạng `detailContent`, `crime.name`, `so-phieu`. */
const TEN_COT_HOP_LE = /^[A-Za-z0-9_.-]+$/;

/**
 * Khoá làm hỏng nguyên mẫu. `JSON.parse` giữ nguyên `__proto__` như một khoá thường, nhưng
 * gán nó vào object literal thì ghi vào nguyên mẫu và ảnh hưởng toàn tiến trình — đúng lớp
 * lỗi đã bắt ở công thức tính (v0.68.0.0).
 */
const KHOA_CAM = new Set(['__proto__', 'constructor', 'prototype']);

export interface GhiDeCot {
  width?: number;
  hidden?: boolean;
  position?: number;
}

export type BoCucCot = Record<string, GhiDeCot>;

function soHopLe(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function kep(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function chuanHoaBoCuc(tho: unknown): BoCucCot {
  if (!tho || typeof tho !== 'object' || Array.isArray(tho)) return {};

  const ra: BoCucCot = Object.create(null) as BoCucCot;
  let dem = 0;

  for (const [ten, giaTri] of Object.entries(tho as Record<string, unknown>)) {
    if (dem >= SO_COT_TOI_DA) break;
    if (KHOA_CAM.has(ten)) continue;
    if (!ten || ten.length > DAI_TEN_TOI_DA || !TEN_COT_HOP_LE.test(ten)) continue;
    if (!giaTri || typeof giaTri !== 'object' || Array.isArray(giaTri)) continue;

    const g = giaTri as Record<string, unknown>;
    const sach: GhiDeCot = {};

    // Kéo quá tay thì kẹp; sai kiểu thì bỏ hẳn khoá ấy nhưng GIỮ các khoá còn lại của cột —
    // một ô bề rộng hỏng không được kéo theo lựa chọn ẩn/hiện của cùng cột.
    if ('width' in g && soHopLe(g['width'])) {
      sach.width = Math.round(kep(g['width'], BE_RONG_TOI_THIEU, BE_RONG_TOI_DA));
    }
    // `false` LÀ ghi đè có nghĩa: người dùng bật lại một cột vốn ẩn theo mặc định.
    if ('hidden' in g && typeof g['hidden'] === 'boolean') sach.hidden = g['hidden'];
    if ('position' in g && soHopLe(g['position'])) {
      const v = Math.round(g['position']);
      if (v >= 0 && v <= VI_TRI_TOI_DA) sach.position = v;
    }

    // Cột không còn ghi đè nào thì không cần nằm trong khối — đúng nguyên tắc chỉ lưu thứ đã đổi.
    if (Object.keys(sach).length === 0) continue;
    ra[ten] = sach;
    dem++;
  }

  // Trả về object thường để `toEqual` và tuần tự hoá JSON cư xử như mong đợi.
  return { ...ra };
}
