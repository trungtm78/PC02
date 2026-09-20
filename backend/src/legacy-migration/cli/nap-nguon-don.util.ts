import {
  khoaNguonDon,
  laNguonTrucTiep,
} from '../../common/utils/nguon-don.util';

/**
 * Gộp giá trị "Nguồn đơn/Đơn vị giao" của hệ cũ thành danh mục `NGUON_DON`.
 *
 * Hàm THUẦN, không đụng cơ sở dữ liệu — phần khó (gộp thế nào, chọn tên nào làm tên chuẩn,
 * mục nào phải chờ duyệt) kiểm được mà không cần máy chủ.
 *
 * Số liệu prod 20/09/2026: 47.456/47.488 đơn có giá trị · **1.431 cách viết** · gộp theo khoá
 * còn 972 nhóm · 713 nhóm dưới 3 hồ sơ · 2.162 dòng ở dạng NFD.
 */

export interface GiaTriHeCu {
  ten: string;
  soHoSo: number;
}

export interface MucNguonDon {
  name: string;
  order: number;
  choDuyet: boolean;
  laTrucTiep: boolean;
  soHoSo: number;
  /** Mọi cách viết đã gộp vào mục này — để anh soát bảng gộp TRƯỚC khi ghi. */
  bienThe: string[];
}

/**
 * Dưới ngưỡng này thì mục vào trạng thái CHỜ DUYỆT.
 *
 * 713/972 nhóm prod nằm dưới ngưỡng. Bỏ chúng đi là lấy mất chỗ nhập của hồ sơ cũ; nhận thẳng
 * là đổ một đống chuỗi gõ nhầm vào ô chọn của cán bộ. Nạp hết, nhưng đánh dấu và xếp sau.
 */
export const NGUONG_CHO_DUYET = 3;

/** Mục chờ duyệt xếp sau mọi mục đã duyệt — cùng quy ước với danh mục Loại thông tin. */
const THU_TU_CHO_DUYET = 9000;

/**
 * Một mục đã có trong danh mục — để biết giá trị nào KHÔNG cần nạp lại.
 *
 * Phải mang cả `bienThe`: quản trị duyệt xong thường ĐỔI TÊN mục (vd "trực tiếp" → "Trực tiếp
 * (nộp tại trụ sở)"). So theo TÊN thôi thì lượt chạy sau không nhận ra và nạp lại đúng thứ vừa
 * dọn. `bienThe` là mọi cách viết đã gộp vào mục, CLI ghi sẵn vào `metadata` lúc tạo.
 */
export interface MucDaCo {
  name: string;
  bienThe?: string[];
}

export function gopNguonDon(
  giaTri: GiaTriHeCu[],
  daCo: (string | MucDaCo)[] = [],
  /**
   * `order` lớn nhất đang có. Đánh số lại từ 0 mỗi lượt thì mục thêm ở lượt sau chen vào GIỮA
   * mục lượt trước theo thứ tự không đoán được (`findAll` sắp theo `order` rồi `code`).
   */
  orderGoc = 0,
): MucNguonDon[] {
  const khoaDaCo = new Set<string>();
  for (const m of daCo) {
    const muc: MucDaCo = typeof m === 'string' ? { name: m } : m;
    for (const ten of [muc.name, ...(muc.bienThe ?? [])]) {
      const k = khoaNguonDon(ten);
      if (k) khoaDaCo.add(k);
    }
  }
  const gop = new Map<
    string,
    { soHoSo: number; bienThe: Map<string, number> }
  >();

  for (const gt of giaTri) {
    const ten = gt.ten?.trim();
    if (!ten) continue;
    const khoa = khoaNguonDon(ten);
    // Khoá rỗng nghĩa là chuỗi chỉ có dấu câu/khoảng trắng — không phải một nguồn đơn.
    if (!khoa || khoaDaCo.has(khoa)) continue;

    const nhom = gop.get(khoa) ?? {
      soHoSo: 0,
      bienThe: new Map<string, number>(),
    };
    nhom.soHoSo += gt.soHoSo;
    nhom.bienThe.set(ten, (nhom.bienThe.get(ten) ?? 0) + gt.soHoSo);
    gop.set(khoa, nhom);
  }

  return (
    [...gop.values()]
      .map((nhom) => {
        // Tên chuẩn = cách viết PHỔ BIẾN NHẤT. Chọn bản đầu tiên gặp được là để "trực tiếp"
        // (956 hồ sơ) thắng "Trực tiếp" (10.656) chỉ vì thứ tự đọc.
        const name = [...nhom.bienThe.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0][0];
        return {
          name,
          choDuyet: nhom.soHoSo < NGUONG_CHO_DUYET,
          laTrucTiep: laNguonTrucTiep(name),
          soHoSo: nhom.soHoSo,
          bienThe: [...nhom.bienThe.keys()],
          order: 0,
        };
      })
      // Nhiều hồ sơ lên trước: cán bộ gặp thứ hay dùng ngay đầu danh sách.
      .sort(
        (a, b) =>
          Number(a.choDuyet) - Number(b.choDuyet) || b.soHoSo - a.soHoSo,
      )
      .map((m, i) => ({
        ...m,
        order: (m.choDuyet ? THU_TU_CHO_DUYET : orderGoc) + i + 1,
      }))
  );
}

/**
 * Bảng đổi: cách viết cũ → tên chuẩn, để ghi lại chính hồ sơ.
 *
 * Dựng danh mục THÔI chưa đủ cho động cơ ban đầu: 47.456 hồ sơ vẫn giữ 1.431 cách viết, nên
 * báo cáo theo nguồn vẫn sai y như trước — chỉ dữ liệu NHẬP MỚI là sạch. Muốn thống kê đúng
 * thì phải ghi lại cả hồ sơ cũ.
 *
 * Chỉ trả cặp THẬT SỰ đổi (cũ ≠ chuẩn), để lệnh ghi không đụng những dòng vốn đã đúng.
 */
export function bangDoiTenChuan(
  muc: MucNguonDon[],
): { cu: string; chuan: string }[] {
  return muc.flatMap((m) =>
    m.bienThe
      .filter((cu) => cu !== m.name)
      .map((cu) => ({ cu, chuan: m.name })),
  );
}
