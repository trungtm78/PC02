/**
 * Chuẩn hoá tên đơn vị để SO TRÙNG.
 *
 * Chuyển lên đây từ `legacy-migration/cli/org-mapper.ts` vì nay cả tầng dịch vụ cũng cần: ô
 * "Tạo mới" trên form phải chặn trùng bằng ĐÚNG bộ luật đã gộp 3.806 tên thô của hệ cũ xuống
 * 2.812 đơn vị. Dựng bộ luật thứ hai ở tầng dịch vụ là cách chắc chắn để hai bên trôi khỏi
 * nhau — bẫy đã cắn nhiều lần trong dự án này.
 *
 * `org-mapper.ts` xuất lại hàm này nên mọi đường nhập cũ giữ nguyên.
 */

/** Bỏ dấu tiếng Việt, gộp khoảng trắng, đưa về chữ thường. */
export function boDauTiengViet(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Khoá so trùng của một tên đơn vị xử lý.
 *
 * Ngoài bỏ dấu còn bỏ tiền tố "BCH " (Ban chỉ huy) và mọi dấu câu, vì dữ liệu thật có đủ kiểu
 * viết cho cùng một đơn vị: `Công an Phường Bàn Cờ`, `CÔNG AN P. BÀN CỜ`, `BCH Công an phường
 * Bàn Cờ`. Không gộp chúng thì danh mục vừa dọn xong sẽ phình lại y như hệ cũ.
 */
export function khoaDonVi(ten: string): string {
  return (
    boDauTiengViet(ten)
      // "BCH Đội 4" = "Đội 4"; "Phòng PC01 …" = "PC01 …". Đo trên dữ liệu thật 09/09/2026:
      // riêng tiền tố "Phòng" đang tách 60 đơn vị thành hai dòng, trong đó có PC01 (699 + 637
      // hồ sơ) và PC03 (494 + 323) — hai đơn vị dùng nhiều nhất của danh mục.
      .replace(/^(bch|phong)\s+/, '')
      // "TP. HCM" và "TP. Hồ Chí Minh" là một thành phố. Không gộp thì "Cơ sở 1 - PC02" nằm
      // hai dòng (299 + 239 hồ sơ). Chỉ khớp HCM đứng RIÊNG một từ, không cắt vào giữa chữ.
      .replace(/\bhcm\b/g, 'ho chi minh')
      .replace(/[.,;:()\-/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
