/**
 * Kiểu chung cho bố cục form theo hệ cũ pc02hcm.com.
 *
 * VÌ SAO Ở TẦNG CHUNG: hệ cũ dùng ĐÚNG MỘT form `/doi-1/Them` cho cả Đơn thư, Vụ việc và Vụ
 * án — cùng 10 tab, cùng 231 nhãn, cùng thứ tự. Chỉ trường "Phân loại ban đầu" quyết định hồ
 * sơ hiện ở danh sách nào. Hệ mới tách thành ba bảng, nhưng BỐ CỤC thì vẫn là một.
 *
 * Nếu mỗi thực thể giữ một bản mô tả riêng thì hôm nào sửa nhãn ở một bên là hai màn trôi
 * khỏi nhau — đúng loại hỏng mà kiến trúc khai-bằng-dữ-liệu sinh ra để chặn.
 *
 * Cái KHÔNG dùng chung được là chỗ lưu: `field` của Vụ án trỏ vào `CaseFormData`, của Đơn thư
 * trỏ vào `PetitionFormData`. Nên phần nào dùng chung thì để ở đây, phần nào riêng thì mỗi
 * thực thể tự khai qua `LegacyFormSpec`.
 */

export type LegacyFieldKind =
  | "text"
  | "date"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "toggle"
  | "crime"
  | "fk";

/** Ba kiểu giá trị một ô hệ cũ có thể mang. */
export type LegacyFieldValue = string | string[] | boolean;

export interface LegacyLayoutItem<
  TField extends string = string,
  TTab extends string = string,
> {
  /** Nhãn nguyên văn hệ cũ. */
  caption: string;
  /** Ô lưu giá trị trong dữ liệu form của thực thể. */
  field: TField;
  kind: LegacyFieldKind;
  /** `half` = col-sm-6 hệ cũ, `full` = col-xs-12 tràn dòng. */
  span: "half" | "full";
  /** Có dấu sao đỏ ở hệ cũ. */
  required?: boolean;
  /** Tab gốc của ô, khi mục này chỉ là bản hiện lại (trường gương). */
  mirrorOf?: TTab;
  /** Gợi ý trong ô, nguyên văn hệ cũ. */
  placeholder?: string;
  /** Lựa chọn cho `select` / `multiselect` khai thẳng. */
  options?: readonly { value: string; label: string }[];
  /** Loại danh mục cho `fk`, hoặc khoá catalog cho `multiselect`. */
  source?: string;
  /** Số dòng cho `textarea`. */
  rows?: number;
}

export type LegacyLayout<TTab extends string, TField extends string> = Record<
  TTab,
  readonly LegacyLayoutItem<TField, TTab>[]
>;

export type LegacyEntity = "case" | "petition" | "incident";

/**
 * Nơi DUY NHẤT biết một thực thể lưu giá trị ở đâu.
 *
 * `read` / `write` tách ra khỏi thành phần dựng ô để tiền tố lồng (`statistic.` của Vụ án)
 * chỉ còn tồn tại ở một chỗ, thay vì rải trong mã dựng giao diện.
 */
export interface LegacyFormSpec<TForm, TTab extends string, TField extends string> {
  entity: LegacyEntity;
  tabLabel: Readonly<Record<TTab, string>>;
  layout: LegacyLayout<TTab, TField>;
  read(form: TForm, field: TField): LegacyFieldValue;
  write(form: TForm, field: TField, value: LegacyFieldValue): TForm;
  /** Tên cột ở lớp máy chủ khi khác tên ô trong dữ liệu form. */
  fieldToColumn: Readonly<Record<string, string>>;
}

/** Nhãn hiển thị thật: gắn hậu tố "(Tab: X)" cho trường gương, đúng cách hệ cũ làm. */
export function legacyCaptionOf<TField extends string, TTab extends string>(
  item: LegacyLayoutItem<TField, TTab>,
  tabLabel: Readonly<Record<TTab, string>>,
): string {
  return item.mirrorOf ? `${item.caption} (Tab: ${tabLabel[item.mirrorOf]})` : item.caption;
}

/**
 * Tập CỘT mà form đã có ô nhập ở đúng vị trí hệ cũ.
 *
 * Panel "Thông tin nghiệp vụ bổ sung" cuối trang dùng tập này để KHÔNG dựng ô thứ hai cho
 * cùng một cột. Không lọc thì mỗi cột có hai ô cùng ghi một chỗ, và vì panel ghi sau nên nó
 * ĐÈ giá trị cán bộ vừa gõ trong tab — mất dữ liệu ngay trong một lần lưu.
 *
 * Ô lồng (`statistic.…`) không tính: chúng nằm ở bảng khác, không đụng cột của bảng chính.
 */
export function ownedColumns<TForm, TTab extends string, TField extends string>(
  spec: LegacyFormSpec<TForm, TTab, TField>,
): ReadonlySet<string> {
  return new Set(
    Object.values(spec.layout)
      .flat()
      .map((it) => (it as LegacyLayoutItem<TField, TTab>).field as string)
      .filter((f) => !f.includes("."))
      .map((f) => spec.fieldToColumn[f] ?? f),
  );
}
