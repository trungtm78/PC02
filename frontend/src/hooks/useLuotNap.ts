import { useRef, useCallback } from "react";

/**
 * Chỉ cho lượt nạp MỚI NHẤT được ghi vào state.
 *
 * ── Vì sao ──
 *
 * Đổi bộ lọc hoặc gõ tìm kiếm nhanh thì nhiều lượt nạp chạy song song. Chừng nào `catch` còn im
 * lặng thì một lượt cũ hỏng muộn là vô hại — nó không đụng vào state. Nhưng từ khi `catch` dọn
 * dữ liệu và báo lỗi (đợt vá "tải hỏng phải khác rỗng"), lượt cũ hỏng muộn sẽ XOÁ kết quả của
 * lượt mới đã xong và bày lỗi cho một câu hỏi người dùng không còn xem.
 *
 * Tức bản vá tự tạo ra một cuộc đua. Hook này là lớp chặn, dùng chung cho mọi trang có bộ lọc.
 *
 * ── Dùng ──
 *
 *     const { batDau } = useLuotNap();
 *     const nap = useCallback(async () => {
 *       const conMoiNhat = batDau();
 *       try {
 *         const res = await api.get(...);
 *         if (!conMoiNhat()) return;
 *         setItems(res.data.data ?? []);
 *       } catch (e) {
 *         if (!conMoiNhat()) return;
 *         setLoadError(...);
 *       }
 *     }, [deps]);
 */
export function useLuotNap(): { batDau: () => () => boolean } {
  const dem = useRef(0);
  const batDau = useCallback(() => {
    const luot = ++dem.current;
    return () => luot === dem.current;
  }, []);
  return { batDau };
}
