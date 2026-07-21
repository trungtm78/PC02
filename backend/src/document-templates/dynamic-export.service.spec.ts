import { Writable } from 'stream';
import PizZip from 'pizzip';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
      // Người đang đăng nhập — nạp cho ngữ cảnh render (dòng ký in tên NGƯỜI IN).
      user: {
        findUnique: jest.fn().mockResolvedValue({ firstName: 'Văn', lastName: 'In', rank: 'Trung tá' }),
      },
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

    it('[codex P2] soVanBan required KHÔNG chặn (engine cấp, bỏ khỏi validate)', async () => {
      const T = { ...DT, variables: [{ name: 'soVanBan', source: 'auto', field: 'soVanBan', required: true }] };
      prisma.documentTemplate.findMany.mockResolvedValue([T]);
      // record rỗng + không manualValues → vẫn KHÔNG throw (soVanBan do engine cấp)
      await svc.exportEntityDocuments('DON_THU', 'p1', { senderName: '', unit: 'u1' }, ['d1'], 'merged', 'u1', {}, plainRes());
      expect(docNums.commitWithTx).toHaveBeenCalledTimes(1);
    });

    it('[codex P2] manualValues value non-string → KHÔNG crash 500 (String coerce)', async () => {
      const T = { ...DT, variables: [{ name: 'ghiChu', source: 'manual', required: true }] };
      prisma.documentTemplate.findMany.mockResolvedValue([T]);
      // value là number → String(123)="123" non-empty → qua validate, không TypeError
      await expect(
        svc.exportEntityDocuments('DON_THU', 'p1', { unit: 'u1' }, ['d1'], 'merged', 'u1', { ghiChu: 123 as any }, plainRes()),
      ).resolves.toBeUndefined();
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

  // ── exportBatchByCode (IN ĐỒNG LOẠT động — PR4 thay BatchExportService tĩnh) ──────
  describe('exportBatchByCode', () => {
    let svc: DynamicExportService;
    let prisma: any;
    let docNums: any;
    let commitCount: number;
    // Mẫu DON_THU không có biến required → assertRequiredSatisfied pass cho mọi record.
    const TPL = { id: 'bn', code: 'BIEN_NHAN', entityType: 'DON_THU', status: 'active', needsNumber: true, numberSeriesId: 'BIEN_NHAN', fileSha: 'sha', variables: [], fileBytes: makeDocx('So {soVanBan}') };

    beforeEach(() => {
      commitCount = 0;
      prisma = {
        // exportBatchByCode nay delegate sang exportBatchByCodes (dùng findMany).
        // findFirst giữ lại để các test override `findFirst` cũ vẫn có hiệu lực.
        documentTemplate: {
          findFirst: jest.fn().mockResolvedValue(TPL),
          findMany: jest.fn().mockResolvedValue([TPL]),
        },
        documentRenderLog: { create: jest.fn().mockResolvedValue({}) },
        user: {
          findUnique: jest.fn().mockResolvedValue({ firstName: 'Văn', lastName: 'In', rank: 'Trung tá' }),
        },
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $transaction: jest.fn(async (fn: any) => fn(prisma)),
      };
      docNums = { commitWithTx: jest.fn().mockImplementation(async () => ({ number: `BN-${++commitCount}` })) };
      svc = new DynamicExportService(prisma, docNums, { merge: jest.fn() } as any);
    });

    /** Đọc manifest.json trong ZIP mà res.send nhận được. */
    function readManifest(res: any) {
      const buf = res.send.mock.calls[0][0] as Buffer;
      return JSON.parse(new PizZip(buf).file('manifest.json')!.asText());
    }

    it('[P1] dedup petitionIds trùng → 1 đơn chỉ cấp 1 số (không nhảy số sổ)', async () => {
      const res = plainRes();
      const load = jest.fn(async (id: string) => ({ id, senderName: 'A' }));
      await svc.exportBatchByCode('DON_THU', 'BIEN_NHAN', ['p1', 'p1', 'p1'], load, 'u1', res);
      expect(docNums.commitWithTx).toHaveBeenCalledTimes(1); // 3 id trùng → cấp đúng 1 số
      const man = readManifest(res);
      expect(man.total).toBe(1);
      expect(man.items.filter((i: any) => i.ok)).toHaveLength(1);
    });

    it('1 hồ sơ lỗi nghiệp vụ (thiếu trường) → manifest ok:false, lô VẪN tiếp tục', async () => {
      const res = plainRes();
      const load = jest.fn(async (id: string) => {
        if (id === 'bad') throw new BadRequestException('Thiếu thông tin bắt buộc: Họ tên');
        return { id, senderName: 'A' };
      });
      await svc.exportBatchByCode('DON_THU', 'BIEN_NHAN', ['good', 'bad'], load, 'u1', res);
      const man = readManifest(res);
      expect(man.items.find((i: any) => i.id === 'good').ok).toBe(true);
      const bad = man.items.find((i: any) => i.id === 'bad');
      expect(bad.ok).toBe(false);
      expect(bad.error).toContain('Họ tên');
    });

    it('[P3] set header đếm X-Batch-Total/Ok/Failed để FE báo kết quả (1 ok + 1 fail)', async () => {
      const res = plainRes();
      const load = jest.fn(async (id: string) => {
        if (id === 'bad') throw new BadRequestException('thiếu');
        return { id, senderName: 'A' };
      });
      await svc.exportBatchByCode('DON_THU', 'BIEN_NHAN', ['good', 'bad'], load, 'u1', res);
      const calls = (res.setHeader as jest.Mock).mock.calls;
      const hdr = (name: string) => calls.find((c: any[]) => c[0] === name)?.[1];
      expect(hdr('X-Batch-Total')).toBe('2');
      expect(hdr('X-Batch-Ok')).toBe('1');
      expect(hdr('X-Batch-Failed')).toBe('1');
    });

    it('[P2] hồ sơ ngoài scope (Forbidden) / không tồn tại (NotFound) → message TRUNG LẬP (chống IDOR-enum)', async () => {
      const res = plainRes();
      const load = jest.fn(async (id: string) => {
        if (id === 'forbidden') throw new ForbiddenException('Bạn không có quyền truy cập bản ghi này');
        if (id === 'missing') throw new NotFoundException('Đơn thư không tồn tại (id: missing)');
        return { id, senderName: 'A' };
      });
      await svc.exportBatchByCode('DON_THU', 'BIEN_NHAN', ['forbidden', 'missing'], load, 'u1', res);
      const man = readManifest(res);
      const msgs = man.items.map((i: any) => i.error);
      // KHÔNG để lộ "không có quyền" vs "không tồn tại" (phân biệt id thật) → cùng 1 message.
      expect(new Set(msgs).size).toBe(1);
      expect(msgs[0]).not.toContain('quyền');
      expect(msgs[0]).not.toContain('không tồn tại (id');
    });

    /**
     * HỢP ĐỒNG ĐỔI CÓ CHỦ ĐÍCH (trước: rethrow abort cả lô).
     *
     * Rethrow làm CHÁY số văn bản: cặp trước đã commit ở tx riêng, trả 5xx thì client
     * không nhận file nào mà số thì không rollback được. Nay: ghi manifest + cờ
     * X-Batch-System-Error rồi VẪN giao ZIP các file đã cấp số.
     *
     * Yêu cầu "không che thành công giả" vẫn được giữ — nhưng bằng header/manifest chứ
     * không bằng cách vứt bỏ số đã cấp.
     */
    it('[P1] lỗi HỆ THỐNG → KHÔNG vứt số đã cấp: ghi manifest + cờ lỗi, vẫn giao ZIP', async () => {
      const res = plainRes();
      const load = jest.fn(async (id: string) => {
        if (id === 'p2') throw new Error('DB connection lost');
        return { id, stt: `DT-${id}`, senderName: 'A' };
      });
      await svc.exportBatchByCode('DON_THU', 'BIEN_NHAN', ['p1', 'p2'], load, 'u1', res);

      // p1 đã cấp số → file của nó PHẢI được giao, không bị vứt cùng lỗi của p2.
      expect(res.send).toHaveBeenCalled();
      const man = readManifest(res);
      expect(man.items.find((i: any) => i.id === 'p1').ok).toBe(true);
      const bad = man.items.find((i: any) => i.id === 'p2');
      expect(bad.ok).toBe(false);
      expect(bad.systemError).toBe(true);
      // Không lộ chi tiết hạ tầng ra client.
      expect(bad.error).not.toContain('DB connection lost');
      // FE phải phân biệt được lỗi hệ thống với lỗi thiếu dữ liệu.
      expect(res.setHeader).toHaveBeenCalledWith('X-Batch-System-Error', '1');
    });

    it('mẫu không tồn tại → BadRequest', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([]);
      await expect(
        svc.exportBatchByCode('DON_THU', 'KHONG_CO', ['p1'], jest.fn(), 'u1', plainRes()),
      ).rejects.toThrow(BadRequestException);
    });

    it('danh sách rỗng → BadRequest', async () => {
      await expect(
        svc.exportBatchByCode('DON_THU', 'BIEN_NHAN', [], jest.fn(), 'u1', plainRes()),
      ).rejects.toThrow('trống');
    });

    it('[P2] mẫu cấu hình sai (needsNumber nhưng thiếu series) → ABORT lô (không che per-record)', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([{ ...TPL, numberSeriesId: null }]);
      const load = jest.fn(async (id: string) => ({ id, senderName: 'A' }));
      await expect(
        svc.exportBatchByCode('DON_THU', 'BIEN_NHAN', ['p1', 'p2'], load, 'u1', plainRes()),
      ).rejects.toThrow('chưa cấu hình series');
      expect(load).not.toHaveBeenCalled(); // fail TRƯỚC vòng lặp
    });
  });

  /**
   * N hồ sơ × M mẫu → 1 ZIP. Bản mở rộng của exportBatchByCode (hàm cũ delegate sang đây
   * nên 8 test ở trên phải giữ xanh).
   */
  describe('exportBatchByCodes (N hồ sơ × M mẫu)', () => {
    let svc: DynamicExportService;
    let prisma: any;
    let docNums: any;
    let commitCount: number;
    const mkTpl = (id: string, code: string, name: string, over: any = {}) => ({
      id, code, name, entityType: 'DON_THU', status: 'active',
      needsNumber: true, numberSeriesId: code, fileSha: 'sha', variables: [],
      fileBytes: makeDocx('So {soVanBan}'), ...over,
    });
    const BN = mkTpl('bn', 'BIEN_NHAN', 'Giấy biên nhận');
    const DX = mkTpl('dx', 'PHIEU_DE_XUAT', 'Phiếu đề xuất');

    beforeEach(() => {
      commitCount = 0;
      prisma = {
        documentTemplate: {
          findFirst: jest.fn().mockResolvedValue(BN),
          findMany: jest.fn().mockResolvedValue([BN, DX]),
        },
        documentRenderLog: { create: jest.fn().mockResolvedValue({}) },
        user: {
          findUnique: jest.fn().mockResolvedValue({ firstName: 'Văn', lastName: 'In', rank: 'Trung tá' }),
        },
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $transaction: jest.fn(async (fn: any) => fn(prisma)),
      };
      docNums = { commitWithTx: jest.fn().mockImplementation(async () => ({ number: `${++commitCount}` })) };
      svc = new DynamicExportService(prisma, docNums, { merge: jest.fn() } as any);
    });

    function readZip(res: any) {
      return new PizZip(res.send.mock.calls[0][0] as Buffer);
    }
    function readManifest(res: any) {
      return JSON.parse(readZip(res).file('manifest.json')!.asText());
    }
    const loadOk = () => jest.fn(async (id: string) => ({ id, stt: `DT-2026-${id}`, senderName: 'A' }));

    it('2 mẫu × 3 hồ sơ → 6 file trong ZIP, tên có Mã hồ sơ + Tên mẫu', async () => {
      const res = plainRes();
      await svc.exportBatchByCodes(
        'DON_THU', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], ['p1', 'p2', 'p3'], loadOk(), 'u1', res,
      );
      const names = Object.keys(readZip(res).files).filter((n) => n.endsWith('.docx'));
      expect(names).toHaveLength(6);
      expect(names).toContain('DT-2026-p1_Giấy biên nhận_1.docx');
      expect(names.some((n) => n.includes('Phiếu đề xuất'))).toBe(true);
      expect(docNums.commitWithTx).toHaveBeenCalledTimes(6);
    });

    it('manifest có trường `code` — 1 id xuất hiện M lần nên thiếu code sẽ trùng khoá', async () => {
      const res = plainRes();
      await svc.exportBatchByCodes('DON_THU', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], ['p1'], loadOk(), 'u1', res);
      const man = readManifest(res);
      expect(man.items).toHaveLength(2);
      expect(man.items.map((i: any) => i.code).sort()).toEqual(['BIEN_NHAN', 'PHIEU_DE_XUAT']);
      expect(man.items.every((i: any) => i.id === 'p1')).toBe(true);
    });

    it('[P1] mẫu THỨ HAI thiếu series → 400 TRƯỚC mọi loadRecord, KHÔNG cấp số nào', async () => {
      // Nếu kiểm muộn: mẫu 1 đã commit số rồi mẫu 2 mới throw → ĐỐT SỐ SỔ rồi trả 500,
      // số đã cấp không rollback được vì tx đã đóng.
      prisma.documentTemplate.findMany.mockResolvedValue([BN, { ...DX, numberSeriesId: null }]);
      const load = loadOk();
      await expect(
        svc.exportBatchByCodes('DON_THU', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], ['p1'], load, 'u1', plainRes()),
      ).rejects.toThrow('chưa cấu hình series');
      expect(load).not.toHaveBeenCalled();
      expect(docNums.commitWithTx).not.toHaveBeenCalled();
    });

    it('[P1] 1 mẫu lỗi nghiệp vụ ở 1 hồ sơ → mẫu KIA CỦA CHÍNH hồ sơ đó vẫn ra file', async () => {
      // Khoá lỗi tx-granularity: gom M mẫu vào 1 tx sẽ rollback số của mẫu đã thành công.
      const spy = jest
        .spyOn(svc as any, 'assertRequiredSatisfied')
        .mockImplementation((_e: any, _r: any, tpls: any) => {
          if (tpls[0].code === 'PHIEU_DE_XUAT') throw new BadRequestException('Thiếu: Nhận thấy');
        });
      const res = plainRes();
      await svc.exportBatchByCodes('DON_THU', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], ['p1'], loadOk(), 'u1', res);
      const man = readManifest(res);
      expect(man.items.find((i: any) => i.code === 'BIEN_NHAN').ok).toBe(true);
      expect(man.items.find((i: any) => i.code === 'PHIEU_DE_XUAT').ok).toBe(false);
      expect(Object.keys(readZip(res).files).filter((n) => n.endsWith('.docx'))).toHaveLength(1);
      spy.mockRestore();
    });

    it('[P1] N×M vượt 100 file → 400 TRƯỚC khi cấp số', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `p${i}`);
      const load = loadOk();
      await expect(
        svc.exportBatchByCodes('DON_THU', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], ids, load, 'u1', plainRes()),
      ).rejects.toThrow(/100/);
      expect(docNums.commitWithTx).not.toHaveBeenCalled();
      expect(load).not.toHaveBeenCalled();
    });

    it('danh sách mẫu rỗng → 400', async () => {
      await expect(
        svc.exportBatchByCodes('DON_THU', [], ['p1'], loadOk(), 'u1', plainRes()),
      ).rejects.toThrow(/mẫu/i);
    });

    it('có mã mẫu không tồn tại → 400 nêu đúng mã sai', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([BN]);
      await expect(
        svc.exportBatchByCodes('DON_THU', ['BIEN_NHAN', 'KHONG_CO'], ['p1'], loadOk(), 'u1', plainRes()),
      ).rejects.toThrow('KHONG_CO');
    });

    it('dedup mã mẫu trùng → không cấp số 2 lần cho cùng 1 mẫu', async () => {
      const res = plainRes();
      await svc.exportBatchByCodes('DON_THU', ['BIEN_NHAN', 'BIEN_NHAN'], ['p1'], loadOk(), 'u1', res);
      expect(docNums.commitWithTx).toHaveBeenCalledTimes(1);
    });

    it('header X-Batch-* đếm theo SỐ FILE (N×M), có thêm X-Batch-Records', async () => {
      const res = plainRes();
      await svc.exportBatchByCodes('DON_THU', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], ['p1', 'p2'], loadOk(), 'u1', res);
      expect(res.setHeader).toHaveBeenCalledWith('X-Batch-Total', '4');
      expect(res.setHeader).toHaveBeenCalledWith('X-Batch-Ok', '4');
      expect(res.setHeader).toHaveBeenCalledWith('X-Batch-Records', '2');
    });
  });
});
