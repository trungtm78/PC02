'use strict';
/**
 * Splits a PDF into single-page PDFs, in a worker thread with its own memory limit.
 *
 * Plain JavaScript on purpose: a worker is started from a file, and this one has to run unchanged from the TypeScript
 * sources under test and from the compiled output (it is copied as an asset by the build).
 */
const { parentPort, workerData } = require('node:worker_threads');
const { PDFDocument, EncryptedPDFError, PDFName } = require('pdf-lib');

// Active or tracking parts of a page that a viewer would act on. The text and the picture are all a reading needs.
const DROP = ['AA', 'Annots', 'Metadata', 'PieceInfo', 'Thumb', 'B'].map((name) => PDFName.of(name));

async function split({ bytes, maxPages }) {
  let source;
  try {
    source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    return { error: error instanceof EncryptedPDFError ? 'ENCRYPTED' : 'UNREADABLE' };
  }
  const count = source.getPageCount();
  if (count === 0) return { error: 'UNREADABLE' };
  if (count > maxPages) return { error: 'TOO_MANY_PAGES', count };
  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(source, [i]);
    for (const key of DROP) page.node.delete(key);
    out.addPage(page);
    pages.push(await out.save());
  }
  return { pages };
}

split(workerData).then(
  (result) => parentPort.postMessage(result),
  () => parentPort.postMessage({ error: 'UNREADABLE' }),
);
