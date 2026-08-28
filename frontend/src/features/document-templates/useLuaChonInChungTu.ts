import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userExportPreferencesApi, type LuaChonInApi } from '@/lib/api';
import type { EntityType } from './types';

/**
 * Lựa chọn in chứng từ đã lưu của chính người đang đăng nhập.
 *
 * ── Vì sao ──
 *
 * Popup In chứng từ bị gỡ khỏi màn hình khi đóng nên không nhớ gì: mỗi lần in, cán bộ phải tích
 * lại từ đầu. Đơn thư có 14 mẫu (đo 28/08/2026) nên đây là việc lặp mỗi ngày.
 *
 * ── Thứ tự ưu tiên ──
 *
 * Lựa chọn CÁ NHÂN thắng; ai chưa từng đặt thì popup dùng cờ `selectedByDefault` admin bật ở màn
 * Quản lý mẫu chứng từ. `undefined` = chưa từng đặt, khác hẳn `{templateIds: []}` = đặt rồi mà
 * cố ý không chọn mẫu nào — lẫn hai cái là lần sau popup tích lại đúng thứ cán bộ vừa bỏ.
 *
 * ── Vì sao `tai()` trả Promise thay vì `useQuery` ──
 *
 * Popup gieo lựa chọn ban đầu trong `.then` của `Promise.all`, cùng một lượt render với danh
 * sách mẫu. Dùng `useQuery` thì dữ liệu về ở lượt render SAU, nên có một khoảnh khắc danh sách
 * đã hiện mà chưa ô nào tích — người dùng nhanh tay bấm Xuất lúc ấy thấy nút bị khoá. Đúng bẫy
 * đã trả giá hôm nay. `fetchQuery` vẫn dùng chung kho đệm của react-query nên một lượt gọi đủ
 * cho cả ba màn.
 */
const KHOA = ['user-export-preferences'] as const;
const STALE_MS = 30_000;

type BanDoLuaChon = Record<string, LuaChonInApi>;

export interface KetQuaLuaChonIn {
  /** Đọc lựa chọn đã lưu. `undefined` = CHƯA từng đặt. Không bao giờ ném. */
  tai: () => Promise<LuaChonInApi | undefined>;
  /**
   * Ghi lựa chọn. Trả Promise và KHÔNG BAO GIỜ ném — nơi gọi phải `await` được để lệnh ghi đi
   * xong trước khi popup đóng.
   */
  luu: (luaChon: LuaChonInApi) => Promise<void>;
  datLai: () => Promise<void>;
}

export function useLuaChonInChungTu(entityType: EntityType): KetQuaLuaChonIn {
  const qc = useQueryClient();

  const tai = useCallback(async (): Promise<LuaChonInApi | undefined> => {
    try {
      const banDo = await qc.fetchQuery<BanDoLuaChon>({
        queryKey: KHOA,
        queryFn: async () => (await userExportPreferencesApi.list()).data,
        staleTime: STALE_MS,
        retry: false,
      });
      return banDo?.[entityType];
    } catch {
      // CỐ Ý nuốt: máy chủ lỗi thì popup vẫn phải in được. Mất trí nhớ còn hơn mất đường in —
      // rơi về cờ admin là trạng thái luôn dùng được, và cán bộ vẫn tích tay bình thường.
      return undefined;
    }
  }, [qc, entityType]);

  const luuMut = useMutation({
    mutationFn: (luaChon: LuaChonInApi) => userExportPreferencesApi.luu(entityType, luaChon),
    onMutate: async (luaChon) => {
      await qc.cancelQueries({ queryKey: KHOA });
      const truoc = qc.getQueryData<BanDoLuaChon>(KHOA);
      qc.setQueryData<BanDoLuaChon>(KHOA, { ...(truoc ?? {}), [entityType]: luaChon });
      return { truoc };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.truoc !== undefined) qc.setQueryData(KHOA, ctx.truoc);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KHOA }),
  });

  const datLaiMut = useMutation({
    mutationFn: () => userExportPreferencesApi.datLai(entityType),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: KHOA });
      const truoc = qc.getQueryData<BanDoLuaChon>(KHOA);
      // XOÁ HẲN khoá, không đặt khối rỗng: vắng mặt nghĩa là "theo cờ admin", còn rỗng nghĩa là
      // "cán bộ cố ý không chọn mẫu nào". Đặt rỗng ở đây là không bao giờ về được mặc định.
      const moi = { ...(truoc ?? {}) };
      delete moi[entityType];
      qc.setQueryData(KHOA, moi);
      return { truoc };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.truoc !== undefined) qc.setQueryData(KHOA, ctx.truoc);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KHOA }),
  });

  // `mutate`/`mutateAsync` của react-query ỔN ĐỊNH qua các lượt render; đối tượng mutation thì
  // KHÔNG. Bám vào đối tượng là mỗi lượt render sinh một hàm mới.
  const { mutateAsync: goiLuu } = luuMut;
  const { mutateAsync: goiDatLai } = datLaiMut;

  /**
   * Dùng `mutateAsync` chứ KHÔNG `mutate`.
   *
   * `mutate` là bắn-rồi-quên và gắn với vòng đời component. Popup ĐÓNG ngay sau khi xuất xong,
   * nên quan sát viên bị huỷ trước khi lệnh ghi kịp đi — lựa chọn không bao giờ tới máy chủ, và
   * hỏng hoàn toàn im lặng: cán bộ thấy tệp tải về bình thường, mở lại popup mới biết chẳng nhớ
   * gì. Bắt được ở UAT trên máy thật 29/08/2026; ca kiểm thành phần không thấy.
   */
  const luu = useCallback(
    async (luaChon: LuaChonInApi) => {
      try {
        await goiLuu(luaChon);
      } catch {
        // CỐ Ý nuốt: mất trí nhớ còn hơn mất đường in. `onError` của mutation đã hoàn nguyên kho
        // đệm; ném tiếp ở đây là chặn việc xuất vì một thứ phụ.
      }
    },
    [goiLuu],
  );
  const datLai = useCallback(async () => {
    await goiDatLai();
  }, [goiDatLai]);

  /**
   * Trả đối tượng ỔN ĐỊNH.
   *
   * Không gói thì mỗi lượt render sinh một đối tượng mới, và bất kỳ `useEffect` nào của popup
   * bám vào nó sẽ chạy lại → đặt state → render lại → vòng lặp vô tận. Đã dẫm đúng bẫy này:
   * React báo "Maximum update depth exceeded" ngay lần chạy ca kiểm đầu tiên.
   */
  return useMemo(() => ({ tai, luu, datLai }), [tai, luu, datLai]);
}
