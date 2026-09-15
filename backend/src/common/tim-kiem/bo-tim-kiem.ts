import { Logger } from '@nestjs/common';
import { KY_THONG_KE } from '../utils/thong-ke-ky.util';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  docThe,
  dungDieuKienTimKiem,
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
    const ra = dungDieuKienTimKiem(the, this.khai, { luiCotGoc });
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

  /** Có thẻ ngày không — cán bộ đã chỉ rõ ngày thì kỳ thống kê MẶC ĐỊNH không được cắt thêm. */
  coTheNgay(tk: unknown): boolean {
    return damThe(tk).some((muc) => {
      const i = muc.indexOf('~');
      if (i <= 0) return false;
      const khoa = muc.slice(0, i);
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
