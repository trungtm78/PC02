import * as fs from 'fs';
import * as path from 'path';
import 'reflect-metadata';
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import {
  PERMISSIONS_KEY,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DispatchGuard } from '../auth/guards/dispatch.guard';

// otplib chỉ có bản ESM — jest không nạp được; cổng này chỉ đọc metadata, không gọi hàm nào của nó.
jest.mock('otplib', () => ({}));

/**
 * CỔNG: route nào đi qua PermissionsGuard thì PHẢI khai @RequirePermissions (20/09/2026).
 *
 * PermissionsGuard không thấy metadata quyền thì CHO QUA mọi tài khoản đã đăng nhập (permissions.guard.ts). Nên một
 * route quên khai = mở toang, và không ca kiểm nào đỏ. Đo thật: GET /reports/stat48, /reports/monthly/export,
 * /reports/quarterly/export — màn hình đòi read:Case nhưng số liệu/tệp xuất thì ai đăng nhập cũng kéo được.
 *
 * Đọc METADATA THẬT của Nest (không dò chữ): nạp mọi *.controller.ts; route có PermissionsGuard (cấp lớp HOẶC cấp
 * phương thức — 5 controller bulk gắn ở từng phương thức) phải có quyền ở phương thức hoặc ở lớp (guard đọc cả hai),
 * trừ route có guard phân quyền riêng nằm trong MIEN (DispatchGuard: phân công — quyết định 19/09/2026). Guard khác
 * (throttle, JWT...) KHÔNG miễn. Duyệt cả chuỗi prototype vì Nest quét cả phương thức kế thừa.
 */
const MIEN: readonly unknown[] = [DispatchGuard];

type Lop = { name: string; prototype: object };

function moiController(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return moiController(p);
    return e.name.endsWith('.controller.ts') ? [p] : [];
  });
}

function moiPhuongThuc(lop: Lop): [string, object][] {
  const kq = new Map<string, object>();
  for (
    let p: object | null = lop.prototype;
    p && p !== Object.prototype;
    p = Object.getPrototypeOf(p) as object | null
  ) {
    for (const ten of Object.getOwnPropertyNames(p)) {
      if (ten === 'constructor' || kq.has(ten)) continue;
      const mo = Object.getOwnPropertyDescriptor(p, ten);
      if (mo && typeof mo.value === 'function') kq.set(ten, mo.value as object);
    }
  }
  return [...kq];
}

/** Route thiếu quyền của MỘT lớp controller — tách riêng để có ca kiểm âm. */
function routeThieuQuyenCuaLop(lop: Lop): string[] {
  if (Reflect.getMetadata(PATH_METADATA, lop) === undefined) return [];
  const guardLop = (Reflect.getMetadata(GUARDS_METADATA, lop) ??
    []) as unknown[];
  const quyenLop = (Reflect.getMetadata(PERMISSIONS_KEY, lop) ??
    []) as unknown[];
  const thieu: string[] = [];
  for (const [ten, ham] of moiPhuongThuc(lop)) {
    if (Reflect.getMetadata(METHOD_METADATA, ham) === undefined) continue; // không phải route
    const guardRieng = (Reflect.getMetadata(GUARDS_METADATA, ham) ??
      []) as unknown[];
    if (![...guardLop, ...guardRieng].includes(PermissionsGuard)) continue;
    const quyen = (Reflect.getMetadata(PERMISSIONS_KEY, ham) ??
      []) as unknown[];
    if (quyen.length > 0 || quyenLop.length > 0) continue;
    if (guardRieng.some((g) => MIEN.includes(g))) continue;
    thieu.push(`${lop.name}.${ten}`);
  }
  return thieu;
}

const GOC = path.resolve(__dirname, '..');

function routeThieuQuyen(): { thieu: string[]; soLop: number } {
  const thieu: string[] = [];
  let soLop = 0;
  for (const tep of moiController(GOC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(tep) as Record<string, unknown>;
    for (const giaTri of Object.values(mod)) {
      if (
        typeof giaTri !== 'function' ||
        Reflect.getMetadata(PATH_METADATA, giaTri) === undefined
      )
        continue;
      soLop++;
      const rel = path.relative(GOC, tep).replace(/\\/g, '/');
      thieu.push(
        ...routeThieuQuyenCuaLop(giaTri as Lop).map((r) => `${rel} ${r}`),
      );
    }
  }
  return { thieu, soLop };
}

// ── Lớp mẫu cho ca kiểm âm (gieo lỗi có chủ đích) ──
@Controller('mau-thieu')
@UseGuards(PermissionsGuard)
class MauThieuQuyen {
  @Get('co')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  co() {}

  @Get('thieu')
  thieu() {}
}

@Controller('mau-guard-phuong-thuc')
class MauGuardPhuongThuc {
  @Get()
  @UseGuards(PermissionsGuard)
  thieu() {}
}

class ChaCoRoute {
  @Get('ke-thua')
  keThua() {}
}
@Controller('mau-ke-thua')
@UseGuards(PermissionsGuard)
class MauKeThua extends ChaCoRoute {}

class GuardKhac {}
@Controller('mau-guard-khac')
@UseGuards(PermissionsGuard)
class MauGuardKhac {
  @Get()
  @UseGuards(GuardKhac)
  thieu() {}

  @Get('phan-cong')
  @UseGuards(DispatchGuard)
  phanCong() {}
}

@Controller('mau-quyen-lop')
@UseGuards(PermissionsGuard)
@RequirePermissions({ action: 'read', subject: 'Case' })
class MauQuyenLop {
  @Get()
  lay() {}
}

describe('CỔNG route qua PermissionsGuard phải khai quyền', () => {
  jest.setTimeout(120_000);

  it('không route nào của hệ thống thiếu quyền', () => {
    const { thieu, soLop } = routeThieuQuyen();
    expect(soLop).toBeGreaterThan(40); // chống xanh vì nạp rỗng
    expect(thieu).toEqual([]);
  });

  it('bắt route thiếu quyền trong lớp có guard cấp lớp', () => {
    expect(routeThieuQuyenCuaLop(MauThieuQuyen)).toEqual([
      'MauThieuQuyen.thieu',
    ]);
  });

  it('bắt route chỉ gắn PermissionsGuard ở cấp phương thức', () => {
    expect(routeThieuQuyenCuaLop(MauGuardPhuongThuc)).toEqual([
      'MauGuardPhuongThuc.thieu',
    ]);
  });

  it('bắt route kế thừa từ lớp cha', () => {
    expect(routeThieuQuyenCuaLop(MauKeThua)).toEqual(['MauKeThua.keThua']);
  });

  it('guard bất kỳ KHÔNG miễn; chỉ DispatchGuard miễn', () => {
    expect(routeThieuQuyenCuaLop(MauGuardKhac)).toEqual(['MauGuardKhac.thieu']);
  });

  it('quyền khai ở cấp lớp được tính (guard đọc cả lớp)', () => {
    expect(routeThieuQuyenCuaLop(MauQuyenLop)).toEqual([]);
  });
});
