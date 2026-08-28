/**
 * Lựa chọn cho ô "Tình trạng hồ sơ" và "Phân loại hồ sơ nội bộ" — vốn là `<select>` ở hệ cũ.
 *
 * Hệ cũ lưu bằng MÃ, chữ chỉ tra ra lúc hiện. Ta chép sang thành ô gõ tự do nên nó in nguyên
 * mã ra màn hình: vụ án `2026-11139` hiện `-1` (anh phát hiện 28/08/2026). Máy chủ đã giải mã
 * tại cửa vào (`backend/src/legacy-migration/ma-o-chon-he-cu.ts`); đây là nửa còn lại — đổi ô
 * gõ thành ô chọn để cán bộ không gõ chữ tự do vào rồi cột lại lẫn số với chữ như cũ.
 *
 * Bảng dưới đây phải khớp từng dòng với bảng ở máy chủ; có cổng đọc thẳng mã nguồn máy chủ để
 * canh, vì hai bản chép tay của cùng một bảng sẽ lệch ngay lần đầu ai đó sửa một bên.
 *
 * `value` là CHỮ chứ không phải mã, vì cột trong cơ sở dữ liệu lưu chữ sau khi giải mã. Lưu mã
 * ở đây thì mỗi lần cán bộ mở form rồi bấm Lưu là ghi ngược mã số trở lại cột.
 */
export interface TuyChon {
  value: string;
  label: string;
}

export type ThucTheHoSo = 'DON_THU' | 'VU_VIEC' | 'VU_AN';

/** Vụ án — bỏ `-1` "Tất cả" của bộ lọc; trên bản ghi `-1` nghĩa là chưa chọn, tức ô trống. */
const VU_AN: TuyChon[] = [
  { value: '-2', label: 'Chưa rõ' },
  { value: '0', label: 'Vụ án đang điều tra' },
  { value: '2', label: 'Đã kết luận điều tra' },
  { value: '3', label: 'Điều tra bổ sung' },
  { value: '4', label: 'Điều tra lại' },
  { value: '5', label: 'Vụ án Tạm đình chỉ' },
  { value: '6', label: 'Vụ án TĐC hết thời hiệu' },
  { value: '7', label: 'Vụ án TĐC HTH đã đình chỉ' },
  { value: '8', label: 'Đình chỉ vụ án' },
  { value: '9', label: 'Vụ án đã chuyển đơn vị khác' },
  { value: '10', label: 'Đã nhập vào vụ án khác' },
  { value: '11', label: 'Vụ án phục hồi điều tra' },
  { value: '12', label: 'Vụ án đã được tách' },
];

/** Vụ việc — mã trùng số với vụ án nhưng KHÁC nghĩa. */
const VU_VIEC: TuyChon[] = [
  { value: '-2', label: 'Chưa rõ' },
  { value: '0', label: 'Vụ việc đang xác minh' },
  { value: '1', label: 'Vụ việc đã lên phân công' },
  { value: '2', label: 'Vụ việc không khởi tố' },
  { value: '3', label: 'Vụ việc Tạm đình chỉ' },
  { value: '4', label: 'Vụ việc TĐC hết thời hiệu' },
  { value: '5', label: 'Vụ việc TĐC HTH không khởi tố' },
  { value: '6', label: 'Vụ việc đã chuyển đơn vị khác' },
  { value: '7', label: 'Đã nhập vào vụ việc khác' },
  { value: '8', label: 'Phân loại dân sự' },
  { value: '9', label: 'Ủy thác điều tra' },
  { value: '10', label: 'Luật sư' },
  { value: '11', label: 'Vụ việc chuyển XPHC' },
  { value: '12', label: 'Vụ việc phục hồi nguồn tin TP' },
  { value: '13', label: 'Phân loại khác' },
];

export const TINH_TRANG_OPTIONS: Record<ThucTheHoSo, TuyChon[]> = {
  VU_AN,
  VU_VIEC,
  /** Đơn thư là giai đoạn trước vụ việc trong cùng luồng hồ sơ — dùng chung bảng của vụ việc. */
  DON_THU: VU_VIEC,
};

export const PHAN_LOAI_HO_SO_OPTIONS: TuyChon[] = [
  { value: 'don_thu', label: 'Đơn thư đã phân loại' },
  { value: 'vu_viec_da_phan_loai', label: 'Vụ việc đã phân loại' },
  { value: 'vu_an_da_phan_loai', label: 'Vụ án đã phân loại' },
  { value: 'tra_ho_so', label: 'Trả hồ sơ' },
  { value: 'huong_dan', label: 'Hướng dẫn' },
  { value: 'trao_doi_chuyen_an', label: 'Trao đổi chuyên án' },
  { value: 'luat_su', label: 'Luật sư' },
  { value: 'uy_thac_dieu_tra', label: 'Ủy thác điều tra' },
  { value: 'vu_viec_phuong_xa', label: 'Vụ việc phường/xã' },
  { value: 'vu_an_phuong_xa', label: 'Vụ án phường/xã' },
  { value: 'kien_nghi_vks', label: 'Kiến nghị VKS' },
];

/**
 * Chèn giá trị đang có vào danh sách nếu nó không nằm trong đó.
 *
 * 118 vụ việc mang chữ thật ("Tạm đình chỉ theo Điều 134") không thuộc 15 lựa chọn, và cột
 * cũng có thể còn mã lạ chưa tra được. Ô chọn thường sẽ hiện TRỐNG cho những hồ sơ ấy, rồi
 * lần lưu kế tiếp ghi rỗng đè lên — cán bộ không hề biết mình vừa xoá gì.
 *
 * Nhãn của giá trị lạ là chính nó: bịa một nhãn khác là che mất thứ đang nằm trong cơ sở dữ
 * liệu, mà đó chính là thứ người ta cần nhìn thấy để sửa cho đúng.
 */
export function optionsGiuGiaTriLa(ds: readonly TuyChon[], giaTri: string | null | undefined): TuyChon[] {
  const v = (giaTri ?? '').trim();
  if (!v || ds.some((o) => o.value === v)) return [...ds];
  return [...ds, { value: v, label: v }];
}
