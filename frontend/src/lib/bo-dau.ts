/**
 * Bỏ dấu tiếng Việt phía giao diện — dùng để LỌC danh sách chọn tại chỗ (nhãn trạng thái, danh
 * mục). Tách dấu bằng NFD rồi bỏ dấu kết hợp, nên chữ gõ tổ hợp và chữ dựng sẵn ra cùng một kết
 * quả; `đ` không tách được bằng NFD nên đổi riêng.
 *
 * Tìm kiếm TRÊN MÁY CHỦ không đi qua hàm này: máy chủ bỏ dấu bằng bảng chung JS + SQL
 * (`backend/src/common/tim-kiem/bo-dau.ts`), giao diện chỉ gửi nguyên chữ người dùng gõ.
 */
export function boDau(chu: string): string {
  return chu.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function khopKhongDau(chu: string, truyVan: string): boolean {
  const q = boDau(truyVan).trim();
  return q === '' || boDau(chu).includes(q);
}
