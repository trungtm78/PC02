import { Controller, Get, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Cấu hình giao diện (hành động khi bấm vào dòng danh sách…) — MỌI người dùng đăng nhập đọc được.
 *
 * Tách khỏi `SettingsController` có chủ ý: controller đó gắn `PermissionsGuard` cấp lớp nên mọi route trong nó phải
 * khai quyền (cổng `cong-route-co-quyen.spec.ts`). Đường này CỐ Ý chỉ cần JWT — cán bộ thường mở danh sách cũng phải
 * biết bấm vào dòng thì làm gì, mà họ không có quyền Setting. Dữ liệu trả là danh sách trắng khoá giao diện
 * (`SettingsService.getGiaoDien`), không bao giờ lộ khoá nhạy cảm (2FA, thời hạn…).
 */
@Controller('settings/giao-dien')
@UseGuards(JwtAuthGuard)
export class GiaoDienController {
  constructor(private readonly settingsService: SettingsService) {}

  // GET /api/v1/settings/giao-dien
  @Get()
  getGiaoDien() {
    return this.settingsService.getGiaoDien();
  }
}
