import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { parseBlobError, triggerDownload } from '@/features/document-templates/export.api';
import { A11Y_FOCUS_RING, BTN_OUTLINE_BLUE } from '@/constants/styles';

interface Props {
  /** Điểm cuối xuất, vd `/petitions/export/danh-sach`. */
  duongDan: string;
  /** ĐÚNG bộ tham số bảng đang dùng (thẻ tìm, trạng thái, ngày, cán bộ nhập, sắp xếp…), không phân trang. */
  thamSo: Record<string, unknown>;
  /** Khoá các cột đang hiện, theo thứ tự hiển thị. */
  cot: string[];
  /** Tổng số dòng đang lọc — hiện trên nhãn nút; `null` khi chưa biết. */
  tong: number | null;
  /** Bộ lọc có thay đổi chưa áp dụng thì áp dụng TRƯỚC rồi mới xuất, để tệp khớp màn hình. */
  hasUnappliedChanges: boolean;
  onApply: () => void;
  /** Tên tệp dự phòng khi máy chủ không gửi Content-Disposition. */
  tenDuPhong: string;
}

/**
 * Nút "Xuất N dòng Excel" trong khung Bộ lọc (anh yêu cầu 18/09/2026): xuất ĐÚNG dữ liệu đang lọc, theo
 * thứ tự và các cột đang hiện. Máy chủ đếm và chặn khi vượt trần — nút hiện nguyên câu máy chủ trả.
 */
export function NutXuatTheoBoLoc({
  duongDan,
  thamSo,
  cot,
  tong,
  hasUnappliedChanges,
  onApply,
  tenDuPhong,
}: Props) {
  const [dangXuat, setDangXuat] = useState(false);
  const [loi, setLoi] = useState('');
  /** Bấm khi còn thay đổi chưa áp dụng: áp dụng xong (tham số mới về) thì mới xuất. */
  const choXuatSauApDung = useRef(false);

  // Khoá theo GIÁ TRỊ: `thamSo` đổi tham chiếu mỗi lần màn vẽ lại.
  const khoaThamSo = JSON.stringify(thamSo);
  const khoaCot = cot.join(',');
  const xuat = useCallback(async () => {
    setDangXuat(true);
    setLoi('');
    try {
      const res = await api.get<Blob>(duongDan, {
        params: { ...(JSON.parse(khoaThamSo) as Record<string, unknown>), cot: khoaCot },
        responseType: 'blob',
      });
      triggerDownload(res, tenDuPhong);
    } catch (e) {
      setLoi(
        extractApiError(await parseBlobError(e), 'Không xuất được tệp Excel. Vui lòng thử lại.').messages.join(', '),
      );
    } finally {
      setDangXuat(false);
    }
  }, [duongDan, khoaThamSo, khoaCot, tenDuPhong]);

  // Tham số đã áp dụng đổi (sau onApply) → `xuat` mới → chạy lượt xuất đang chờ.
  useEffect(() => {
    if (!choXuatSauApDung.current || hasUnappliedChanges) return;
    choXuatSauApDung.current = false;
    void xuat();
  }, [xuat, hasUnappliedChanges]);

  const bam = () => {
    if (hasUnappliedChanges) {
      choXuatSauApDung.current = true;
      onApply();
      return;
    }
    void xuat();
  };

  const nhan =
    tong === null
      ? 'Xuất Excel'
      : `Xuất ${tong.toLocaleString('vi-VN')} dòng Excel`;

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        data-testid="btn-xuat-excel-theo-bo-loc"
        onClick={bam}
        disabled={dangXuat || tong === 0}
        title={tong === 0 ? 'Không có dữ liệu để xuất' : undefined}
        className={`${BTN_OUTLINE_BLUE} ${A11Y_FOCUS_RING} inline-flex items-center gap-2`}
      >
        {dangXuat ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
        {dangXuat ? 'Đang xuất…' : nhan}
      </button>
      {loi && (
        <p role="alert" data-testid="loi-xuat-excel" className="mt-1 text-xs text-red-700 max-w-xs text-right">
          {loi}
        </p>
      )}
    </div>
  );
}
