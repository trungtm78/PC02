import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { chuanHoaBoCuc, type BoCucCot } from './bo-cuc-cot.util';

/**
 * Bố cục cột bảng danh sách, riêng từng người dùng.
 *
 * Dữ liệu của chính mình nên chỉ cần đăng nhập, không cần phân quyền — giống
 * `UserShortcutsService`. Nhưng MỌI truy vấn phải kẹp `userId`: thiếu một chỗ là người này
 * đọc hoặc ghi đè bố cục của người kia.
 */

/**
 * Danh sách bảng được phép — khai tường minh, không nhận khoá tuỳ ý.
 *
 * Không chặn thì mỗi lỗi đánh máy ở giao diện sinh một hàng rác vĩnh viễn, và bảng trở thành
 * chỗ nhét dữ liệu tuỳ ý theo tài khoản. Thêm màn danh sách mới thì khai thêm ở đây.
 */
export const BANG_HOP_LE = new Set([
  'petitions',
  'incidents',
  'cases',
  'comprehensive',
  'objects',
  'lawyers',
  'deadline-rules',
  // Đơn thư phường: chưa có chọn cột, nhưng nhớ mật độ dòng (18/09/2026).
  'ward-petitions',
]);

/**
 * Mật độ dòng (18/09/2026, mẫu Airtable "row height"): Gọn = mỗi ô 1 dòng, Đọc = Tóm tắt 5 dòng (MẶC ĐỊNH theo
 * yêu cầu anh), Đầy đủ = không kẹp. Khi hầu hết hồ sơ đều dài, "Xem thêm" từng dòng thành việc vặt — cán bộ
 * chọn "Đầy đủ" một lần là xong.
 */
export const MAT_DO_HOP_LE = ['gon', 'doc', 'day-du'] as const;
export type MatDo = (typeof MAT_DO_HOP_LE)[number];
const laMatDo = (v: unknown): v is MatDo =>
  typeof v === 'string' && (MAT_DO_HOP_LE as readonly string[]).includes(v);

@Injectable()
export class UserTableLayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private kiemBang(tableKey: string): void {
    if (!BANG_HOP_LE.has(tableKey)) {
      throw new BadRequestException(`Không có bảng "${tableKey}"`);
    }
  }

  /**
   * Toàn bộ bố cục của một người, dạng bản đồ theo khoá bảng.
   *
   * Trả bản đồ thay vì mảng để giao diện tra thẳng `boCuc[tableKey]`, khỏi lọc mảng ở mọi
   * trang danh sách. Một lần gọi lúc vào ứng dụng là đủ cho mọi bảng.
   */
  async list(userId: string): Promise<Record<string, BoCucCot>> {
    const rows = await this.prisma.userTableLayout.findMany({
      where: { userId },
      select: { tableKey: true, columns: true },
    });
    const ra: Record<string, BoCucCot> = {};
    for (const r of rows) {
      // Chuẩn hoá CẢ KHI ĐỌC: hàng cũ có thể mang payload méo (lưu trước khi có cổng kiểm,
      // hoặc sửa tay trong cơ sở dữ liệu). Không lọc ở đây thì một hàng hỏng làm vỡ bảng của
      // người ấy vĩnh viễn, và họ không có đường tự thoát ngoài việc gọi hỗ trợ.
      ra[r.tableKey] = chuanHoaBoCuc(r.columns);
    }
    return ra;
  }

  /**
   * Ghi cả cục bố cục của MỘT bảng.
   *
   * Ghi nguyên khối chứ không vá từng cột: đổi thứ tự cột sửa vị trí nhiều cột cùng lúc, và
   * ghi từng phần thì mạng đứt giữa chừng để lại bố cục nửa vời — cột này đã dời, cột kia
   * chưa. Một lần ghi, hoặc không gì cả.
   */
  async upsert(userId: string, tableKey: string, columns: unknown) {
    this.kiemBang(tableKey);
    // Cột JSON của Prisma nhận `InputJsonValue`; `BoCucCot` là một bản ghi thuần nên tương
    // thích về giá trị, chỉ lệch về kiểu khai. Ép ở đúng một chỗ này thay vì nới lỏng kiểu
    // của `BoCucCot` — kiểu chặt là thứ giữ cho phần còn lại không lọt payload lạ.
    const sach = chuanHoaBoCuc(columns) as unknown as Prisma.InputJsonValue;
    return this.prisma.userTableLayout.upsert({
      where: { userId_tableKey: { userId, tableKey } },
      create: { userId, tableKey, columns: sach },
      update: { columns: sach },
    });
  }

  /**
   * Về mặc định = xoá hàng, không phải ghi khối rỗng — cột vắng mặt vốn nghĩa là "theo mã".
   *
   * Trừ khi người ấy đã chọn mật độ dòng: "Đặt lại cột" là đặt lại CỘT, không được xoá luôn mật độ — khi ấy chỉ
   * làm rỗng bố cục cột (rỗng = theo mã, cùng nghĩa với vắng hàng).
   */
  async reset(userId: string, tableKey: string): Promise<{ deleted: number }> {
    this.kiemBang(tableKey);
    // MỘT lệnh ghi có điều kiện, không đọc-rồi-ghi: hai tab cùng bấm thì hàng có thể biến mất giữa hai lệnh và
    // lệnh cập nhật ném P2025 (500).
    const giuMatDo = await this.prisma.userTableLayout.updateMany({
      where: { userId, tableKey, matDo: { not: null } },
      data: { columns: {} },
    });
    if (giuMatDo.count > 0) return { deleted: giuMatDo.count };
    const r = await this.prisma.userTableLayout.deleteMany({ where: { userId, tableKey } });
    return { deleted: r.count };
  }

  /** Mật độ dòng của một người, bản đồ theo bảng. Giá trị lạ trong CSDL bị bỏ — giao diện rơi về mặc định. */
  async listMatDo(userId: string): Promise<Record<string, MatDo>> {
    const rows = await this.prisma.userTableLayout.findMany({
      where: { userId, matDo: { not: null } },
      select: { tableKey: true, matDo: true },
    });
    const ra: Record<string, MatDo> = {};
    for (const r of rows) if (laMatDo(r.matDo)) ra[r.tableKey] = r.matDo;
    return ra;
  }

  /** Ghi mật độ dòng của MỘT bảng — chỉ đổi ô mật độ, không đụng bố cục cột. */
  async luuMatDo(userId: string, tableKey: string, matDo: MatDo) {
    this.kiemBang(tableKey);
    return this.prisma.userTableLayout.upsert({
      where: { userId_tableKey: { userId, tableKey } },
      create: { userId, tableKey, columns: {}, matDo },
      update: { matDo },
    });
  }
}
