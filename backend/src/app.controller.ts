import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { phienBanDangChay, maBanDung } from './phien-ban-dang-chay';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Trạng thái máy chủ + SỐ HIỆU BẢN ĐANG CHẠY.
   *
   * `version` để giao diện tự phát hiện mình đã cũ. Giao diện chỉ mang bản số nướng sẵn lúc
   * dựng, nên nó không tự biết; phải hỏi một nguồn KHÔNG BAO GIỜ bị cache, và `/api/` là
   * nguồn ấy (nginx chuyển tiếp thẳng, CDN không cache đường động).
   *
   * Ngày 28/08/2026 cán bộ dùng app của bản 23/08 suốt 5 ngày mà không ai biết — CDN giữ
   * `sw.js` cũ ở biên và service worker cũ phục vụ gói cũ từ kho nội bộ. Deploy xanh, health
   * ok, hỏng hoàn toàn im lặng. Trường này là để lần sau app tự nhận ra.
   */
  @Get('health')
  health(): { status: string; timestamp: string; version: string; buildId: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: phienBanDangChay(),
      // `version` chỉ tăng khi phát hành nên KHÔNG dò được "app có đang chạy bản cũ không".
      // `buildId` đổi mỗi lần deploy — đó mới là thứ giao diện so.
      buildId: maBanDung(),
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
