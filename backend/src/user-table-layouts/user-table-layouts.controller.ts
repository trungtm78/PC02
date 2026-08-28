import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTableLayoutsService } from './user-table-layouts.service';
import { LuuBoCucDto } from './dto/luu-bo-cuc.dto';

/**
 * Bố cục cột bảng danh sách của chính người đang đăng nhập.
 *
 * Chỉ `JwtAuthGuard`, không `PermissionsGuard`: đây là tuỳ chọn hiển thị của chính mình, đọc
 * hay ghi đều không đụng dữ liệu nghiệp vụ. Cùng lối với `user-shortcuts`.
 *
 * `userId` LUÔN lấy từ token, không bao giờ từ tham số — nhận từ tham số là mở đường cho một
 * người sửa bố cục của người khác.
 */
@UseGuards(JwtAuthGuard)
@Controller('user-table-layouts')
export class UserTableLayoutsController {
  constructor(private readonly service: UserTableLayoutsService) {}

  @Get()
  list(@Request() req: any) {
    return this.service.list(req.user.id);
  }

  @Put(':tableKey')
  luu(@Request() req: any, @Param('tableKey') tableKey: string, @Body() dto: LuuBoCucDto) {
    return this.service.upsert(req.user.id, tableKey, dto.columns);
  }

  @Delete(':tableKey')
  datLai(@Request() req: any, @Param('tableKey') tableKey: string) {
    return this.service.reset(req.user.id, tableKey);
  }
}
