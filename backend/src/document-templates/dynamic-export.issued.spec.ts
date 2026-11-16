import PizZip from 'pizzip';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { DynamicExportService } from './dynamic-export.service';

/**
 * C5: the renderer takes a number the caller allocated (the request slip of a ward assignment decision, issued once),
 * renders it as it is, and allocates nothing. Every existing export is unchanged: it still allocates when the
 * template says so, and still drops a number a client sends in its manual values.
 */
function makeDocx(body: string): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${body}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}

const textOf = (buffer: Buffer) => new PizZip(buffer).file('word/document.xml')!.asText();

describe('DynamicExportService — a number given by the caller (C5)', () => {
  afterEach(() => jest.restoreAllMocks());
  let svc: DynamicExportService;
  let prisma: any;
  let docNums: any;

  beforeEach(() => {
    jest.spyOn(CaseGovernanceService.prototype, 'assertGeneralExport').mockResolvedValue(undefined);
    jest
      .spyOn(DynamicExportService.prototype as never, 'authorizedRecord' as never)
      .mockImplementation(((_t: unknown, _id: unknown, record: unknown) => Promise.resolve(record)) as never);
    prisma = {
      documentTemplate: { findMany: jest.fn() },
      documentRenderLog: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Văn', lastName: 'In', rank: 'Trung tá', userTeams: [] }) },
      systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    docNums = { commitWithTx: jest.fn().mockResolvedValue({ number: '0099/ĐX-PC02-Đ1' }) };
    svc = new DynamicExportService(prisma, docNums, { merge: jest.fn() } as never);
  });

  const SLIP = {
    id: 'ts',
    code: 'PHIEU_YEU_CAU',
    name: 'Phiếu yêu cầu',
    entityType: 'HO_SO_PHAN_CONG',
    status: 'active',
    // Even a template that says "number me" is not numbered again when the number is given.
    needsNumber: true,
    numberSeriesId: 'PHIEU_YEU_CAU',
    fileSha: 'shaS',
    format: 'DOCX',
    fileBytes: makeDocx('Số: {soVanBan} | {yeuCau}'),
    variables: [
      { name: 'soVanBan', source: 'auto', field: 'soVanBan' },
      { name: 'yeuCau', source: 'auto', field: 'yeuCau' },
    ],
  };
  const record = { code: '2026-7', decision: { slipNumber: 'IGNORED', requirements: ['Bổ sung lời khai', 'Xác minh nhân thân'] } };

  it('renders the given number, allocates none, logs the render against the ward request', async () => {
    const out = await svc.renderIssuedInTx(prisma, {
      entityType: 'HO_SO_PHAN_CONG',
      entityId: 'wa1',
      record,
      template: SLIP as never,
      actorId: 'u1',
      issued: { documentNumber: '1949A/PYC-PC02-Đ1' },
    });
    expect(docNums.commitWithTx).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    const xml = textOf(out.buffer);
    expect(xml).toContain('Số: 1949A/PYC-PC02-Đ1');
    // The requirements: one value, numbered, soft line breaks between them.
    expect(xml).toMatch(/1\. Bổ sung lời khai<\/w:t><\/w:r><w:r><w:br\/><\/w:r><w:r><w:t[^>]*>2\. Xác minh nhân thân/);
    expect(prisma.documentRenderLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ wardAssignmentId: 'wa1', documentType: 'PHIEU_YEU_CAU', generatedNumber: '1949A/PYC-PC02-Đ1', templateSha: 'shaS' }),
    });
    expect(out.documentNumber).toBe('1949A/PYC-PC02-Đ1');
  });

  it('a number in the manual values cannot replace the given one', async () => {
    const out = await svc.renderIssuedInTx(prisma, {
      entityType: 'HO_SO_PHAN_CONG',
      entityId: 'wa1',
      record,
      template: SLIP as never,
      actorId: 'u1',
      issued: { documentNumber: '5/PYC-PC02-Đ1' },
      manualValues: { soVanBan: 'FORGED' },
    });
    expect(textOf(out.buffer)).toContain('Số: 5/PYC-PC02-Đ1');
    expect(textOf(out.buffer)).not.toContain('FORGED');
  });

  it('an empty given number is refused (never renders a slip without its number)', async () => {
    await expect(
      svc.renderIssuedInTx(prisma, { entityType: 'HO_SO_PHAN_CONG', entityId: 'wa1', record, template: SLIP as never, actorId: 'u1', issued: { documentNumber: ' ' } }),
    ).rejects.toThrow();
  });

  describe('the existing exports are unchanged', () => {
    const plainRes = () => ({ setHeader: jest.fn(), send: jest.fn() }) as any;
    const DX = {
      id: 'd1',
      code: 'PHIEU_DE_XUAT',
      name: 'Phiếu đề xuất',
      entityType: 'DON_THU',
      status: 'active',
      needsNumber: true,
      numberSeriesId: 'PHIEU_DE_XUAT',
      fileSha: 'shaD',
      format: 'DOCX',
      fileBytes: makeDocx('Số: {soVanBan}'),
      variables: [{ name: 'soVanBan', source: 'auto', field: 'soVanBan' }],
    };

    it('a numbered petition template still allocates its number, row-locks the petition, logs it', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([DX]);
      const res = plainRes();
      await svc.exportEntityDocuments('DON_THU', 'p1', { stt: '2026-172' }, ['d1'], 'merged', 'u1', {}, res);
      expect(docNums.commitWithTx).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('FROM "petitions"'), 'p1');
      expect(textOf(res.send.mock.calls[0][0])).toContain('Số: 0099/ĐX-PC02-Đ1');
      expect(prisma.documentRenderLog.create.mock.calls[0][0].data).toMatchObject({ petitionId: 'p1', generatedNumber: '0099/ĐX-PC02-Đ1' });
    });

    it('a client still cannot forge the number through the manual values (unnumbered template: the record\'s own)', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([{ ...DX, needsNumber: false }]);
      const res = plainRes();
      await svc.exportEntityDocuments('DON_THU', 'p1', { stt: '2016-172' }, ['d1'], 'merged', 'u1', { soVanBan: 'FORGED' }, res);
      expect(docNums.commitWithTx).not.toHaveBeenCalled();
      const xml = textOf(res.send.mock.calls[0][0]);
      expect(xml).not.toContain('FORGED');
      expect(xml).toContain('Số: 172');
    });

    it.each([
      ['VU_AN', 'case-1', 'cases', 'caseId'],
      ['VU_VIEC', 'inc-1', 'incidents', 'incidentId'],
    ])('%s: numbered export still allocates and logs against its own record', async (entityType, entityId, table, idField) => {
      prisma.documentTemplate.findMany.mockResolvedValue([{ ...DX, entityType, code: 'QD', numberSeriesId: 'CASE' }]);
      await svc.exportEntityDocuments(entityType as never, entityId, {}, ['d1'], 'merged', 'u1', {}, plainRes());
      expect(docNums.commitWithTx).toHaveBeenCalledWith('CASE', expect.objectContaining({ [idField]: entityId }), expect.anything(), expect.anything());
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining(`FROM "${table}"`), entityId);
      expect(prisma.documentRenderLog.create.mock.calls[0][0].data[idField]).toBe(entityId);
    });
  });
});
