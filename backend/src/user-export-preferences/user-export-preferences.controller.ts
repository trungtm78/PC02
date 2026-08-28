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
import { UserExportPreferencesService } from './user-export-preferences.service';
import { LuuLuaChonDto } from './dto/luu-lua-chon.dto';

/**
 * Lựa chọn in chứng từ của chính người đang đăng nhập.
 *
 * Chỉ `JwtAuthGuard`, không `PermissionsGuard`: đây là tuỳ chọn của chính mình, đọc hay ghi đều
 * không đụng dữ liệu nghiệp vụ. Cùng lối với `user-table-layouts` và `user-shortcuts`.
 *
 * `userId` LUÔN lấy từ token, không bao giờ từ tham số — nhận từ tham số là mở đường cho một
 * người ghi đè lựa chọn của người khác.
 */
@UseGuards(JwtAuthGuard)
@Controller('user-export-preferences')
export class UserExportPreferencesController {
  constructor(private readonly service: UserExportPreferencesService) {}

  @Get()
  list(@Request() req: any) {
    return this.service.list(req.user.id);
  }

  @Put(':entityType')
  luu(@Request() req: any, @Param('entityType') entityType: string, @Body() dto: LuuLuaChonDto) {
    return this.service.upsert(req.user.id, entityType, dto.luaChon);
  }

  @Delete(':entityType')
  datLai(@Request() req: any, @Param('entityType') entityType: string) {
    return this.service.reset(req.user.id, entityType);
  }
}
