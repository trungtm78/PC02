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
]);

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

  /** Về mặc định = xoá hàng, không phải ghi khối rỗng — cột vắng mặt vốn nghĩa là "theo mã". */
  async reset(userId: string, tableKey: string): Promise<{ deleted: number }> {
    this.kiemBang(tableKey);
    const r = await this.prisma.userTableLayout.deleteMany({ where: { userId, tableKey } });
    return { deleted: r.count };
  }
}
