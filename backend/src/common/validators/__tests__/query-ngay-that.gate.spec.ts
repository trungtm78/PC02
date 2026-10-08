import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryCasesDto } from '../../../cases/dto/query-cases.dto';
import { QueryChuyenTraDto } from '../../../workflow/dto/query-chuyen-tra.dto';
import { QueryGuidanceDto } from '../../../guidance/dto/query-guidance.dto';
import { QueryProposalsDto } from '../../../proposals/dto/query-proposals.dto';
import { QuerySubjectsDto } from '../../../subjects/dto/query-subjects.dto';
import { QueryDuplicatesDto } from '../../../petitions/dto/query-duplicates.dto';

/**
 * GATE: a date typed into a list filter must be a real calendar date, or the request is a 400.
 *
 * Found by the monkey run of 09/10/2026: `GET /api/v1/cases?fromDate=<garbage>` answered 500
 * (`PrismaClientValidationError: Provided Date object is invalid`) because the DTO only said `@IsString()`, so
 * `new Date("garbage")` reached Prisma. The petition and incident list DTOs already used `@IsNgayThat()`; six others
 * had been missed.
 */
const MOI = ['fromDate', 'toDate'] as const;

const DTO: [string, new () => object][] = [
  ['QueryCasesDto', QueryCasesDto],
  ['QueryChuyenTraDto', QueryChuyenTraDto],
  ['QueryGuidanceDto', QueryGuidanceDto],
  ['QueryProposalsDto', QueryProposalsDto],
  ['QuerySubjectsDto', QuerySubjectsDto],
  ['QueryDuplicatesDto', QueryDuplicatesDto],
];

function loi(Kieu: new () => object, du: Record<string, unknown>, truong: string) {
  return validateSync(plainToInstance(Kieu, du)).filter((l) => l.property === truong);
}

describe.each(DTO)('%s: ô ngày lọc danh sách chỉ nhận ngày có thật', (_ten, Kieu) => {
  it.each(MOI)('%s từ chối chuỗi rác, ngày không có thật và dạng dd/mm/yyyy', (truong) => {
    for (const xau of ['garbage', '2026-02-31', '31/12/2026', '2026-13-01', '0000-00-00']) {
      expect({ xau, soLoi: loi(Kieu, { [truong]: xau }, truong).length }).toEqual({ xau, soLoi: 1 });
    }
  });

  it.each(MOI)('%s vẫn nhận ngày hợp lệ và để trống', (truong) => {
    for (const ok of ['2026-10-09', '2024-02-29', '0225-05-12', '2026-10-09T00:00:00.000Z']) {
      expect({ ok, soLoi: loi(Kieu, { [truong]: ok }, truong).length }).toEqual({ ok, soLoi: 0 });
    }
    expect(loi(Kieu, {}, truong)).toHaveLength(0);
  });
});

/**
 * Text scan so a SEVENTH query DTO cannot repeat this: every property of a `*query*.dto.ts` file whose name says it is a
 * date bound must carry `@IsNgayThat()` right above it.
 */
describe('mọi DTO truy vấn có ô cận ngày đều dùng @IsNgayThat', () => {
  const GOC = path.resolve(__dirname, '../../..');
  const TEN_CAN_NGAY = /^\s+((?:from|to)Date(?:Range)?|ngay\w*(?:From|To)|\w*(?:Tu|Den)Ngay)\??:\s*string/;

  function tepDto(dir: string): string[] {
    const ra: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') ra.push(...tepDto(p));
      } else if (/query.*\.dto\.ts$/.test(e.name)) {
        ra.push(p);
      }
    }
    return ra;
  }

  /** Date-bound properties of one file that lack `@IsNgayThat()` in the decorator block above them. */
  function thieu(chu: string): string[] {
    const dong = chu.split(/\r?\n/);
    const ra: string[] = [];
    dong.forEach((d, i) => {
      const m = TEN_CAN_NGAY.exec(d);
      if (!m) return;
      let j = i - 1;
      const khoi: string[] = [];
      while (j >= 0 && /^\s*(@|\/\/|\/\*|\*)/.test(dong[j])) khoi.unshift(dong[j--]);
      if (!khoi.some((x) => /@IsNgayThat\(/.test(x))) ra.push(m[1]);
    });
    return ra;
  }

  it('bộ quét thấy ô cận ngày và bắt được ô thiếu @IsNgayThat (ca gieo lỗi)', () => {
    expect(thieu('  @IsOptional()\n  @IsString()\n  fromDate?: string;')).toEqual(['fromDate']);
    expect(thieu('  @IsOptional()\n  @IsNgayThat()\n  fromDate?: string;')).toEqual([]);
    expect(thieu('  @IsOptional()\n  @IsNgayThat()\n  // ghi chú\n  toDateRange?: string;')).toEqual([]);
    expect(thieu('  @IsOptional()\n  @IsString()\n  ngayTiepNhanTo?: string;')).toEqual(['ngayTiepNhanTo']);
  });

  it('không DTO truy vấn nào còn ô cận ngày trần', () => {
    const tep = tepDto(GOC);
    expect(tep.length).toBeGreaterThanOrEqual(8);
    const sai = tep.flatMap((f) => thieu(fs.readFileSync(f, 'utf8')).map((t) => `${path.relative(GOC, f).replace(/\\/g, '/')}: ${t}`));
    expect(sai).toEqual([]);
  });
});
