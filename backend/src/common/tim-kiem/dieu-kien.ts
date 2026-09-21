import { BadRequestException } from '@nestjs/common';
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
export interface KhoangNgay {
  gte: Date;
  lt: Date;
}

const hai = (n: number) => String(n).padStart(2, '0');

/**
 * Tiền tố chuỗi EDTF ứng với ĐỘ CHÍNH XÁC người gõ: `2026-12-15` · `2026-12` · `2026`.
 *
 * Dùng cho hồ sơ chỉ có ngày THIẾU thành phần (`2026-12-XX`, cột ngày thật rỗng) — đo prod
 * 21/09/2026: ~4.4k đơn thư như vậy, vô hình với mọi phép lọc ngày. Tiền tố phải là tiền tố
 * THẬT của chuỗi hệ sinh ra, nếu không nhánh `startsWith` im lặng trả rỗng.
 *
 * Cố ý KHÔNG đối xứng: gõ đủ `15/12/2026` KHÔNG khớp `2026-12-XX`. Hệ không biết ngày ấy là
 * ngày nào; coi như khớp là bịa, đúng thứ `ngay-viet-don.util.ts` đã cấm.
 *
 * Hàm RIÊNG, không gắn vào `docKhoangNgay`: ba service (Uỷ thác, Trao đổi, Hướng dẫn) trả
 * NGUYÊN đối tượng khoảng thẳng vào Prisma, nên mọi khoá thêm vào đó đều rò ra bộ lọc và
 * Prisma ném lỗi. Tách ra thì việc rò là KHÔNG THỂ, thay vì phải nhớ lọc ở từng chỗ gọi.
 */
export function tienToEdtf(giaTri: string): string | undefined {
  const v = giaTri.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${hai(Number(m[2]))}-${hai(Number(m[1]))}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return `${m[2]}-${hai(Number(m[1]))}`;
  m = /^(\d{4})$/.exec(v);
  if (m) return m[1];
  return undefined;
}

export function docKhoangNgay(giaTri: string): KhoangNgay | undefined {
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

function khoangNgay(
  nam: number,
  thang: number,
  ngay: number,
): KhoangNgay | undefined {
  if (!ngayHopLe(nam, thang, ngay)) return undefined;
  return {
    gte: mocVN(nam, thang - 1, ngay),
    lt: mocVN(nam, thang - 1, ngay + 1),
  };
}

/**
 * Điều kiện cho MỘT giá trị ngày trên MỘT trường — dùng chung cho thẻ ngày riêng và cho thẻ
 * "tất cả các cột".
 *
 * Một hàm, nên hai đường không bao giờ lệch nhau. Tách ra từ `case 'ngay'` ngày 21/09/2026.
 *
 * Hai nhánh RỜI NHAU nên không đếm trùng:
 *   { cột ngày thật trong khoảng }                           ← hồ sơ có ngày đủ
 *   { cột ngày thật NULL, cột EDTF bắt đầu bằng tiền tố }     ← hồ sơ chỉ có ngày THIẾU
 *
 * `tienTo` KHÔNG được lọt vào bộ lọc Prisma — nó là dữ liệu của ta, không phải toán tử của
 * Prisma. Ca kiểm "ngày: khoảng [gte, lt) trên cột ngày thật" bắt đúng việc ấy.
 */
export function dieuKienNgay(
  truong: TruongTimKiem,
  cot: string,
  giaTri: string,
): DieuKien[] {
  const khoang = docKhoangNgay(giaTri);
  if (!khoang) return [];
  const theoNgayThat: DieuKien = { [cot]: khoang };
  const tienTo = tienToEdtf(giaTri);
  if (!truong.cotEdtf || !tienTo) return [theoNgayThat];
  return [
    {
      OR: [
        theoNgayThat,
        { [cot]: null, [truong.cotEdtf]: { startsWith: tienTo } },
      ],
    },
  ];
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
    const hopLe =
      truong?.kieu === 'chon'
        ? truong.giaTriCot
          ? Object.keys(truong.giaTriCot)
          : truong.giaTriHopLe
        : undefined;
    if (hopLe && !hopLe.includes(giaTri)) {
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

/**
 * Mẫu `contains` trên cột bỏ dấu — CHUỖI CON ở bất kỳ đâu, mọi độ dài (như `%like%`).
 *
 * Trước 17/09/2026 chuỗi 1–2 ký tự được thêm khoảng trắng đầu nên chỉ khớp ĐẦU TỪ ("an" không ra
 * "Tuấn", "11" không ra "26-11171"), để GIN trigram dùng được. Đo lại trên 47.169 đơn thư: chuỗi
 * ngắn phổ biến thì CẢ HAI cách đều Seq Scan và chuỗi con còn nhanh hơn (đếm 255 ms so với 317 ms);
 * chỉ chuỗi ngắn HIẾM chậm đi (4 ms → ~234 ms), vẫn dưới ngưỡng 300 ms. Cột bóng giữ nguyên khoảng
 * trắng đầu — vô hại với `contains`, nên không cần migration hay nạp lại.
 */
function mauBoDau(giaTri: string): string | undefined {
  const b = boDauTimKiem(giaTri);
  if (!b) return undefined;
  return thoatLike(b);
}

/** Chứa chuỗi gõ trên cột gốc, không phân biệt hoa thường — cho cột MÃ (không có cột bóng). */
const chuaMa = (cot: string, giaTri: string): DieuKien => ({
  [cot]: { contains: thoatLike(giaTri), mode: 'insensitive' },
});

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
  nguon: readonly string[],
  giaTri: string,
  luiCotGoc: boolean,
): DieuKien[] {
  // Cột bóng ghép nhiều nguồn (`cotGhep`) thì nhánh lùi tìm TỪNG cột nguồn; một nguồn thì để trần.
  const goc: DieuKien =
    nguon.length === 1
      ? chuaGoc(nguon[0], giaTri)
      : { OR: nguon.map((c) => chuaGoc(c, giaTri)) };
  const mau = mauBoDau(giaTri);
  if (mau === undefined) return [goc];
  const bong = cotBongCua(cot).field;
  const bongChua = { [bong]: { contains: mau } };
  return luiCotGoc ? [bongChua, { [bong]: null, ...goc }] : [bongChua];
}

/**
 * Tên người qua quan hệ (`users.ho_ten_bd`). Luôn giữ nhánh lùi: bảng users nhỏ nên không tốn, và
 * `ho_ten_bd` rỗng tới khi chạy CLI nạp — không lùi thì thẻ Người nhập trả 0 dòng mà trông như lọc thật.
 */
function dieuKienNguoi(truong: TruongTimKiem, v: string): DieuKien {
  const mau = mauBoDau(v);
  const quanHe = truong.quanHe as string;
  if (mau === undefined) {
    return {
      [quanHe]: { is: { OR: COT_NGUON_HO_TEN.map((c) => chuaGoc(c, v)) } },
    };
  }
  return {
    [quanHe]: {
      is: {
        OR: [
          { hoTenBd: { contains: mau } },
          { hoTenBd: null, OR: COT_NGUON_HO_TEN.map((c) => chuaGoc(c, v)) },
        ],
      },
    },
  };
}

function luaChonTatCa(
  khai: KhaiThucThe,
  giaTri: string,
  luiCotGoc: boolean,
): DieuKien[] {
  // `tatCaGomNguoi`: "*" HOẶC thêm tên người qua quan hệ (bảng không có cột chữ nào chứa tên người).
  const nguoi = khai.tatCaGomNguoi
    ? khai.truong
        .filter((t) => t.kieu === 'nguoi')
        .map((t) => dieuKienNguoi(t, giaTri))
    : [];
  // `tatCaGomQuanHe`: thêm các trường quan hệ đang hiện trên bảng (tội danh chính, bị can…).
  for (const k of khai.tatCaGomQuanHe ?? []) {
    const t = timTruong(khai, k);
    if (t?.kieu === 'quan-he') nguoi.push(dieuKienQuanHe(t, giaTri));
    else if (t?.kieu === 'doi-tuong')
      nguoi.push(...dieuKienDoiTuong(t, giaTri));
  }
  const mau = mauBoDau(giaTri);
  if (mau === undefined) {
    return [
      { OR: cotGhepTatCa(khai).map((c) => chuaGoc(c, giaTri)) },
      ...nguoi,
    ];
  }
  const ghepChua = { timKiemBd: { contains: mau } };
  return luiCotGoc
    ? [
        ghepChua,
        {
          timKiemBd: null,
          OR: cotGhepTatCa(khai).map((c) => chuaGoc(c, giaTri)),
        },
        ...nguoi,
      ]
    : [ghepChua, ...nguoi];
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
      return gop(
        the.giaTri.flatMap((v) =>
          luaChonChu(cot, truong.cotGhep ?? [cot], v, luiCotGoc),
        ),
      );
    case 'ma-thuong':
      // Mã danh mục / mã cán bộ / IP / thao tác: CHỨA chuỗi gõ ("T0" ra "T01", "192.168" ra IP
      // "192.168.1.10"). Không đi biến thể mã hồ sơ.
      return hoac(the.giaTri.map((v) => chuaMa(cot, v)));
    case 'ma':
      // STT hồ sơ: CHỨA chuỗi gõ. Trước 17/09/2026 so ĐÚNG NGUYÊN mã (`in`) nên anh gõ thẻ "STT: 78"
      // ra "Không tìm thấy". KHÔNG sinh biến thể năm 2↔4 số: đo prod 17/09 có 0 mã lưu dạng ngắn ở cả
      // ba bảng, nên dạng ngắn gõ vào đã là chuỗi con của mã lưu; còn biến thể thì gây rò ("2026-1" sinh
      // "26-1", khớp "2025-126-1").
      return hoac(
        [...new Set(the.giaTri.map((v) => v.trim()).filter(Boolean))].map((v) =>
          chuaMa(cot, v),
        ),
      );
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
      return hoac(the.giaTri.flatMap((v) => dieuKienNgay(truong, cot, v)));
    case 'chon': {
      const doi = truong.giaTriCot;
      // Cột enum/chuỗi: `in` (EnumFilter/StringFilter có `in`).
      if (!doi) return [{ [cot]: { in: the.giaTri } }];
      // `giaTriCot` dùng cho cột boolean — `BoolFilter` của Prisma CHỈ có `equals`/`not`, không có `in`:
      // dựng `{ in: [true] }` là Prisma từ chối tham số → 500 cả danh sách. Mỗi giá trị một `equals`,
      // trùng gộp một, nhiều giá trị OR bên trong phần tử AND.
      const giaTri = [...new Set(the.giaTri.map((v) => doi[v]))];
      return hoac(giaTri.map((v) => ({ [cot]: { equals: v } })));
    }
    case 'doi-tuong':
      return hoac(the.giaTri.flatMap((v) => dieuKienDoiTuong(truong, v)));
    case 'quan-he':
      return hoac(the.giaTri.map((v) => dieuKienQuanHe(truong, v)));
    case 'nguoi':
      return hoac(the.giaTri.map((v) => dieuKienNguoi(truong, v)));
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
