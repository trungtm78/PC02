import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';
import {
  gopCauHinhBamDong,
  BAM_DONG_MAC_DINH,
  type BamDongGiaTri,
  type KhoaBamDong,
} from '@/constants/giaoDienSettings';

/**
 * Cấu hình giao diện admin đặt (hành động khi bấm vào dòng danh sách…), lấy từ `GET /settings/giao-dien`.
 *
 * Kho cấp MÔ-ĐUN thay vì react-query: 7 màn danh sách đọc chung một bản, không cần `QueryClientProvider` (các ca
 * kiểm render màn riêng lẻ cũng không phải dựng thêm), và một cú tải phục vụ mọi màn trong 5 phút.
 *
 * Luôn có giá trị dùng được: chưa tải xong, mạng lỗi, API bản cũ chưa có đường này → mặc định trong mã. Màn danh sách
 * không bao giờ phải chờ hay hỏng vì cấu hình.
 */
const TUOI_TOI_DA_MS = 5 * 60 * 1000;
/** Tải hỏng: thử lại sau ~1 phút (lần gắn kế tiếp), không đập máy chủ mỗi lần dựng lại. */
const THU_LAI_SAU_LOI_MS = 60 * 1000;

type CauHinh = Record<KhoaBamDong, BamDongGiaTri>;
interface TrangThai {
  data: CauHinh;
  /** Mốc giờ của lần tải gần nhất (0 = chưa từng). */
  luc: number;
}

let trangThai: TrangThai = { data: { ...BAM_DONG_MAC_DINH }, luc: 0 };
let dangTai: Promise<void> | null = null;
/** Tăng mỗi lần đặt lại: kết quả của một lần tải bắt đầu TRƯỚC khi đặt lại là kết quả cũ, bỏ đi. */
let epoca = 0;
const nguoiNghe = new Set<() => void>();

function datTrangThai(moi: TrangThai): void {
  const doiGiaTri = JSON.stringify(moi.data) !== JSON.stringify(trangThai.data);
  // Giữ NGUYÊN tham chiếu `data` khi không đổi giá trị: các màn dùng nó làm khoá useCallback/useMemo.
  trangThai = { data: doiGiaTri ? moi.data : trangThai.data, luc: moi.luc };
  if (doiGiaTri) nguoiNghe.forEach((f) => f());
}

function tai(): Promise<void> {
  if (dangTai) return dangTai;
  const e = epoca;
  dangTai = (async () => {
    try {
      const res = await api.get<{ success?: boolean; data?: unknown }>('/settings/giao-dien');
      if (e === epoca) datTrangThai({ data: gopCauHinhBamDong(res?.data?.data), luc: Date.now() });
    } catch {
      if (e === epoca) {
        datTrangThai({ data: trangThai.data, luc: Date.now() - TUOI_TOI_DA_MS + THU_LAI_SAU_LOI_MS });
      }
    } finally {
      if (e === epoca) dangTai = null;
    }
  })();
  return dangTai;
}

/** Gọi sau khi admin lưu một khoá: bản trong bộ nhớ cũ ngay lập tức, màn danh sách đang mở nhận giá trị mới. */
export function lamMoiCauHinhGiaoDien(): Promise<void> {
  // Một lần tải đang bay đã đọc cấu hình TRƯỚC khi admin lưu: bỏ kết quả của nó (đổi epoca) rồi tải lại, nếu không
  // `tai()` trả luôn lần tải cũ và màn danh sách giữ giá trị cũ tới 5 phút.
  epoca += 1;
  dangTai = null;
  trangThai = { ...trangThai, luc: 0 };
  return tai();
}

/** Chỉ cho ca kiểm: về trạng thái như vừa mở trang. */
export function datLaiCauHinhGiaoDienChoCaKiem(): void {
  epoca += 1;
  trangThai = { data: { ...BAM_DONG_MAC_DINH }, luc: 0 };
  dangTai = null;
  nguoiNghe.clear();
}

function dangKy(f: () => void): () => void {
  nguoiNghe.add(f);
  return () => {
    nguoiNghe.delete(f);
  };
}

export function useCauHinhGiaoDien(): CauHinh {
  const snap = useSyncExternalStore(dangKy, () => trangThai, () => trangThai);
  useEffect(() => {
    if (Date.now() - trangThai.luc > TUOI_TOI_DA_MS) void tai();
  }, []);
  return snap.data;
}
