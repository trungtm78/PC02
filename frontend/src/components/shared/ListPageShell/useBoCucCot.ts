import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userTableLayoutsApi } from '@/lib/api';
import type { ColumnDef } from './Table';
import {
  apDungBoCuc,
  boCucTuLocalStorage,
  ganViTri,
  KHOA_DA_CHUYEN,
  type BoCucCot,
} from './boCucCot';

/**
 * Bố cục cột của người dùng: bề rộng, ẩn/hiện, thứ tự — lưu trên máy chủ theo tài khoản.
 *
 * Thay `useColumnVisibility` (lưu ở `localStorage` từng máy). MỞ RỘNG primitive sẵn có chứ
 * không dựng hệ thứ hai bên cạnh: cùng một chỗ lưu cho cả ba loại tuỳ chỉnh, cùng một nút
 * "Về mặc định". Hai hệ song song cho cùng một thứ là lỗi đã phải gỡ ở PR #233.
 *
 * Một lượt gọi `GET` duy nhất cho MỌI bảng, react-query chia sẻ giữa các trang.
 */

const KHOA_TRUY_VAN = ['user-table-layouts'];
/** Bố cục đổi hiếm nhưng phải thấy ngay khi quay lại tab — cùng nhịp với phím tắt. */
const CU_SAU_MS = 30 * 1000;

export interface BoCucCotHook<TRow> {
  /** Cột đang hiện, đã áp bề rộng và thứ tự người dùng đặt. */
  visibleColumns: ColumnDef<TRow>[];
  /** Cột được phép bật/tắt — chỉ cột khai `optional`. */
  toggleableColumns: ColumnDef<TRow>[];
  isVisible(key: string): boolean;
  batTat(key: string): void;
  datBeRong(key: string, px: number): void;
  xoaBeRong(key: string): void;
  doiCho(key: string, toiViTri: number): void;
  datLai(): void;
}

export function useBoCucCot<TRow>(
  tableKey: string,
  columns: ColumnDef<TRow>[],
): BoCucCotHook<TRow> {
  const qc = useQueryClient();

  const { data: tatCa } = useQuery({
    queryKey: KHOA_TRUY_VAN,
    queryFn: () => userTableLayoutsApi.list().then((r) => r.data),
    staleTime: CU_SAU_MS,
    refetchOnWindowFocus: true,
    // Máy chủ lỗi thì rơi về mặc định trong mã: danh sách hồ sơ không được chết vì một tuỳ
    // chọn hiển thị. Cùng lớp phòng thủ thứ ba của `useUserShortcuts`.
    retry: false,
  });

  const boCuc: BoCucCot = useMemo(() => tatCa?.[tableKey] ?? {}, [tatCa, tableKey]);

  const luu = useMutation({
    mutationFn: (moi: BoCucCot) => userTableLayoutsApi.luu(tableKey, moi),
    // Hiện NGAY, không chờ mạng: chờ thì cột nhảy giật một nhịp sau mỗi lần kéo và cảm giác
    // như bị treo. Hỏng thì trả lại bố cục cũ.
    onMutate: async (moi) => {
      await qc.cancelQueries({ queryKey: KHOA_TRUY_VAN });
      const truoc = qc.getQueryData<Record<string, BoCucCot>>(KHOA_TRUY_VAN);
      qc.setQueryData<Record<string, BoCucCot>>(KHOA_TRUY_VAN, {
        ...(truoc ?? {}),
        [tableKey]: moi,
      });
      return { truoc };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.truoc) qc.setQueryData(KHOA_TRUY_VAN, ctx.truoc);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KHOA_TRUY_VAN }),
  });

  const datLaiMut = useMutation({
    mutationFn: () => userTableLayoutsApi.datLai(tableKey),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: KHOA_TRUY_VAN });
      const truoc = qc.getQueryData<Record<string, BoCucCot>>(KHOA_TRUY_VAN);
      qc.setQueryData<Record<string, BoCucCot>>(KHOA_TRUY_VAN, { ...(truoc ?? {}), [tableKey]: {} });
      return { truoc };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.truoc) qc.setQueryData(KHOA_TRUY_VAN, ctx.truoc);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KHOA_TRUY_VAN }),
  });

  /**
   * GỘP vào bố cục đang có, không thay thế.
   *
   * Thay thế thì ẩn một cột sẽ xoá mất bề rộng người dùng vừa kéo ở cột khác — mất lặng lẽ,
   * và họ chỉ phát hiện sau khi tải lại trang.
   */
  const gop = useCallback(
    (them: BoCucCot) => {
      const moi: BoCucCot = { ...boCuc };
      for (const [k, v] of Object.entries(them)) {
        const cu = moi[k] ?? {};
        const gopCot = { ...cu, ...v };
        // Ghi đè rỗng thì bỏ hẳn khoá — giữ đúng nguyên tắc chỉ lưu thứ đã đổi.
        if (Object.keys(gopCot).length === 0) delete moi[k];
        else moi[k] = gopCot;
      }
      luu.mutate(moi);
    },
    [boCuc, luu],
  );

  // ── Chuyển lựa chọn cũ trong trình duyệt lên máy chủ, đúng MỘT lần ──
  //
  // Hôm nay lựa chọn ẩn/hiện nằm ở `localStorage`. Không chuyển thì lần đầu mở bản mới, mọi
  // cột cán bộ đã tắt hiện lại hết và họ phải tắt lại từ đầu trên từng máy.
  //
  // Chỉ chuyển khi máy chủ CHƯA có bố cục cho bảng ấy: máy chủ đã có nghĩa là người dùng đã
  // chỉnh ở đâu đó, và dữ liệu cũ của một máy không được đè lên.
  const daDay = useRef(false);
  useEffect(() => {
    if (daDay.current || tatCa === undefined) return;
    if (Object.keys(tatCa[tableKey] ?? {}).length > 0) return;
    const cu = boCucTuLocalStorage(tableKey);
    if (!cu || Object.keys(cu).length === 0) return;
    daDay.current = true;
    try {
      localStorage.setItem(KHOA_DA_CHUYEN, '1');
    } catch {
      // Ghi cờ hỏng thì lần sau chuyển lại — vô hại vì máy chủ lúc ấy đã có bố cục.
    }
    luu.mutate(cu);
  }, [tatCa, tableKey, luu]);

  const visibleColumns = useMemo(() => apDungBoCuc(columns, boCuc), [columns, boCuc]);
  const toggleableColumns = useMemo(() => columns.filter((c) => c.optional != null), [columns]);

  const isVisible = useCallback(
    (key: string) => {
      const c = columns.find((x) => x.key === key);
      if (!c) return false;
      if (c.optional == null) return true;
      const g = boCuc[key]?.hidden;
      return g !== undefined ? !g : c.optional === 'show';
    },
    [columns, boCuc],
  );

  const batTat = useCallback(
    (key: string) => {
      const c = columns.find((x) => x.key === key);
      if (!c || c.optional == null) return;
      gop({ [key]: { hidden: isVisible(key) } });
    },
    [columns, gop, isVisible],
  );

  const datBeRong = useCallback((key: string, px: number) => gop({ [key]: { width: px } }), [gop]);

  const xoaBeRong = useCallback(
    (key: string) => {
      const moi: BoCucCot = { ...boCuc };
      const con = { ...(moi[key] ?? {}) };
      delete con.width;
      if (Object.keys(con).length === 0) delete moi[key];
      else moi[key] = con;
      luu.mutate(moi);
    },
    [boCuc, luu],
  );

  /** Đổi chỗ sinh vị trí mới cho NHIỀU cột cùng lúc — gửi một lần, không vá từng cột. */
  const doiCho = useCallback(
    (key: string, toiViTri: number) => {
      const thuTu = visibleColumns.filter((c) => c.optional != null && !c.sticky).map((c) => c.key);
      if (!thuTu.includes(key)) return;
      gop(ganViTri(thuTu, key, toiViTri));
    },
    [visibleColumns, gop],
  );

  const datLai = useCallback(() => datLaiMut.mutate(), [datLaiMut]);

  return {
    visibleColumns,
    toggleableColumns,
    isVisible,
    batTat,
    datBeRong,
    xoaBeRong,
    doiCho,
    datLai,
  };
}
