/**
 * Ánh xạ các ô hệ cũ vừa được đưa về đúng vị trí trên form → cột Vụ án.
 *
 * Dùng CHUNG cho cả tạo mới lẫn chỉnh sửa. Chép hai bản là cách chắc chắn để một hôm nào đó
 * thêm ô mới vào một chỗ mà quên chỗ kia — khi ấy cán bộ tạo hồ sơ thì lưu được, sửa hồ sơ
 * thì mất, một kiểu hỏng rất khó lần ra.
 *
 * Quy ước `undefined` ≠ `null`: `undefined` là "lời gọi không nhắc tới ô này" (giữ nguyên giá
 * trị đang có), `null`/chuỗi rỗng là "người dùng xoá trắng ô này". Vì vậy mọi mục đều gác
 * bằng `!== undefined` thay vì kiểm giá trị thật.
 */

/** Danh sách ô kiểu ngày — chuỗi ISO ở lớp DTO, `Date` ở lớp cơ sở dữ liệu. */
const O_NGAY = [
  'ngayXayRa',
  'ngayQDPhanCongNguonTin',
  'ngayQDKhongKhoiTo',
  'ngayQDTamDinhChiNguonTin',
  'ngayHetThoiHieuVuViec',
  'ngayPhucHoiNguonTin',
] as const;

/** Ô kiểu chuỗi, chép thẳng. */
const O_CHU = [
  'phanLoaiNguonTinBanDau',
  'noiXayRaPhuongXa',
  'baoCaoBanGiamDocText',
  'soQDPhanCongNguonTin',
  'soQDKhongKhoiTo',
  'canCuKhongKhoiTo',
  'chuyenVuViecDonViKhac',
  'nhapVaoVuViecSo',
  'phanLoaiDanSu',
  'soQDTamDinhChiNguonTin',
  'canCuTamDinhChiNguonTin',
  'khacPhucLyDoTDCVuViec',
  'tienDoKhacPhucTDCVuViec',
  'soPhucHoiNguonTin',
  'vatChungMoTa',
  'lenhNhapKho',
  'noiLuuTruBaoQuan',
  'toiDanhChinhKhoiToId',
  'soHoSoCu',
  // Form Vụ án CÓ ô "STT cũ" và vẫn gửi `sttCu` lên, nhưng không nơi nào ghi nó xuống cột —
  // cán bộ gõ vào, bấm Lưu, mở lại thì trống. Cột `sttCu` đã có sẵn trong lược đồ.
  'sttCu',
] as const;

/** Ô chọn nhiều — mảng chuỗi. */
const O_MANG = ['lyDoKhongKhoiTo', 'lyDoTamDinhChiNguonTin'] as const;

/** Ô đúng-sai. */
const O_DUNG_SAI = [
  'vuViecTamDungTruoc2015',
  // Cờ tội phạm công nghệ cao trước đây chỉ được ánh xạ ở nhánh CHỈNH SỬA. Tạo hồ sơ mới
  // rồi bật công tắc là mất — đúng kiểu hỏng mà hàm dùng chung này sinh ra để chặn.
  'laCongNgheCao',
] as const;

/** Mọi ô mà hàm này phụ trách — dùng cho ca kiểm "không sót ô nào". */
export const O_HE_CU_TREN_FORM: readonly string[] = [
  ...O_NGAY,
  ...O_CHU,
  ...O_MANG,
  ...O_DUNG_SAI,
];

/**
 * Kiểu trả về khai tường minh thay vì mượn `Prisma.CaseUncheckedUpdateInput`.
 *
 * Kiểu Update của Prisma cho phép dạng toán tử (`{ set: ... }`), nên spread nó vào dữ liệu
 * TẠO MỚI là lỗi kiểu. Khai riêng ở đây giữ được cả hai đường dùng chung một hàm.
 */
export type LegacyFormParityData = Record<string, Date | string | string[] | boolean | null>;

export function legacyFormParityData(dto: Record<string, unknown>): LegacyFormParityData {
  const data: Record<string, unknown> = {};

  for (const k of O_NGAY) {
    if (dto[k] !== undefined) data[k] = dto[k] ? new Date(dto[k] as string) : null;
  }
  for (const k of O_CHU) {
    if (dto[k] !== undefined) data[k] = (dto[k] as string | null) ?? null;
  }
  for (const k of O_MANG) {
    // Mảng rỗng là "đã bỏ chọn hết", khác hẳn `undefined`. Đừng quy nó về null: cột là
    // `String[]`, không nhận null.
    if (dto[k] !== undefined) data[k] = (dto[k] as string[] | null) ?? [];
  }
  for (const k of O_DUNG_SAI) {
    if (dto[k] !== undefined) data[k] = (dto[k] as boolean | null) ?? null;
  }

  return data as LegacyFormParityData;
}
