import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { docThe, dungDieuKienTimKiem } from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM_DON_THU } from '../common/tim-kiem/khai/don-thu.khai';
import { thuMucMigrationTimKiemMoiNhat } from '../common/tim-kiem/sinh/tep-sinh';

/**
 * The 30 petition search tags added on 03/11/2026, ON REAL POSTGRESQL.
 *
 * Unit specs only prove the SHAPE of the generated SQL and Prisma conditions. What matters is what the database
 * does: the trigger fills 21 new shadow columns (three of them from `metadata` JSON), the JSON date lands as an ISO
 * text range, old rows are backfilled by the migration, and a malformed JSON value never aborts a record write.
 *
 * Applies the NEWEST search migration (the real file) twice - it must be idempotent - then searches through the same
 * condition builder the API uses. Runs only with `PETITION_SUGGEST_DATABASE_URL` (127.0.0.1/pc02_goiy_scope_test);
 * `PETITION_SUGGEST_DATABASE_REQUIRED=1` in CI turns a missing database into a FAILURE, not a silent skip.
 */
const diaChi = process.env.PETITION_SUGGEST_DATABASE_URL;
const chay = diaChi ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(diaChi).toBeTruthy();
  });
}

chay('petition search tags on PostgreSQL', () => {
  let db: PrismaClient;
  const prefix = `tm-${randomUUID().slice(0, 8)}`;
  const crimeA = `crime-a-${prefix}`;
  const crimeB = `crime-b-${prefix}`;
  let targetId = '';
  let controlId = '';

  /** Search by one tag through the same builder the API uses; returns the matching `stt` values of this run. */
  const tim = async (tk: string): Promise<string[]> => {
    const dieuKien = dungDieuKienTimKiem(
      docThe([tk], KHAI_TIM_KIEM_DON_THU),
      KHAI_TIM_KIEM_DON_THU,
    );
    const rows = await db.petition.findMany({
      where: { AND: [...dieuKien, { stt: { startsWith: prefix } }] } as never,
      select: { stt: true },
    });
    return rows.map((r) => r.stt).sort();
  };
  const stt = (s: string) => `${prefix}-${s}`;

  beforeAll(async () => {
    const url = new URL(diaChi!);
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/pc02_goiy_scope_test') {
      throw new Error(
        'Refused: PETITION_SUGGEST_DATABASE_URL must point to 127.0.0.1/pc02_goiy_scope_test',
      );
    }
    // Apply the REAL newest search migration, twice: it must be idempotent.
    const thuMuc = thuMucMigrationTimKiemMoiNhat();
    expect(thuMuc).toBeDefined();
    const sql = fs.readFileSync(
      path.join(__dirname, '../../prisma/migrations', thuMuc!, 'migration.sql'),
      'utf-8',
    );
    const client = new Client({ connectionString: diaChi! });
    await client.connect();
    try {
      await client.query(sql);
      await client.query(sql);
    } finally {
      await client.end();
    }

    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: diaChi! }) });
    await db.crime.createMany({
      data: [
        { id: crimeA, code: `DA-${prefix}`, name: 'Tội lừa đảo chiếm đoạt tài sản', articleNo: 174, chapter: 'XVIII' },
        { id: crimeB, code: `DB-${prefix}`, name: 'Tội giết người', articleNo: 123, chapter: 'XIV' },
      ],
    });

    const base = { receivedDate: new Date('2026-10-08T00:00:00Z'), senderName: 'Nguyễn Văn Thử' };
    const target = await db.petition.create({
      data: {
        ...base,
        stt: stt('target'),
        soPhieuChuyen: 'A16763',
        nhanThay: 'Bị can do Tổ công tác Số 8 thụ lý',
        deXuat: 'Đề xuất giao đơn vị ngoài',
        huongXuLy: 'CHUYEN_DON',
        raSoatTrung: 'Trùng đơn gốc 2026-00001',
        baoCaoBanGiamDocText: 'Báo cáo BGĐ khẩn',
        ghiChuKhac: 'Ghi chú đặc biệt',
        phuongThucThuDoan: 'Giả danh cơ quan nhà nước',
        phanLoaiNguonTin: 'Tố giác ban đầu',
        laCongNgheCao: true,
        dieuTraVien: 'Nguyễn Văn Thử Việt',
        senderPhone: '0987654321',
        senderBirthYear: '1975',
        senderIdNumber: '079075009999',
        senderIdIssuePlace: 'Cục CSQLHC về TTXH',
        senderAddress: '99 Nguyễn Huệ, Quận 1',
        soQDPhanCongNguonTin: 'QD-PC-99',
        ngayQDPhanCongNguonTin: new Date('2026-08-02T00:00:00Z'),
        soQDTamDinhChiNguonTin: 'QD-TDC-99',
        ngayQDTamDinhChiNguonTin: new Date('2026-08-03T00:00:00Z'),
        canCuTamDinhChiNguonTin: 'Căn cứ điều 148',
        soPhucHoiNguonTin: 'PH-99',
        ngayPhucHoiNguonTin: new Date('2026-08-04T00:00:00Z'),
        thoiHanUTDT: new Date('2026-12-31T00:00:00Z'),
        crimeChinhId: crimeA,
        soTienBiThietHai: 1500.5,
        soLuongBiHai: 37,
        metadata: {
          soQuyetDinhKhoiTo: 'KT-99',
          ngayKhoiTo: '2026-09-12',
          toiDanhChinhKhoiToId: crimeB,
        },
      } as never,
    });
    const control = await db.petition.create({
      data: {
        ...base,
        stt: stt('control'),
        soPhieuChuyen: 'ZZZ',
        nhanThay: 'Không liên quan',
        huongXuLy: 'GIAO_DON',
        laCongNgheCao: false,
        soTienBiThietHai: 5,
        soLuongBiHai: 2,
        metadata: { soQuyetDinhKhoiTo: 'XX', ngayKhoiTo: '2019-01-01' },
      } as never,
    });
    targetId = target.id;
    controlId = control.id;
  }, 120_000);

  afterAll(async () => {
    await db.petition.deleteMany({ where: { stt: { startsWith: prefix } } });
    await db.crime.deleteMany({ where: { id: { in: [crimeA, crimeB] } } });
    await db.$disconnect();
  });

  // One row per tag: the tag key, and what an officer would type (accents stripped is enough, the box is accent-blind).
  const THE: Array<[string, string]> = [
    ['soPhieuChuyen', 'a16763'],
    ['nhanXet', 'to cong tac so 8'],
    ['deXuat', 'giao don vi ngoai'],
    ['huongXuLy', 'CHUYEN_DON'],
    ['ghiChuTrungDon', 'trung don goc'],
    ['baoCaoBanGiamDoc', 'bgd khan'],
    ['ghiChuKhac', 'dac biet'],
    ['phuongThucThuDoan', 'gia danh co quan'],
    ['phanLoaiNguonTin', 'to giac ban dau'],
    ['laCongNgheCao', 'co'],
    ['dieuTraVien', 'thu viet'],
    ['soDienThoai', '98765'],
    ['namSinh', '1975'],
    ['soCccd', '079075009999'],
    ['noiCapCccd', 'csqlhc'],
    ['diaChi', 'nguyen hue'],
    ['soQDPhanCongNguonTin', 'qd-pc-99'],
    ['ngayQDPhanCongNguonTin', '02/08/2026'],
    ['soQDTamDinhChiNguonTin', 'qd-tdc-99'],
    ['ngayQDTamDinhChiNguonTin', '03/08/2026'],
    ['canCuTamDinhChiNguonTin', 'dieu 148'],
    ['soPhucHoiNguonTin', 'ph-99'],
    ['ngayPhucHoiNguonTin', '04/08/2026'],
    ['thoiHanUTDT', '31/12/2026'],
    ['toiDanhChinh', 'lua dao'],
    ['soTienBiThietHai', '1.500,5'],
    ['soLuongBiHai', '37'],
    ['soQuyetDinhKhoiTo', 'kt-99'],
    ['ngayKhoiTo', '12/09/2026'],
    ['toiDanhChinhKhoiTo', 'giet nguoi'],
  ];

  it('covers every tag the declaration added', () => {
    expect(THE).toHaveLength(30);
  });

  it.each(THE)('tag %s finds the target and not the control (typing "%s")', async (key, go) => {
    expect(await tim(`${key}~${go}`)).toEqual([stt('target')]);
  });

  it('the "all columns" box finds a JSON text field, a JSON date and the initial crime name', async () => {
    expect(await tim('*~kt-99')).toEqual([stt('target')]);
    expect(await tim('*~12/09/2026')).toEqual([stt('target')]);
    expect(await tim('*~lua dao')).toEqual([stt('target')]);
    expect(await tim('*~nhan xet khong lien quan')).toEqual([]);
  });

  it('typing a number in the "all columns" box does NOT match a number field', async () => {
    // 37 is the target's victim count and appears in no text field.
    expect(await tim('*~37')).toEqual([]);
  });

  it('a JSON date stored as an ISO timestamp (migration style) is found on its calendar day', async () => {
    await db.petition.update({
      where: { id: controlId },
      data: { metadata: { ngayKhoiTo: '2020-01-12T00:00:00.000Z' } } as never,
    });
    expect(await tim('ngayKhoiTo~12/01/2020')).toEqual([stt('control')]);
    expect(await tim('ngayKhoiTo~01/2020')).toEqual([stt('control')]);
    expect(await tim('ngayKhoiTo~2020')).toEqual([stt('control')]);
  });

  it('editing ONLY metadata refreshes the JSON-backed shadows (the trigger listens to metadata)', async () => {
    await db.petition.update({
      where: { id: controlId },
      data: { metadata: { soQuyetDinhKhoiTo: 'MOI-123' } } as never,
    });
    expect(await tim('soQuyetDinhKhoiTo~moi-123')).toEqual([stt('control')]);
    expect(await tim('soQuyetDinhKhoiTo~xx')).toEqual([]);
  });

  it('a malformed JSON date never aborts the write and leaves the other shadows intact', async () => {
    await db.petition.update({
      where: { id: controlId },
      data: {
        nhanThay: 'Nhận xét sau khi sửa',
        metadata: { ngayKhoiTo: 'khong phai ngay', soQuyetDinhKhoiTo: 'OK-1' },
      } as never,
    });
    // The date shadow is NULL (not searchable) but the text shadows of the same row were still computed.
    expect(await tim('ngayKhoiTo~2026')).toEqual([stt('target')]);
    expect(await tim('nhanXet~sau khi sua')).toEqual([stt('control')]);
    expect(await tim('soQuyetDinhKhoiTo~ok-1')).toEqual([stt('control')]);
  });

  it('rows written BEFORE the migration are backfilled when it runs (refreshExisting)', async () => {
    // Simulate an old row: wipe its shadows without touching any source column (so no trigger fires).
    await db.$executeRawUnsafe(
      `UPDATE petitions SET so_phieu_chuyen_bd = NULL, nhan_thay_bd = NULL, so_quyet_dinh_khoi_to_bd = NULL,
         ngay_khoi_to_bd = NULL, toi_danh_chinh_khoi_to_bd = NULL, tim_kiem_bd = NULL WHERE id = '${targetId}'`,
    );
    // A real column falls back to its source column while the shadow is NULL, so the old row is still found...
    expect(await tim('soPhieuChuyen~a16763')).toEqual([stt('target')]);
    // ...but a JSON-backed field has no source column to fall back to: it is invisible until the shadow is loaded.
    // That is exactly why the migration backfills every row.
    expect(await tim('soQuyetDinhKhoiTo~kt-99')).toEqual([]);
    expect(await tim('ngayKhoiTo~12/09/2026')).toEqual([]);

    const thuMuc = thuMucMigrationTimKiemMoiNhat()!;
    const sql = fs.readFileSync(
      path.join(__dirname, '../../prisma/migrations', thuMuc, 'migration.sql'),
      'utf-8',
    );
    const client = new Client({ connectionString: diaChi! });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }

    expect(await tim('soPhieuChuyen~a16763')).toEqual([stt('target')]);
    expect(await tim('nhanXet~to cong tac so 8')).toEqual([stt('target')]);
    expect(await tim('soQuyetDinhKhoiTo~kt-99')).toEqual([stt('target')]);
    expect(await tim('ngayKhoiTo~12/09/2026')).toEqual([stt('target')]);
    expect(await tim('toiDanhChinhKhoiTo~giet nguoi')).toEqual([stt('target')]);
    expect(await tim('*~kt-99')).toEqual([stt('target')]);
  });
});
