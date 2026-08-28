import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

/**
 * App tự nhận ra mình đang chạy bản cũ, và tự thoát.
 *
 * ── Chuyện đã xảy ra ──
 *
 * Ngày 28/08/2026: cán bộ dùng app của bản 23/08 suốt 5 ngày mà không ai biết. CDN giữ
 * `sw.js` cũ ở biên 30 ngày, nên trình duyệt hỏi bản mới thì biên trả lại đúng bản cũ; service
 * worker cũ tiếp tục phục vụ gói cũ từ kho nội bộ; và mọi tệp cũ vẫn còn trên máy chủ nên app
 * cũ chạy trơn tru. Deploy xanh, health ok, hỏng HOÀN TOÀN IM LẶNG. Chỉ lộ khi có người tình
 * cờ bấm Ctrl+Shift+R.
 *
 * Giao diện không tự biết mình cũ: nó chỉ mang một bản số nướng sẵn lúc dựng. Nên nó phải hỏi
 * một nguồn KHÔNG BAO GIỜ bị cache — `/api/v1/health`, đi thẳng xuống máy chủ, không qua
 * service worker (đường `/api/` khai NetworkOnly) và không qua cache của CDN.
 *
 * ── Vì sao phần lớn mã ở đây là chốt chặn ──
 *
 * Rủi ro của chính tính năng này lớn hơn lỗi nó chữa: tự tải lại trang giữa giờ làm việc sẽ
 * cuốn mất dữ liệu cán bộ đang nhập dở. Nên nó chỉ được làm ĐÚNG MỘT LẦN mỗi phiên, và chỉ
 * khi cả hai bên đều nói rõ số hiệu của mình.
 */

/** Chốt chặn vòng lặp. Dùng `sessionStorage`: hết phiên là quên, không kẹt vĩnh viễn. */
export const KHOA_DA_TU_CHUA = 'pc02-da-tu-chua-ban-cu';

/** Máy chủ trả số này khi KHÔNG đọc được tệp phiên bản — không phải một bản thật. */
const KHONG_XAC_DINH = '0.0.0.0';

/**
 * Có nên tự chữa không.
 *
 * Tách khỏi phần gọi mạng để kiểm được luật mà không cần dựng máy chủ giả — và luật ở đây mới
 * là chỗ nguy hiểm, không phải lượt gọi.
 */
export function canTuChua(cuaGiaoDien?: string, cuaMayChu?: string): boolean {
  const a = (cuaGiaoDien ?? '').trim();
  const b = (cuaMayChu ?? '').trim();
  // Thiếu một trong hai thì KHÔNG đoán. Máy chủ bản cũ chưa có trường `version`, và giao diện
  // dựng lỗi có thể thiếu bản số — cả hai đều không phải lý do bắt cán bộ tải lại trang.
  if (!a || !b) return false;
  // Máy chủ đọc lỗi tệp phiên bản: coi là "khác" thì mỗi lần đọc lỗi sẽ bắt TOÀN BỘ cán bộ
  // tải lại trang một lần vô cớ.
  if (b === KHONG_XAC_DINH) return false;
  if (a === b) return false;
  // Đã tự chữa một lần trong phiên này thì thôi: service worker có thể vẫn ghim bản cũ, và
  // không có chốt này thì tải lại → vẫn lệch → tải lại… vòng vô tận.
  try {
    if (sessionStorage.getItem(KHOA_DA_TU_CHUA)) return false;
  } catch {
    // `sessionStorage` ném lỗi ở chế độ riêng tư — thà không tự chữa còn hơn có nguy cơ lặp.
    return false;
  }
  return true;
}

/** Khoảng cách giữa hai lần hỏi. Đủ thưa để không phiền máy chủ, đủ dày để không lỡ cả buổi. */
const NHIP_MS = 10 * 60 * 1000;

/**
 * Gỡ service worker rồi tải lại.
 *
 * Chỉ gỡ là chưa đủ: kho nội dung (Cache Storage) vẫn giữ gói cũ và service worker mới sẽ
 * dùng lại chúng. Xoá luôn kho rồi mới tải lại.
 */
async function thoatBanCu(): Promise<void> {
  try {
    sessionStorage.setItem(KHOA_DA_TU_CHUA, '1');
  } catch {
    // Không ghi được chốt thì THÔI, không tải lại — nguy cơ lặp lớn hơn lợi ích.
    return;
  }
  try {
    if ('serviceWorker' in navigator) {
      const ds = await navigator.serviceWorker.getRegistrations();
      await Promise.all(ds.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const ten = await caches.keys();
      await Promise.all(ten.map((t) => caches.delete(t)));
    }
  } catch {
    // Gỡ hỏng thì vẫn tải lại: bản thân lượt tải lại đã có thể lấy được bản mới.
  }
  window.location.reload();
}

/**
 * Gắn một lần ở khung ứng dụng.
 *
 * Hỏi ngay khi vào, rồi hỏi lại theo nhịp và mỗi lần quay lại tab — cán bộ thường để tab mở
 * cả ngày, nên chỉ hỏi lúc vào là bỏ lỡ mọi lần deploy trong ngày.
 */
export function useTuChuaBanCu(phienBanGiaoDien: string): void {
  const dangChay = useRef(false);

  useEffect(() => {
    let huy = false;

    const kiem = async () => {
      if (huy || dangChay.current) return;
      dangChay.current = true;
      try {
        const r = await api.get<{ version?: string }>('/health');
        if (!huy && canTuChua(phienBanGiaoDien, r.data?.version)) {
          await thoatBanCu();
        }
      } catch {
        // Mất mạng hoặc máy chủ lỗi — im lặng, nhịp sau hỏi lại.
      } finally {
        dangChay.current = false;
      }
    };

    void kiem();
    const dinhKy = setInterval(() => void kiem(), NHIP_MS);
    const khiQuayLai = () => {
      if (document.visibilityState === 'visible') void kiem();
    };
    document.addEventListener('visibilitychange', khiQuayLai);

    return () => {
      huy = true;
      clearInterval(dinhKy);
      document.removeEventListener('visibilitychange', khiQuayLai);
    };
  }, [phienBanGiaoDien]);
}
