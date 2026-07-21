import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { exportEntityDocuments, listExportTemplates, resolveFilename, parseBlobError } from '../export.api';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));
const mPost = vi.mocked(api.post);
const mGet = vi.mocked(api.get);

beforeEach(() => {
  mPost.mockReset();
  mGet.mockReset();
});

describe('document-templates export.api', () => {
  it('exportEntityDocuments cases: POST /cases/:id/export-documents với responseType blob', async () => {
    mPost.mockResolvedValue({ data: new Blob() } as never);
    await exportEntityDocuments('cases', 'c1', {
      templateIds: ['t1', 't2'],
      mode: 'merged',
      manualValues: { soVanBan: '42' },
    });
    expect(mPost).toHaveBeenCalledWith(
      '/cases/c1/export-documents',
      { templateIds: ['t1', 't2'], mode: 'merged', manualValues: { soVanBan: '42' } },
      { responseType: 'blob' },
    );
  });

  it('exportEntityDocuments incidents: POST /incidents/:id/export-documents', async () => {
    mPost.mockResolvedValue({ data: new Blob() } as never);
    await exportEntityDocuments('incidents', 'i9', { templateIds: ['t1'], mode: 'zip' });
    expect(mPost).toHaveBeenCalledWith(
      '/incidents/i9/export-documents',
      { templateIds: ['t1'], mode: 'zip' },
      { responseType: 'blob' },
    );
  });

  it('listExportTemplates: GET /:entity/export-templates trả mảng thẳng (không envelope)', async () => {
    mGet.mockResolvedValue({ data: [{ id: 't1' }] } as never);
    const r = await listExportTemplates('incidents');
    expect(mGet).toHaveBeenCalledWith('/incidents/export-templates');
    expect(r).toEqual([{ id: 't1' }]);
  });

  it('listExportTemplates: data null → [] an toàn', async () => {
    mGet.mockResolvedValue({ data: null } as never);
    expect(await listExportTemplates('cases')).toEqual([]);
  });

  it('resolveFilename: lấy filename từ content-disposition', () => {
    const name = resolveFilename(
      { 'content-disposition': 'attachment; filename="QuyetDinh_2026.docx"' },
      'merged',
    );
    expect(name).toBe('QuyetDinh_2026.docx');
  });

  it('resolveFilename: fallback theo mode khi thiếu header', () => {
    expect(resolveFilename({}, 'merged')).toBe('ChungTu.docx');
    expect(resolveFilename(undefined, 'zip')).toBe('ChungTu.zip');
  });

  /**
   * Tải file đi qua `a.download = <chuỗi JS>` (triggerDownload) nên trình duyệt BỎ QUA
   * Content-Disposition — tên file trên đĩa chính là chuỗi resolveFilename trả về.
   * Nhánh `filename="..."` đã bị backend thay mọi ký tự non-ASCII bằng `_`, nên phải
   * đọc `filename*=UTF-8''` thì tên tiếng Việt mới tới được đĩa.
   */
  describe('resolveFilename giữ dấu tiếng Việt', () => {
    it('ƯU TIÊN filename*=UTF-8 thay vì nhánh ASCII đã bị băm', () => {
      const cd =
        'attachment; filename="DT-2026-36679_Phi__u ____ xu_t_0012.docx"; ' +
        "filename*=UTF-8''DT-2026-36679_Phi%E1%BA%BFu%20%C4%91%E1%BB%81%20xu%E1%BA%A5t_0012.docx";
      expect(resolveFilename({ 'content-disposition': cd }, 'merged')).toBe(
        'DT-2026-36679_Phiếu đề xuất_0012.docx',
      );
    });

    it('chỉ có filename* (không có nhánh ASCII) vẫn đọc được', () => {
      const cd = "attachment; filename*=UTF-8''Gi%E1%BA%A5y%20bi%C3%AAn%20nh%E1%BA%ADn.docx";
      expect(resolveFilename({ 'content-disposition': cd }, 'merged')).toBe('Giấy biên nhận.docx');
    });

    it('filename* hỏng (percent-encoding sai) → lùi về nhánh ASCII, KHÔNG ném lỗi', () => {
      const cd = 'attachment; filename="fallback.docx"; filename*=UTF-8\'\'%E0%A4%A';
      expect(resolveFilename({ 'content-disposition': cd }, 'merged')).toBe('fallback.docx');
    });

    it('không nuốt mất phần sau dấu ; của filename*', () => {
      const cd = "attachment; filename*=UTF-8''ChungTu_20260721.zip";
      expect(resolveFilename({ 'content-disposition': cd }, 'zip')).toBe('ChungTu_20260721.zip');
    });
  });

  it('parseBlobError: blob JSON lỗi được parse thành object để đọc message', async () => {
    const blob = new Blob([JSON.stringify({ message: 'Thiếu biến bắt buộc' })], {
      type: 'application/json',
    });
    const err = { response: { data: blob } };
    const parsed = (await parseBlobError(err)) as { response: { data: { message: string } } };
    expect(parsed.response.data.message).toBe('Thiếu biến bắt buộc');
  });
});
