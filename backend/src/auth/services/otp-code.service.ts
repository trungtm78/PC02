import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class OtpCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async invalidatePrior(userId: string): Promise<void> {
    await this.prisma.otpCode.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async generate(userId: string): Promise<string> {
    await this.invalidatePrior(userId);

    const code = crypto.randomInt(100000, 999999).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const codeHash = crypto
      .createHash('sha256')
      .update(salt + code)
      .digest('hex');

    await this.prisma.otpCode.create({
      data: {
        userId,
        codeHash,
        salt,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    return code;
  }

  async verify(userId: string, plaintext: string): Promise<boolean> {
    const record = await this.prisma.otpCode.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return false;

    const computed = crypto
      .createHash('sha256')
      .update(record.salt + plaintext)
      .digest('hex');

    // OV-004: constant-time comparison
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(record.codeHash, 'hex'),
    );

    if (isMatch) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    }

    return isMatch;
  }
}
