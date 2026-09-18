import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { api } from '@/lib/api';
import { apDungBanMoi, canCapNhat } from './apDungBanMoi';
import { trangDangRanh } from './trangDangRanh';

/** Nhịp hỏi máy chủ khi tab mở liên tục. */
const NHIP_HOI_MS = 5 * 60 * 1000;
/** Nhịp nhờ service worker tự kiểm bản mới. */
const NHIP_SW_MS = 60 * 60 * 1000;
/** Tab ẩn ít nhất bấy lâu thì lúc quay lại mới được coi là "cán bộ vừa quay về", đủ để tự tải. */
export const TAB_AN_TOI_THIEU_MS = 5 * 60 * 1000;

/**
 * App tự lên bản mới, KHÔNG hiện hộp nhắc nào (anh chốt 18/09/2026).
 *
 * Nguồn biết "có bản mới": `/api/v1/health` trả `buildId` — đi thẳng xuống máy chủ, không qua
 * service worker hay CDN nên không bao giờ bị ghim. Service worker báo có bản chờ cũng chỉ là
 * cú hích để hỏi lại nguồn ấy.
 *
 * Lên bản ở đúng ba thời điểm an toàn (khuôn "version skew" chuẩn của SPA):
 *
 *   có bản mới ──┬─ (1) cán bộ chuyển màn ──────────────► tải URL đích bằng bản mới
 *                ├─ (2) quay lại tab sau ≥ 5 phút ẩn ──► chỉ khi trangDangRanh()
 *                └─ (3) lỗi tải gói (main.tsx)       ──► taiLaiKhiHongChunk()
 *
 * Ngoài ba thời điểm ấy thì KHÔNG làm gì: đang gõ giữa màn không bao giờ bị tải lại.
 */
export function useTuCapNhat(phienBanGiaoDien: string): void {
  const { pathname } = useLocation();
  const banDich = useRef<string | null>(null);
  const dangHoi = useRef(false);
  const anTu = useRef<number | null>(null);

  useEffect(() => {
    let huy = false;

    const hoi = async (): Promise<void> => {
      if (huy || dangHoi.current) return;
      dangHoi.current = true;
      try {
        const r = await api.get<{ buildId?: string }>('/health');
        const cuaMayChu = r.data?.buildId;
        // So `buildId`, không so `version`: `version` đứng yên qua hàng chục lần deploy.
        if (!huy && canCapNhat(phienBanGiaoDien, cuaMayChu)) banDich.current = cuaMayChu ?? null;
      } catch {
        // Mất mạng hoặc máy chủ lỗi: chưa biết gì thêm, nhịp sau hỏi lại. Không có gì để báo.
      } finally {
        dangHoi.current = false;
      }
    };

    const khiDoiHienThi = () => {
      if (document.visibilityState === 'hidden') {
        anTu.current = Date.now();
        return;
      }
      const an = anTu.current;
      anTu.current = null;
      void hoi().then(() => {
        const dich = banDich.current;
        if (!huy && dich && an !== null && Date.now() - an >= TAB_AN_TOI_THIEU_MS && trangDangRanh()) {
          void apDungBanMoi(dich);
        }
      });
    };
    const khiFocus = () => void hoi();

    void hoi();
    const nhip = setInterval(() => void hoi(), NHIP_HOI_MS);
    document.addEventListener('visibilitychange', khiDoiHienThi);
    window.addEventListener('focus', khiFocus);

    // Service worker: đăng ký ở đây (không còn hộp nhắc giữ việc đăng ký). Có bản chờ thì hỏi lại
    // nguồn thật; việc lên bản vẫn đi qua ba thời điểm an toàn ở trên.
    let nhipSw: ReturnType<typeof setInterval> | undefined;
    registerSW({
      onNeedRefresh: () => void hoi(),
      onRegisteredSW: (_url, dangKy) => {
        if (!dangKy) return;
        nhipSw = setInterval(() => {
          dangKy.update().catch(() => {
            // Mất mạng: nhịp sau thử lại.
          });
        }, NHIP_SW_MS);
      },
    });

    return () => {
      huy = true;
      clearInterval(nhip);
      if (nhipSw) clearInterval(nhipSw);
      document.removeEventListener('visibilitychange', khiDoiHienThi);
      window.removeEventListener('focus', khiFocus);
    };
  }, [phienBanGiaoDien]);

  // (1) Chuyển màn: cán bộ đang rời màn cũ nên không còn gì đang gõ để mất. Bỏ qua lần dựng đầu.
  const lanDau = useRef(true);
  useEffect(() => {
    if (lanDau.current) {
      lanDau.current = false;
      return;
    }
    const dich = banDich.current;
    if (dich) void apDungBanMoi(dich, window.location.href);
  }, [pathname]);
}
