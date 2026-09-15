import { BadRequestException } from '@nestjs/common';
import { hoSoCodeVariants } from '../utils/ho-so-code.util';
import { dieuKienSttCu } from '../utils/stt-cu.util';
import { boDauTimKiem, thoatLike } from './bo-dau';
import {
  COT_NGUON_DOI_TUONG,
  COT_NGUON_HO_TEN,
  cotBongCua,
  cotGhepTatCa,
  type KhaiThucThe,
  type TruongTimKiem,
} from './sinh/sinh-tim-kiem';

/**
 * Thẻ tìm kiếm trên URL (`tk=khoá~giá trị`) → điều kiện Prisma — MỘT helper cho mọi đường đọc
 * (danh sách, thống kê, hồ sơ đã xoá…). Điều kiện trả về là MẢNG để nối vào `where.AND`, không bao
 * giờ gán thẳng khoá lên `where`: vài service gán `where.case = scope`, đè lên đó là mất phạm vi.
 */

export const SO_THE_TOI_DA = 20;
export const DO_DAI_GIA_TRI_TOI_DA = 200;
/** Khoá thẻ "tìm trong tất cả các cột". */
export const KHOA_TAT_CA = '*';

export interface The {
  key: string;
  giaTri: string[];
}

type DieuKien = Record<string, unknown>;

const NAM_MIN = 1900;
const NAM_MAX = 2100;
const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;

/** 00:00 giờ Việt Nam của một ngày (tháng đếm từ 0; ngày/tháng tràn được, như Date.UTC). */
const mocVN = (nam: number, thang0: number, ngay: number) =>
  new Date(Date.UTC(nam, thang0, ngay) - LECH_GIO_VN_MS);

function ngayHopLe(nam: number, thang: number, ngay: number): boolean {
  if (nam < NAM_MIN || nam > NAM_MAX || thang < 1 || thang > 12 || ngay < 1)
    return false;
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  return d.getUTCMonth() === thang - 1 && d.getUTCDate() === ngay;
}

/**
 * Khoảng `[gte, lt)` theo giờ Việt Nam cho một ngày (`12/09/2026`, `2026-09-12`), một tháng
 * (`09/2026`) hoặc một năm (`2026`). Tìm ngày luôn là KHOẢNG trên cột ngày thật — so chuỗi ngày lệch
 * một ngày với hồ sơ ghi lúc 00:00–07:00.
 */
export function docKhoangNgay(
  giaTri: string,
): { gte: Date; lt: Date } | undefined {
  const v = giaTri.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return khoangNgay(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return khoangNgay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) {
    const [thang, nam] = [Number(m[1]), Number(m[2])];
    if (!ngayHopLe(nam, thang, 1)) return undefined;
    return { gte: mocVN(nam, thang - 1, 1), lt: mocVN(nam, thang, 1) };
  }
  m = /^(\d{4})$/.exec(v);
  if (m) {
    const nam = Number(m[1]);
    if (!ngayHopLe(nam, 1, 1)) return undefined;
    return { gte: mocVN(nam, 0, 1), lt: mocVN(nam + 1, 0, 1) };
  }
  return undefined;
}

function khoangNgay(nam: number, thang: number, ngay: number) {
  if (!ngayHopLe(nam, thang, ngay)) return undefined;
  return {
    gte: mocVN(nam, thang - 1, ngay),
    lt: mocVN(nam, thang - 1, ngay + 1),
  };
}

const timTruong = (khai: KhaiThucThe, key: string): TruongTimKiem | undefined =>
  khai.truong.find((t) => t.key === key);

const loi = (thongBao: string) => new BadRequestException(thongBao);

/**
 * Đọc thẻ từ query. Khoá lạ → 400, KHÔNG âm thầm bỏ qua: bỏ qua là trả dữ liệu chưa lọc mà trông
 * như đã lọc. Cùng khoá gộp một thẻ (các giá trị OR với nhau).
 */
export function docThe(
  tk: string | readonly string[] | undefined,
  khai: KhaiThucThe,
): The[] {
  const ds = tk === undefined ? [] : typeof tk === 'string' ? [tk] : tk;
  if (ds.length > SO_THE_TOI_DA) {
    throw loi(`Chỉ được tối đa ${SO_THE_TOI_DA} thẻ tìm kiếm`);
  }
  const theoKhoa = new Map<string, string[]>();
  for (const tho of ds) {
    const i = tho.indexOf('~');
    if (i <= 0) throw loi(`Thẻ tìm kiếm "${tho}" sai dạng khoá~giá trị`);
    const key = tho.slice(0, i);
    const giaTri = tho.slice(i + 1).trim();
    const truong = key === KHOA_TAT_CA ? undefined : timTruong(khai, key);
    if (key !== KHOA_TAT_CA && !truong) {
      throw loi(`Cột "${key}" không tìm kiếm được`);
    }
    if (giaTri.length > DO_DAI_GIA_TRI_TOI_DA) {
      throw loi(`Giá trị tìm kiếm dài quá ${DO_DAI_GIA_TRI_TOI_DA} ký tự`);
    }
    if (!giaTri) continue;
    if (
      truong?.kieu === 'chon' &&
      truong.giaTriHopLe &&
      !truong.giaTriHopLe.includes(giaTri)
    ) {
      throw loi(`Giá trị "${giaTri}" không hợp lệ cho cột "${key}"`);
    }
    if (truong?.kieu === 'ngay' && !docKhoangNgay(giaTri)) {
      throw loi(
        `Không đọc được ngày "${giaTri}" — gõ dạng 12/09/2026, 09/2026 hoặc 2026`,
      );
    }
    const cu = theoKhoa.get(key);
    if (cu) cu.push(giaTri);
    else theoKhoa.set(key, [giaTri]);
  }
  return [...theoKhoa].map(([key, giaTri]) => ({ key, giaTri }));
}

/** Mẫu `contains` trên cột bỏ dấu: 1–2 ký tự thì khớp ĐẦU TỪ (cột bóng có khoảng trắng đầu). */
function mauBoDau(giaTri: string): string | undefined {
  const b = boDauTimKiem(giaTri);
  if (!b) return undefined;
  return thoatLike(b.length < 3 ? ` ${b}` : b);
}

const chuaGoc = (cot: string, giaTri: string): DieuKien => ({
  [cot]: { contains: thoatLike(giaTri), mode: 'insensitive' },
});

/**
 * Cột bóng chứa mẫu; khi `luiCotGoc` thêm "HOẶC cột bóng chưa nạp và cột gốc chứa chữ gõ". Nhánh
 * lùi buộc quét cả bảng (GIN không phục vụ IS NULL), nên nơi gọi chỉ bật khi còn dòng chưa nạp.
 *
 * Giá trị bỏ dấu xong RỖNG (chỉ gồm `#`, `--`, `/`…): so nguyên chữ trên cột gốc. Trả `[]` là bỏ
 * luôn điều kiện — danh sách ra mọi dòng mà trông như đã lọc.
 */
function luaChonChu(
  cot: string,
  giaTri: string,
  luiCotGoc: boolean,
): DieuKien[] {
  const mau = mauBoDau(giaTri);
  if (mau === undefined) return [chuaGoc(cot, giaTri)];
  const bong = cotBongCua(cot).field;
  const bongChua = { [bong]: { contains: mau } };
  return luiCotGoc
    ? [bongChua, { [bong]: null, ...chuaGoc(cot, giaTri) }]
    : [bongChua];
}

function luaChonTatCa(
  khai: KhaiThucThe,
  giaTri: string,
  luiCotGoc: boolean,
): DieuKien[] {
  const mau = mauBoDau(giaTri);
  if (mau === undefined) {
    return [{ OR: cotGhepTatCa(khai).map((c) => chuaGoc(c, giaTri)) }];
  }
  const ghepChua = { timKiemBd: { contains: mau } };
  return luiCotGoc
    ? [
        ghepChua,
        {
          timKiemBd: null,
          OR: cotGhepTatCa(khai).map((c) => chuaGoc(c, giaTri)),
        },
      ]
    : [ghepChua];
}

/** Luôn bọc OR — dùng cho các lựa chọn vốn là "hoặc" (cột bóng / cột gốc). */
const hoacLuon = (ds: DieuKien[]): DieuKien[] =>
  ds.length ? [{ OR: ds }] : [];
/** Một điều kiện thì để trần, nhiều điều kiện thì OR. */
const hoac = (ds: DieuKien[]): DieuKien[] =>
  ds.length === 0 ? [] : ds.length === 1 ? ds : [{ OR: ds }];

function dieuKienMotThe(
  the: The,
  khai: KhaiThucThe,
  luiCotGoc: boolean,
): DieuKien[] {
  // Có nhánh lùi thì mỗi giá trị là một cặp "hoặc" — luôn bọc OR; không có thì một điều kiện để trần.
  const gop = luiCotGoc ? hoacLuon : hoac;
  if (the.key === KHOA_TAT_CA) {
    return gop(the.giaTri.flatMap((v) => luaChonTatCa(khai, v, luiCotGoc)));
  }
  const truong = timTruong(khai, the.key);
  if (!truong) return [];
  const cot = truong.cot as string;
  switch (truong.kieu) {
    case 'chu':
      return gop(the.giaTri.flatMap((v) => luaChonChu(cot, v, luiCotGoc)));
    case 'ma':
      return [
        { [cot]: { in: [...new Set(the.giaTri.flatMap(hoSoCodeVariants))] } },
      ];
    case 'ma-cu':
      return hoac(
        the.giaTri.flatMap((v) => {
          const dk = dieuKienSttCu(v);
          return dk
            ? [{ [cot]: { ...dk, contains: thoatLike(dk.contains) } }]
            : [];
        }),
      );
    case 'ngay':
      return hoac(
        the.giaTri.flatMap((v) => {
          const khoang = docKhoangNgay(v);
          return khoang ? [{ [cot]: khoang }] : [];
        }),
      );
    case 'chon':
      return [{ [cot]: { in: [...the.giaTri] } }];
    case 'doi-tuong':
      return hoac(the.giaTri.flatMap((v) => dieuKienDoiTuong(truong, v)));
    case 'quan-he':
      return hoac(the.giaTri.map((v) => dieuKienQuanHe(truong, v)));
    case 'nguoi':
      return hoac(
        the.giaTri.flatMap((v) => {
          const mau = mauBoDau(v);
          // Luôn giữ nhánh lùi: bảng users nhỏ nên không tốn, và `ho_ten_bd` rỗng tới khi chạy CLI
          // nạp — không lùi thì thẻ Người nhập trả 0 dòng mà trông như lọc thật.
          return mau === undefined
            ? [
                {
                  [truong.quanHe as string]: {
                    is: { OR: COT_NGUON_HO_TEN.map((c) => chuaGoc(c, v)) },
                  },
                },
              ]
            : [
                {
                  [truong.quanHe as string]: {
                    is: {
                      OR: [
                        { hoTenBd: { contains: mau } },
                        {
                          hoTenBd: null,
                          OR: COT_NGUON_HO_TEN.map((c) => chuaGoc(c, v)),
                        },
                      ],
                    },
                  },
                },
              ];
        }),
      );
  }
}

/**
 * Thẻ kiểu đối tượng: có ÍT NHẤT MỘT đối tượng đúng loại, chưa xoá, tên khớp. Luôn giữ nhánh lùi —
 * bảng `subjects` nhỏ nên không tốn, và `full_name_bd` rỗng tới khi chạy CLI nạp.
 */
function dieuKienDoiTuong(truong: TruongTimKiem, v: string): DieuKien[] {
  const mau = mauBoDau(v);
  return [
    {
      [truong.quanHe as string]: {
        some: {
          deletedAt: null,
          ...(truong.loaiDoiTuong ? { type: truong.loaiDoiTuong } : {}),
          // Bỏ dấu xong rỗng → so nguyên chữ trên cột gốc (xem luaChonChu).
          ...(mau === undefined
            ? chuaGoc(COT_NGUON_DOI_TUONG[0], v)
            : {
                OR: [
                  { fullNameBd: { contains: mau } },
                  { fullNameBd: null, ...chuaGoc(COT_NGUON_DOI_TUONG[0], v) },
                ],
              }),
        },
      },
    },
  ];
}

/**
 * Thẻ kiểu quan hệ MỘT-MỘT (vd Luật sư → Vụ án): `is` trên cột bóng của đích. Luôn giữ nhánh lùi về
 * cột gốc của đích — bảng đích có thể chưa nạp, và bộ `luiCotGoc` chỉ hỏi bảng chính.
 * Trả MỘT khoá quan hệ nằm trong phần tử AND — không bao giờ gán đè khoá cùng tên ở tầng trên (vd
 * `where.case = phạm vi` của Đối tượng/Luật sư).
 */
function dieuKienQuanHe(truong: TruongTimKiem, v: string): DieuKien {
  const mau = mauBoDau(v);
  const nguon = {
    OR: (truong.cotNguonDich ?? []).map((c) => chuaGoc(c, v)),
  };
  const cot = truong.cotDich as string;
  return {
    [truong.quanHe as string]: {
      is:
        mau === undefined
          ? nguon
          : { OR: [{ [cot]: { contains: mau } }, { [cot]: null, ...nguon }] },
    },
  };
}

export interface TuyChonDieuKien {
  /** Còn dòng chưa nạp cột bóng → lùi về cột gốc cho dòng ấy. Mặc định BẬT (đúng trước, nhanh sau). */
  luiCotGoc?: boolean;
}

/** Mỗi thẻ một phần tử (AND giữa các thẻ); nhiều giá trị cùng thẻ là OR bên trong phần tử. */
export function dungDieuKienTimKiem(
  the: readonly The[],
  khai: KhaiThucThe,
  { luiCotGoc = true }: TuyChonDieuKien = {},
): DieuKien[] {
  return the.flatMap((t) => dieuKienMotThe(t, khai, luiCotGoc));
}

/** Nối điều kiện thẻ vào `where.AND`, giữ nguyên điều kiện đã có (phạm vi dữ liệu…). */
export function noiVaoWhere(
  where: Record<string, unknown>,
  dieuKien: readonly DieuKien[],
): void {
  if (!dieuKien.length) return;
  const cu: unknown = where.AND;
  const daCo: unknown[] = Array.isArray(cu)
    ? (cu as unknown[])
    : cu
      ? [cu]
      : [];
  where.AND = [...daCo, ...dieuKien];
}
