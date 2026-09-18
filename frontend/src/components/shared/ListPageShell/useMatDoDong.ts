import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matDoDongApi, type MatDo } from '@/lib/api';
import { MAT_DO_MAC_DINH } from './matDo';

/**
 * Một khoá cho mọi bảng — một lần gọi lúc vào màn đủ cho cả ứng dụng. Khoá GỐC RIÊNG, không nằm dưới
 * `['user-table-layouts']`: `useBoCucCot` huỷ/làm mới khoá ấy theo tiền tố mỗi lần kéo cột — chung tiền tố là mật
 * độ bị huỷ theo và bảng lật tạm về "Đọc" (rà mã PR-F2).
 */
const KHOA_TRUY_VAN = ['user-table-mat-do'];

/**
 * Mật độ dòng của MỘT bảng, nhớ theo cán bộ ở máy chủ (18/09/2026, PR-F2).
 *
 * - Chưa chọn / máy chủ lỗi → "Đọc": danh sách hồ sơ không được chết vì một tuỳ chọn hiển thị.
 * - Đổi là hiện NGAY (cập nhật lạc quan), lưu hỏng thì trả lại lựa chọn cũ.
 * - Đổi tài khoản: `useXoaKhoDemKhiDoiTaiKhoan` xoá cả kho đệm nên người sau không thấy lựa chọn người trước.
 */
export function useMatDoDong(tableKey: string): [MatDo, (moi: MatDo) => void] {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: KHOA_TRUY_VAN,
    queryFn: () => matDoDongApi.list().then((r) => r.data),
    staleTime: 30_000,
    retry: false,
  });

  const luu = useMutation({
    mutationFn: (moi: MatDo) => matDoDongApi.luu(tableKey, moi),
    onMutate: async (moi) => {
      await qc.cancelQueries({ queryKey: KHOA_TRUY_VAN });
      const truoc = qc.getQueryData<Record<string, MatDo>>(KHOA_TRUY_VAN);
      qc.setQueryData<Record<string, MatDo>>(KHOA_TRUY_VAN, { ...(truoc ?? {}), [tableKey]: moi });
      return { truoc };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.truoc) qc.setQueryData(KHOA_TRUY_VAN, ctx.truoc);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KHOA_TRUY_VAN }),
  });

  const { mutate } = luu;
  const dat = useCallback((moi: MatDo) => mutate(moi), [mutate]);
  return [data?.[tableKey] ?? MAT_DO_MAC_DINH, dat];
}
