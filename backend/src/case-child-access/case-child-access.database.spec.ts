import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { CaseChildAccessService } from './case-child-access.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { AuditService } from '../audit/audit.service';
import { SubjectsService } from '../subjects/subjects.service';
import { ConclusionsService } from '../conclusions/conclusions.service';
import { AdminService } from '../admin/admin.service';
import { EnrollmentService } from '../auth/services/enrollment.service';
import { configurationHash } from '../cases/governance/case-configuration.service';
import { CaseSourceCreationService } from './case-source-creation.service';
import { CaseFieldSchemaService } from '../cases/governance/case-field-schema.service';
import { IncidentsService } from '../incidents/incidents.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

const connection = process.env.CASE_GOVERNANCE_UAT_DATABASE_URL;
(connection ? describe : describe.skip)('CG14/CG-RP01 actual private PostgreSQL boundaries', () => {
  let db: PrismaClient;
  let child: CaseChildAccessService;
  let subjects: SubjectsService;
  let conclusions: ConclusionsService;
  let admin: AdminService;
  let enrollment: EnrollmentService;
  let actorId: string, managerId: string, businessId: string, ordinaryId: string, teamId: string, otherTeamId: string;
  let actorRoleId: string, businessRoleId: string;
  const prefix = 'cg-child-' + randomUUID();
  let normalId: string, restrictedId: string, hiddenNameId: string;

  beforeAll(async () => {
    const address = new URL(connection!);
    if (address.hostname !== '127.0.0.1' || address.port !== '55441' || address.pathname !== '/pc02_case_governance_uat') throw new Error('Private child UAT database target rejected');
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connection! }) });
    const actorRole = await db.role.create({ data: { name: prefix + '-technical' } });
    const managerRole = await db.role.create({ data: { name: prefix + '-manager' } });
    const businessRole = await db.role.create({ data: { name: prefix + '-business' } });
    const ordinaryRole = await db.role.create({ data: { name: prefix + '-ordinary' } });
    actorRoleId = actorRole.id; businessRoleId = businessRole.id;
    const grant = async (roleId: string, subject: string, action: string) => {
      const permission = await db.permission.findUnique({ where: { action_subject: { action, subject } } });
      if (!permission) throw new Error('Required registered permission unavailable: ' + subject + '.' + action);
      await db.rolePermission.create({ data: { roleId, permissionId: permission.id } });
    };
    for (const roleId of [actorRole.id, managerRole.id]) {
      for (const subject of ['Case', 'Subject']) for (const action of ['read','write','edit','delete']) await grant(roleId,subject,action);
      await grant(roleId,'User','write');
    }
    await grant(managerRole.id,'CaseGovernance','manage_access');
    await grant(businessRole.id,'CaseGovernance','review');
    const user = async (suffix: string, roleId: string) => (await db.user.create({ data: { username: prefix + suffix, passwordHash: 'synthetic-not-a-login', roleId, workId: prefix + suffix } })).id;
    actorId = await user('-actor',actorRole.id); managerId = await user('-manager',managerRole.id); businessId = await user('-business',businessRole.id); ordinaryId = await user('-ordinary',ordinaryRole.id);
    teamId = (await db.team.create({ data: { name: prefix, code: prefix } })).id;
    otherTeamId = (await db.team.create({ data: { name: prefix + '-foreign', code: prefix + '-foreign' } })).id;
    for (const userId of [actorId,managerId,businessId]) await db.userTeam.create({ data: { userId, teamId } });
    const core = new CaseGovernanceService(db as never);
    child = new CaseChildAccessService(db as never,core);
    const audit = new AuditService(db as never);
    subjects = new SubjectsService(db as never,audit,child);
    conclusions = new ConclusionsService(db as never,audit,child);
    enrollment = new EnrollmentService(db as never,audit,{ get: () => 'http://127.0.0.1/private-uat' } as never,{} as never);
    admin = new AdminService(db as never,audit,{} as never,enrollment);
    const createCase = async (name: string, extra: Prisma.CaseUncheckedCreateInput = { name: '', caseProvenance: 'DIRECT_DISCOVERY' }) => (await db.case.create({ data: { ...extra, name, caseProvenance: 'DIRECT_DISCOVERY', sourceDocumentNote: 'Synthetic child ACL evidence', assignedTeamId: teamId, investigatorId: actorId } })).id;
    normalId = await createCase(prefix + '-normal');
    restrictedId = await createCase(prefix + '-restricted',{ name: '', caseProvenance: 'DIRECT_DISCOVERY', sensitivity: 'RESTRICTED' });
    const definition = { fields: [], fieldPolicies: [{ key: 'name', sensitivity: 'RESTRICTED' }] };
    const schema = await db.caseFieldDefinitionVersion.create({ data: { code: prefix, definition, contentHash: configurationHash(definition), status: 'PUBLISHED', authorId: managerId, publishedAt: new Date() } });
    hiddenNameId = await createCase(prefix + '-private-name',{ name: '', caseProvenance: 'DIRECT_DISCOVERY', fieldDefinitionVersionId: schema.id });
    for (const caseId of [normalId,restrictedId,hiddenNameId]) {
      await db.subject.create({ data: { caseId, fullName: prefix + '-public-child' } });
      await db.conclusion.create({ data: { caseId, type: 'KET_LUAN_DIEU_TRA', content: 'Synthetic conclusion', authorId: actorId } });
    }
  }, 30000);
  afterAll(async () => { await db?.$disconnect(); });

  it('child list/count/detail exclude restricted parent with null cached scope', async () => {
    const result = await subjects.getList({ limit: 100 } as never,null,actorId);
    expect(result.total).toBe(2);
    expect(result.data.map(row => row.caseId).sort()).toEqual([normalId,hiddenNameId].sort());
    const restricted = await db.conclusion.findFirstOrThrow({ where: { caseId: restrictedId } });
    await expect(conclusions.getById(restricted.id,null,actorId)).rejects.toMatchObject({ status: 403 });
  });
  it('pinned private parent name is removed from hydration and cannot match child token search/count', async () => {
    const rows = await subjects.getList({ caseId: hiddenNameId } as never,null,actorId);
    expect(rows.data[0]!.case).not.toHaveProperty('name');
    const hidden = await subjects.getList({ tk: ['vuAn~' + prefix + '-private-name'] } as never,null,actorId);
    expect(hidden.total).toBe(0);
    expect(hidden.data).toEqual([]);
    const normal = await subjects.getList({ tk: ['vuAn~' + prefix + '-normal'] } as never,null,actorId);
    expect(normal.total).toBe(1);
  });
  it('exact unexpired sensitive grant permits only its Case and revocation immediately removes it', async () => {
    const grant = await db.caseGovernanceGrant.create({ data: { caseId: restrictedId, granteeId: actorId, createdById: managerId, startsAt: new Date(), expiresAt: new Date(Date.now() + 3600000), capabilities: ['read_sensitive'] } });
    expect((await subjects.getList({ caseId: restrictedId } as never,null,actorId)).total).toBe(1);
    await db.caseGovernanceGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    expect((await subjects.getList({ caseId: restrictedId } as never,null,actorId)).total).toBe(0);
  });
  it('ordinary child create bumps parent revision and writes its audit in the transaction', async () => {
    const before = await db.case.findUniqueOrThrow({ where: { id: normalId } });
    const result = await conclusions.create({ caseId: normalId, type: 'KET_LUAN_DIEU_TRA', content: 'Atomic synthetic conclusion' } as never,actorId);
    const after = await db.case.findUniqueOrThrow({ where: { id: normalId } });
    expect(after.governanceRevision).toBe(before.governanceRevision + 1);
    expect(await db.auditLog.count({ where: { subjectId: result.data.id, action: 'CONCLUSION_CREATED' } })).toBe(1);
  });
  it('pending Case freezes child mutations without changing parent/child/audit', async () => {
    const pending = await db.case.create({ data: { name: prefix + '-pending', caseProvenance: 'DIRECT_DISCOVERY', assignedTeamId: teamId, investigatorId: actorId, intakeStage: 'CHO_NHAN' } });
    await expect(conclusions.create({ caseId: pending.id, type: 'KET_LUAN_DIEU_TRA', content: 'Cannot persist' } as never,actorId)).rejects.toMatchObject({ status: 409 });
    expect(await db.conclusion.count({ where: { caseId: pending.id } })).toBe(0);
    expect((await db.case.findUniqueOrThrow({ where: { id: pending.id } })).governanceRevision).toBe(pending.governanceRevision);
  });
  it('injected handler fault rolls back child, audit, and parent CAS together', async () => {
    const before = await db.case.findUniqueOrThrow({ where: { id: normalId } });
    const marker = prefix + '-fault';
    await expect(child.write([normalId],actorId,'Case','edit',async tx => {
      await tx.conclusion.create({ data: { caseId: normalId, type: 'KET_LUAN_DIEU_TRA', content: marker, authorId: actorId } });
      await tx.auditLog.create({ data: { action: marker, subject: 'Case', subjectId: normalId, userId: actorId } });
      throw new Error('Synthetic rollback fault');
    })).rejects.toThrow('Synthetic rollback fault');
    expect(await db.conclusion.count({ where: { content: marker } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: marker } })).toBe(0);
    expect((await db.case.findUniqueOrThrow({ where: { id: normalId } })).governanceRevision).toBe(before.governanceRevision);
  });
  it('a concurrent responsibility change cannot commit a stale child write or its audit', async () => {
    const raceCase = await db.case.create({ data: { name: prefix + '-race', caseProvenance: 'DIRECT_DISCOVERY', assignedTeamId: teamId, investigatorId: actorId } });
    let signal!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { signal = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    const marker = prefix + '-race-child';
    const writing = child.write([raceCase.id],actorId,'Case','edit',async tx => {
      signal(); await proceed;
      await tx.conclusion.create({ data: { caseId: raceCase.id, type: 'KET_LUAN_DIEU_TRA', content: marker, authorId: actorId } });
      await tx.auditLog.create({ data: { action: marker, subject: 'Case', subjectId: raceCase.id, userId: actorId } });
    });
    const rejected = expect(writing).rejects.toMatchObject({ status: 409 });
    await entered;
    await db.case.update({ where: { id: raceCase.id }, data: { assignedTeamId: otherTeamId, investigatorId: null, governanceRevision: { increment: 1 } } });
    release(); await rejected;
    expect(await db.conclusion.count({ where: { content: marker } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: marker } })).toBe(0);
  });
  it('technical User.write cannot reset or issue enrollment for business account; delegated scoped manager can', async () => {
    await expect(admin.adminResetTwoFa(businessId,actorId)).rejects.toMatchObject({ status: 403 });
    await expect(enrollment.generateEnrollmentLink(businessId,actorId)).rejects.toMatchObject({ status: 403 });
    await expect(admin.adminResetTwoFa(businessId,managerId)).resolves.toHaveProperty('success',true);
    await expect(enrollment.generateEnrollmentLink(businessId,managerId)).resolves.toHaveProperty('url');
  });
  it('ordinary global account maintenance remains available, and ordinary-to-business acquisition invalidates the old token', async () => {
    const issued = await enrollment.generateEnrollmentLink(ordinaryId,actorId);
    const rawToken = new URL(issued.url).searchParams.get('token')!;
    await db.userTeam.create({ data: { userId: ordinaryId, teamId } });
    const result = await admin.updateUser(ordinaryId,{ roleId: businessRoleId, workId: prefix + '-ordinary' },managerId);
    expect(result).toHaveProperty('requiresBusinessEnrollment',true);
    const current = await db.user.findUniqueOrThrow({ where: { id: ordinaryId } });
    expect(current.enrollmentTokenHash).toBeNull();
    expect(current.refreshTokenHash).toBeNull();
    expect(current.tokenVersion).toBe(1);
    await expect(enrollment.consumeEnrollmentToken(ordinaryId,rawToken,'SyntheticPass1!',{})).rejects.toMatchObject({ status: 401 });
  });
  it('current child role revocation denies new mutation despite the same actor identifier', async () => {
    const permission = await db.permission.findUniqueOrThrow({ where: { action_subject: { action: 'edit', subject: 'Case' } } });
    await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: actorRoleId, permissionId: permission.id } } });
    await expect(child.write([normalId],actorId,'Case','read',async () => 'stale actor')).rejects.toMatchObject({ status: 403 });
  });
  it('governed source deletion preserves both live FK directions and does not invoke its mutation', async () => {
    const manager = await db.user.findUniqueOrThrow({ where: { id: managerId } });
    const permission = await db.permission.upsert({ where: { action_subject: { action: 'delete',subject: 'Incident' } },create: { action: 'delete',subject: 'Incident' },update: {} });
    await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: manager.roleId,permissionId: permission.id } },create: { roleId: manager.roleId,permissionId: permission.id },update: {} });
    const source = await db.incident.create({ data: { code: prefix + '-preserved-source',name: 'Synthetic preserved source',incidentType: 'Synthetic',assignedTeamId: teamId,investigatorId: managerId } });
    const parent = await db.case.create({ data: { name: prefix + '-preserved-parent',caseProvenance: 'FROM_INCIDENT',linkedIncidentId: source.id,assignedTeamId: teamId,investigatorId: managerId,governanceRevision: 1 } });
    await db.incident.update({ where: { id: source.id },data: { linkedCaseId: parent.id } });
    const handler = jest.fn(async () => 'deleted');
    await expect(child.sourceDeletion('Incident',source.id,managerId,handler)).rejects.toMatchObject({ status: 409 });
    expect(handler).not.toHaveBeenCalled();
    expect((await db.incident.findUniqueOrThrow({ where: { id: source.id } })).linkedCaseId).toBe(parent.id);
    expect((await db.case.findUniqueOrThrow({ where: { id: parent.id } })).linkedIncidentId).toBe(source.id);
  });
  it('business scope grant requires current authority and owned destination while ordinary source fault is atomic', async () => {
    await db.userTeam.update({ where: { userId_teamId: { userId: managerId,teamId } },data: { isLeader: true } });
    await expect(admin.createDataAccessGrant({ granteeId: businessId,teamId,accessLevel: 'WRITE' },actorId)).rejects.toMatchObject({ status: 403 });
    await expect(admin.createDataAccessGrant({ granteeId: businessId,teamId: otherTeamId,accessLevel: 'WRITE' },managerId)).rejects.toMatchObject({ status: 403 });
    const grant = await admin.createDataAccessGrant({ granteeId: businessId,teamId,accessLevel: 'READ' },managerId);
    expect(await db.auditLog.count({ where: { subjectId: grant.id,action: 'DATA_GRANT_CREATED' } })).toBe(1);
    const source = await db.incident.create({ data: { code: prefix + '-delete-fault',name: 'Synthetic source fault',incidentType: 'Synthetic',assignedTeamId: teamId,investigatorId: managerId } });
    await expect(child.sourceDeletion('Incident',source.id,managerId,async tx => {
      await tx.incident.update({ where: { id: source.id },data: { deletedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: managerId,action: prefix + '-source-fault',subject: 'Incident',subjectId: source.id } });
      throw new Error('Synthetic source rollback');
    })).rejects.toThrow('Synthetic source rollback');
    expect((await db.incident.findUniqueOrThrow({ where: { id: source.id } })).deletedAt).toBeNull();
    expect(await db.auditLog.count({ where: { subjectId: source.id } })).toBe(0);
  });
  it('actual explicit source conversion binds Case authority, typed default values, counter, lineage and idempotent replay', async () => {
    const core = new CaseGovernanceService(db as never), fields = new CaseFieldSchemaService(db as never,core);
    const creator = new CaseSourceCreationService(db as never,core,fields);
    const manager = await db.user.findUniqueOrThrow({ where: { id: managerId } });
    for (const [subject,action] of [['Incident','edit'],['CaseGovernance','operate'],['CaseGovernance','read_sensitive']] as const) {
      const permission = await db.permission.upsert({ where: { action_subject: { subject,action } },create: { subject,action },update: {} });
      await db.rolePermission.create({ data: { roleId: manager.roleId, permissionId: permission.id } });
    }
    const documentType = 'CASE_PRIVATE_' + randomUUID();
    const template = await db.documentNumberTemplate.create({ data: { name: prefix + '-source-counter', documentType, createdById: managerId, segments: [{ type: 'LITERAL',value: prefix },{ type: 'COUNTER' }], counterConfig: { resetPeriod: 'NEVER', minValue: 1, maxValue: 999999, padding: 6 } } });
    const numbers = new DocumentNumbersService(db as never);
    const isolatedNumbers = { commitWithTx: (_type: string,context: { userId: string },tx: Prisma.TransactionClient) => numbers.commitWithTx(documentType,context,tx) };
    const incidents = new IncidentsService(db as never,new AuditService(db as never),{} as never,{} as never,isolatedNumbers as never,{ emit: () => false } as never,creator,child);
    const source = await db.incident.create({ data: { code: prefix + '-explicit-source', name: prefix + '-explicit-source', incidentType: 'Synthetic criminal source', status: 'DANG_XAC_MINH', intakeStage: 'DA_NHAN', assignedTeamId: teamId, investigatorId: managerId } });
    const schema = await db.caseFieldDefinitionVersion.findFirst({ where: { code: 'default',status: 'PUBLISHED' },orderBy: { revision: 'desc' } });
    const definition = schema?.definition as { fields?: { key: string; type: string; options?: string[] }[] } | undefined;
    const caseCustomFields = Object.fromEntries((definition?.fields ?? []).map(field => [field.key,field.type === 'boolean' ? false : field.type === 'number' ? 0 : field.type === 'date' ? '2026-10-06' : field.type === 'select' ? field.options![0] : 'Synthetic required source value']));
    const input = { caseName: prefix + '-explicit-case', prosecutionDecision: 'SYNTHETIC-QD', prosecutionDate: '2026-10-01', expectedUpdatedAt: source.updatedAt.toISOString(), requestKey: prefix + '-source-command', caseCustomFields };
    const first = await incidents.prosecute(source.id,input,managerId);
    const second = await incidents.prosecute(source.id,input,managerId);
    expect(second.data.case.id).toBe(first.data.case.id);
    expect(await db.case.count({ where: { linkedIncidentId: source.id } })).toBe(1);
    expect(await db.documentNumberLog.count({ where: { templateId: template.id } })).toBe(1);
    expect(await db.caseGovernanceOperation.count({ where: { caseId: first.data.case.id, operation: 'SOURCE_INCIDENT_CASE_CREATE' } })).toBe(1);
    expect(await db.caseGovernanceOutbox.count({ where: { caseId: first.data.case.id } })).toBe(1);
    expect((await db.case.findUniqueOrThrow({ where: { id: first.data.case.id } })).investigationPhase).toBeNull();
    const caseWrite = await db.permission.findUniqueOrThrow({ where: { action_subject: { action: 'write',subject: 'Case' } } });
    await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: manager.roleId,permissionId: caseWrite.id } } });
    await expect(incidents.prosecute(source.id,input,managerId)).rejects.toMatchObject({ status: 403 });
    expect(await db.documentNumberLog.count({ where: { templateId: template.id } })).toBe(1);
  });
});
