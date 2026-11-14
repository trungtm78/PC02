import * as fs from 'fs';
import * as path from 'path';
import {
  ANCHOR_KINDS,
  BANDS,
  DURATION_UNITS,
  PROCESSING_CODES_TARGETS,
  PROCESSING_ERROR,
  PROCESSING_ERROR_CODES,
  processingCodes,
  renderProcessingCodes,
} from './processing-codes';
import { ANCHOR_KEYS } from '../gateway/record-snapshot';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('the processing codes shared by the server, the web and Flutter', () => {
  it.each(PROCESSING_CODES_TARGETS)('%s is exactly what the generator writes now', (target) => {
    // Line ends are compared as written: a checkout that rewrites them is a difference worth seeing, except CRLF.
    const onDisk = fs.readFileSync(path.join(ROOT, target), 'utf8').replace(/\r\n/g, '\n');
    expect(onDisk).toBe(renderProcessingCodes());
  });

  it('both copies are the same file', () => {
    const [web, mobile] = PROCESSING_CODES_TARGETS.map((target) => fs.readFileSync(path.join(ROOT, target)));
    expect(web.equals(mobile)).toBe(true);
  });

  it('the generated text is JSON that carries every list', () => {
    const parsed = JSON.parse(renderProcessingCodes()) as ReturnType<typeof processingCodes>;
    expect(parsed.durationUnits).toEqual([...DURATION_UNITS]);
    expect(parsed.anchorKinds).toEqual([...ANCHOR_KINDS]);
    expect(parsed.bands).toEqual([...BANDS]);
    expect(parsed.errorCodes).toEqual([...PROCESSING_ERROR_CODES]);
  });

  it('no list holds a code twice', () => {
    for (const [name, list] of Object.entries(processingCodes())) {
      if (!Array.isArray(list)) continue;
      expect({ name, size: new Set(list).size }).toEqual({ name, size: list.length });
    }
  });

  it('every error code has a constant of the same name', () => {
    expect(Object.keys(PROCESSING_ERROR)).toEqual([...PROCESSING_ERROR_CODES]);
    for (const code of PROCESSING_ERROR_CODES) expect(PROCESSING_ERROR[code]).toBe(code);
  });

  it('every date the gateway reads from a record is an anchor kind', () => {
    expect(ANCHOR_KEYS.filter((key) => !(ANCHOR_KINDS as readonly string[]).includes(key))).toEqual([]);
  });

  it('the Flutter asset is declared in pubspec.yaml', () => {
    const pubspec = fs.readFileSync(path.join(ROOT, 'mobile', 'pubspec.yaml'), 'utf8');
    expect(pubspec).toMatch(/^\s+- assets\/contract\/\s*$/m);
  });
});
