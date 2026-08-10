import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health(): { status: string; timestamp: string; minMobileVersion: string | null } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      // PR-M1 — phiên bản di động tối thiểu. Ứng dụng đã cài đọc mốc này để
      // biết mình đã quá cũ; đây là ĐƯỜNG CỨU DUY NHẤT cho một APK không hiểu
      // `FEATURE_DISABLED`, vì không deploy nào sửa được app trên máy người
      // dùng. Để trống nghĩa là không ép cập nhật — client cho đi tiếp.
      minMobileVersion: process.env.MIN_MOBILE_VERSION ?? null,
    };
  }

  // Sprint 3 / S3.4 — CSP violation report endpoint.
  // Browser POST report body khi script/style bị block bởi CSP. Log để monitor
  // XSS attempts hoặc legitimate breakage cần loosen policy. Không gated bởi
  // auth — public per CSP spec (browser tự gửi, không user-controlled).
  @Post('csp-report')
  @HttpCode(HttpStatus.NO_CONTENT)
  cspReport(@Body() report: unknown): void {
    this.logger.warn(`CSP violation: ${JSON.stringify(report).slice(0, 2000)}`);
  }
}
