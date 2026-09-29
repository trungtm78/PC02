import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { danhSachMigration } from './cli/bootstrap-fresh-db';

/**
 * Thứ tự áp migration phải là thứ tự CHỮ CÁI của tên thư mục — đúng cách Prisma làm.
 * Sai thứ tự thì `migrate resolve` đánh dấu lệch và lần deploy sau chạy nhầm.
 */
describe('bootstrap-fresh-db — liệt kê migration', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const tao = (ten: string, coSql = true) => {
    fs.mkdirSync(path.join(tmp, ten));
    if (coSql) fs.writeFileSync(path.join(tmp, ten, 'migration.sql'), '-- x');
  };

  it('trả về theo thứ tự chữ cái, đúng thứ tự Prisma áp', () => {
    tao('20260826010000_b');
    tao('20260227000000_a');
    tao('99999999999999_z');
    expect(danhSachMigration(tmp)).toEqual([
      '20260227000000_a',
      '20260826010000_b',
      '99999999999999_z',
    ]);
  });

  it('bỏ qua thư mục không có migration.sql — không đánh dấu nhầm', () => {
    tao('20260101000000_that', true);
    tao('20260102000000_rong', false);
    expect(danhSachMigration(tmp)).toEqual(['20260101000000_that']);
  });

  it('bỏ qua tệp lẻ nằm cạnh các thư mục migration', () => {
    tao('20260101000000_that');
    fs.writeFileSync(path.join(tmp, 'migration_lock.toml'), 'x');
    expect(danhSachMigration(tmp)).toEqual(['20260101000000_that']);
  });

  it('kho mã thật: liệt kê được đủ migration, không sót', () => {
    const that = path.resolve(__dirname, '../../prisma/migrations');
    const ds = danhSachMigration(that);
    expect(ds.length).toBeGreaterThan(80);
    // Migration đầu tiên chính là chỗ hỏng khi dựng từ số không.
    expect(ds[0]).toBe('20260227000000_add_case_metadata');
  });

  it('Mobile E2E dựng database trống bằng bootstrap trước khi seed', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../../../.github/workflows/mobile-e2e.yml'),
      'utf8',
    );

    expect(workflow).toContain(
      'npx ts-node src/legacy-migration/cli/bootstrap-fresh-db.ts',
    );
    expect(workflow).toContain(
      'SEED_ADMIN_PASSWORD=$(openssl rand -base64 32)',
    );
    expect(workflow).toContain(
      'JWT_PRIVATE_KEY_PATH=$RUNNER_TEMP/pc02-e2e-keys/private.pem',
    );
    expect(workflow).toContain(
      'JWT_PUBLIC_KEY_PATH=$RUNNER_TEMP/pc02-e2e-keys/public.pem',
    );
    expect(workflow).toContain(
      'MAESTRO_FIXTURE_API_BASE_URL: http://127.0.0.1:${{ env.BACKEND_PORT }}/api/v1',
    );
    expect(workflow).not.toContain('export MAESTRO_');
    expect(workflow).not.toContain('npx prisma migrate deploy');
  });

  it('các flow Maestro dùng script thật và cú pháp chờ hợp lệ', () => {
    const flowsDir = path.resolve(__dirname, '../../../mobile/.maestro/flows');
    const flows = fs
      .readdirSync(flowsDir)
      .filter((file) => file.endsWith('.yaml'))
      .map((file) => fs.readFileSync(path.join(flowsDir, file), 'utf8'))
      .join('\n');

    expect(flows).toContain('runScript:');
    expect(flows).not.toContain('evalScript: |');
    expect(flows).not.toMatch(/assertVisible:\s*\n(?:\s+.*\n)*?\s+timeout:/);
    expect(flows).not.toContain('2fa-submit-button');
  });
});
