import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Chuỗi EDTF Level 1 cho ngày CÓ THỂ THIẾU thành phần, và phần đã ghi phải CÓ THẬT trên lịch.
 *
 * Kiểm hình dạng thôi là chưa đủ: `2026-02-31` khớp `^\d{4}-\d{2}-\d{2}$` nhưng không tồn tại.
 * Trình duyệt đã chặn, nhưng máy chủ nhận hồ sơ từ nhiều đường (CLI di trú, lời gọi API
 * thẳng), và một ngày không có thật đi thẳng xuống cột rồi lên bản in chứng từ.
 *
 * Nhận: `2026-12-15` · `2026-12-XX` · `2026-XX-XX` · `2024-02-29` (năm nhuận).
 * Chặn: `2026-02-31` · `2026-13-01` · `2026-00-10` · `2025-02-29`.
 */
const HINH_DANG = /^(\d{4})-(\d{2}|XX)-(\d{2}|XX)$/;

export function laEdtfNgayThat(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const m = HINH_DANG.exec(v);
  if (!m) return false;

  const nam = Number(m[1]);
  if (nam < 1) return false;

  // Thiếu THÁNG thì ngày cũng phải thiếu: biết ngày mà không biết tháng là không biết gì.
  if (m[2] === 'XX') return m[3] === 'XX';

  const thang = Number(m[2]);
  if (thang < 1 || thang > 12) return false;
  if (m[3] === 'XX') return true;

  const ngay = Number(m[3]);
  if (ngay < 1) return false;
  // `new Date` tự cuộn 31/02 thành 03/03 — phải so lại từng phần mới bắt được.
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  return (
    d.getUTCFullYear() === nam &&
    d.getUTCMonth() === thang - 1 &&
    d.getUTCDate() === ngay
  );
}

export function IsEdtfNgayThat(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isEdtfNgayThat',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: ({ property }) =>
          `${property}: ngày không đúng dạng EDTF hoặc không có thật (vd 2026-12-XX; 2026-02-31 không tồn tại)`,
        ...validationOptions,
      },
      validator: { validate: (v: unknown) => laEdtfNgayThat(v) },
    });
  };
}
