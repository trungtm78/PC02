import { describe, it, expect } from 'vitest';
import controller from '../../../../backend/src/documents/documents.controller.ts?raw';
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  ALLOWED_MEDIA_EXTENSIONS,
  ALLOWED_DOCUMENT_EXTENSIONS,
  acceptAttr,
} from '../upload-limits';

/**
 * The media tab told users it accepted six formats at 100MB. The endpoint
 * accepts two at 10MB. Nobody noticed because nothing compared the two — the
 * copy, the client-side check and the server limit were three separate
 * hand-written lists.
 *
 * This reads the controller. If someone widens or narrows what the API takes,
 * the frontend mirror fails here rather than lying to a user who has already
 * waited for a 60MB upload.
 */
const MAX_FILE_SIZE_MB = Number(
  /const MAX_FILE_SIZE = (\d+) \* 1024 \* 1024/.exec(controller)?.[1],
);

const ALLOWED_MIME_TYPES = (() => {
  const block = /const ALLOWED_MIME_TYPES = \[([\s\S]*?)\];/.exec(controller)?.[1];
  return [...(block ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
})();

/** MIME → the extensions a user would actually pick in a file dialog. */
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'video/mp4': ['mp4'],
  'audio/mpeg': ['mp3'],
  'text/plain': ['txt'],
};

describe('upload limits mirror the documents endpoint', () => {
  it('parses the controller at all — a silent zero would pass vacuously', () => {
    expect(MAX_FILE_SIZE_MB).toBeGreaterThan(0);
    expect(ALLOWED_MIME_TYPES.length).toBeGreaterThan(5);
  });

  it('agrees on the size limit', () => {
    expect(MAX_UPLOAD_BYTES).toBe(MAX_FILE_SIZE_MB * 1024 * 1024);
    expect(MAX_UPLOAD_LABEL).toBe(`${MAX_FILE_SIZE_MB}MB`);
  });

  it('knows every MIME type the endpoint admits', () => {
    const unmapped = ALLOWED_MIME_TYPES.filter((m) => !MIME_TO_EXTENSIONS[m]);
    expect(unmapped).toEqual([]);
  });

  it('lists exactly the document extensions the endpoint admits', () => {
    const expected = ALLOWED_MIME_TYPES.flatMap((m) => MIME_TO_EXTENSIONS[m] ?? []);
    expect([...ALLOWED_DOCUMENT_EXTENSIONS].sort()).toEqual(expected.sort());
  });

  it('offers no media extension the endpoint would reject', () => {
    const admitted = new Set(
      ALLOWED_MIME_TYPES.flatMap((m) => MIME_TO_EXTENSIONS[m] ?? []),
    );
    const rejected = ALLOWED_MEDIA_EXTENSIONS.filter((e) => !admitted.has(e));
    expect(rejected).toEqual([]);
  });

  it('builds an accept attribute a file dialog understands', () => {
    expect(acceptAttr(ALLOWED_MEDIA_EXTENSIONS)).toBe('.mp3,.mp4');
  });
});
