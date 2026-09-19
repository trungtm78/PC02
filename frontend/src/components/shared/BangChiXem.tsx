import { Eye } from 'lucide-react';

/**
 * Dải báo ở đầu form SỬA khi người mở chỉ ĐỌC được hồ sơ (máy chủ trả `quyenGhi: false` — cùng luật checkWriteScope).
 * Form vẫn hiện đủ để xem; mọi nút ghi đã ẩn và đường gửi form bị chặn ở trang (20/09/2026).
 */
export function BangChiXem({ loai }: { loai: string }) {
  return (
    <div
      role="status"
      data-testid="bang-chi-xem"
      className="flex items-start gap-3 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700"
    >
      <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
      <p>
        <span className="font-semibold">Chỉ xem.</span> {loai} này nằm ngoài phạm vi ghi của bạn — bạn xem được đầy đủ
        nhưng không lưu thay đổi được. Cần sửa, hãy nhờ tổ đang thụ lý hoặc người được phân công.
      </p>
    </div>
  );
}
