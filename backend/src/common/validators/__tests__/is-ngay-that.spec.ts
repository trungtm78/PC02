import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCaseDto } from '../../../cases/dto/create-case.dto';
import { UpdateCaseDto } from '../../../cases/dto/update-case.dto';

/**
 * Ô ngày phải là ngày CÓ THẬT (tồn đọng PR #220, 19/09/2026): `@IsDateString()` mặc định nhận "1985-02-31" — Postgres
 * rồi JavaScript lặng lẽ đổi thành 03/03/1985, hồ sơ mang một mốc tố tụng không ai nhập.
 */
function loiNgay(
  Kieu: new () => object,
  du: Record<string, unknown>,
  truong: string,
) {
  const loi = validateSync(plainToInstance(Kieu, du));
  return loi.filter((l) => l.property === truong);
}

describe('Ô ngày chỉ nhận ngày có thật', () => {
  it.each([
    '1985-02-31',
    '2023-02-29',
    '2026-09-31',
    '2026-04-31T00:00:00.000Z',
  ])('từ chối %s', (ngay) => {
    expect(
      loiNgay(UpdateCaseDto, { ngayDeXuat: ngay }, 'ngayDeXuat'),
    ).toHaveLength(1);
    expect(
      loiNgay(UpdateCaseDto, { ngayKhoiTo: ngay }, 'ngayKhoiTo'),
    ).toHaveLength(1);
  });

  it.each(['2024-02-29', '2026-09-19', '2026-09-19T10:00:00.000Z'])(
    'nhận %s',
    (ngay) => {
      expect(
        loiNgay(UpdateCaseDto, { ngayDeXuat: ngay }, 'ngayDeXuat'),
      ).toHaveLength(0);
    },
  );

  it('lời báo lỗi tiếng Việt nói rõ ngày không có thật', () => {
    const [loi] = loiNgay(
      CreateCaseDto,
      { ngayDeXuat: '1985-02-31' },
      'ngayDeXuat',
    );
    expect(Object.values(loi.constraints ?? {}).join(' ')).toMatch(
      /không có thật/,
    );
  });
});

/** CỔNG: không còn `@IsDateString` trần trong mã nguồn — thêm ô ngày mới mà quên là đỏ. */
describe('CỔNG ô ngày', () => {
  it('mọi ô ngày dùng @IsNgayThat, không dùng @IsDateString trần', () => {
    const goc = path.resolve(__dirname, '../../..');
    const vi: string[] = [];
    const duyet = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) duyet(p);
        else if (
          f.endsWith('.ts') &&
          !f.endsWith('.spec.ts') &&
          !p.includes('is-ngay-that.validator')
        ) {
          const s = fs.readFileSync(p, 'utf8');
          if (/@IsDateString\(/.test(s)) vi.push(path.relative(goc, p));
        }
      }
    };
    duyet(goc);
    expect(vi).toEqual([]);
  });
});
