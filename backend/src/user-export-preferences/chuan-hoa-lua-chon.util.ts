/**
 * Chuẩn hoá lựa chọn in chứng từ của một cán bộ.
 *
 * ── Triết lý ──
 *
 * Sai kiểu thì BỎ, quá tay thì CẮT — không từ chối cả khối. Cùng lối `bo-cuc-cot.util.ts`.
 *
 * Lý do: một hàng méo (lưu từ trước khi có cổng kiểm, hoặc sửa tay trong CSDL) mà làm popup ném
 * lỗi thì cán bộ **mất hẳn đường in**, và không có cách nào tự thoát ngoài gọi hỗ trợ. Bỏ phần
 * hỏng rồi đi tiếp thì tệ nhất họ chỉ phải tích lại.
 *
 * Dùng chung cho CẢ đường ghi lẫn đường đọc — chuẩn hoá khi đọc là thứ giữ cho hàng cũ không
 * làm vỡ popup vĩnh viễn.
 */

/** Ba định dạng xuất của popup. `separate` = nhiều tệp Word rời (mặc định của popup). */
export const CHE_DO_HOP_LE = ['separate', 'merged', 'zip'] as const;
export type CheDoXuat = (typeof CHE_DO_HOP_LE)[number];

export const CHE_DO_MAC_DINH: CheDoXuat = 'separate';

/**
 * Trần số mẫu ghi nhớ. Đơn thư — màn nhiều mẫu nhất — đang có 14 mẫu (đo 28/08/2026), nên 200
 * là rộng rãi cho mọi mức phình hợp lý, đồng thời chặn payload bịa làm phình bản ghi.
 */
export const SO_MAU_TOI_DA = 200;

/** Mã mẫu là cuid. Chuỗi dài hay ký tự lạ là dấu hiệu payload bịa, không phải mã thật. */
const DAI_MA_TOI_DA = 64;
const MA_MAU_HOP_LE = /^[A-Za-z0-9_-]+$/;

export interface LuaChonInChungTu {
  templateIds: string[];
  mode: CheDoXuat;
}

function laCheDo(v: unknown): v is CheDoXuat {
  return typeof v === 'string' && (CHE_DO_HOP_LE as readonly string[]).includes(v);
}

function locMaMau(tho: unknown): string[] {
  if (!Array.isArray(tho)) return [];
  const ra: string[] = [];
  const daCo = new Set<string>();
  for (const phanTu of tho) {
    if (ra.length >= SO_MAU_TOI_DA) break; // CẮT, không từ chối cả khối
    if (typeof phanTu !== 'string') continue;
    const ma = phanTu.trim();
    if (!ma || ma.length > DAI_MA_TOI_DA || !MA_MAU_HOP_LE.test(ma)) continue;
    if (daCo.has(ma)) continue; // trùng lặp làm popup tích một mẫu nhiều lần vô nghĩa
    daCo.add(ma);
    ra.push(ma);
  }
  return ra;
}

export function chuanHoaLuaChon(tho: unknown): LuaChonInChungTu {
  if (!tho || typeof tho !== 'object' || Array.isArray(tho)) {
    return { templateIds: [], mode: CHE_DO_MAC_DINH };
  }
  // Đọc qua `Record` chứ không destructure: payload có thể mang `__proto__` từ `JSON.parse`, và
  // đối tượng trả về được dựng mới nên không khoá lạ nào đi kèm.
  const o = tho as Record<string, unknown>;
  return {
    templateIds: locMaMau(o['templateIds']),
    // Chế độ lạ mà lọt ra popup thì KHÔNG nút định dạng nào được chọn — cán bộ nhìn thấy một
    // popup không có định dạng, bấm Xuất ra hành vi không ai định nghĩa. Rơi về mặc định là thứ
    // luôn dùng được.
    mode: laCheDo(o['mode']) ? o['mode'] : CHE_DO_MAC_DINH,
  };
}
