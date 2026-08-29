/**
 * Con số chỉ được hiện khi ta BIẾT nó đúng.
 *
 * ── Vì sao có tệp này ──
 *
 * Ngày 29/08/2026, đo trên máy thật: chặn `GET /proposals`, màn Kiến nghị VKS hiện
 * "Tổng số kiến nghị 0 · Chờ gửi 0 · Đã gửi 0" — trong khi thực tế có 33 kiến nghị chờ gửi.
 * Gốc rễ là `catch { setAllProposals([]) }`: một dòng biến "không hỏi được máy chủ" thành
 * "không có gì cả", rồi mọi thẻ thống kê đếm từ mảng rỗng ấy.
 *
 * Màn hình trắng làm người ta nghi ngờ. Ba con số không thì **đọc như một câu trả lời**: cán bộ
 * kết luận đơn vị mình không còn kiến nghị nào chờ gửi — một kết luận nghiệp vụ sai, dựng trên
 * một sự cố kỹ thuật, và không có gì trên màn hình nói cho họ biết.
 *
 * Tách ra hàm thuần để ca kiểm với tới được phép quyết định, thay vì để nó nằm rải trong JSX.
 */

/** Dấu hiệu "chưa biết" — em gạch ngang, không phải số 0, không phải khoảng trắng. */
export const CHUA_BIET = '—';

/**
 * Trả về thứ ĐƯỢC PHÉP hiện cho một con số thống kê.
 *
 * `taiHong = true` nghĩa là lần hỏi máy chủ gần nhất thất bại, nên mọi con số dẫn xuất từ nó
 * đều vô nghĩa — kể cả khi tình cờ đúng.
 */
export function soLieuHienThi(so: number | null | undefined, taiHong: boolean): string {
  if (taiHong) return CHUA_BIET;
  if (so === null || so === undefined || Number.isNaN(so)) return CHUA_BIET;
  return String(so);
}
