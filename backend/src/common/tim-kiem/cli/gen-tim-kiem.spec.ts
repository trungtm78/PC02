import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KHAI_TIM_KIEM } from '../khai';
import {
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
} from '../sinh/sinh-tim-kiem';
import { chayGenTimKiem, dauThoiGian, type DuongDanGen } from './gen-tim-kiem';

/**
 * CLI bộ sinh — chạy trên THƯ MỤC TẠM, không đụng tệp thật của kho mã. Canh: chọn đúng migration để
 * ghi, tạo migration mới đúng tên, và báo thiếu field Prisma bằng mã thoát khác 0.
 */
describe('chayGenTimKiem', () => {
  let goc: string;
  let dd: DuongDanGen;
  const SCHEMA_DU = [
    'model Petition {',
    '  nguonDonBd        String? @map("nguon_don_bd")',
    '  senderNameBd      String? @map("sender_name_bd")',
    '  detailContentBd   String? @map("detail_content_bd")',
    '  donViGiaiQuyetBd  String? @map("don_vi_giai_quyet_bd")',
    '  ketQuaXuLyKhacBd  String? @map("ket_qua_xu_ly_khac_bd")',
    '  suspectedPersonBd String? @map("suspected_person_bd")',
    '  timKiemBd         String? @map("tim_kiem_bd")',
    '}',
    'model User {',
    '  hoTenBd             String?   @map("ho_ten_bd")',
    '}',
  ].join('\n');

  beforeEach(() => {
    goc = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-tim-kiem-'));
    dd = {
      thuMucMigration: path.join(goc, 'migrations'),
      tepFrontend: path.join(goc, 'frontend', 'generated.ts'),
      tepSchema: path.join(goc, 'schema.prisma'),
    };
    fs.mkdirSync(dd.thuMucMigration, { recursive: true });
    fs.writeFileSync(dd.tepSchema, SCHEMA_DU);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    fs.rmSync(goc, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('dauThoiGian: 14 chữ số theo giờ máy', () => {
    expect(dauThoiGian(new Date(2026, 8, 5, 7, 3, 9))).toBe('20260905070309');
  });

  it('--moi <ten>: tạo migration mới đúng tên + ghi tệp giao diện, thoát 0', () => {
    const ma = chayGenTimKiem(
      ['--moi', 'don_thu'],
      dd,
      KHAI_TIM_KIEM,
      new Date(2026, 8, 15, 6, 3, 5),
    );
    expect(ma).toBe(0);
    const tep = path.join(
      dd.thuMucMigration,
      '20260915060305_tim_kiem_don_thu',
      'migration.sql',
    );
    expect(fs.readFileSync(tep, 'utf8')).toBe(
      sinhMigrationTimKiem(KHAI_TIM_KIEM),
    );
    expect(fs.readFileSync(dd.tepFrontend, 'utf8')).toBe(
      sinhFrontendTimKiem(KHAI_TIM_KIEM),
    );
  });

  it('không cờ: ghi lại migration tìm kiếm MỚI NHẤT, không tạo thư mục mới', () => {
    for (const t of [
      '20260901000000_tim_kiem_cu',
      '20261001000000_tim_kiem_moi',
      '20260909150000_khac',
    ]) {
      fs.mkdirSync(path.join(dd.thuMucMigration, t));
    }
    expect(chayGenTimKiem([], dd)).toBe(0);
    expect(
      fs.existsSync(
        path.join(
          dd.thuMucMigration,
          '20261001000000_tim_kiem_moi',
          'migration.sql',
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          dd.thuMucMigration,
          '20260901000000_tim_kiem_cu',
          'migration.sql',
        ),
      ),
    ).toBe(false);
    expect(fs.readdirSync(dd.thuMucMigration)).toHaveLength(3);
  });

  it('không cờ mà chưa có migration tìm kiếm → thoát 2, không ghi gì', () => {
    expect(chayGenTimKiem([], dd)).toBe(2);
    expect(fs.existsSync(dd.tepFrontend)).toBe(false);
  });

  it.each([[['--moi']], [['--moi', 'Ten-Sai']]])(
    '--moi tên sai %j → thoát 2',
    (argv) => {
      expect(chayGenTimKiem(argv, dd)).toBe(2);
      expect(fs.readdirSync(dd.thuMucMigration)).toEqual([]);
    },
  );

  it('schema.prisma thiếu field → vẫn ghi tệp sinh nhưng thoát 1 và nêu field thiếu', () => {
    fs.writeFileSync(dd.tepSchema, 'model Petition {\n}\nmodel User {\n}\n');
    const loi = jest.spyOn(console, 'error');
    expect(chayGenTimKiem(['--moi', 'x'], dd)).toBe(1);
    expect(fs.existsSync(dd.tepFrontend)).toBe(true);
    expect(loi.mock.calls.flat().join('\n')).toContain(
      'senderNameBd String? @map("sender_name_bd")',
    );
  });
});
