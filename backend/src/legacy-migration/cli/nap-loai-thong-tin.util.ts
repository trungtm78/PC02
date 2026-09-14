import { LoaiDon } from '@prisma/client';
import {
  khoaLoaiThongTin,
  nhomHanTheoTen,
  vietHoaChuDau,
} from '../../common/utils/khoa-loai-thong-tin.util';
import { nhomHanCuaLoaiThongTin } from '../../petitions/loai-thong-tin.rule';

/**
 * Gộp giá trị "Loại thông tin" của dữ liệu cũ thành danh mục `LOAI_THONG_TIN` và lập kế hoạch
 * chuẩn hoá từng hồ sơ.
 *
 * Hàm THUẦN, không đụng cơ sở dữ liệu — phần khó (gộp thế nào, tên nào thắng, suy từ tóm tắt
 * ra sao) kiểm được mà không cần máy chủ. Luật gộp là `khoaLoaiThongTin`, CÙNG hàm ô "Tạo mới"
 * trên form và bộ nạp hệ cũ dùng.
 */

/** Mục dựa trên ít hồ sơ hơn ngưỡng này thì chờ quản trị duyệt — hay là lỗi gõ, không phải một loại. */
export const NGUONG_CHO_DUYET = 3;

/** Mục chờ duyệt xếp sau mọi mục đã duyệt trong ô tìm. */
const THU_TU_CHO_DUYET = 9000;

export interface GiaTriDem {
  giaTri: string | null;
  soHoSo: number;
}

export interface MucDaCo {
  name: string;
  code: string;
  metadata: unknown;
}

export interface MucGop {
  khoa: string;
  name: string;
  /** Tổng số hồ sơ mang MỌI biến thể của mục (Đơn thư + Vụ việc + Vụ án). */
  soHoSo: number;
  /** Các cách viết đã gộp vào mục, nhiều hồ sơ nhất trước. */
  bienThe: string[];
  nhomHan: LoaiDon;
  choDuyet: boolean;
  /** Mục đã có trong danh mục — không tạo lại. */
  daCo: boolean;
  order: number;
}

interface Nhom {
  khoa: string;
  daCo?: MucDaCo;
  /** Đếm theo cách viết, CHỈ Đơn thư — tên hiển thị lấy từ đây vì danh mục là của Đơn thư. */
  demDonThu: Map<string, number>;
  demTong: Map<string, number>;
  soHoSo: number;
}

/**
 * Cách viết để đếm và hiển thị: NFC + gộp khoảng trắng. Dữ liệu cũ trộn chữ dựng sẵn với chữ tổ
 * hợp dấu (2.547 hồ sơ trên bản sao 14/09/2026) — không NFC thì một cách viết bị đếm thành hai và
 * tên chuẩn có thể mang dạng tổ hợp, so không khớp chữ cán bộ gõ.
 */
const gonKhoangTrang = (s: string) =>
  s.normalize('NFC').replace(/\s+/g, ' ').trim();

function congDem(dem: Map<string, number>, khoa: string, n: number): void {
  dem.set(khoa, (dem.get(khoa) ?? 0) + n);
}

function xepGiamDan(dem: Map<string, number>): string[] {
  return [...dem.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
    .map(([bienThe]) => bienThe);
}

function choDuyetCuaMucDaCo(muc: MucDaCo, soHoSo: number): boolean {
  const choDuyet = (muc.metadata as Record<string, unknown> | null)?.choDuyet;
  return typeof choDuyet === 'boolean' ? choDuyet : soHoSo < NGUONG_CHO_DUYET;
}

/**
 * @param donThu  số hồ sơ Đơn thư theo từng giá trị — nguồn sinh mục mới
 * @param hoSoKhac số hồ sơ Vụ việc/Vụ án theo từng giá trị — chỉ CỘNG vào mục đã có. Vụ việc có
 *   "Báo cáo đề xuất" (61 hồ sơ), không phải một loại đơn thư; sinh mục từ đó là làm bẩn ô chọn.
 * @param daCo mục đang có trong danh mục — giữ tên và nhóm hạn quản trị viên đã sửa
 */
export function gopLoaiThongTin(
  donThu: readonly GiaTriDem[],
  hoSoKhac: readonly GiaTriDem[],
  daCo: readonly MucDaCo[],
): MucGop[] {
  const nhom = new Map<string, Nhom>();
  const layNhom = (khoa: string): Nhom => {
    let g = nhom.get(khoa);
    if (!g) {
      g = { khoa, demDonThu: new Map(), demTong: new Map(), soHoSo: 0 };
      nhom.set(khoa, g);
    }
    return g;
  };

  for (const muc of daCo) {
    const khoa = khoaLoaiThongTin(muc.name);
    if (!khoa) continue;
    const g = layNhom(khoa);
    g.daCo ??= muc;
  }

  for (const { giaTri, soHoSo } of donThu) {
    const bienThe = gonKhoangTrang(giaTri ?? '');
    const khoa = khoaLoaiThongTin(bienThe);
    if (!khoa) continue;
    const g = layNhom(khoa);
    congDem(g.demDonThu, bienThe, soHoSo);
    congDem(g.demTong, bienThe, soHoSo);
    g.soHoSo += soHoSo;
  }

  for (const { giaTri, soHoSo } of hoSoKhac) {
    const bienThe = gonKhoangTrang(giaTri ?? '');
    const g = nhom.get(khoaLoaiThongTin(bienThe));
    if (!g) continue;
    congDem(g.demTong, bienThe, soHoSo);
    g.soHoSo += soHoSo;
  }

  const ra: MucGop[] = [...nhom.values()].map((g) => {
    if (g.daCo) {
      return {
        khoa: g.khoa,
        name: g.daCo.name,
        soHoSo: g.soHoSo,
        bienThe: xepGiamDan(g.demTong),
        nhomHan:
          nhomHanCuaLoaiThongTin(g.daCo.name, [g.daCo]) ??
          nhomHanTheoTen(g.daCo.name),
        choDuyet: choDuyetCuaMucDaCo(g.daCo, g.soHoSo),
        daCo: true,
        order: 0,
      };
    }
    // Cùng một loại viết nhiều kiểu → cách viết PHỔ BIẾN nhất thường là cách viết đúng.
    const name = vietHoaChuDau(xepGiamDan(g.demDonThu)[0]);
    return {
      khoa: g.khoa,
      name,
      soHoSo: g.soHoSo,
      bienThe: xepGiamDan(g.demTong),
      nhomHan: nhomHanTheoTen(name),
      choDuyet: g.soHoSo < NGUONG_CHO_DUYET,
      daCo: false,
      order: 0,
    };
  });

  ra.sort((a, b) => b.soHoSo - a.soHoSo || a.name.localeCompare(b.name, 'vi'));
  ra.forEach((m, i) => {
    m.order = (m.choDuyet ? THU_TU_CHO_DUYET : 0) + i;
  });
  return ra;
}

const KY_TU_CUA_TU = /[a-z0-9]/;

/**
 * Loại thông tin suy từ câu mở đầu của tóm tắt: "Tố giác bà Văn Thị Thủy…" → "Tố giác".
 *
 * Chỉ khớp ĐẦU câu và NGUYÊN từ; nhiều mục khớp thì lấy mục dài nhất ("Tố cáo cán bộ" thắng
 * "Tố cáo"). Không khớp thì trả `undefined` — để trống còn hơn đoán sai. Mục chờ duyệt không
 * được dùng: đó thường là một câu gõ nhầm vào ô loại, khớp vào là lan lỗi sang hồ sơ khác.
 */
export function suyTuTomTat(
  tomTat: string | null | undefined,
  danhMuc: readonly MucGop[],
): string | undefined {
  const khoa = khoaLoaiThongTin(tomTat);
  if (!khoa) return undefined;
  let tot: MucGop | undefined;
  for (const m of danhMuc) {
    if (m.choDuyet || !m.khoa.length) continue;
    const khop =
      khoa === m.khoa ||
      (khoa.startsWith(m.khoa) &&
        !KY_TU_CUA_TU.test(khoa.charAt(m.khoa.length)));
    if (khop && (!tot || m.khoa.length > tot.khoa.length)) tot = m;
  }
  return tot?.name;
}

export interface HoSoLoai {
  id: string;
  loaiThongTin: string | null;
  petitionType: LoaiDon | null;
  /** Tóm tắt, hoặc đầu nội dung khi tóm tắt trống. */
  tomTat: string | null;
}

export interface DoiLoai {
  id: string;
  /** Giá trị đang có — câu UPDATE lặp lại làm điều kiện để không đè giá trị cán bộ vừa sửa. */
  cu: string | null;
  moi: string;
}

export interface GanNhom {
  id: string;
  /** Loại thông tin mà nhóm hạn này suy ra từ — cũng là điều kiện chặn trong câu UPDATE. */
  loai: string;
  nhom: LoaiDon;
}

export interface KeHoach {
  doiTen: DoiLoai[];
  dienTrong: DoiLoai[];
  ganNhom: GanNhom[];
  khongSuyDuoc: string[];
}

/** Việc ghi cho từng hồ sơ. Hồ sơ đã chuẩn và đã có nhóm hạn thì không có việc — chạy lại ra 0. */
export function lapKeHoach(
  hoSo: readonly HoSoLoai[],
  danhMuc: readonly MucGop[],
): KeHoach {
  const theoKhoa = new Map(danhMuc.map((m) => [m.khoa, m]));
  const keHoach: KeHoach = {
    doiTen: [],
    dienTrong: [],
    ganNhom: [],
    khongSuyDuoc: [],
  };

  for (const h of hoSo) {
    const khoa = khoaLoaiThongTin(h.loaiThongTin);
    let loai: string | undefined;
    if (!khoa) {
      loai = suyTuTomTat(h.tomTat, danhMuc);
      if (loai)
        keHoach.dienTrong.push({ id: h.id, cu: h.loaiThongTin, moi: loai });
      else keHoach.khongSuyDuoc.push(h.id);
    } else {
      const muc = theoKhoa.get(khoa);
      loai = muc?.name ?? (h.loaiThongTin as string);
      if (muc && muc.name !== h.loaiThongTin) {
        keHoach.doiTen.push({ id: h.id, cu: h.loaiThongTin, moi: muc.name });
      }
    }
    // KHÔNG đè nhóm hạn đã có: đó có thể là lựa chọn của cán bộ trước khi bỏ ô Loại đơn thư.
    if (loai && !h.petitionType) {
      const nhom =
        theoKhoa.get(khoaLoaiThongTin(loai))?.nhomHan ?? nhomHanTheoTen(loai);
      keHoach.ganNhom.push({ id: h.id, loai, nhom });
    }
  }
  return keHoach;
}

const oCsv = (v: string | number): string => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Bảng gộp cho người duyệt. Có BOM để Excel đọc đúng tiếng Việt. */
export function bangGopCsv(danhMuc: readonly MucGop[]): string {
  const dong = [
    [
      'Tên chuẩn',
      'Số hồ sơ',
      'Nhóm hạn',
      'Chờ duyệt',
      'Đã có trong danh mục',
      'Biến thể',
    ].join(','),
    ...danhMuc.map((m) =>
      [
        m.name,
        m.soHoSo,
        m.nhomHan,
        m.choDuyet ? 'Có' : 'Không',
        m.daCo ? 'Có' : 'Không',
        m.bienThe.join(' | '),
      ]
        .map(oCsv)
        .join(','),
    ),
  ];
  return `\uFEFF${dong.join('\r\n')}\r\n`;
}
