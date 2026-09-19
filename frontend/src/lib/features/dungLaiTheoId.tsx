import { Fragment, type ReactElement } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Dựng lại trang từ đầu mỗi khi `:id` trên URL đổi — dùng cho mọi route SỬA theo id.
 *
 * React Router giữ nguyên component khi chỉ tham số đổi (`/cases/A/edit` → `/cases/B/edit` qua ô tìm kiếm chung).
 * Với form sửa, đó là lỗi dữ liệu: mục thêm mới đang nhập cho A bị ghi vào B khi bấm Lưu, và kết quả tải trễ của A
 * trộn vào form B (rà mã độc lập 19/09/2026, PR #430). Gắn `key` theo id là cách React bỏ toàn bộ state cũ.
 * Cổng: `__tests__/dungLaiTheoId.test.tsx` đỏ khi có route `:id/edit` quên bọc.
 */
export function DungLaiTheoId({ children }: { children: ReactElement }) {
  const { id } = useParams();
  return <Fragment key={id ?? ''}>{children}</Fragment>;
}
