import * as fs from 'fs';
import * as path from 'path';
import {
  Controller,
  Get,
  INestApplication,
  Injectable,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { FeatureFlagGuard } from './feature-flag.guard';
import { FeatureFlag } from '../decorators/feature-flag.decorator';
import { FeatureFlagsService } from '../feature-flags.service';

/**
 * Tắt tính năng phải CHẶN API thật (tồn đọng PR #217, sửa 19/09/2026).
 *
 * Bản cũ đăng ký FeatureFlagGuard là APP_GUARD. Nest chạy guard toàn cục TRƯỚC guard của controller, nên lúc guard
 * này chạy JwtAuthGuard chưa gắn `request.user` → guard coi là khách → cho qua. Tắt cờ chỉ ẩn menu, API vẫn mở.
 */

/** Giả JwtAuthGuard: gắn user như bản thật. */
@Injectable()
class GiaJwt implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest<{ user?: unknown }>().user = { id: 'u1' };
    return true;
  }
}

@Controller('thu-co')
@UseGuards(GiaJwt, FeatureFlagGuard)
@FeatureFlag('co_thu')
class DieuKhienThu {
  @Get()
  lay() {
    return { ok: true };
  }
}

describe('FeatureFlagGuard đặt SAU xác thực trong @UseGuards — chặn thật qua HTTP', () => {
  let app: INestApplication;
  const co = { isEnabled: jest.fn() };

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [DieuKhienThu],
      providers: [
        GiaJwt,
        FeatureFlagGuard,
        { provide: FeatureFlagsService, useValue: co },
      ],
    }).compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('cờ TẮT → 404', async () => {
    co.isEnabled.mockResolvedValue(false);
    await request(app.getHttpServer() as Server)
      .get('/thu-co')
      .expect(404);
  });

  it('cờ BẬT → 200', async () => {
    co.isEnabled.mockResolvedValue(true);
    await request(app.getHttpServer() as Server)
      .get('/thu-co')
      .expect(200);
  });
});

/** CỔNG cấu hình thật: không đăng ký toàn cục; mọi controller có @FeatureFlag khai guard SAU JwtAuthGuard. */
describe('CỔNG thứ tự guard cờ tính năng', () => {
  const goc = path.resolve(__dirname, '../..');

  it('FeatureFlagsModule KHÔNG đăng ký FeatureFlagGuard làm APP_GUARD', () => {
    const s = fs.readFileSync(
      path.join(goc, 'feature-flags/feature-flags.module.ts'),
      'utf8',
    );
    expect(s).not.toMatch(/APP_GUARD[\s\S]{0,80}FeatureFlagGuard/);
  });

  it('mọi controller dùng @FeatureFlag có @UseGuards(JwtAuthGuard, FeatureFlagGuard, …) đúng thứ tự', () => {
    const sai: string[] = [];
    let so = 0;
    const duyet = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) duyet(p);
        else if (f.endsWith('.controller.ts')) {
          const s = fs.readFileSync(p, 'utf8');
          if (!/@FeatureFlag\(/.test(s)) continue;
          so++;
          const g = /@UseGuards\(([^)]*)\)/.exec(s)?.[1] ?? '';
          const ds = g.split(',').map((x) => x.trim());
          const iJwt = ds.indexOf('JwtAuthGuard');
          const iCo = ds.indexOf('FeatureFlagGuard');
          if (iJwt < 0 || iCo < 0 || iCo < iJwt)
            sai.push(`${path.relative(goc, p)}: @UseGuards(${g})`);
        }
      }
    };
    duyet(goc);
    expect(so).toBeGreaterThan(0);
    expect(sai).toEqual([]);
  });
});
