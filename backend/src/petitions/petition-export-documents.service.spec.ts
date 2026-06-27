import { Writable } from 'stream';
import { PetitionExportDocumentsService } from './petition-export-documents.service';

function plainRes() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
  } as any;
}
/** Writable thật (loại bỏ chunk) + setHeader — phòng nhánh dùng stream. */
function zipRes() {
  const w = new Writable({ write(_c, _e, cb) { cb(); } }) as any;
  w.setHeader = jest.fn();
  w.send = jest.fn();
  return w;
}

describe('PetitionExportDocumentsService', () => {
  let petitions: any;
  let docxMerge: any;
  let svc: PetitionExportDocumentsService;

  beforeEach(() => {
    petitions = {
      // [F1+P2 atomic] render N mẫu + finalize(gộp/zip) trong 1 transaction.
      // Mock GỌI finalize với buffer giả để verify wiring merge/zip của orchestrator.
      renderDocumentsAtomic: jest
        .fn()
        .mockImplementation((_id: string, dts: string[], _a: string, _s: any, finalize: any) =>
          Promise.resolve(
            finalize(
              dts.map((dt) => ({
                buffer: Buffer.from('docx-' + dt),
                documentNumber: '1/' + dt,
                filename: dt + '.docx',
              })),
            ),
          ),
        ),
    };
    docxMerge = { merge: jest.fn().mockReturnValue(Buffer.from('MERGED')) };
    svc = new PetitionExportDocumentsService(petitions, docxMerge);
  });

  it('merged: render atomic + finalize=merge → send MERGED (đúng header docx)', async () => {
    const res = plainRes();
    await svc.exportDocuments('p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], 'merged', 'u1', null, res);

    expect(petitions.renderDocumentsAtomic).toHaveBeenCalledWith(
      'p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], 'u1', null, expect.any(Function),
    );
    expect(docxMerge.merge).toHaveBeenCalledWith([
      Buffer.from('docx-PHIEU_DE_XUAT'),
      Buffer.from('docx-BIEN_NHAN'),
    ]);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('MERGED'));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      expect.stringContaining('wordprocessingml'),
    );
  });

  it('[F1+P2] render atomic lỗi (thiếu trường / gộp lỗi giữa chừng) → throw, KHÔNG send', async () => {
    petitions.renderDocumentsAtomic.mockRejectedValue(new Error('thiếu trường'));
    const res = plainRes();
    await expect(
      svc.exportDocuments('p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], 'merged', 'u1', null, res),
    ).rejects.toThrow();
    expect(docxMerge.merge).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('dedupe docType trùng → render atomic đúng 1 mẫu unique', async () => {
    const res = plainRes();
    await svc.exportDocuments('p1', ['BIEN_NHAN', 'BIEN_NHAN'], 'merged', 'u1', null, res);
    expect(petitions.renderDocumentsAtomic).toHaveBeenCalledWith(
      'p1', ['BIEN_NHAN'], 'u1', null, expect.any(Function),
    );
  });

  it('zip: finalize=buildZipBuffer (thật) → send Buffer .zip, header zip, KHÔNG merge', async () => {
    const res = plainRes();
    await svc.exportDocuments('p1', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], 'zip', 'u1', null, res);
    expect(docxMerge.merge).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(res.send).toHaveBeenCalledTimes(1);
    // buildZipBuffer trả Buffer (zip thật chứa cả 2 file).
    const sent = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(sent)).toBe(true);
    expect(sent.length).toBeGreaterThan(0);
  });
});
