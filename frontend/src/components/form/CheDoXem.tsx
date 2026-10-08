import { createContext, useContext, type ReactNode } from 'react';

/**
 * CHẾ ĐỘ CHỈ XEM của một form (vd Đơn thư `/petitions/:id`: xem trước, muốn sửa phải bấm "Sửa").
 *
 * Vì sao là ngữ cảnh chứ không phải một `<fieldset disabled>` bao tất cả: hai loại ô cần hai cách khoá khác nhau.
 * - Ô CHỮ (chữ/ngày/số/vùng văn bản) → `readOnly`, KHÔNG phải `disabled`. Trong Chromium chữ trong ô `disabled` không
 *   bôi chọn/chép được, mà mục đích của chế độ xem là để cán bộ chép dữ liệu ra chỗ khác (yêu cầu 08/10/2026).
 * - Ô CHỌN (select, FK, tội danh, ô tích) → `disabled`: không có chữ nào cần chép.
 *
 * Ngữ cảnh để ô MỚI thêm về sau tự được khoá, thay vì phải nhớ nối từng ô — hai cổng đỏ nếu quên: cổng cấu trúc duyệt
 * cả 10 tab và đòi mọi ô nhập là readOnly/disabled (`PetitionFormPage.cheDoXem.gate.test.tsx`).
 *
 * Ngoài form có bao `CheDoXemProvider` thì hook trả false và mọi ô chạy như cũ.
 */
const CheDoXemContext = createContext(false);

export function CheDoXemProvider({ xem, children }: { xem: boolean; children: ReactNode }) {
  return <CheDoXemContext.Provider value={xem}>{children}</CheDoXemContext.Provider>;
}

/** Form chứa ô này có đang ở chế độ chỉ xem không. */
export function useCheDoXem(): boolean {
  return useContext(CheDoXemContext);
}
