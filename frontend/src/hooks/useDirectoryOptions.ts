import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DirectoryOption {
  value: string;
  label: string;
}

/**
 * Số dòng tải sẵn khi KHÔNG có từ khoá tìm.
 *
 * Đủ cho mọi danh mục nhỏ (loại đơn, nguồn tin…) và cho danh sách mở đầu của danh mục lớn. Với
 * danh mục lớn, việc tìm do MÁY CHỦ làm — xem `search` bên dưới.
 */
const SO_DONG_MAC_DINH = 200;

/**
 * Tuỳ chọn danh mục cho ô tìm.
 *
 * `search` là phần quan trọng: máy chủ chặn cứng `limit` ở 1.000
 * (`query-directory.dto.ts`), nên danh mục lớn hơn thế KHÔNG BAO GIỜ tải hết về máy được. Lọc
 * phía trình duyệt trên một trang đã cắt là hỏng im lặng — cán bộ gõ tên một đơn vị có thật
 * trong cơ sở dữ liệu mà ô tìm báo không có, rồi tạo ra một bản trùng.
 *
 * Đo 09/09/2026: danh mục `DON_VI` sẽ có ~1.868 dòng sau khi nạp dữ liệu cũ.
 */
export function useDirectoryOptions(
  type: string | undefined,
  opts?: { limit?: number; returnId?: boolean; search?: string },
) {
  const limit = opts?.limit ?? SO_DONG_MAC_DINH;
  const returnId = opts?.returnId ?? false;
  const search = opts?.search?.trim() ?? '';

  return useQuery({
    queryKey: ['directories', type, returnId ? 'by-id' : 'by-name', search],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: type ?? '',
        limit: String(limit),
        isActive: 'true',
      });
      if (search) params.set('search', search);
      const res = await api.get(`/directories?${params.toString()}`);
      const items = res.data?.data ?? [];
      return items.map((d: { id: string; name: string; code: string }) => ({
        // returnId=true: value is the DB id (for parentId foreign key)
        // returnId=false (default): value is the name (for simple string fields)
        value: returnId ? d.id : d.name,
        label: returnId ? `${d.name} (${d.code})` : d.name,
      })) as DirectoryOption[];
    },
    enabled: !!type,
    // Kết quả tìm giữ ngắn hơn danh sách mặc định: vừa tạo một đơn vị xong thì lần gõ kế tiếp
    // phải thấy nó ngay, không đợi 10 phút.
    staleTime: search ? 30 * 1000 : 10 * 60 * 1000,
    // Giữ kết quả cũ trong lúc gõ tiếp — danh sách không nháy trắng giữa hai lần hỏi.
    placeholderData: (truoc) => truoc,
  });
}
