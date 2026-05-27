import { Controller, Get, Sse, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { SseJwtGuard } from '../auth/guards/sse-jwt.guard';
import { NotificationSseService } from './notification-sse.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('notifications')
export class SseController {
  constructor(private readonly sseService: NotificationSseService) {}

  @Get('stream')
  @Sse()
  @SkipThrottle()
  @UseGuards(SseJwtGuard)
  stream(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    return this.sseService.createStream(user.sub);
  }
}
