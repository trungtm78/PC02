import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { FeatureFlagsService } from '../feature-flags.service';
import { getManifest } from '../feature-registry';

/**
 * WIRE FORMAT — do not rename without shipping a mobile release first.
 *
 * Web (`lib/api.ts`) and mobile (`api_client.dart`) both branch on this string
 * to tell "feature switched off" apart from "record not found". An installed
 * APK carries its copy of it, so a rename here silently reverts those clients
 * to showing a raw 404.
 */
export const FEATURE_DISABLED_ERROR = 'FEATURE_DISABLED';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  /**
   * Khoá công khai đọc một lần lúc khởi tạo, đúng khuôn `TwoFaTokenGuard`.
   * Thiếu khoá thì hỏng ngay lúc boot — đúng hơn là hỏng im lặng lúc chạy.
   */
  private readonly publicKey: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    const publicKeyPath = this.config.get<string>(
      'JWT_PUBLIC_KEY_PATH',
      './keys/public.pem',
    );
    this.publicKey = fs.readFileSync(path.resolve(publicKeyPath), 'utf-8');
  }

  /**
   * Request này có mang danh tính hợp lệ không?
   *
   * Guard này TỰ xác thực thay vì đọc `request.user`, và đó là toàn bộ điểm của
   * ADR-0018: nó đăng ký `APP_GUARD` toàn cục nên chạy TRƯỚC `JwtAuthGuard` cấp
   * controller, tức trước thứ tạo ra `request.user`. Đọc `request.user` ở đây
   * luôn thấy `undefined`, và cờ tắt không bao giờ chặn được gì — đo 8/8 lần.
   *
   * Chữ ký phải khớp `JwtAuthGuard` (RS256 + cùng khoá công khai). Lệch một bên
   * là gate im lặng ngừng chạy đúng như sự cố ADR-0018 mô tả.
   */
  private isAuthenticated(request: {
    headers?: Record<string, unknown>;
  }): boolean {
    const header = request.headers?.['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer '))
      return false;
    try {
      this.jwtService.verify(header.slice(7), {
        algorithms: ['RS256'],
        publicKey: this.publicKey,
      });
      return true;
    } catch {
      return false;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string | undefined>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Route not gated on a feature flag → allow.
    if (!flagKey) return true;

    // Bỏ qua kiểm cờ khi request KHÔNG mang danh tính hợp lệ: nếu không, người
    // chưa đăng nhập dò được cờ nào đang bật bằng cách so 404 (tắt) với 401
    // (bật), và câu trả lời rò ra nhanh hơn giới hạn của throttler. Trả `true`
    // để `JwtAuthGuard` phía sau trả 401 đồng nhất.
    //
    // Ý định này giữ nguyên từ bản đầu. Cái đổi là CÁCH xác định "có danh tính":
    // trước đây đọc `request.user`, mà guard này chạy TRƯỚC thứ tạo ra nó ⇒ luôn
    // `undefined` ⇒ cờ không bao giờ chặn được gì. Xem ADR-0018.
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, unknown>;
    }>();
    if (!this.isAuthenticated(request)) return true;

    const enabled = await this.featureFlags.isEnabled(flagKey);
    if (!enabled) {
      // Status stays 404 — a disabled feature should not advertise itself with
      // a distinct status code, and only authenticated callers get this far.
      //
      // The body, however, has to be distinguishable. A bare 404 is
      // indistinguishable from "record not found", so every client showed the
      // wrong thing: the web app rendered a generic error, and the mobile app
      // surfaced `Lỗi: DioException ... 404` verbatim to an officer who had
      // done nothing wrong. `error: 'FEATURE_DISABLED'` is what lets both say
      // "this feature is switched off" instead of guessing.
      //
      // This is also the reason PR-M1 blocks the API-gating waves: turning a
      // flag off without it produces that Dio error string on installed apps,
      // and an installed app cannot be fixed by a redeploy.
      throw new NotFoundException({
        statusCode: 404,
        error: FEATURE_DISABLED_ERROR,
        feature: flagKey,
        message: `Tính năng "${getManifest(flagKey)?.label ?? flagKey}" hiện đang tắt`,
      });
    }
    return true;
  }
}
