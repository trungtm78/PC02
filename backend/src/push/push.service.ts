import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import {
  STALE_TOKEN_FCM_ERRORS,
  type FcmError,
} from '../common/constants/fcm-error.constants';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly projectId = process.env.FCM_PROJECT_ID ?? '';
  private readonly fcmUrl: string;
  private auth: GoogleAuth | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.fcmUrl = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    }
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const devices = await this.prisma.userDevice.findMany({ where: { userId } });
    await Promise.allSettled(devices.map((d) => this.fcmSend(d.id, d.fcmToken, payload)));
  }

  private async fcmSend(deviceId: string, fcmToken: string, payload: PushPayload): Promise<void> {
    if (!this.auth) {
      this.logger.warn('FCM not configured — GOOGLE_APPLICATION_CREDENTIALS missing');
      return;
    }
    try {
      const client = await this.auth.getClient();
      const tokenRes = await client.getAccessToken();
      const accessToken = tokenRes.token;

      const response = await fetch(this.fcmUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title: payload.title, body: payload.body },
            data: payload.data ?? {},
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json() as { error?: { status?: string } };
        const status = err?.error?.status;
        if (status && STALE_TOKEN_FCM_ERRORS.includes(status as FcmError)) {
          this.logger.warn(`Stale FCM token detected, removing device ${deviceId}`);
          await this.prisma.userDevice.delete({ where: { id: deviceId } }).catch(() => {});
        }
      }
    } catch (err) {
      this.logger.error(`FCM send error for device ${deviceId}:`, err);
    }
  }
}
