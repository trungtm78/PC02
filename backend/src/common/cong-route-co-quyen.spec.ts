import * as fs from 'fs';
import * as path from 'path';
import 'reflect-metadata';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

// otplib chỉ có bản ESM — jest không nạp được; cổng này chỉ đọc metadata, không gọi hàm nào của nó.
jest.mock('otplib', () => ({}));

/**
 * CỔNG: controller có PermissionsGuard thì MỌI route phải khai @RequirePermissions (20/09/2026).
 *
 * PermissionsGuard không thấy metadata quyền thì CHO QUA mọi tài khoản đã đăng nhập (permissions.guard.ts). Nên một
 * route quên khai = mở toang, và không ca kiểm nào đỏ. Đo thật: GET /reports/stat48, /reports/monthly/export,
 * /reports/quarterly/export — màn hình đòi read:Case nhưng tệp xuất/số liệu thì ai đăng nhập cũng kéo được.
 *
 * Đọc metadata THẬT của Nest (không dò chữ): nạp mọi *.controller.ts, lấy lớp có @Controller + PermissionsGuard ở
 * @UseGuards cấp lớp, mỗi phương thức có route phải có PERMISSIONS_KEY hoặc guard riêng ở cấp phương thức (vd
 * DispatchGuard cho phân công — quyết định 19/09/2026).
 */
type Lop = {
  new (...a: unknown[]): unknown;
  name: string;
  prototype: Record<string, unknown>;
};

function moiController(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return moiController(p);
    return e.name.endsWith('.controller.ts') ? [p] : [];
  });
}

const GOC = path.resolve(__dirname, '..');

function routeThieuQuyen(): string[] {
  const thieu: string[] = [];
  for (const tep of moiController(GOC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(tep) as Record<string, unknown>;
    for (const giaTri of Object.values(mod)) {
      if (typeof giaTri !== 'function') continue;
      const lop = giaTri as Lop;
      if (Reflect.getMetadata(PATH_METADATA, lop) === undefined) continue;
      const guardLop = (Reflect.getMetadata(GUARDS_METADATA, lop) ??
        []) as unknown[];
      if (!guardLop.includes(PermissionsGuard)) continue;
      for (const ten of Object.getOwnPropertyNames(lop.prototype)) {
        if (ten === 'constructor') continue;
        const ham = lop.prototype[ten];
        if (typeof ham !== 'function') continue;
        if (Reflect.getMetadata(METHOD_METADATA, ham) === undefined) continue; // không phải route
        const quyen = Reflect.getMetadata(PERMISSIONS_KEY, ham) as
          | unknown[]
          | undefined;
        const guardRieng = (Reflect.getMetadata(GUARDS_METADATA, ham) ??
          []) as unknown[];
        if ((quyen && quyen.length > 0) || guardRieng.length > 0) continue;
        thieu.push(
          `${path.relative(GOC, tep).replace(/\\/g, '/')} ${lop.name}.${ten}`,
        );
      }
    }
  }
  return thieu;
}

describe('CỔNG route có PermissionsGuard phải khai quyền', () => {
  jest.setTimeout(120_000);

  it('không route nào thiếu @RequirePermissions', () => {
    expect(routeThieuQuyen()).toEqual([]);
  });

  it('cổng đọc được route thật (tránh xanh vì quét rỗng)', () => {
    // Nạp một controller đã biết có quyền: metadata phải đọc ra được.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CasesController } = require('../cases/cases.controller') as {
      CasesController: Lop;
    };
    const guard = (Reflect.getMetadata(GUARDS_METADATA, CasesController) ??
      []) as unknown[];
    expect(guard).toContain(PermissionsGuard);
    const quyen = Reflect.getMetadata(
      PERMISSIONS_KEY,
      CasesController.prototype.getList as object,
    ) as unknown[];
    expect(quyen?.length).toBeGreaterThan(0);
  });
});
