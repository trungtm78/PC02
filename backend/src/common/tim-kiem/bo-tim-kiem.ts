import { Logger } from '@nestjs/common';
import { boDauTimKiem, thoatLike } from './bo-dau';
import { KY_THONG_KE } from '../utils/thong-ke-ky.util';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  KHOA_TAT_CA,
  docThe,
  dungDieuKienTimKiem,
  docKhoangNgay,
  NGUONG_TIEN_GIAI_NGUOI,
  type IdNguoiTienGiai,
} from './dieu-kien';
import { sinhCauConChuaNap, type KhaiThucThe } from './sinh/sinh-tim-kiem';

/** Nhớ câu trả lời "còn dòng chưa nạp cột bóng" — tắt khẩn trigger thì chậm nhất chừng này mới lùi. */
export const THOI_GIAN_NHO_CHUA_NAP_MS = 60_000;

export interface PrismaHoiChuaNap {
  $queryRawUnsafe(sql: string, ...values: unknown[]): Promise<unknown>;
}

/**
 * Tham số lọc chữ trước thời thẻ → khoá thẻ. Một khoá: gộp vào danh sách thẻ như thẻ thường (cùng
 * khoá với `tk` thì OR trong thẻ). Nhiều khoá: một khối "hoặc" — vd `search` cũ của Vụ việc tìm cả
 * cột trên bảng lẫn tên điều tra viên (quan hệ), mà thẻ `*` chỉ gồm cột trên bảng.
 */
export type ThamSoCu = Readonly<Record<string, string | readonly string[]>>;

type DieuKien = Record<string, unknown>;

const damThe = (tk: unknown): string[] =>
  tk === undefined || tk === null
    ? []
    : Array.isArray(tk)
      ? tk.filter((x): x is string => typeof x === 'string')
      : typeof tk === 'string'
        ? [tk]
        : [];

/**
 * Tìm kiếm dạng thẻ của MỘT thực thể — dùng chung cho mọi service danh sách, để quy tham số cũ, nhánh
 * lùi cột gốc và kỳ thống kê không bị chép ba bản rồi trôi khỏi nhau.
 */
export class BoTimKiem {
  private readonly logger = new Logger(BoTimKiem.name);
  private readonly cauChuaNap: string;
  private nho: { giaTri: boolean; het: number } | null = null;

  constructor(
    private readonly prisma: PrismaHoiChuaNap,
    private readonly khai: KhaiThucThe,
    private readonly thamSoCu: ThamSoCu = {},
    private readonly bayGio: () => number = Date.now,
  ) {
    this.cauChuaNap = sinhCauConChuaNap(khai);
  }

  /**
   * Còn phải lùi về cột gốc không. Nhánh lùi `cột bóng IS NULL AND cột gốc ILIKE` buộc quét cả bảng
   * (đo pc02_spike 47.169 đơn: 124 ms so với 51 ms qua GIN), nên chỉ giữ khi CÒN dòng chưa nạp. Hỏi
   * bằng EXISTS trên chỉ mục một phần; hỏi lỗi thì giữ nhánh lùi — đúng trước, nhanh sau.
   */
  async luiCotGoc(): Promise<boolean> {
    const bayGio = this.bayGio();
    if (this.nho && this.nho.het > bayGio) return this.nho.giaTri;
    let giaTri = true;
    try {
      const dong = (await this.prisma.$queryRawUnsafe(this.cauChuaNap)) as
        | Array<{ co: boolean }>
        | undefined;
      giaTri = dong?.[0]?.co !== false;
    } catch (e) {
      this.logger.warn(
        `Không hỏi được trạng thái nạp cột bóng ${this.khai.bang}: ${String(e)}`,
      );
    }
    this.nho = { giaTri, het: bayGio + THOI_GIAN_NHO_CHUA_NAP_MS };
    return giaTri;
  }

  /**
   * Điều kiện nối vào `where.AND`. Đọc thẻ TRƯỚC khi hỏi CSDL: khoá lạ là 400 ngay, không tốn truy
   * vấn. Tham số cũ cắt còn DO_DAI_GIA_TRI_TOI_DA — ô tìm cũ gửi nguyên chữ dán, quá giới hạn thẻ thì
   * cả trang 400.
   */
  async dieuKien(query: object): Promise<DieuKien[]> {
    const q = query as Record<string, unknown>;
    const tho = damThe(q.tk);
    const nhieuKhoa: Array<{ khoa: readonly string[]; giaTri: string }> = [];
    for (const [ten, khoa] of Object.entries(this.thamSoCu)) {
      const v = q[ten];
      if (typeof v !== 'string') continue;
      const giaTri = v.trim().slice(0, DO_DAI_GIA_TRI_TOI_DA);
      if (!giaTri) continue;
      if (typeof khoa === 'string') tho.push(`${khoa}~${giaTri}`);
      else nhieuKhoa.push({ khoa, giaTri });
    }

    const the = docThe(tho, this.khai);
    if (the.length === 0 && nhieuKhoa.length === 0) return [];

    const luiCotGoc = await this.luiCotGoc();
    const idNguoi = await this.tienGiaiNguoi(the);
    const ra = dungDieuKienTimKiem(the, this.khai, { luiCotGoc, idNguoi });
    for (const { khoa, giaTri } of nhieuKhoa) {
      const hoac = khoa.flatMap((k) =>
        dungDieuKienTimKiem([{ key: k, giaTri: [giaTri] }], this.khai, {
          luiCotGoc,
        }),
      );
      if (hoac.length) ra.push({ OR: hoac });
    }
    return ra;
  }

  /**
   * Một chuỗi gõ tự do (ô chọn liên kết, màn khôi phục) → điều kiện của thẻ "tất cả các cột". Cắt còn
   * DO_DAI_GIA_TRI_TOI_DA: ô ấy gửi nguyên chữ đang gõ, quá giới hạn thẻ là 400.
   */
  dieuKienTatCa(chuoi: string): Promise<DieuKien[]> {
    return this.dieuKien({
      tk: [`${KHOA_TAT_CA}~${chuoi.slice(0, DO_DAI_GIA_TRI_TOI_DA)}`],
    });
  }

  /**
   * Hỏi TRƯỚC id cán bộ mang tên khớp chữ gõ ở thẻ `*`.
   *
   * Tên cán bộ nằm ở bảng `users`, không nằm trong cột ghép của bảng hồ sơ — nên nếu không hỏi
   * riêng thì gõ tên một đồng nghiệp vào dòng "tất cả các cột" ra 0 hồ sơ, trong khi người ấy
   * nhập hàng nghìn hồ sơ. `users` nhỏ và có cột bóng `ho_ten_bd` + GIN nên phép hỏi này rẻ.
   *
   * Lùi về `lastName/firstName/username` cho dòng chưa nạp cột bóng — cùng lý lẽ với `luiCotGoc`.
   *
   * KHÔNG cắt ngầm: lấy `NGUONG + 1` dòng, vượt ngưỡng thì ghi `null` để nơi dựng điều kiện rơi
   * về nhánh quan hệ. Trả về 200 id đầu là danh sách thiếu hồ sơ trong im lặng, mà kết quả vẫn
   * trông hợp lý — kiểu hỏng tệ nhất của tìm kiếm.
   *
   * Hỏi lỗi thì trả `null` cho giá trị ấy: rơi về quan hệ, chậm mà đúng. Không bao giờ để nhánh
   * người biến mất.
   */
  private async tienGiaiNguoi(
    the: readonly { key: string; giaTri: readonly string[] }[],
  ): Promise<IdNguoiTienGiai | undefined> {
    if (this.khai.tatCaGomNguoi) return undefined;
    if (!this.khai.truong.some((t) => t.kieu === 'nguoi')) return undefined;
    const giaTri = [
      ...new Set(
        the.filter((t) => t.key === KHOA_TAT_CA).flatMap((t) => t.giaTri),
      ),
    ];
    if (giaTri.length === 0) return undefined;

    const ra = new Map<string, readonly string[] | null>();
    for (const v of giaTri) {
      const mau = boDauTimKiem(v);
      try {
        const dong = (await this.prisma.$queryRawUnsafe(
          `SELECT "id" FROM "users"
             WHERE ("ho_ten_bd" IS NOT NULL AND "ho_ten_bd" LIKE $1)
                OR ("ho_ten_bd" IS NULL AND (
                      "lastName" ILIKE $2 OR "firstName" ILIKE $2 OR "username" ILIKE $2))
             LIMIT ${NGUONG_TIEN_GIAI_NGUOI + 1}`,
          `%${thoatLike(mau)}%`,
          `%${thoatLike(v)}%`,
        )) as unknown;
        /*
          KIỂM hình dạng trước khi tin. Máy chủ trả gì đó không phải danh sách `{id}` mà ta vẫn
          `map(d => d.id)` thì được `[undefined]`, và `{ enteredById: { in: [undefined] } }` là
          Prisma ném lỗi kiểu → CẢ danh sách 500. Không tin được thì coi như hỏi lỗi: rơi về quan
          hệ, chậm mà đúng.
        */
        const hopLe =
          Array.isArray(dong) &&
          dong.every(
            (d) =>
              typeof (d as { id?: unknown })?.id === 'string' &&
              (d as { id: string }).id !== '',
          );
        if (!hopLe) throw new Error('kết quả hỏi users không đúng hình dạng');
        const id = (dong as { id: string }[]).map((d) => d.id);
        ra.set(v, id.length > NGUONG_TIEN_GIAI_NGUOI ? null : id);
      } catch (e) {
        this.logger.warn(
          `Không tiền giải được tên cán bộ cho "${v}" (${this.khai.thucThe}): ${e instanceof Error ? e.message : String(e)}`,
        );
        ra.set(v, null);
      }
    }
    return ra;
  }

  /**
   * Có thẻ ngày không — cán bộ đã chỉ rõ ngày thì kỳ thống kê MẶC ĐỊNH không được cắt thêm. Thẻ ngày
   * RỖNG không tính: `docThe` bỏ nó nên không lọc ngày nào, gỡ kỳ mặc định là đếm mọi kỳ.
   */
  coTheNgay(tk: unknown): boolean {
    return damThe(tk).some((muc) => {
      const i = muc.indexOf('~');
      if (i <= 0 || !muc.slice(i + 1).trim()) return false;
      const khoa = muc.slice(0, i);
      /*
        Thẻ `*` cũng là thẻ ngày KHI chữ gõ đọc được ra ngày — nó mở nhánh ngày y như thẻ riêng.

        Bỏ sót chỗ này thì kỳ mặc định "Tháng này" vẫn AND vào `ngayDeXuat`: gõ một ngày NGOÀI
        tháng đang xem trả 0 dòng trong khi nhãn hứa tìm khắp nơi. Người thử gõ ngày hôm nay nên
        không bao giờ thấy — đúng kiểu hỏng chỉ lộ ra với người dùng thật.
      */
      if (khoa === KHOA_TAT_CA)
        return docKhoangNgay(muc.slice(i + 1).trim()) !== undefined;
      return this.khai.truong.some((t) => t.key === khoa && t.kieu === 'ngay');
    });
  }

  /**
   * Kỳ THỰC SỰ áp cho danh sách/thống kê: có thẻ ngày thì "tất cả" — cho cả điều kiện lọc lẫn nhãn
   * kỳ trả về, để thanh thẻ không ghi "Tháng này" trên con số không lọc tháng.
   */
  kyApDung<
    K extends { ky: string; tuNgay: string | null; denNgay: string | null },
  >(ky: K, tk: unknown): K {
    return this.coTheNgay(tk)
      ? { ...ky, ky: KY_THONG_KE.TAT_CA, tuNgay: null, denNgay: null }
      : ky;
  }
}
