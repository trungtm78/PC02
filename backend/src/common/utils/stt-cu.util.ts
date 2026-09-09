/**
 * Điều kiện lọc cho ô "STT cũ" — nhận đúng thứ cán bộ quen gõ ở hệ cũ.
 *
 * Hệ cũ (`_PC02/Modules/doi_1/act/list.php:140-151`) tách chuỗi tìm theo dấu `-`: gõ `2016-208`
 * thì lấy VẾ SAU rồi `intval`, gõ `208` thì dùng thẳng. Cán bộ đã quen gõ cả hai kiểu.
 *
 * Không dịch lại hành vi ấy thì người gõ `2016-208` không ra hồ sơ nào, và không có gì báo là
 * do cách gõ — họ kết luận hồ sơ không tồn tại.
 *
 * Đây là NƠI DUY NHẤT dựng điều kiện ấy: trước đó ba service chép tay cùng một dòng, sửa một
 * chỗ thì hai chỗ kia vẫn theo luật cũ.
 */
export function dieuKienSttCu(
  gia: string | undefined | null,
): { contains: string; mode: 'insensitive' } | undefined {
  const tho = gia?.trim();
  if (!tho) return undefined;

  // Vế sau dấu `-`, đúng như hệ cũ. Vế sau rỗng (gõ mỗi "2016-") thì giữ nguyên chuỗi —
  // lấy chuỗi rỗng là biến bộ lọc thành khớp-tất-cả mà trông vẫn như đang lọc.
  const sau = tho.includes('-') ? tho.slice(tho.indexOf('-') + 1).trim() : tho;
  const chon = sau || tho;

  // `intval` của hệ cũ bỏ số 0 đệm: `008` và `8` là một. Chỉ áp cho chuỗi thuần số —
  // chuỗi khác giữ nguyên, không đoán thay cán bộ.
  const chuan = /^\d+$/.test(chon) ? String(parseInt(chon, 10)) : chon;

  return { contains: chuan, mode: 'insensitive' };
}
