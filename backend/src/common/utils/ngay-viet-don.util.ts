/**
 * Hiển thị "Ngày viết đơn" — MỘT nơi cho mọi chỗ đọc nó.
 *
 * Hồ sơ giữ hai cột: `petitionDate` (ngày thật, chỉ có khi nhập ĐỦ) và `ngayVietDonEdtf`
 * (EDTF Level 1, có cả khi nhập thiếu: `2026-12-XX`). Mỗi nơi tự ghép hai cột là mời chúng
 * trôi khỏi nhau — nơi này in "__/12/2026", nơi kia in rỗng, nơi thứ ba bịa ra ngày 01.
 *
 * Cổng `moiNoiInNgayVietDonDungMotHam` bắt mọi nơi đọc thẳng `petitionDate` để in.
 */

const KHUYET = 'XX';

interface HoSoCoNgay {
  petitionDate?: Date | string | null;
  ngayVietDonEdtf?: string | null;
  /**
   * Bản THÔ hệ cũ. 4.435 hồ sơ prod có `ngay_viet_don` là CHỮ TỰ DO ("Không ghi ngày",
   * "tháng 5/2026", "28/12/2023, 19/12/2023 (03 đơn)…") mà HAI CỘT đều rỗng — thông tin chỉ
   * tồn tại ở đây.
   */
  legacyRaw?: Record<string, unknown> | null;
}

function hai(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Chuỗi hiện cho người đọc: `15/12/2026` · `__/12/2026` · `__/__/2026` · `''`.
 *
 * KHÔNG BAO GIỜ bịa ngày: thiếu phần nào thì phần ấy là `__`.
 */
export function ngayVietDonHienThi(r: HoSoCoNgay): string {
  const edtf = r.ngayVietDonEdtf?.trim();
  if (edtf) {
    const m = /^(\d{4})-(\d{2}|XX)-(\d{2}|XX)$/.exec(edtf);
    if (m) {
      const ngay = m[3] === KHUYET ? '__' : m[3];
      const thang = m[2] === KHUYET ? '__' : m[2];
      return `${ngay}/${thang}/${m[1]}`;
    }
  }
  // Hồ sơ cũ chưa có cột EDTF thì vẫn in được từ cột ngày thật.
  const d = r.petitionDate ? new Date(r.petitionDate) : null;
  if (d && !Number.isNaN(d.getTime())) {
    return `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }

  /*
    ĐƯỜNG LÙI CUỐI CÙNG: bản thô hệ cũ.

    4.435 hồ sơ prod có `ngay_viet_don` là chữ tự do mà hai cột đều rỗng, vì chuyển kiểu sang
    DATE đã bào mất chúng lúc di trú. Không có nhánh này thì bản in ra TRỐNG — thông tin biến
    mất trên một văn bản gửi ra ngoài ngành, và cán bộ vừa bấm In không hề biết.

    Đứng SAU hai cột: cán bộ sửa ngày trên hệ mới thì thứ họ sửa phải thắng bản gốc chưa sửa.

    Mẫu HE_CU_* đã tự đỡ ở `khoa-he-cu.ts` (bản thô thắng cả cột, vì bản in phải giống hệ cũ
    từng chữ). Nhánh này là cho họ mẫu PC01 — chúng đi thẳng qua hàm dùng chung nên trước đây
    cả họ bị hở.
  */
  const tho = (r.legacyRaw ?? {})['ngay_viet_don'];
  return typeof tho === 'string' && tho.trim() ? tho.trim() : '';
}

/**
 * Suy chuỗi EDTF từ một ngày THẬT đã đầy đủ: `2026-09-15`.
 *
 * Giữ bất biến **có `petitionDate` thì phải có `ngayVietDonEdtf`**. Không có nó thì mỗi client
 * chỉ gửi ngày thật (gói giao diện cũ còn trong tab của cán bộ, bộ nạp hệ cũ, tự sinh đơn từ
 * vụ án, người gọi API trực tiếp) lại đẻ ra một bản ghi hai cột lệch nhau — và mọi phép lọc
 * hay sắp xếp đọc THẲNG cột chữ sẽ bỏ sót đúng những dòng ấy.
 *
 * Chỉ suy KHI ngày thật hợp lệ. Không bịa gì: ngày thật vốn đã đủ ba thành phần.
 */
export function edtfTuNgayThat(
  ngay: Date | string | null | undefined,
): string | null {
  if (!ngay) return null;
  const d = new Date(ngay);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${hai(d.getUTCMonth() + 1)}-${hai(d.getUTCDate())}`;
}
