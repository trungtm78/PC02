import { BadRequestException } from '@nestjs/common';
import { uploadedFileName, validateUploadedDocument } from './document-upload-policy';

describe('document upload policy', () => {
  const media = {
    originalname: 'recording.wav',
    mimetype: 'audio/wav',
    size: 80 * 1024 * 1024,
  };

  it('accepts a supported 100 MB media format with matching detected bytes', () => {
    expect(() =>
      validateUploadedDocument(media, 'audio/vnd.wave', 'AM_THANH'),
    ).not.toThrow();
  });

  it('accepts AVI and WMV using MIME values reported by the installed byte detector', () => {
    expect(() =>
      validateUploadedDocument(
        { originalname: 'clip.avi', mimetype: 'video/x-msvideo', size: 1024 },
        'video/vnd.avi',
        'VIDEO',
      ),
    ).not.toThrow();
    expect(() =>
      validateUploadedDocument(
        { originalname: 'clip.wmv', mimetype: 'video/x-ms-wmv', size: 1024 },
        'video/x-ms-asf',
        'VIDEO',
      ),
    ).not.toThrow();
  });

  it('rejects an audio ASF stream disguised as WMV', () => {
    expect(() =>
      validateUploadedDocument(
        { originalname: 'clip.wmv', mimetype: 'video/x-ms-wmv', size: 1024 },
        'audio/x-ms-asf',
        'VIDEO',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a nonmedia file larger than 10 MB', () => {
    expect(() =>
      validateUploadedDocument(
        { ...media, originalname: 'report.pdf', mimetype: 'application/pdf' },
        'application/pdf',
        'VAN_BAN',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a forged extension even if its claimed MIME is allowed', () => {
    expect(() =>
      validateUploadedDocument(
        { ...media, originalname: 'recording.pdf' },
        'audio/vnd.wave',
        'AM_THANH',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects media when detected bytes disagree with the claimed MIME', () => {
    expect(() =>
      validateUploadedDocument(media, 'video/mp4', 'AM_THANH'),
    ).toThrow(BadRequestException);
  });
});

describe('uploadedFileName', () => {
  // What the multipart parser hands over for a UTF-8 name: each byte read as one latin1 character.
  const asParsed = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

  it('gives back the Vietnamese name the person chose (found in the browser pass)', () => {
    expect(asParsed('Báo cáo xác minh.pdf')).toBe('BÃ¡o cÃ¡o xÃ¡c minh.pdf');
    expect(uploadedFileName(asParsed('Báo cáo xác minh.pdf'))).toBe('Báo cáo xác minh.pdf');
    expect(uploadedFileName(asParsed('Ghi chú xác minh.txt'))).toBe('Ghi chú xác minh.txt');
  });

  it('leaves a plain name, a true latin1 name and a name already in Unicode as they came', () => {
    expect(uploadedFileName('report-2026.pdf')).toBe('report-2026.pdf');
    // "café" sent as latin1 bytes is not valid UTF-8: kept.
    expect(uploadedFileName('café.txt')).toBe('café.txt');
    expect(uploadedFileName('Báo cáo điều tra.pdf')).toBe('Báo cáo điều tra.pdf');
  });
});
