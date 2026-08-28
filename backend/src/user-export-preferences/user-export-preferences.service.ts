import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chuanHoaLuaChon, type LuaChonInChungTu } from './chuan-hoa-lua-chon.util';

/**
 * Lựa chọn in chứng từ (mẫu đã tích + định dạng xuất), riêng từng cán bộ.
 *
 * ── Vì sao có ──
 *
 * Popup In chứng từ không nhớ gì giữa các lần mở — nó bị gỡ khỏi màn hình khi đóng nên mọi lựa
 * chọn tan hết. Đơn thư có 14 mẫu, nên cán bộ phải tích lại từ đầu mỗi ngày.
 *
 * ── Thứ tự ưu tiên ──
 *
 * Lựa chọn CÁ NHÂN thắng; ai chưa từng đặt thì popup dùng cờ "Tích sẵn khi in" admin bật ở màn
 * Quản lý mẫu chứng từ. Đây là cá nhân hoá, không phải thiết lập chung.
 *
 * Dữ liệu của chính mình nên chỉ cần đăng nhập, không cần phân quyền — giống
 * `UserTableLayoutsService`. Nhưng MỌI truy vấn phải kẹp `userId`: thiếu một chỗ là người này
 * đọc hoặc ghi đè lựa chọn của người kia.
 */

/**
 * Ba thực thể có popup In chứng từ — khai tường minh, không nhận khoá tuỳ ý.
 *
 * Không chặn thì mỗi lỗi đánh máy ở giao diện sinh một hàng rác vĩnh viễn, và bảng trở thành chỗ
 * nhét dữ liệu tuỳ ý theo tài khoản.
 */
export const THUC_THE_HOP_LE = new Set(['DON_THU', 'VU_VIEC', 'VU_AN']);

@Injectable()
export class UserExportPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  private kiemThucThe(entityType: string): void {
    if (!THUC_THE_HOP_LE.has(entityType)) {
      throw new BadRequestException(`Không có loại hồ sơ "${entityType}"`);
    }
  }

  /**
   * Toàn bộ lựa chọn của một người, dạng bản đồ theo loại hồ sơ.
   *
   * Trả bản đồ thay vì mảng để popup tra thẳng `luaChon[entityType]`, khỏi lọc mảng ở ba màn.
   */
  async list(userId: string): Promise<Record<string, LuaChonInChungTu>> {
    const rows = await this.prisma.userExportPreference.findMany({
      where: { userId },
      select: { entityType: true, templateIds: true, mode: true },
    });
    const ra: Record<string, LuaChonInChungTu> = {};
    for (const r of rows) {
      // Chuẩn hoá CẢ KHI ĐỌC: hàng cũ có thể mang chế độ lạ hoặc mã mẫu rác (lưu trước khi có
      // cổng kiểm, hoặc sửa tay trong CSDL). Không lọc ở đây thì một hàng hỏng làm vỡ popup của
      // người ấy vĩnh viễn, và họ không có đường tự thoát ngoài việc gọi hỗ trợ.
      ra[r.entityType] = chuanHoaLuaChon(r);
    }
    return ra;
  }

  /**
   * Ghi cả cục lựa chọn của MỘT loại hồ sơ.
   *
   * Ghi nguyên khối chứ không vá từng mẫu: một lần in là một bộ lựa chọn trọn vẹn, và ghi từng
   * phần thì mạng đứt giữa chừng để lại bộ nửa vời — mẫu này đã nhớ, mẫu kia chưa.
   */
  async upsert(userId: string, entityType: string, luaChon: unknown) {
    this.kiemThucThe(entityType);
    const sach = chuanHoaLuaChon(luaChon);
    return this.prisma.userExportPreference.upsert({
      where: { userId_entityType: { userId, entityType } },
      create: { userId, entityType, templateIds: sach.templateIds, mode: sach.mode },
      update: { templateIds: sach.templateIds, mode: sach.mode },
    });
  }

  /**
   * Về mặc định = XOÁ hàng, không phải ghi khối rỗng.
   *
   * Khác nhau thật: hàng vắng mặt nghĩa là "theo cờ admin", còn khối rỗng nghĩa là "cán bộ cố ý
   * không chọn mẫu nào". Gộp hai cái là mất đường quay về mặc định.
   */
  async reset(userId: string, entityType: string): Promise<{ deleted: number }> {
    this.kiemThucThe(entityType);
    const r = await this.prisma.userExportPreference.deleteMany({ where: { userId, entityType } });
    return { deleted: r.count };
  }
}
