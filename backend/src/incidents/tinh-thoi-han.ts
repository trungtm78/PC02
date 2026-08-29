/**
 * Phép tính THỜI HẠN TỐ TỤNG — tách khỏi service để ca kiểm với tới được.
 *
 * ── Vì sao tách ──
 *
 * Trước bản này phép tính nằm inline trong `incidents.service.ts`:
 *
 *     const d = new Date(dto.ngayDeXuat);
 *     d.setDate(d.getDate() + xacMinhRule.value);
 *
 * và ở đường gia hạn:
 *
 *     const newDeadline = new Date(currentDeadline);
 *     newDeadline.setDate(newDeadline.getDate() + extensionDays);
 *
 * Muốn kiểm nó phải dựng cả `PrismaService`, `AuditService`, `DeadlineRulesService`,
 * `DocumentNumbersService` và `EventEmitter` — nên trên thực tế KHÔNG ca kiểm nào chạm tới,
 * dù đây là vùng rủi ro cao nhất hệ: sai một ngày là sai thời hạn theo Điều 147/148/149
 * BLTTHS 2015, và hậu quả là hồ sơ quá hạn mà không ai biết.
 *
 * Tách ra hàm thuần thì kiểm được trên HÀNG NGHÌN đầu vào thay vì vài ví dụ tay.
 *
 * ── Vì sao dùng `setDate` chứ không cộng mili-giây ──
 *
 * `+ n * 86400000` sai vào ngày đổi giờ mùa (DST). Việt Nam không đổi giờ, nhưng máy chủ hoặc
 * bản sao dữ liệu có thể chạy ở múi khác, và một hạn tố tụng lệch một ngày là lệch thật.
 * `setDate` cộng theo LỊCH, đúng ở mọi múi giờ.
 */

/** Số ngày tối đa nhận được — chặn cấu hình sai làm hạn văng ra hàng thế kỷ. */
export const SO_NGAY_TOI_DA = 3650;

/**
 * Cộng `soNgay` ngày lịch vào `moc`.
 *
 * Không đụng vào `moc` (trả về Date mới) — bên gọi thường giữ mốc gốc để ghi nhật ký.
 *
 * @throws Error khi mốc không hợp lệ, hoặc số ngày âm / không nguyên / vượt trần.
 */
export function congNgay(moc: Date, soNgay: number): Date {
  if (!(moc instanceof Date) || Number.isNaN(moc.getTime())) {
    throw new Error('Mốc thời gian không hợp lệ');
  }
  if (!Number.isInteger(soNgay)) {
    throw new Error('Số ngày phải là số nguyên');
  }
  if (soNgay < 0) {
    throw new Error('Số ngày không được âm — thời hạn chỉ đi tới, không lùi lại');
  }
  if (soNgay > SO_NGAY_TOI_DA) {
    throw new Error(`Số ngày vượt trần ${SO_NGAY_TOI_DA}`);
  }
  const ra = new Date(moc.getTime());
  ra.setDate(ra.getDate() + soNgay);
  return ra;
}

/**
 * Thời hạn giải quyết ban đầu = mốc tiếp nhận + thời hạn luật định.
 */
export function tinhThoiHan(mocTiepNhan: Date, soNgayLuatDinh: number): Date {
  return congNgay(mocTiepNhan, soNgayLuatDinh);
}

/**
 * Hạn sau khi gia hạn = hạn hiện tại + số ngày gia hạn.
 *
 * Gia hạn chỉ ĐẨY HẠN RA XA. Số ngày âm bị chặn ở `congNgay`, nên không có đường nào kéo hạn
 * vào gần hơn — đó là bất biến nghiệp vụ, không phải chi tiết kỹ thuật: kéo hạn vào là biến một
 * hồ sơ đang trong hạn thành quá hạn bằng một thao tác mang tên "gia hạn".
 */
export function tinhHanSauGiaHan(hanHienTai: Date, soNgayGiaHan: number): Date {
  if (soNgayGiaHan <= 0) {
    throw new Error('Số ngày gia hạn phải lớn hơn 0');
  }
  return congNgay(hanHienTai, soNgayGiaHan);
}
