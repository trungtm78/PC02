/**
 * Hai cách một thực thể lưu giá trị ô hệ cũ.
 *
 * Vụ án có một nhánh lồng (`statistic.…`) vì 48 chỉ tiêu thống kê nằm ở bảng riêng. Đơn thư
 * và Vụ việc thì phẳng. Tách ra đây để tiền tố lồng chỉ tồn tại ở MỘT chỗ, thay vì rải trong
 * mã dựng giao diện — chỗ nó vốn nằm và khiến thành phần dựng ô không dùng lại được.
 */
import type { LegacyFieldValue } from './types';

/** Chuẩn hoá giá trị đọc từ dữ liệu form về đúng ba kiểu ô hệ cũ mang được. */
function chuanHoa(raw: unknown): LegacyFieldValue {
  if (typeof raw === 'boolean') return raw;
  if (Array.isArray(raw)) return raw as string[];
  return raw == null ? '' : String(raw);
}

export interface LegacyAccessor<TForm> {
  read(form: TForm, field: string): LegacyFieldValue;
  write(form: TForm, field: string, value: LegacyFieldValue): TForm;
}

/** Dữ liệu form phẳng — mọi ô nằm thẳng ở cấp trên cùng (Đơn thư, Vụ việc). */
export function flatAccessor<TForm>(): LegacyAccessor<TForm> {
  return {
    read: (form, field) => chuanHoa((form as Record<string, unknown>)[field]),
    write: (form, field, value) => ({ ...form, [field]: value }) as TForm,
  };
}

/**
 * Dữ liệu form có MỘT nhánh lồng: ô nào mang tiền tố `<prefix>.` thì đọc/ghi trong nhánh ấy.
 *
 * Vụ án truyền `"statistic"`; ô `statistic.ngayThongKe` đi vào `formData.statistic.ngayThongKe`.
 */
export function nestedAccessor<TForm, K extends keyof TForm & string>(
  prefix: K,
): LegacyAccessor<TForm> {
  const dau = `${prefix}.`;
  const trongNhanh = (field: string) => field.startsWith(dau);
  const khoaCon = (field: string) => field.slice(dau.length);

  return {
    read: (form, field) => {
      const ban = form as Record<string, unknown>;
      const raw = trongNhanh(field)
        ? (ban[prefix] as Record<string, unknown> | undefined)?.[khoaCon(field)]
        : ban[field];
      return chuanHoa(raw);
    },
    write: (form, field, value) => {
      if (!trongNhanh(field)) return { ...form, [field]: value } as TForm;
      const ban = form as Record<string, unknown>;
      const nhanh = (ban[prefix] ?? {}) as Record<string, unknown>;
      return { ...form, [prefix]: { ...nhanh, [khoaCon(field)]: value } } as TForm;
    },
  };
}
