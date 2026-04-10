import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /api/v1/notifications — danh sách thông báo của current user */
  @Get()
  getList(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getList(user.id, query);
  }

  /** GET /api/v1/notifications/unread-count — số thông báo chưa đọc */
  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  /** POST /api/v1/notifications/seed — tạo thông báo demo (chỉ nếu chưa có) */
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seedDemo(@CurrentUser() user: AuthUser) {
    return this.notificationsService.seedDemoForUser(user.id);
  }

  /** PATCH /api/v1/notifications/:id/read — đánh dấu 1 thông báo đã đọc */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  /** PATCH /api/v1/notifications/read-all — đánh dấu tất cả đã đọc */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  /** DELETE /api/v1/notifications/:id — xóa 1 thông báo */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.deleteOne(id, user.id);
  }

  /** DELETE /api/v1/notifications/read — xóa tất cả thông báo đã đọc */
  @Delete('read')
  @HttpCode(HttpStatus.OK)
  deleteAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.deleteAllRead(user.id);
  }
}
