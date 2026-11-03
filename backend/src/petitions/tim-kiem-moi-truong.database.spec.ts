import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { docThe, dungDieuKienTimKiem } from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM } from '../common/tim-kiem/khai';
import { KHAI_TIM_KIEM_DON_THU } from '../common/tim-kiem/khai/don-thu.khai';
import { sinhCacCauNap } from '../common/tim-kiem/sinh/sinh-tim-kiem';
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
  const tim = async (
    tk: string,
    luiCotGoc?: boolean,
  ): Promise<string[]> => {
    const dieuKien = dungDieuKienTimKiem(
      docThe([tk], KHAI_TIM_KIEM_DON_THU),
      KHAI_TIM_KIEM_DON_THU,
      luiCotGoc === undefined ? undefined : { luiCotGoc },
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
    if (
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/pc02_goiy_scope_test'
    ) {
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

    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: diaChi! }),
    });
    await db.crime.createMany({
      data: [
        {
          id: crimeA,
          code: `DA-${prefix}`,
          name: 'Tội lừa đảo chiếm đoạt tài sản',
          articleNo: 174,
          chapter: 'XVIII',
        },
        {
          id: crimeB,
          code: `DB-${prefix}`,
          name: 'Tội giết người',
          articleNo: 123,
          chapter: 'XIV',
        },
      ],
    });

    const base = {
      receivedDate: new Date('2026-10-08T00:00:00Z'),
      senderName: 'Nguyễn Văn Thử',
    };
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

  it.each(THE)(
    'tag %s finds the target and not the control (typing "%s")',
    async (key, go) => {
      expect(await tim(`${key}~${go}`)).toEqual([stt('target')]);
    },
  );

  it('the "all columns" box finds a JSON text field, a JSON date and the initial crime name', async () => {
    expect(await tim('*~kt-99')).toEqual([stt('target')]);
    expect(await tim('*~12/09/2026')).toEqual([stt('target')]);
    expect(await tim('*~lua dao')).toEqual([stt('target')]);
    expect(await tim('*~nhan xet khong lien quan')).toEqual([]);
  });

  it('long free text is tag-only: the "all columns" box does not search it, its own tag does', async () => {
    // Nhận xét / Đề xuất stay out of the combined shadow (measured: putting them in made common terms 2-5x slower).
    expect(await tim('*~to cong tac so 8')).toEqual([]);
    expect(await tim('*~giao don vi ngoai')).toEqual([]);
    expect(await tim('nhanXet~to cong tac so 8')).toEqual([stt('target')]);
    expect(await tim('deXuat~giao don vi ngoai')).toEqual([stt('target')]);
    // Short identifiers are still reachable from the box.
    expect(await tim('*~a16763')).toEqual([stt('target')]);
    expect(await tim('*~079075009999')).toEqual([stt('target')]);
    expect(await tim('*~nguyen hue')).toEqual([stt('target')]);
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

  it('rows written BEFORE the migration: new tags wait for the batch loader (the combined shadow is stale, not NULL)', async () => {
    // The REAL state right after the migration: the new shadow columns are NULL, but the combined `tim_kiem_bd` still
    // holds the OLD value. The server only falls back to the source columns while some row has `tim_kiem_bd IS NULL`
    // (`BoTimKiem.luiCotGoc`), so here the fallback is OFF. Simulate it without touching any source column (no trigger).
    await db.$executeRawUnsafe(
      `UPDATE petitions SET so_phieu_chuyen_bd = NULL, nhan_thay_bd = NULL, so_quyet_dinh_khoi_to_bd = NULL,
         ngay_khoi_to_bd = NULL, toi_danh_chinh_khoi_to_bd = NULL WHERE id = '${targetId}'`,
    );
    // Contract, stated on purpose: until `nap-cot-bong-tim-kiem --that` has run, the NEW tags do not find old rows -
    // not even those on real columns. `deploy.sh` step 9e reports the unloaded rows and ends red until then.
    expect(await tim('soPhieuChuyen~a16763', false)).toEqual([]);
    expect(await tim('nhanXet~to cong tac so 8', false)).toEqual([]);
    expect(await tim('soQuyetDinhKhoiTo~kt-99', false)).toEqual([]);
    // The "all columns" line keeps working on the old aggregate (it still holds the old fields).
    expect(await tim('*~nguyen van', false)).toEqual([stt('control'), stt('target')]);

    // When some row IS unloaded (`tim_kiem_bd IS NULL`) the fallback is on and a real column is found through its
    // source column (the fallback compares the raw text, accents included); a JSON-backed field has no source column.
    expect(await tim('soPhieuChuyen~a16763', true)).toEqual([stt('target')]);
    expect(await tim('nhanXet~Tổ công tác Số 8', true)).toEqual([stt('target')]);
    expect(await tim('soQuyetDinhKhoiTo~kt-99', true)).toEqual([]);

    // The batch loader (`nap-cot-bong-tim-kiem --that`) runs exactly this statement for a batch of ids.
    const nap = sinhCacCauNap(KHAI_TIM_KIEM).find((c) => c.bang === 'petitions')!.cau.nap;
    const client = new Client({ connectionString: diaChi! });
    await client.connect();
    try {
      const ra = await client.query(nap, [[targetId]]);
      expect(ra.rowCount).toBe(1);
      // Idempotent: a second run finds nothing left to write.
      const lai = await client.query(nap, [[targetId]]);
      expect(lai.rowCount).toBe(0);
    } finally {
      await client.end();
    }

    expect(await tim('soPhieuChuyen~a16763', false)).toEqual([stt('target')]);
    expect(await tim('nhanXet~to cong tac so 8', false)).toEqual([stt('target')]);
    expect(await tim('soQuyetDinhKhoiTo~kt-99', false)).toEqual([stt('target')]);
    expect(await tim('ngayKhoiTo~12/09/2026', false)).toEqual([stt('target')]);
    expect(await tim('toiDanhChinhKhoiTo~giet nguoi', false)).toEqual([stt('target')]);
    expect(await tim('*~kt-99', false)).toEqual([stt('target')]);
  });
});
