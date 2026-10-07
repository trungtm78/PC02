import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { openEvidenceFile } from '../cases/evidence-governance/evidence-file-integrity';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { CaseEvidenceGovernanceService } from '../cases/evidence-governance/evidence-governance.service';
describe('CG-R03 hydration rechecks before transmitting verified bytes', () => {
  let root: string;
  const bytes = Buffer.from('private synthetic original');
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc02-hydration-'));
    await writeFile(join(root, 'original.bin'), bytes, { flag: 'wx' });
  });
  afterEach(async () => {
    if (!root.startsWith(join(tmpdir(), 'pc02-hydration-')))
      throw new Error('Unsafe cleanup');
    await rm(root, { recursive: true, force: true });
  });
  function fixture(registered = false) {
    const record = {
      id: 'doc1',
      caseId: 'case1',
      incidentId: null,
      petitionId: null,
      updatedAt: new Date('2026-10-06'),
      fileName: 'original.bin',
      originalName: 'synthetic.bin',
      mimeType: 'application/octet-stream',
      size: bytes.length,
      case: { id: 'case1' },
    };
    const asset = registered ? { id: 'asset1', caseId: 'case1' } : null;
    const prisma = {
      document: { findFirst: jest.fn().mockResolvedValue(record) },
      caseAssetVersion: { findUnique: jest.fn().mockResolvedValue(asset) },
      caseEvidenceHold: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const core = { assertCaseReadable: jest.fn() };
    const evidence = {
      authorizeLegacyDocumentRead: jest.fn().mockResolvedValue({
        scope: null,
        caseVisible: true,
        fieldDefinitionVersionId: null,
      }),
      filterDocumentCase: jest.fn((record: unknown) => Promise.resolve(record)),
      authorizeDocumentDownload: jest
        .fn()
        .mockResolvedValue({ mode: 'INTERNAL', revision: 0 }),
      authorizeAsset: jest.fn(),
      verifiedAsset: jest.fn(async () =>
        openEvidenceFile(root, 'original.bin'),
      ),
    };
    const audit = { log: jest.fn() };
    const service = new DocumentsService(
      prisma as never,
      audit as never,
      {} as never,
      core as unknown as CaseGovernanceService,
      evidence as unknown as CaseEvidenceGovernanceService,
    );
    Object.defineProperty(service, 'uploadDir', { value: root });
    return { service, prisma, evidence, audit, record };
  }
  it('returns verified snapshot stream with no caller-path output', async () => {
    const { service, audit } = fixture();
    const result = await service.openDownload(
      'doc1',
      { userId: 'actor' },
      null,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of result.data.stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks)).toEqual(bytes);
    expect(result.data).not.toHaveProperty('filePath');
    expect(audit.log).toHaveBeenCalledTimes(1);
  });
  it('rejects representation revocation occurring after lookup before transmission', async () => {
    const { service, evidence, audit } = fixture(true);
    evidence.authorizeAsset
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ForbiddenException('Grant revoked'));
    await expect(
      service.openDownload('doc1', { userId: 'actor' }, null),
    ).rejects.toMatchObject({ status: 403 });
    expect(audit.log).not.toHaveBeenCalled();
  });
  it('rejects ownership changed during hydration', async () => {
    const { service, prisma, record } = fixture();
    prisma.document.findFirst
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce({
        ...record,
        caseId: 'hidden',
        updatedAt: new Date('2026-10-07'),
      });
    await expect(
      service.openDownload('doc1', { userId: 'actor' }, null),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('preservation hold allows independently authorized read transmission', async () => {
    const { service, prisma, audit } = fixture();
    prisma.caseEvidenceHold.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'newhold' });
    const result = await service.openDownload(
      'doc1',
      { userId: 'actor' },
      null,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of result.data.stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks)).toEqual(bytes);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });
  it('legacy download-info route refuses registered original bypass', async () => {
    const { service } = fixture(true);
    await expect(
      service.getDownloadInfo('doc1', { userId: 'actor' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
