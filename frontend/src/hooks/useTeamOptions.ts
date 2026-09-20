import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TeamOption {
  value: string; // Team.name (lưu vào donViXuLy — text; Team.name là @unique)
  label: string; // Team.name
}

/**
 * Options Tổ/Nhóm cho FKSelect "Đơn vị xử lý" khi thuộc thẩm quyền.
 * GET /teams trả MẢNG THÔ (không bọc {data}) — đọc res.data trực tiếp.
 * Lọc isActive; value = name (lưu tên tổ vào donViXuLy, đồng nhất với nhánh danh mục DON_VI).
 *
 * CHỈ Tổ/Nhóm NỘI BỘ — bỏ tổ địa bàn (công an phường/xã).
 *
 * Đo prod 20/09/2026: `GET /teams` trả 192 tổ hoạt động, trong đó **166 là công an phường/xã**
 * và chỉ **26 là Tổ/Nhóm thật**. Không lọc thì cán bộ gõ "Công an" vào ô nhãn "Chọn Tổ/Nhóm
 * xử lý" nhận về 166 dòng công an phường, còn Tổ mình cần thì chôn trong đó.
 *
 * Lọc không mất dữ liệu: 0 đơn thư đang dùng tên tổ ĐỊA BÀN làm Đơn vị xử lý, trong khi 17.199
 * đơn dùng tên Tổ chức năng.
 *
 * Phân biệt bằng cột `Team.wardId` (khai từ v0.33: rỗng = tổ chức năng), KHÔNG đoán theo tên —
 * tên là thứ người ta sửa được. Máy chủ không gửi `wardId` thì coi là chức năng: đoán nhầm
 * theo chiều kia sẽ xoá sạch danh sách.
 */
export function useTeamOptions(enabled = true) {
  return useQuery({
    queryKey: ['teams', 'options'],
    queryFn: async () => {
      const res = await api.get('/teams');
      const items: Array<{ name: string; isActive?: boolean; wardId?: string | null }> =
        Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      return items
        .filter((t) => t.isActive !== false)
        .filter((t) => t.wardId == null)
        .map((t) => ({ value: t.name, label: t.name })) as TeamOption[];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
