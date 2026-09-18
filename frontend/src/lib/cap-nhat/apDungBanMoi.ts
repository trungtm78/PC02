/**
 * Lên bản mới: gỡ service worker, xoá kho nội dung, rồi tải trang.
 *
 * ── Chuyện đã xảy ra (28/08/2026) ──
 * Cán bộ dùng bản của 5 ngày trước mà không ai biết: CDN ghim `sw.js` cũ, service worker cũ phục vụ
 * gói cũ từ kho nội bộ, app cũ chạy trơn tru. Chỉ gỡ service worker là chưa đủ — kho nội dung vẫn giữ
 * gói cũ và bản mới sẽ dùng lại chúng — nên xoá luôn kho rồi mới tải.
 *
 * ── 18/09/2026: tự lên bản, không hỏi ──
 * Trước đây app chỉ HIỆN dải báo "Đang dùng bản cũ" và chờ cán bộ bấm. Anh báo dải ấy tốn thời gian
 * và che tầm nhìn; nay app tự lên bản ở thời điểm an toàn (`useTuCapNhat`). Chốt chống lặp gắn theo
 * BẢN ĐÍCH chứ không theo phiên: chốt theo phiên chặn luôn mọi lần deploy sau trong ngày.
 */

/** Bản đích đã thử lên trong phiên này. Cùng bản đích mà vẫn lệch → không thử lại (tránh lặp). */
export const KHOA_DA_CAP_NHAT = 'pc02-da-cap-nhat-toi';

/** Bản đang chạy lúc đã tự tải lại vì lỗi tải gói. Tải lại mà vẫn cùng bản → gói hỏng thật, thôi. */
export const KHOA_DA_TAI_LAI_CHUNK = 'pc02-da-tai-lai-chunk';

/** Máy chủ trả số này khi KHÔNG đọc được tệp phiên bản — không phải một bản thật. */
const KHONG_XAC_DINH = '0.0.0.0';

/** Dấu "không đọc được kho phiên" — khác mọi bản số thật. */
const KHONG_DOC_DUOC = Symbol('khong-doc-duoc');

function doc(khoa: string): string | null | typeof KHONG_DOC_DUOC {
  try {
    return sessionStorage.getItem(khoa);
  } catch {
    // `sessionStorage` ném lỗi ở chế độ riêng tư. Coi như "đã thử" để KHÔNG tự tải lại: thà dùng
    // bản cũ thêm một lúc còn hơn có nguy cơ lặp tải lại mà không có chốt.
    return KHONG_DOC_DUOC;
  }
}

function ghi(khoa: string, giaTri: string): boolean {
  try {
    sessionStorage.setItem(khoa, giaTri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Có nên lên bản `cuaMayChu` không. Tách khỏi phần gọi mạng để kiểm được luật mà không cần máy chủ
 * giả — luật mới là chỗ nguy hiểm.
 */
export function canCapNhat(cuaGiaoDien?: string, cuaMayChu?: string): boolean {
  const a = (cuaGiaoDien ?? '').trim();
  const b = (cuaMayChu ?? '').trim();
  // Thiếu một trong hai thì KHÔNG đoán: máy chủ bản cũ chưa có `buildId`, giao diện dựng lỗi có
  // thể thiếu bản số — không phải lý do bắt cán bộ tải lại trang.
  if (!a || !b) return false;
  if (b === KHONG_XAC_DINH) return false;
  if (a === b) return false;
  const daThu = doc(KHOA_DA_CAP_NHAT);
  if (daThu === KHONG_DOC_DUOC || daThu === b) return false;
  return true;
}

/**
 * Gỡ service worker + xoá kho rồi TẢI LẠI trang hiện tại.
 *
 * Luôn `reload()`, không `assign(url)`: lúc chuyển màn thì URL đã là màn đích, và `assign` tạo mục
 * lịch sử mới với `history.state` rỗng — màn đọc `location.state` (vd CaseDetail `activeTab`,
 * Chuyển/Trả hồ sơ `preselectedRecord`) sẽ mất dữ liệu (rà mã 18/09/2026).
 */
async function goBanCuRoiTaiLai(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const ds = await navigator.serviceWorker.getRegistrations();
      await Promise.all(ds.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const ten = await caches.keys();
      await Promise.all(ten.map((t) => caches.delete(t)));
    }
  } catch (loi) {
    // Gỡ hỏng thì vẫn tải: bản thân lượt tải đã có thể lấy được bản mới. Để lại dấu vết.
    console.warn('[apDungBanMoi] gỡ service worker/kho lỗi, vẫn tải trang:', loi);
  }
  window.location.reload();
}

/** Lên bản `banDich`. Ghi chốt TRƯỚC; không ghi được chốt thì THÔI — nguy cơ lặp lớn hơn lợi ích. */
export async function apDungBanMoi(banDich: string): Promise<void> {
  if (!ghi(KHOA_DA_CAP_NHAT, banDich)) return;
  await goBanCuRoiTaiLai();
}

/**
 * Lỗi tải gói (tên tệp gói đổi sau deploy trong lúc tab còn mở): tự tải lại MỘT lần cho bản đang
 * chạy. Trả `true` nếu đã tải lại — nơi gọi thì thôi xử lý tiếp; `false` là gói hỏng thật, để giao
 * diện báo lỗi như thường.
 */
export function taiLaiKhiHongChunk(banDangChay: string): boolean {
  const daThu = doc(KHOA_DA_TAI_LAI_CHUNK);
  if (daThu === KHONG_DOC_DUOC || daThu === banDangChay) return false;
  if (!ghi(KHOA_DA_TAI_LAI_CHUNK, banDangChay)) return false;
  // Gỡ cả service worker: tab do SW điều khiển mà chỉ `reload()` thì SW cũ có thể trả lại đúng bộ
  // khung cũ, và chốt đã ghi thì lần hỏng sau không thử nữa — kẹt ở màn lỗi (codex 18/09/2026).
  void goBanCuRoiTaiLai();
  return true;
}
