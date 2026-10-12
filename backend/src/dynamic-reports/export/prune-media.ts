import JSZip from 'jszip';

/**
 * Removing a worksheet in exceljs does not remove the pictures that belonged to
 * it: the workbook keeps one shared list of media and writes all of it. An
 * export that drops the sheets of other teams (or of the author's own notes)
 * would still carry their images inside the .xlsx — anyone who renames the file
 * to .zip can read another team's scanned report. This keeps only the media
 * that some surviving part of the package actually points at.
 */

function resolveMediaTarget(relsPath: string, target: string): string {
  // A relationship target is relative to the folder of the part the .rels file describes.
  if (target.startsWith('/')) return target.slice(1);
  const ownerDir = relsPath.replace(/(^|\/)_rels\/[^/]*$/, '$1').replace(/\/$/, '');
  const parts = (ownerDir ? `${ownerDir}/${target}` : target).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

export async function pruneUnreferencedMedia(xlsx: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx);
  const mediaFiles = Object.keys(zip.files).filter((n) => n.startsWith('xl/media/') && !zip.files[n].dir);
  if (mediaFiles.length === 0) return xlsx;

  const referenced = new Set<string>();
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.rels')) continue;
    const xml = await (zip.file(name) as JSZip.JSZipObject).async('string');
    for (const tag of xml.match(/<Relationship\b[^>]*>/g) ?? []) {
      const target = /\sTarget="([^"]+)"/.exec(tag)?.[1];
      if (target && /(^|\/)media\//.test(target)) referenced.add(resolveMediaTarget(name, target));
    }
  }

  let removed = 0;
  for (const name of mediaFiles) {
    if (!referenced.has(name)) {
      zip.remove(name);
      removed += 1;
    }
  }
  if (removed === 0) return xlsx;
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
