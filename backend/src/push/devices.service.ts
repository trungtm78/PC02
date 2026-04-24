import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, fcmToken: string, platform: string) {
    return this.prisma.userDevice.upsert({
      where: { fcmToken },
      create: { userId, fcmToken, platform },
      update: { userId, platform },
    });
  }

  async unregister(fcmToken: string, userId: string) {
    return this.prisma.userDevice.deleteMany({
      where: { fcmToken, userId },
    });
  }
}
