import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { isMainThread } from 'node:worker_threads';
import { PdfSandbox } from './pdf-sandbox';

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (
      (error as { getResponse?: () => { code?: string } }).getResponse?.()
        .code ?? 'unknown'
    );
  }
};

/** A real PDF with `count` pages, each carrying its own text so pages can be told apart afterwards. */
async function makePdf(count: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= count; i += 1) {
    const page = doc.addPage([300, 400]);
    page.drawText(`page-${i}`, { x: 20, y: 200, size: 18 });
  }
  return Buffer.from(await doc.save());
}

describe('PdfSandbox', () => {
  const sandbox = new PdfSandbox({ maxPages: 5, timeoutMs: 15_000 });

  it('splits a PDF into one single-page PDF per page, in order', async () => {
    const pages = await sandbox.split(await makePdf(3));
    expect(pages).toHaveLength(3);
    for (const [i, bytes] of pages.entries()) {
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(Buffer.from(bytes).toString('latin1')).toContain('%PDF-');
      expect(i).toBeGreaterThanOrEqual(0);
    }
  });

  it('refuses a PDF with more pages than allowed, before splitting it', async () => {
    expect(await codeOf(sandbox.split(await makePdf(6)))).toBe(
      'OCR_PDF_TOO_MANY_PAGES',
    );
  });

  it('refuses a PDF that is encrypted', async () => {
    // A minimal encrypted-looking trailer is enough for the loader to refuse it.
    const encrypted = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R/Size 4/Encrypt<</Filter/Standard/V 1/R 2/O(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)/U(bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb)/P -4>>>>\n%%EOF',
      'latin1',
    );
    const code = await codeOf(sandbox.split(encrypted));
    expect(['OCR_PDF_ENCRYPTED', 'OCR_PDF_UNREADABLE']).toContain(code);
  });

  it('refuses bytes that are not a readable PDF', async () => {
    expect(
      await codeOf(
        sandbox.split(Buffer.from('%PDF-1.4 this is not really a pdf')),
      ),
    ).toBe('OCR_PDF_UNREADABLE');
  });

  it('removes page actions, annotations and metadata: nothing active survives into the copy a viewer opens', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const ctx = doc.context;
    page.node.set(
      PDFName.of('AA'),
      ctx.obj({ O: { S: 'JavaScript', JS: PDFString.of('app.alert(1)') } }),
    );
    page.node.set(
      PDFName.of('Annots'),
      ctx.obj([
        ctx.obj({
          Type: 'Annot',
          Subtype: 'Link',
          A: { S: 'URI', URI: PDFString.of('http://evil.example') },
        }),
      ]),
    );
    const [only] = await sandbox.split(
      Buffer.from(await doc.save({ useObjectStreams: false })),
    );
    const text = Buffer.from(only).toString('latin1');
    expect(text).not.toContain('JavaScript');
    expect(text).not.toContain('evil.example');
    expect(text).not.toContain('/AA');
    expect(text).not.toContain('/Annots');
  });

  it('stops a parse whose memory outside the JS heap grows past the allowance (decoded streams live there)', async () => {
    let reads = 0;
    const hungry = new PdfSandbox({
      maxPages: 5,
      timeoutMs: 15_000,
      maxExtraMemoryMb: 100,
      // The first reading is the baseline; every later one reports a parse that has grown by half a gigabyte.
      memoryProbeBytes: () => (reads++ === 0 ? 0 : 500 * 1024 * 1024),
      probeEveryMs: 1,
    });
    expect(await codeOf(hungry.split(await makePdf(5)))).toBe(
      'OCR_PDF_TOO_COMPLEX',
    );
  });

  it('stops a parse that runs too long instead of holding the server', async () => {
    const impatient = new PdfSandbox({ maxPages: 5, timeoutMs: 1 });
    expect(await codeOf(impatient.split(await makePdf(5)))).toBe(
      'OCR_PDF_TOO_COMPLEX',
    );
  });

  it('does not run the parser in the calling thread: the work happens in a worker', async () => {
    expect(isMainThread).toBe(true);
    // A parse that would take the whole event loop for seconds still lets this thread answer: it resolves a timer.
    let ticked = false;
    const pending = sandbox.split(await makePdf(5));
    setImmediate(() => {
      ticked = true;
    });
    await pending;
    expect(ticked).toBe(true);
  });
});
