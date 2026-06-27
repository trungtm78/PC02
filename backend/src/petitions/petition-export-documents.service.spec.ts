import { Writable } from 'stream';
import { PetitionExportDocumentsService } from './petition-export-documents.service';

function plainRes() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
  } as any;
}
/** Writable thật (loại bỏ chunk) + setHeader — cho nhánh zip (archiver.pipe). */
function zipRes() {
  const w = new Writable({ write(_c, _e, cb) { cb(); } }) as any;
  w.setHeader = jest.fn();
  return w;
}

describe('PetitionExportDocumentsService', () => {
  let petitions: any;
  let docxMerge: any;
  let svc: PetitionExportDocumentsService;

  beforeEach(() => {
    petitions = {
      // [F1+P2 atomic] render CẢ N mẫu trong 1 transaction, trả mảng buffer.
      renderDocumentsAtomic: jest
        .fn()
        .mockImplementation((_id: string, dts: string[]) =>
          Promise.resolve(
            dts.map((dt) => ({
              buffer: Buffer.from('docx-' + dt),
              documentNumber: '1/' + dt,
              filename: dt + '.docx',
            })),
          ),
        ),
    };
    docxMerge = { merge: jest.fn().mockReturnValue(Buffer.from('MERGED')) };
    svc = new PetitionExportDocumentsService(petitions, docxMerge);
  });

  it('merged: render atomic N mẫu → merge → send (đúng header docx)', async () => {
    const res = plainRes();
    await svc.exportDocuments('p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], 'merged', 'u1', null, res);

    expect(petitions.renderDocumentsAtomic).toHaveBeenCalledWith(
      'p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], 'u1', null,
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

  it('[F1+P2] render atomic lỗi (thiếu trường / lỗi giữa chừng) → throw, KHÔNG merge/send', async () => {
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
      'p1', ['BIEN_NHAN'], 'u1', null,
    );
  });

  it('zip: set header zip + KHÔNG merge', async () => {
    const res = zipRes();
    await svc.exportDocuments('p1', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], 'zip', 'u1', null, res);
    expect(docxMerge.merge).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(petitions.renderDocumentsAtomic).toHaveBeenCalledWith(
      'p1', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], 'u1', null,
    );
  });
});
