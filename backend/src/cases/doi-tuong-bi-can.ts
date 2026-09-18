/**
 * Chuỗi cột "Đối tượng bị can" — bản máy chủ của `formatDoiTuongBiCan` ở
 * `frontend/src/pages/cases/CaseListPageShell.tsx`, để tệp Excel in đúng thứ màn hiện.
 *
 * Máy chủ chỉ trả tối đa `LIST_SUSPECT_NAMES_LIMIT` tên kèm `_count.subjects` đếm cùng điều kiện;
 * phần dư hiện "+N". Khác màn đúng một chỗ: không có bị can thì ô TRỐNG (màn vẽ "—").
 */
export function dinhDangDoiTuongBiCan(r: {
  subjects?: readonly { fullName: string | null }[] | null;
  _count?: { subjects?: number } | null;
}): string {
  const ten = (r.subjects ?? [])
    .map((s) => s.fullName)
    .filter((t): t is string => Boolean(t));
  if (ten.length === 0) return '';
  const tong = r._count?.subjects ?? ten.length;
  const du = Math.max(0, tong - ten.length);
  return du > 0 ? `${ten.join(', ')} +${du}` : ten.join(', ');
}
