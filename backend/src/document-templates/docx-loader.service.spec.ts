import { DocxTemplateLoaderService, DOCUMENT_TYPES } from './docx-loader.service';

describe('DocxTemplateLoaderService', () => {
  it('loads all 6 templates at module init', async () => {
    const loader = new DocxTemplateLoaderService();
    await loader.onModuleInit();
    for (const docType of DOCUMENT_TYPES) {
      const buf = loader.get(docType);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2000); // valid docx files have at least 2KB of OOXML
    }
  });

  it('caches buffers — same Buffer reference across calls', async () => {
    const loader = new DocxTemplateLoaderService();
    await loader.onModuleInit();
    const a = loader.get('PHIEU_DE_XUAT');
    const b = loader.get('PHIEU_DE_XUAT');
    expect(a).toBe(b);
  });

  it('throws when get() is called before onModuleInit()', () => {
    const loader = new DocxTemplateLoaderService();
    expect(() => loader.get('PHIEU_DE_XUAT')).toThrow(/not loaded/);
  });

  it('throws on unknown documentType', async () => {
    const loader = new DocxTemplateLoaderService();
    await loader.onModuleInit();
    expect(() => loader.get('UNKNOWN_DOC' as any)).toThrow(/UNKNOWN_DOC/);
  });

  it('exposes a stable templateSha for audit log', async () => {
    const loader = new DocxTemplateLoaderService();
    await loader.onModuleInit();
    const sha = loader.sha('PHIEU_DE_XUAT');
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
  });

  it('module-init fails fast with descriptive error if a template is missing', async () => {
    // Override the template dir to a known-empty location to simulate missing files.
    process.env['DOCX_TEMPLATE_DIR_OVERRIDE'] = '/nonexistent/path';
    const loader = new DocxTemplateLoaderService();
    await expect(loader.onModuleInit()).rejects.toThrow(/Template not found/);
    delete process.env['DOCX_TEMPLATE_DIR_OVERRIDE'];
  });
});
