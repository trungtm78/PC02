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
  /** Nhãn riêng (mặc định "Xuất N dòng Excel"). Dùng khi màn có hơn một nút xuất. */
  nhanRieng?: string;
  /** `data-testid` riêng — hai nút cùng một id thì ca kiểm mù và cán bộ cũng không phân biệt được. */
  testId?: string;
  /** Gợi ý khi rê chuột — nút xuất đầy đủ cần nói rõ nó khác nút thường ở đâu. */
  goiY?: string;
  /** KHÔNG gửi danh sách cột (đường xuất đầy đủ tự quyết bộ cột của nó). */
  boQuaCot?: boolean;
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
  nhanRieng,
  testId,
  goiY,
  boQuaCot,
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
        params: {
          ...(JSON.parse(khoaThamSo) as Record<string, unknown>),
          // Đường xuất đầy đủ tự quyết bộ cột của nó; gửi `cot` lên chỉ để máy chủ bỏ qua, mà
          // `CotXuatDto.cot` lại khai `@MaxLength(1000)` nên ~130 khoá là một lượt 400 vô cớ.
          ...(boQuaCot ? {} : { cot: khoaCot }),
        },
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
  }, [duongDan, khoaThamSo, khoaCot, tenDuPhong, boQuaCot]);

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

  // `tong` là số dòng của bộ lọc ĐANG áp dụng — còn thay đổi chưa áp dụng thì chưa biết số dòng sẽ xuất,
  // và bộ lọc cũ ra 0 dòng không có nghĩa bộ lọc mới cũng thế.
  const nhan = nhanRieng
    ? hasUnappliedChanges
      ? `Áp dụng & ${nhanRieng.toLowerCase()}`
      : nhanRieng
    : hasUnappliedChanges
      ? 'Áp dụng & xuất Excel'
      : tong === null
        ? 'Xuất Excel'
        : `Xuất ${tong.toLocaleString('vi-VN')} dòng Excel`;
  const rong = tong === 0 && !hasUnappliedChanges;

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        data-testid={testId ?? 'btn-xuat-excel-theo-bo-loc'}
        onClick={bam}
        disabled={dangXuat || rong}
        title={rong ? 'Không có dữ liệu để xuất' : goiY}
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
