const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

const databaseUrl = 'postgresql://petition_test@127.0.0.1:55439/petition_search_test';
const output = path.resolve(__dirname, '../../test-results/petition-local');

async function main() {
  const sql = new Client({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  await sql.connect();
  try {
    const role = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const permission = await prisma.permission.upsert({
      where: { action_subject: { action: 'read', subject: 'Petition' } },
      update: {}, create: { action: 'read', subject: 'Petition' },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {}, create: { roleId: role.id, permissionId: permission.id },
    });
    const password = crypto.randomBytes(24).toString('base64url');
    const user = await prisma.user.upsert({
      where: { username: 'petition_search_uat' },
      update: { passwordHash: await bcrypt.hash(password, 10), twoFaSetupRequired: false },
      create: { username: 'petition_search_uat', passwordHash: await bcrypt.hash(password, 10), roleId: role.id, lastName: 'Kiểm', firstName: 'Tìmkiếm', twoFaSetupRequired: false },
    });
    const officerRole = await prisma.role.upsert({ where: { name: 'OFFICER' }, update: {}, create: { name: 'OFFICER' } });
    await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: officerRole.id, permissionId: permission.id } }, update: {}, create: { roleId: officerRole.id, permissionId: permission.id } });
    const officer = await prisma.user.upsert({ where: { username: 'petition_scope_uat' }, update: { passwordHash: await bcrypt.hash(password, 10), twoFaSetupRequired: false }, create: { username: 'petition_scope_uat', passwordHash: await bcrypt.hash(password, 10), roleId: officerRole.id, twoFaSetupRequired: false } });
    for (const suffix of ['1', '2']) {
      await prisma.petition.upsert({ where: { stt: `2099-70000${suffix}` }, update: {}, create: { stt: `2099-70000${suffix}`, senderName: `Paginationprobe ${suffix}`, receivedDate: new Date('2019-01-01T05:00:00Z'), enteredById: officer.id, status: 'DANG_XU_LY' } });
    }
    await prisma.featureFlag.upsert({ where: { key: 'TIM_KIEM_THE' }, update: { enabled: true }, create: { key: 'TIM_KIEM_THE', label: 'Search chips', enabled: true } });
    await prisma.systemSetting.upsert({ where: { key: 'THONG_KE_KY' }, update: { value: 'TAT_CA' }, create: { key: 'THONG_KE_KY', value: 'TAT_CA', label: 'Isolated UAT period' } });
    const migrations = path.resolve(__dirname, '../prisma/migrations');
    const indexMigration = fs.readdirSync(migrations).find(name => name.endsWith('_tim_kiem_petition_all_columns'));
    const fixture = await prisma.petition.upsert({
      where: { stt: '2099-987654' }, update: {},
      create: {
        stt: '2099-987654', sttCu: 'old987654', receivedDate: new Date('2026-01-11T05:00:00Z'),
        senderName: 'Nguyễn Searchsender', enteredById: user.id, loaiThongTin: 'Tố giác Searchtype',
        nguonDon: 'Searchsource', detailContent: 'Searchsummary', donViGiaiQuyet: 'Searchunit',
        ketQuaXuLyKhac: 'Searchresult', suspectedPerson: 'Searchsuspect', ngayVietDonChu: 'Sau tết Searchdate',
        deadline: new Date('2030-02-12T05:00:00Z'), createdAt: new Date('2020-03-13T05:00:00Z'),
        ngayDeXuat: new Date('2026-04-14T05:00:00Z'), ngayTiepNhanNguonTin: new Date('2026-05-15T05:00:00Z'),
        petitionDate: new Date('2026-06-16T05:00:00Z'), ngayGiaoDonViGiaiQuyet: new Date('2026-07-17T05:00:00Z'),
        ngayPhieuChuyen: new Date('2026-08-18T05:00:00Z'), senderIdIssueDate: new Date('2026-09-19T05:00:00Z'),
      },
    });
    await sql.query('UPDATE petitions SET tim_kiem_bd = $1, loai_thong_tin_bd = NULL WHERE id = $2', [' old initialized aggregate', fixture.id]);
    const before = await sql.query('SELECT "updatedAt", tim_kiem_bd FROM petitions WHERE id=$1', [fixture.id]);
    await sql.query(fs.readFileSync(path.join(migrations, indexMigration, 'migration.sql'), 'utf8'));
    await sql.query('UPDATE users SET "firstName" = "firstName"');
    const after = await sql.query('SELECT "updatedAt", tim_kiem_bd, loai_thong_tin_bd FROM petitions WHERE id=$1', [fixture.id]);
    assert.match(after.rows[0].tim_kiem_bd, /searchtype/);
    assert.match(after.rows[0].tim_kiem_bd, /sau tet searchdate/);
    assert.equal(after.rows[0].updatedAt.toISOString(), before.rows[0].updatedAt.toISOString());
    assert.match(after.rows[0].loai_thong_tin_bd, /to giac searchtype/);
    await prisma.petition.update({ where: { id: fixture.id }, data: { loaiThongTin: 'Tố giác Searchtypeupdated' } });
    const updated = await sql.query('SELECT tim_kiem_bd, loai_thong_tin_bd FROM petitions WHERE id=$1', [fixture.id]);
    assert.match(updated.rows[0].tim_kiem_bd, /searchtypeupdated/);
    assert.match(updated.rows[0].loai_thong_tin_bd, /searchtypeupdated/);
    await prisma.petition.update({ where: { id: fixture.id }, data: { loaiThongTin: 'Tố giác Searchtype' } });
    const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    if (!fs.existsSync(path.join(output, 'private.pem'))) {
      fs.writeFileSync(path.join(output, 'private.pem'), keys.privateKey);
      fs.writeFileSync(path.join(output, 'public.pem'), keys.publicKey);
    }
    fs.writeFileSync(path.join(output, 'runtime.json'), JSON.stringify({ username: user.username, officerUsername: officer.username, password, id: fixture.id, databaseUrl }));
    console.log('Isolated fixture ready; stale non-null backfill, unchanged timestamps and update triggers verified.');
  } finally {
    await prisma.$disconnect();
    await sql.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
