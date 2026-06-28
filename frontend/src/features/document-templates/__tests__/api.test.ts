import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import {
  listTemplates,
  createTemplate,
  getFieldCatalog,
  detectVariables,
  downloadTemplateFile,
} from '../api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const mGet = vi.mocked(api.get);
const mPost = vi.mocked(api.post);

beforeEach(() => {
  mGet.mockReset();
  mPost.mockReset();
});

describe('document-templates api', () => {
  it('listTemplates: GET với query entityType (bỏ key undefined) + trả res.data trực tiếp', async () => {
    // [codex P1] controller trả array trực tiếp (không envelope {success,data}) như document-numbers.
    mGet.mockResolvedValue({ data: [{ id: 't1' }] } as never);
    const r = await listTemplates({ entityType: 'VU_AN' });
    expect(mGet).toHaveBeenCalledWith('/document-templates', { params: { entityType: 'VU_AN' } });
    expect(r).toEqual([{ id: 't1' }]);
  });

  it('createTemplate: POST multipart FormData', async () => {
    mPost.mockResolvedValue({ data: { id: 't1' } } as never);
    const fd = new FormData();
    await createTemplate(fd);
    expect(mPost).toHaveBeenCalledWith(
      '/document-templates',
      fd,
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  });

  it('getFieldCatalog: GET field-catalog với entityType', async () => {
    mGet.mockResolvedValue({ data: [{ key: 'ghiTen', label: 'Họ tên', group: 'Người gửi' }] } as never);
    const r = await getFieldCatalog('DON_THU');
    expect(mGet).toHaveBeenCalledWith('/document-templates/field-catalog', {
      params: { entityType: 'DON_THU' },
    });
    expect(r[0].key).toBe('ghiTen');
  });

  it('detectVariables: POST multipart kèm file + entityType + delimiter', async () => {
    mPost.mockResolvedValue({ data: { detected: ['x'], suggested: [] } } as never);
    const file = new File(['x'], 'a.docx');
    const r = await detectVariables(file, 'DON_THU', '[[', ']]');
    expect(mPost).toHaveBeenCalledWith(
      '/document-templates/detect',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
    expect(r.detected).toEqual(['x']);
  });

  it('downloadTemplateFile: GET :id/file responseType blob', async () => {
    const blob = new Blob(['docx']);
    mGet.mockResolvedValue({ data: blob } as never);
    const r = await downloadTemplateFile('t1');
    expect(mGet).toHaveBeenCalledWith('/document-templates/t1/file', { responseType: 'blob' });
    expect(r).toBe(blob);
  });
});
