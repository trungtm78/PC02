import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { EntityDocumentsTab } from '@/components/documents/EntityDocumentsTab';
import { LOAI_TEP_KET_QUA } from '@/features/petitions/loai-tep.def';

/**
 * Nhập nhanh "Kết quả xử lý, giải quyết khác" + tệp nhận từ đơn vị xử lý, ngay trên màn danh
 * sách (anh yêu cầu 22/09/2026).
 *
 * MỞ TỪ CHÍNH Ô "Kết quả xử lý", không thêm nút thứ sáu vào cột Thao tác. Cột ấy đang khai
 * `12rem` cho 5 nút, và nút thứ sáu là ĐÚNG hình học đã làm mất nút In trên prod hôm 21/09
 * (#464). Bấm vào ô để sửa chính ô ấy cũng là thao tác tự nhiên hơn một icon không nhãn.
 */
export interface KetQuaXuLyModalProps {
  petitionId: string;
  stt: string;
  /** Giá trị đang hiện trên bảng. */
  giaTri: string;
  /** Mốc chống ghi đè — xem chú thích ở `luu()`. */
  updatedAt?: string;
  onClose: () => void;
  /** Lưu xong: báo cho bảng tải lại. */
  onSaved: (giaTriMoi: string) => void;
}

export function KetQuaXuLyModal({
  petitionId,
  stt,
  giaTri,
  updatedAt,
  onClose,
  onSaved,
}: KetQuaXuLyModalProps) {
  const [chu, setChu] = useState(giaTri);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState('');
  const [xungDot, setXungDot] = useState(false);

  useEffect(() => setChu(giaTri), [giaTri]);

  const luu = async () => {
    setDangLuu(true);
    setLoi('');
    try {
      /*
        `expectedUpdatedAt` là BẮT BUỘC, không phải tuỳ chọn.

        `petitions.service.ts:1132` viết `...(dto.expectedUpdatedAt ? { updatedAt } : {})` —
        thiếu khoá ấy thì phép chống ghi đè IM LẶNG TẮT. Hai cán bộ cùng mở popup trên một hồ
        sơ, người sau xoá trắng kết quả người trước, và cả hai đều thấy "Lưu thành công".
      */
      await api.put(`/petitions/${petitionId}`, {
        ketQuaXuLyKhac: chu.trim() === '' ? null : chu,
        ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}),
      });
      onSaved(chu);
      onClose();
    } catch (e: unknown) {
      const { message } = extractApiError(e, 'Không lưu được. Vui lòng thử lại.');
      /*
        GIỮ NGUYÊN chữ cán bộ vừa gõ khi đụng xung đột.

        Đóng popup hoặc xoá ô lúc này là bắt người ta gõ lại từ đầu một đoạn vừa soạn — và lần
        gõ lại thường ngắn hơn, mất chi tiết. Ô vẫn sửa được, chỉ hiện rõ là có người khác đã
        đổi hồ sơ trong lúc mình soạn.
      */
      setXungDot(true);
      setLoi(message);
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="modal-ket-qua-xu-ly"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-800">
            Kết quả xử lý — đơn {stt}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
            data-testid="btn-dong-ket-qua"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Kết quả xử lý, giải quyết khác
            </label>
            <textarea
              rows={5}
              value={chu}
              onChange={(e) => setChu(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Các trường hợp xử lý giải quyết khác"
              data-testid="o-ket-qua-xu-ly"
            />
          </div>

          {loi && (
            <p className="text-sm text-red-600" data-testid="loi-ket-qua-xu-ly">
              {loi}
              {xungDot && ' — chữ anh vừa gõ vẫn còn trong ô, mở lại hồ sơ để đối chiếu rồi lưu lại.'}
            </p>
          )}

          <EntityDocumentsTab
            entityKind="petition"
            entityId={petitionId}
            chiLoai={[LOAI_TEP_KET_QUA]}
            loaiMacDinh={LOAI_TEP_KET_QUA}
            tieuDe="Tệp nhận từ đơn vị xử lý"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => void luu()}
            disabled={dangLuu}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            data-testid="btn-luu-ket-qua"
          >
            <Save className="w-4 h-4" />
            {dangLuu ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}
