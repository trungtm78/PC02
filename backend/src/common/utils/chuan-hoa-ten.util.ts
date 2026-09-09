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
  return boDauTiengViet(ten)
    .replace(/^bch\s+/, '')
    .replace(/[.,;:()\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
