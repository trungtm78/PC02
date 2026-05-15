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
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
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
