import { Writable } from 'stream';
import PizZip from 'pizzip';
import { DynamicExportService } from './dynamic-export.service';

/** Dựng .docx tối thiểu hợp lệ cho docxtemplater (đủ Content_Types + rels + document.xml). */
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

function plainRes() {
  return { setHeader: jest.fn(), send: jest.fn() } as any;
}

const T_NUM = { id: 't1', code: 'QD-KTVA', entityType: 'VU_AN', status: 'active', needsNumber: true, numberSeriesId: 'CASE', fileSha: 'sha1', fileBytes: makeDocx('So {soVuAn}') };
const T_NONUM = { id: 't2', code: 'BB-KN', entityType: 'VU_AN', status: 'active', needsNumber: false, numberSeriesId: null, fileSha: 'sha2', fileBytes: makeDocx('Bien ban {tenVuAn}') };

describe('DynamicExportService', () => {
  let svc: DynamicExportService;
  let prisma: any;
  let docNums: any;
  let docxMerge: any;

  beforeEach(() => {
    prisma = {
      documentTemplate: { findMany: jest.fn() },
      documentRenderLog: { create: jest.fn().mockResolvedValue({}) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    docNums = { commitWithTx: jest.fn().mockResolvedValue({ number: 'QD-001' }) };
    docxMerge = { merge: jest.fn().mockReturnValue(Buffer.from('MERGED')) };
    svc = new DynamicExportService(prisma, docNums, docxMerge);
  });

  const rec = { caseCode: 'VA-1', name: 'Vụ X', crime: 'Trộm', unit: 'u1' };

  it('listExportableTemplates: query active theo entityType, KHÔNG select fileBytes, sort sortOrder+code', async () => {
    const rows = [{ id: 't1', code: 'QD01', fileSha: 's' }];
    prisma.documentTemplate.findMany.mockResolvedValue(rows);
    await expect(svc.listExportableTemplates('VU_AN')).resolves.toBe(rows);
    const arg = prisma.documentTemplate.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ entityType: 'VU_AN', deletedAt: null, status: 'active' });
    expect(arg.select.fileBytes).toBeUndefined(); // không tải bytes nặng vào list
    expect(arg.select.id).toBe(true);
    expect(arg.orderBy).toEqual([{ sortOrder: 'asc' }, { code: 'asc' }]);
  });

  it('merged: render 2 mẫu trong 1 tx → merge → send; cấp số CHỈ mẫu needsNumber', async () => {
    prisma.documentTemplate.findMany.mockResolvedValue([T_NUM, T_NONUM]);
    const res = plainRes();
    await svc.exportEntityDocuments('VU_AN', 'case-1', rec, ['t1', 't2'], 'merged', 'u1', {}, res);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(docNums.commitWithTx).toHaveBeenCalledTimes(1); // chỉ T_NUM
    expect(docxMerge.merge).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(Buffer.from('MERGED'));
    expect(prisma.documentRenderLog.create).toHaveBeenCalledTimes(2);
  });

  it('template không tồn tại → 400 (trước tx, 0 cấp số)', async () => {
    prisma.documentTemplate.findMany.mockResolvedValue([T_NUM]); // thiếu t2
    await expect(
      svc.exportEntityDocuments('VU_AN', 'case-1', rec, ['t1', 't2'], 'merged', 'u1', {}, plainRes()),
    ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(docNums.commitWithTx).not.toHaveBeenCalled();
  });

  it('template sai entityType → 400', async () => {
    prisma.documentTemplate.findMany.mockResolvedValue([{ ...T_NUM, entityType: 'VU_VIEC' }]);
    await expect(
      svc.exportEntityDocuments('VU_AN', 'case-1', rec, ['t1'], 'merged', 'u1', {}, plainRes()),
    ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[codex P2] needsNumber=true nhưng thiếu numberSeriesId → throw (không render câm)', async () => {
    prisma.documentTemplate.findMany.mockResolvedValue([
      { ...T_NUM, numberSeriesId: null },
    ]);
    await expect(
      svc.exportEntityDocuments('VU_AN', 'case-1', rec, ['t1'], 'merged', 'u1', {}, plainRes()),
    ).rejects.toThrow();
  });

  it('[codex P2] templateIds trùng lặp → 400 (không tiêu số gấp đôi)', async () => {
    await expect(
      svc.exportEntityDocuments('VU_AN', 'case-1', rec, ['t1', 't1'], 'merged', 'u1', {}, plainRes()),
    ).rejects.toThrow();
    expect(prisma.documentTemplate.findMany).not.toHaveBeenCalled();
  });

  it('zip: build buffer + header zip, KHÔNG merge', async () => {
    prisma.documentTemplate.findMany.mockResolvedValue([T_NONUM]);
    const res = plainRes();
    await svc.exportEntityDocuments('VU_AN', 'case-1', rec, ['t2'], 'zip', 'u1', {}, res);
    expect(docxMerge.merge).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    const sent = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(sent)).toBe(true);
  });

  describe('DON_THU (Đơn thư động — PR3)', () => {
    const DT = {
      id: 'd1', code: 'PHIEU_DE_XUAT', entityType: 'DON_THU', status: 'active',
      needsNumber: true, numberSeriesId: 'PHIEU_DE_XUAT', fileSha: 'shaD',
      fileBytes: makeDocx('Gui {ghiTen} so {soVanBan}'),
      variables: [
        { name: 'ghiTen', source: 'auto', field: 'ghiTen', required: true },
        { name: 'soVanBan', source: 'auto', field: 'soVanBan', required: false },
      ],
    };

    it('[codex P1#2] thiếu required (ghiTen rỗng, không manualValues) → throw TRƯỚC tx (0 cấp số)', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([DT]);
      await expect(
        svc.exportEntityDocuments('DON_THU', 'p1', { senderName: '', unit: 'u1' }, ['d1'], 'merged', 'u1', {}, plainRes()),
      ).rejects.toThrow(/bắt buộc/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(docNums.commitWithTx).not.toHaveBeenCalled();
    });

    it('manualValues bổ sung required → qua validate, render OK', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([DT]);
      await svc.exportEntityDocuments('DON_THU', 'p1', { senderName: '', unit: 'u1' }, ['d1'], 'merged', 'u1', { ghiTen: 'Trần A' }, plainRes());
      expect(docNums.commitWithTx).toHaveBeenCalledTimes(1);
    });

    it('render DON_THU: row-lock "petitions", commitWithTx idKey petitionId, renderLog.petitionId', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([DT]);
      await svc.exportEntityDocuments('DON_THU', 'p1', { senderName: 'Trần A', unit: 'u1' }, ['d1'], 'merged', 'u1', {}, plainRes());
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('FROM "petitions"'), 'p1');
      expect(docNums.commitWithTx).toHaveBeenCalledWith(
        'PHIEU_DE_XUAT', expect.objectContaining({ petitionId: 'p1' }), expect.anything(), expect.anything(),
      );
      expect(prisma.documentRenderLog.create.mock.calls[0][0].data.petitionId).toBe('p1');
    });

    it('readiness DON_THU: cột phẳng → savable=true + column (FE PUT lưu đơn)', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([
        { id: 'd1', code: 'PHIEU_DE_XUAT', variables: [{ name: 'ghiTen', source: 'auto', field: 'ghiTen', required: true }] },
      ]);
      const r = await svc.getExportReadiness('DON_THU', { senderName: '' });
      const m = r.items[0].missing[0];
      expect(m).toMatchObject({ field: 'ghiTen', savable: true, column: 'senderName' });
    });
  });
});
