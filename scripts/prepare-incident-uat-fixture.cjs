const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, sign, createHash } = require('node:crypto');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
const { buildTemplateDocx } = require('../backend/dist/prisma/seed-assets/document-templates/docx-builder.js');
const { detectDocxVariables } = require('../backend/dist/src/document-templates/docx-variables.util.js');
const { seedDeadlineRules } = require('../backend/dist/prisma/seed-deadline-rules.js');
const { seedLoaiTaiLieu } = require('../backend/dist/prisma/seed-loai-tai-lieu.js');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55441' || url.pathname !== '/pc02_incident_release_uat') throw new Error('Refuse non-isolated DB');
  const fixturePath = process.env.INCIDENT_BROWSER_FIXTURE;
  if (!fixturePath) throw new Error('Private synthetic fixture required');
  const f = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const key = fs.readFileSync(path.join(path.dirname(fixturePath), 'jwt-private.pem'));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const tag = randomUUID();
  const jwt = (user, role) => {
    const now = Math.floor(Date.now() / 1000);
    const data = [Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, email: '', role, canDispatch: user.canDispatch, type: 'access', tokenVersion: user.tokenVersion, iat: now, exp: now + 7200 })).toString('base64url')].join('.');
    return data + '.' + sign('RSA-SHA256', Buffer.from(data), key).toString('base64url');
  };
  try {
    await seedDeadlineRules(db);
    await seedLoaiTaiLieu(db);
    const source = await db.userTeam.findFirstOrThrow({ where: { userId: f.sender.user.id } });
    const outside = await db.team.create({ data: { name: 'UAT ngoài phạm vi ' + tag, code: 'UAT-OUT-' + tag } });
    const readPermissions = ['Incident', 'Case', 'Team', 'FeatureFlag', 'Directory', 'Catalog', 'Settings', 'User'];
    const makeRole = async (name, actions) => {
      const role = await db.role.upsert({ where: { name }, create: { name }, update: {} });
      for (const subject of readPermissions) for (const action of actions) {
        const permission = await db.permission.upsert({ where: { action_subject: { action, subject } }, create: { action, subject }, update: {} });
        await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
      }
      return role;
    };
    const readerRole = await makeRole('UAT_INCIDENT_READER_' + tag, ['read']);
    const editorRole = await makeRole('UAT_INCIDENT_EDITOR_' + tag, ['read', 'edit', 'write', 'delete']);
    const adminRole = await makeRole('ADMIN', ['read', 'edit', 'write', 'delete']);
    const makeUser = async (kind, role, teamId) => {
      const user = await db.user.create({ data: { username: 'uat_' + kind + '_' + tag, passwordHash: 'not-a-login-credential', roleId: role.id, totpEnabled: true } });
      if (teamId) await db.userTeam.create({ data: { userId: user.id, teamId } });
      const permissions = await db.rolePermission.findMany({ where: { roleId: role.id }, include: { permission: true } });
      return { token: jwt(user, role.name), user: { id: user.id, username: user.username, role: role.name, canDispatch: false, totpEnabled: true, permissions: permissions.map(p => `${p.permission.action}:${p.permission.subject}`), teams: [], primaryTeam: null } };
    };
    f.reader = await makeUser('reader', readerRole, f.toTeamId);
    f.outsider = await makeUser('outsider', editorRole, outside.id);
    f.grantee = await makeUser('read_grantee', editorRole, outside.id);
    f.editorTarget = await makeUser('editor_target', editorRole, f.toTeamId);
    f.admin = await makeUser('admin', adminRole, null);
    await db.dataAccessGrant.createMany({ data: [source.teamId, f.toTeamId].map(teamId => ({ granteeId: f.grantee.user.id, teamId, accessLevel: 'READ', grantedById: f.admin.user.id })) });
    for (const actor of ['sender', 'receiver']) {
      const user = await db.user.findUniqueOrThrow({ where: { id: f[actor].user.id }, include: { role: true } });
      if (!user.role.name.startsWith('UAT_INCIDENT_')) throw new Error('Refuse to alter non-synthetic fixture role');
      for (const action of ['read', 'write', 'edit', 'delete']) {
        const permission = await db.permission.upsert({ where: { action_subject: { action, subject: 'Document' } }, create: { action, subject: 'Document' }, update: {} });
        await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: user.roleId, permissionId: permission.id } }, create: { roleId: user.roleId, permissionId: permission.id }, update: {} });
      }
      f[actor].token = jwt(user, user.role.name);
    }
    await db.featureFlag.upsert({ where: { key: 'INCIDENT_INTAKE_HANDOFF' }, create: { key: 'INCIDENT_INTAKE_HANDOFF', label: 'UAT', enabled: true }, update: { enabled: true } });
    const create = (suffix, extra = {}) => db.incident.create({ data: {
      code: 'UAT-' + suffix + '-' + tag, name: 'Vụ việc UAT ' + suffix + ' ' + tag,
      description: tag + '/' + suffix + ' — Bản ghi kiểm chứng riêng', assignedTeamId: source.teamId,
      createdById: f.sender.user.id, intakeStage: 'PHAN_LOAI', status: 'TIEP_NHAN',
      ngayDeXuat: new Date('2026-10-06'), deadline: new Date('2026-10-26'), ...extra,
    } });
    f.uat = {
      pending: await create('pending'), admin: await create('admin'), mismatch: await create('mismatch'),
      prosecution: await create('prosecution', {
        intakeStage: 'DA_NHAN', status: 'DANG_XAC_MINH', assignedTeamId: f.toTeamId,
        benVu: 'Người cung cấp UAT ' + tag, sdtNguoiToGiac: '09' + String(parseInt(tag.replaceAll('-', '').slice(0, 8), 16)).padStart(8, '0').slice(-8), cmndNguoiToGiac: 'UAT-ID-' + tag,
        diaChiNguoiToGiac: 'Địa chỉ UAT', diaChiXayRa: tag,
        ngayTiepNhanNguonTin: new Date('2026-10-01'), fromDate: new Date('2026-09-29'),
        chuyenTuDonVi: 'Đơn vị cung cấp UAT', donViGiaiQuyet: 'Đơn vị xử lý UAT',
      }),
      history: await create('history', { intakeStage: 'DA_NHAN', status: 'DANG_XAC_MINH', assignedTeamId: f.toTeamId }),
      noHistory: await create('no-history', { intakeStage: null, legacyCollection: 'ho_so', status: 'TAM_DINH_CHI', assignedTeamId: f.toTeamId }),
    };
    const spec = { code: 'UAT_PERSISTED_DECISION_' + tag, entityType: 'VU_AN', name: 'UAT kiểm chứng quyết định đã lưu', category: 'Khác', sortOrder: 0, body: { coQuan: 'UAT LOCAL', tieuDe: 'KIỂM CHỨNG QUYẾT ĐỊNH', trichYeu: 'Dữ liệu kiểm thử', noiDung: [{ text: 'Vụ án: {tenVuAn}' }, { text: 'Số quyết định: {soQuyetDinhKhoiTo}' }, { text: 'Ngày quyết định: {ngayKhoiTo}' }] } };
    const bytes = await buildTemplateDocx(spec.body);
    const template = await db.documentTemplate.create({ data: { code: spec.code, name: spec.name, entityType: 'VU_AN', category: 'Khác', fileBytes: bytes, fileName: 'uat-decision.docx', fileSha: createHash('sha256').update(bytes).digest('hex'), createdById: f.admin.user.id, variables: detectDocxVariables(bytes).map(name => ({ name, label: name, field: name, source: 'auto', required: ['tenVuAn', 'soQuyetDinhKhoiTo', 'ngayKhoiTo'].includes(name) })) } });
    f.uat.templateId = template.id;
    for (const documentType of ['CASE', 'INCIDENT']) {
      if (!await db.documentNumberTemplate.findFirst({ where: { documentType, isActive: true } })) {
        await db.documentNumberTemplate.create({ data: { name: 'UAT ' + documentType, documentType, createdById: f.admin.user.id, separator: '-', segments: [{ type: 'LITERAL', value: 'UAT-' + documentType }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'NEVER', minValue: 1, maxValue: 999999, padding: 6 } } });
      }
    }
    f.uatTag = tag;
    fs.writeFileSync(fixturePath, JSON.stringify(f));
    console.log('Prepared isolated synthetic roles, READ grants, dossiers and numbering');
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
