import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 587),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
      // ISSUE-005 fix: fail fast if SMTP unreachable (avoid 3-min TCP timeout)
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
    });
  }

  async sendTwoFaOtp(to: string, code: string): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'PC02 System <noreply@pc02hcm.com>');
    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: '[PC02] Mã xác thực đăng nhập 2FA',
        text: `Mã xác thực PC02 của bạn là: ${code}\n\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.`,
        html: `<p>Mã xác thực PC02 của bạn là: <strong>${code}</strong></p><p>Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.</p>`,
      });
    } catch (err) {
      this.logger.error('Failed to send 2FA OTP email', err);
      throw new InternalServerErrorException('Không thể gửi email OTP. Vui lòng thử lại.');
    }
  }
}
