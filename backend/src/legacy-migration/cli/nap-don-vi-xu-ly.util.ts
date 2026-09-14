import { khoaDonVi } from '../../common/utils/chuan-hoa-ten.util';

/**
 * Chọn và gộp tên đơn vị từ bảng phân loại `legacy_unit_aliases` để nạp vào danh mục `DON_VI`.
 *
 * Hàm THUẦN, không đụng cơ sở dữ liệu — phần khó (lọc nhóm nào, gộp thế nào, xếp thứ tự ra sao)
 * kiểm được mà không cần máy chủ.
 */

/** Nhóm được nạp. `TEAM` đã có trong bảng `teams`; `RESULT` là kết quả xử lý, không phải đơn vị. */
export const NHOM_NAP = ['EXTERNAL_ORG', 'UNKNOWN'] as const;

/**
 * Nhóm vào danh mục nhưng CHỜ DUYỆT.
 *
 * `UNKNOWN` nghĩa là đợt phân loại trước không xác nhận được đó có phải tên đơn vị hay không —
 * trong 1.263 dòng ấy có cả câu văn kiểu "trả lại đơn cho ông và hướng dẫn ký tên vào đơn". Đổ
 * thẳng vào ô chọn của cán bộ là để một chuỗi rác đi vào ô "Kính gửi" của văn bản gửi ra ngoài
 * ngành. Vẫn nạp (không bỏ tên nào), nhưng có nhãn và xếp sau.
 */
export const NHOM_CHO_DUYET = 'UNKNOWN';

export interface BiDanhHeCu {
  rawValue: string;
  sampleRaw: string | null;
  kind: string;
  recordCount: number;
}

export interface MucDanhMuc {
  name: string;
  order: number;
  choDuyet: boolean;
  kind: string;
  /** Tổng số hồ sơ của MỌI biến thể đã gộp vào mục này — để xếp thứ tự và để người duyệt cân nhắc. */
  soHoSo: number;
  /** Số hồ sơ của riêng biến thể đang được chọn làm tên hiển thị. */
  soHoSoCuaTenDangChon: number;
}

/**
 * Gộp danh sách bí danh thành các mục danh mục.
 *
 * @param daCo tên các mục đã có trong danh mục — bỏ qua để chạy lại được nhiều lần
 */
export function gopThanhDanhMuc(
  biDanh: BiDanhHeCu[],
  daCo: string[] = [],
): MucDanhMuc[] {
  const khoaDaCo = new Set(daCo.map(khoaDonVi));
  const gop = new Map<string, MucDanhMuc>();

  for (const b of biDanh) {
    if (!NHOM_NAP.includes(b.kind as (typeof NHOM_NAP)[number])) continue;
    // `sampleRaw` là bản gốc chưa chuẩn hoá — dễ đọc hơn `rawValue` (đã bỏ dấu, hạ chữ thường).
    const ten = (b.sampleRaw ?? b.rawValue).trim();
    if (!ten) continue;

    const khoa = khoaDonVi(ten);
    if (!khoa || khoaDaCo.has(khoa)) continue;

    const cu = gop.get(khoa);
    if (!cu) {
      gop.set(khoa, {
        name: ten,
        order: 0,
        choDuyet: b.kind === NHOM_CHO_DUYET,
        kind: b.kind,
        soHoSo: b.recordCount,
        soHoSoCuaTenDangChon: b.recordCount,
      });
      continue;
    }

    cu.soHoSo += b.recordCount;
    // Cùng một đơn vị viết nhiều kiểu → lấy tên của biến thể PHỔ BIẾN nhất làm tên hiển thị.
    // Bản hay dùng thường là bản viết đúng; lấy bản gặp đầu tiên là lấy ngẫu nhiên.
    if (b.recordCount > cu.soHoSoCuaTenDangChon) {
      cu.name = ten;
      cu.soHoSoCuaTenDangChon = b.recordCount;
    }
    // Đã xác nhận là đơn vị thật ở BẤT KỲ biến thể nào thì cả mục hết chờ duyệt.
    if (b.kind !== NHOM_CHO_DUYET) {
      cu.choDuyet = false;
      cu.kind = b.kind;
    }
  }

  const ra = [...gop.values()];
  // Đơn vị hay dùng nổi lên đầu ô tìm; nhóm chờ duyệt luôn xuống dưới (cộng 9000).
  ra.sort((a, b) => b.soHoSo - a.soHoSo || a.name.localeCompare(b.name, 'vi'));
  ra.forEach((m, i) => {
    m.order = (m.choDuyet ? 9000 : 0) + i;
  });
  return ra;
}

// Sinh mã dùng chung với ô "Tạo mới" trên form — xem `common/utils/ma-danh-muc.util.ts`.
export { sinhDayMa } from '../../common/utils/ma-danh-muc.util';
