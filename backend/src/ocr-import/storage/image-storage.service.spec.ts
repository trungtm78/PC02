import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  ImageStorageService,
  isPdf,
  sniffImage,
} from './image-storage.service';

const codeOf = async (promise: Promise<unknown>): Promise<string | null> => {
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

const png = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .png()
    .toBuffer();

/** A JPEG tagged "rotate 90 degrees" (orientation 6) that also carries a GPS position in its EXIF block. */
const jpegWithExif = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 10, b: 10 },
    },
  })
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '10/1 46/1 30/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '106/1 42/1 0/1',
      },
    })
    .jpeg()
    .toBuffer();

describe('sniffImage (magic bytes, not the file name or the declared type)', () => {
  it('recognises JPEG, PNG and WebP', async () => {
    expect(sniffImage(await jpegWithExif(10, 10))?.mimeType).toBe('image/jpeg');
    expect(sniffImage(await png(10, 10))?.mimeType).toBe('image/png');
    const webp = await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#fff' },
    })
      .webp()
      .toBuffer();
    expect(sniffImage(webp)?.mimeType).toBe('image/webp');
  });

  it('refuses HEIC, text, PDF disguised as an image, and empty input', () => {
    const heic = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftypheic'),
      Buffer.alloc(16),
    ]);
    expect(sniffImage(heic)).toBeNull();
    expect(
      sniffImage(Buffer.from('hello world, I am not an image')),
    ).toBeNull();
    expect(sniffImage(Buffer.from('%PDF-1.7 fake'))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe('ImageStorageService', () => {
  let root: string;
  let storage: ImageStorageService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-storage-'));
    storage = new ImageStorageService({
      rootDir: root,
      maxBytes: 5 * 1024 * 1024,
    });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  describe('originals', () => {
    it('stores the exact bytes uploaded, named by their hash, and reports that hash', async () => {
      const bytes = await jpegWithExif(64, 32);
      const saved = await storage.saveOriginal('sess1', bytes);
      expect(saved.sha256).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );
      expect(saved.mimeType).toBe('image/jpeg');
      expect(saved.sizeBytes).toBe(bytes.length);
      expect(fs.readFileSync(path.join(root, saved.originalPath))).toEqual(
        bytes,
      );
      expect(saved.originalPath).toBe(
        path.join('sess1', `${saved.sha256}.jpg`),
      );
    });

    it('never re-encodes: the original keeps its EXIF, because it is the evidence of what was uploaded', async () => {
      const bytes = await jpegWithExif(64, 32);
      const saved = await storage.saveOriginal('sess1', bytes);
      const meta = await sharp(
        fs.readFileSync(path.join(root, saved.originalPath)),
      ).metadata();
      expect(meta.exif).toBeDefined();
    });

    it('saving the same bytes again is harmless and returns the same record', async () => {
      const bytes = await png(20, 20);
      const first = await storage.saveOriginal('sess1', bytes);
      const second = await storage.saveOriginal('sess1', bytes);
      expect(second).toEqual(first);
    });

    it('refuses an unsupported type, a file over the size limit, and a name that tries to leave its folder', async () => {
      expect(
        await codeOf(
          storage.saveOriginal('sess1', Buffer.from('not an image')),
        ),
      ).toBe('OCR_IMAGE_UNSUPPORTED');
      const big = Buffer.concat([
        await png(10, 10),
        Buffer.alloc(6 * 1024 * 1024),
      ]);
      expect(await codeOf(storage.saveOriginal('sess1', big))).toBe(
        'OCR_IMAGE_TOO_LARGE',
      );
      expect(
        await codeOf(storage.saveOriginal('../escape', await png(10, 10))),
      ).toBe('OCR_SESSION_NOT_FOUND');
    });

    it('refuses bytes that look like an image but cannot be decoded', async () => {
      const broken = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(40, 7),
      ]);
      expect(await codeOf(storage.saveOriginal('sess1', broken))).toBe(
        'OCR_IMAGE_UNREADABLE',
      );
    });
  });

  describe('single-page PDFs', () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

    it('stores a single-page PDF byte for byte, named by its hash, with its own type', async () => {
      const saved = await storage.savePdfPage('sess1', pdf);
      expect(saved).toMatchObject({
        mimeType: 'application/pdf',
        sizeBytes: pdf.length,
      });
      expect(saved.sha256).toBe(createHash('sha256').update(pdf).digest('hex'));
      expect(saved.originalPath).toBe(
        path.join('sess1', `${saved.sha256}.pdf`),
      );
      expect(fs.readFileSync(path.join(root, saved.originalPath))).toEqual(pdf);
    });

    it('refuses bytes that do not start like a PDF, and a name that tries to leave its folder', async () => {
      expect(
        await codeOf(storage.savePdfPage('sess1', Buffer.from('not a pdf'))),
      ).toBe('OCR_IMAGE_UNSUPPORTED');
      expect(await codeOf(storage.savePdfPage('../escape', pdf))).toBe(
        'OCR_SESSION_NOT_FOUND',
      );
    });

    it('recognises a PDF by its first bytes, not by what the upload claims to be', () => {
      expect(isPdf(pdf)).toBe(true);
      expect(isPdf(Buffer.from('<html>%PDF-</html>'))).toBe(false);
    });
  });

  describe('the copy sent to the provider', () => {
    it('applies the EXIF rotation, then removes the EXIF block including the GPS position', async () => {
      const bytes = await jpegWithExif(300, 200); // orientation 6: displayed as 200 x 300
      const derived = await storage.deriveForProvider(bytes);
      expect(derived.mediaType).toBe('image/jpeg');
      expect([derived.widthPx, derived.heightPx]).toEqual([200, 300]);
      const meta = await sharp(derived.buffer).metadata();
      expect(meta.exif).toBeUndefined();
      expect(derived.transforms).toContain('rotate');
      expect(derived.transforms).toContain('strip-metadata');
    });

    it('shrinks a large page so its long edge is at most 2500 px, and never enlarges a small one', async () => {
      const large = await storage.deriveForProvider(await png(4000, 3000));
      expect(Math.max(large.widthPx, large.heightPx)).toBe(2500);
      expect(large.widthPx / large.heightPx).toBeCloseTo(4 / 3, 1);
      const small = await storage.deriveForProvider(await png(600, 400));
      expect([small.widthPx, small.heightPx]).toEqual([600, 400]);
    });

    it('refuses an image with an absurd number of pixels before decoding it', async () => {
      const bomb = await png(12000, 10000); // 120 million pixels, tiny on disk
      expect(await codeOf(storage.deriveForProvider(bomb))).toBe(
        'OCR_IMAGE_TOO_LARGE',
      );
    });
  });

  describe('reading and deleting', () => {
    it('reads back what was stored, and refuses a path outside its root', async () => {
      const saved = await storage.saveOriginal('sess1', await png(10, 10));
      expect((await storage.read(saved.originalPath)).length).toBe(
        saved.sizeBytes,
      );
      expect(await codeOf(storage.read(path.join('..', 'outside.txt')))).toBe(
        'OCR_PAGE_NOT_FOUND',
      );
    });

    it('deletes files, ignores ones already gone, and never deletes outside its root', async () => {
      const saved = await storage.saveOriginal('sess1', await png(10, 10));
      const outside = path.join(os.tmpdir(), `ocr-outside-${Date.now()}.txt`);
      fs.writeFileSync(outside, 'keep');
      try {
        const removed = await storage.deleteFiles([
          saved.originalPath,
          'sess1/missing.png',
          path.relative(root, outside),
        ]);
        expect(removed).toBe(1);
        expect(fs.existsSync(path.join(root, saved.originalPath))).toBe(false);
        expect(fs.existsSync(outside)).toBe(true);
      } finally {
        fs.rmSync(outside, { force: true });
      }
    });
  });
});
