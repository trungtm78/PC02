import { InternalServerErrorException } from '@nestjs/common';
import { EmailService } from './email.service';

function makeService(sendMailImpl?: jest.Mock) {
  const sendMail = sendMailImpl ?? jest.fn().mockResolvedValue({});
  const config = {
    get: jest.fn((key: string, fallback?: any) => {
      const map: Record<string, any> = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        SMTP_FROM: 'PC02 System <noreply@pc02hcm.com>',
      };
      return map[key] ?? fallback;
    }),
  } as any;

  const svc = new EmailService(config);

  // Inject mock transporter after onModuleInit would set it
  jest.spyOn(require('nodemailer'), 'createTransport').mockReturnValue({ sendMail });
  svc.onModuleInit();

  return { svc, sendMail };
}

describe('EmailService', () => {
  it('sendTwoFaOtp calls sendMail with correct to and subject containing PC02', async () => {
    const { svc, sendMail } = makeService();
    await svc.sendTwoFaOtp('user@example.com', '123456');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('PC02'),
        text: expect.stringContaining('123456'),
      }),
    );
  });

  it('sendMail rejection propagates as InternalServerErrorException', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP connect failed'));
    const { svc } = makeService(sendMail);
    await expect(svc.sendTwoFaOtp('user@example.com', '123456')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('sendEventReminder escapes HTML in event title (XSS in mail clients)', async () => {
    const { svc, sendMail } = makeService();
    await svc.sendEventReminder(
      'user@example.com',
      '<script>alert(1)</script>',
      new Date('2026-06-01'),
    );
    const call = sendMail.mock.calls[0][0];
    expect(call.html).not.toContain('<script>alert(1)</script>');
    expect(call.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    // plain-text body keeps the raw title (no HTML injection risk there)
    expect(call.text).toContain('<script>alert(1)</script>');
  });

  it('sendEventReminder escapes special HTML chars (&, ", \', <, >)', async () => {
    const { svc, sendMail } = makeService();
    await svc.sendEventReminder('user@example.com', `A & B "C" 'D' <E>`, new Date('2026-06-01'));
    const call = sendMail.mock.calls[0][0];
    expect(call.html).toContain('A &amp; B &quot;C&quot; &#39;D&#39; &lt;E&gt;');
  });
});
