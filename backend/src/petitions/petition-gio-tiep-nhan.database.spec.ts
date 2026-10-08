import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Cột `petitions.gioTiepNhan` + ràng buộc CHECK — KIỂM TRÊN POSTGRESQL THẬT.
 *
 * Vì sao cần: CSDL thử dựng bằng `prisma db push` (chỉ lược đồ) nên KHÔNG có ràng buộc CHECK viết ở migration SQL. Spec này
 * áp CHÍNH tệp migration `20261009090000_petition_gio_tiep_nhan` (idempotent) rồi khẳng định CSDL từ chối giờ sai — bằng
 * chứng rằng tầng CSDL chặn được dữ liệu hỏng kể cả khi có đường ghi bỏ qua DTO (nhập hàng loạt, script, di trú).
 *
 * Chỉ chạy khi có `PETITION_SUGGEST_DATABASE_URL` (127.0.0.1/pc02_goiy_scope_test), cùng cổng với
 * `goi-y-don-theo-ten.database.spec.ts`; `PETITION_SUGGEST_DATABASE_REQUIRED=1` ở CI biến việc thiếu thành LỖI.
 */
const diaChi = process.env.PETITION_SUGGEST_DATABASE_URL;
const chay = diaChi ? describe : describe.skip;

chay('petitions.gioTiepNhan trên PostgreSQL thật', () => {
  let db: PrismaClient;
  const tien = `gt-${randomUUID().slice(0, 8)}`;
  const tao = (stt: string, gio: string | null) =>
    db.petition.create({
      data: {
        stt: `${tien}-${stt}`,
        receivedDate: new Date('2026-10-08T00:00:00Z'),
        senderName: 'Nguyễn Văn Thử',
        gioTiepNhan: gio,
      } as never,
    });

  beforeAll(async () => {
    const url = new URL(diaChi!);
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/pc02_goiy_scope_test') {
      throw new Error('Từ chối: PETITION_SUGGEST_DATABASE_URL phải trỏ 127.0.0.1/pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: diaChi! }) });
    // Áp CHÍNH tệp migration. Idempotent: ADD COLUMN IF NOT EXISTS + DROP/ADD CONSTRAINT — chạy lại không lỗi.
    const sql = fs.readFileSync(
      path.join(__dirname, '../../prisma/migrations/20261009090000_petition_gio_tiep_nhan/migration.sql'),
      'utf-8',
    );
    const cau = sql
      .split('\n')
      .filter((d) => !d.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean);
    expect(cau.length).toBeGreaterThanOrEqual(3);
    for (const c of cau) await db.$executeRawUnsafe(c);
    // Chạy lần hai: phải không lỗi (idempotent).
    for (const c of cau) await db.$executeRawUnsafe(c);
  });

  afterAll(async () => {
    await db.petition.deleteMany({ where: { stt: { startsWith: tien } } });
    await db.$disconnect();
  });

  it.each(['00:00', '09:30', '12:00', '23:59'])('nhận giờ hợp lệ %s và đọc lại đúng', async (gio) => {
    const don = await tao(`ok-${gio}`, gio);
    const lai = await db.petition.findUniqueOrThrow({ where: { id: don.id } });
    expect((lai as unknown as { gioTiepNhan: string }).gioTiepNhan).toBe(gio);
  });

  it('NULL (không biết giờ) được phép và đọc lại là null', async () => {
    const don = await tao('null', null);
    const lai = await db.petition.findUniqueOrThrow({ where: { id: don.id } });
    expect((lai as unknown as { gioTiepNhan: string | null }).gioTiepNhan).toBeNull();
  });

  it.each(['24:00', '9:30', '09:60', '0930', '09:30:00', 'ab:cd', '25:00', '', '09-30'])(
    'CSDL TỪ CHỐI "%s" (ràng buộc CHECK)',
    async (gio) => {
      await expect(tao(`xau-${gio}`, gio)).rejects.toThrow();
    },
  );

  it('cột là VARCHAR(5): chuỗi dài hơn bị từ chối dù khớp phần đầu', async () => {
    await expect(tao('dai', '09:30:00')).rejects.toThrow();
  });

  it('hồ sơ CŨ (tạo không khai giờ) có gioTiepNhan NULL — không có giá trị mặc định bịa', async () => {
    const don = await db.petition.create({
      data: {
        stt: `${tien}-cu`,
        receivedDate: new Date('2026-10-08T00:00:00Z'),
        senderName: 'Hồ sơ cũ',
      } as never,
    });
    const lai = await db.petition.findUniqueOrThrow({ where: { id: don.id } });
    expect((lai as unknown as { gioTiepNhan: string | null }).gioTiepNhan).toBeNull();
  });
});
