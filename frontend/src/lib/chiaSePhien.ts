import { authStore, layChuToken } from '@/stores/auth.store';

/**
 * Chia sẻ PHIÊN ĐĂNG NHẬP giữa các tab đang mở cùng ứng dụng.
 *
 * Vì sao cần (anh báo 08/10/2026): token truy cập nằm ở `sessionStorage` — riêng từng tab, cố ý như vậy để đóng hết
 * tab là hết phiên. Hệ quả: MỌI tab mở mới (Ctrl/⌘+bấm, nút giữa, `window.open` có `noopener`, dán địa chỉ) có
 * `sessionStorage` rỗng → `ProtectedRoute` đẩy sang /login dù cán bộ đang đăng nhập ở tab bên cạnh. Đó là lý do nút
 * "mở xem" ở gợi ý tên người gửi, và Ctrl/⌘+bấm vào dòng danh sách, đều bắt đăng nhập lại.
 *
 * Cách làm: tab mới HỎI các tab khác qua `BroadcastChannel` (chỉ cùng nguồn gốc, cùng hồ sơ trình duyệt); tab nào đang
 * đăng nhập trả lời bằng token của mình. Không có tab nào còn sống (đóng hết rồi mở lại trình duyệt) thì KHÔNG có ai
 * trả lời → đăng nhập lại như cũ. Cố ý KHÔNG đổi refresh token ở `localStorage` lấy phiên mới: làm vậy biến "đóng
 * trình duyệt" thành "vẫn đăng nhập" suốt thời hạn refresh token, là đổi chính sách bảo mật chứ không phải sửa lỗi.
 */
const TEN_KENH = 'pc02-chia-se-phien';
/** Chờ tối đa. Một vòng hỏi–đáp giữa hai tab cỡ vài ms; quá hạn này coi như không có tab nào còn sống. */
export const CHO_TOI_DA_MS = 500;

type Goi = { loai: 'hoi'; id: string } | { loai: 'dap'; id: string; accessToken: string };

interface Kenh {
  postMessage(m: unknown): void;
  close(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
}

let taoKenh = (): Kenh | null =>
  typeof BroadcastChannel === 'function' ? (new BroadcastChannel(TEN_KENH) as unknown as Kenh) : null;

/** Chỉ cho ca kiểm: thay kênh thật bằng kênh giả. Trả hàm khôi phục. */
export function datKenhChoCaKiem(f: () => Kenh | null): () => void {
  const cu = taoKenh;
  taoKenh = f;
  return () => {
    taoKenh = cu;
  };
}

function taoId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Chỉ nhận thứ trông đúng là JWT còn hạn — không nhét chuỗi bất kỳ vào `sessionStorage`. */
function laTokenHopLe(t: unknown): t is string {
  if (typeof t !== 'string') return false;
  const phan = t.split('.');
  if (phan.length !== 3) return false;
  try {
    const nd = JSON.parse(atob(phan[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof nd.exp !== 'number' || nd.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Tab đang đăng nhập trả lời tab khác xin phiên. Gọi MỘT lần lúc khởi động ứng dụng (`main.tsx`), ngoài React để
 * StrictMode không đăng ký hai lần. Trả hàm gỡ đăng ký.
 */
export function batDauTraLoiPhien(): () => void {
  const kenh = taoKenh();
  if (!kenh) return () => {};
  kenh.onmessage = (e) => {
    const g = e.data as Goi | null;
    if (!g || g.loai !== 'hoi' || typeof g.id !== 'string') return;
    // Tab không đăng nhập thì im lặng — không trả lời "không có" để tab hỏi khỏi phải phân biệt.
    const token = authStore.getAccessToken();
    if (!token || !laTokenHopLe(token)) return;
    kenh.postMessage({ loai: 'dap', id: g.id, accessToken: token } satisfies Goi);
  };
  return () => {
    kenh.onmessage = null;
    kenh.close();
  };
}

/**
 * Có đáng chờ tab khác không? Refresh token còn ở `localStorage` nghĩa là trên trình duyệt này CÓ một phiên chưa đăng
 * xuất. Đã đăng xuất (hoặc chưa từng đăng nhập) thì không có gì để xin → không bắt người dùng chờ.
 */
export function coTheCoPhienOTabKhac(): boolean {
  return !!authStore.getRefreshToken();
}

/**
 * Token nhận được có phải của ĐÚNG phiên đang sống trên trình duyệt này không? Refresh token ở `localStorage` là nguồn
 * sự thật duy nhất về "ai đang đăng nhập" (dùng chung mọi tab, ghi bởi lần đăng nhập SAU CÙNG). Token truy cập chỉ được
 * nhận khi cùng chủ (`sub`) với nó.
 *
 * Codex bắt 08/10/2026: tab A đăng nhập người A, rồi tab B đăng nhập người B (ghi đè refresh token). Tab mới hỏi thì cả A
 * lẫn B đều trả lời; nhận cái nhanh hơn có thể cho tab mới chạy người A trong khi mọi lần làm mới sau đó dùng refresh
 * token của B — lẫn phiên giữa hai người.
 */
function cungChuVoiPhienHienHanh(accessToken: string): boolean {
  const rt = authStore.getRefreshToken();
  if (!rt) return false;
  const chu = layChuToken(rt);
  return chu !== null && layChuToken(accessToken) === chu;
}

/** Xin phiên từ tab khác. `true` = đã nhận và ghi vào `sessionStorage` của tab này. */
export function xinPhienTuTabKhac(choToiDaMs: number = CHO_TOI_DA_MS): Promise<boolean> {
  if (authStore.getAccessToken()) return Promise.resolve(true);
  // Không còn refresh token = đã đăng xuất (hoặc chưa từng đăng nhập): không có phiên nào để nhận.
  if (!authStore.getRefreshToken()) return Promise.resolve(false);
  const kenh = taoKenh();
  if (!kenh) return Promise.resolve(false);
  const id = taoId();
  return new Promise<boolean>((resolve) => {
    let xong = false;
    const hen = setTimeout(() => ketThuc(false), choToiDaMs);
    function ketThuc(ok: boolean) {
      if (xong) return;
      xong = true;
      clearTimeout(hen);
      kenh!.onmessage = null;
      kenh!.close();
      resolve(ok);
    }
    kenh.onmessage = (e) => {
      const g = e.data as Goi | null;
      if (!g || g.loai !== 'dap' || g.id !== id || !laTokenHopLe(g.accessToken)) return;
      // Đăng xuất ở tab khác ngay trong lúc chờ: refresh token đã mất → không nhận phiên của tab còn sót.
      if (!authStore.getRefreshToken()) return ketThuc(false);
      // Token của người KHÁC (tab cũ còn giữ người trước): bỏ qua, chờ tab đúng người trả lời.
      if (!cungChuVoiPhienHienHanh(g.accessToken)) return;
      authStore.setAccessToken(g.accessToken);
      ketThuc(true);
    };
    kenh.postMessage({ loai: 'hoi', id } satisfies Goi);
  });
}
