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
      preValidateExportDocuments: jest.fn().mockResolvedValue(undefined),
      exportDocumentToBuffer: jest
        .fn()
        .mockImplementation((_id: string, dt: string) =>
          Promise.resolve({
            buffer: Buffer.from('docx-' + dt),
            documentNumber: '1/' + dt,
            filename: dt + '.docx',
          }),
        ),
    };
    docxMerge = { merge: jest.fn().mockReturnValue(Buffer.from('MERGED')) };
    svc = new PetitionExportDocumentsService(petitions, docxMerge);
  });

  it('merged: pre-validate → render từng mẫu → merge → send (đúng header docx)', async () => {
    const res = plainRes();
    await svc.exportDocuments('p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], 'merged', 'u1', null, res);

    expect(petitions.preValidateExportDocuments).toHaveBeenCalledWith(
      'p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], null,
    );
    expect(petitions.exportDocumentToBuffer).toHaveBeenCalledTimes(2);
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

  it('[F1] pre-validate lỗi → KHÔNG render mẫu nào (0 lần cấp số), không merge', async () => {
    petitions.preValidateExportDocuments.mockRejectedValue(new Error('thiếu trường'));
    const res = plainRes();
    await expect(
      svc.exportDocuments('p1', ['PHIEU_DE_XUAT', 'BIEN_NHAN'], 'merged', 'u1', null, res),
    ).rejects.toThrow();
    expect(petitions.exportDocumentToBuffer).not.toHaveBeenCalled();
    expect(docxMerge.merge).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('dedupe docType trùng → render đúng 1 mẫu unique', async () => {
    const res = plainRes();
    await svc.exportDocuments('p1', ['BIEN_NHAN', 'BIEN_NHAN'], 'merged', 'u1', null, res);
    expect(petitions.exportDocumentToBuffer).toHaveBeenCalledTimes(1);
  });

  it('zip: set header zip + KHÔNG merge', async () => {
    const res = zipRes();
    await svc.exportDocuments('p1', ['BIEN_NHAN', 'PHIEU_DE_XUAT'], 'zip', 'u1', null, res);
    expect(docxMerge.merge).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(petitions.exportDocumentToBuffer).toHaveBeenCalledTimes(2);
  });
});
