import { describe, expect, it, vi } from 'vitest';
import { loadCaseMediaDocuments, prepareMediaFile, uploadPendingMedia } from '../media-upload';
import type { MediaFile } from '../types';

describe('Case media staging', () => {
  const makeMedia = (id: string, recordDate: string): MediaFile => ({
    id,
    name: `${id}.wav`,
    type: 'audio/wav',
    size: '1 MB',
    uploadDate: '',
    uploader: '',
    recordDate,
    file: new File(['audio'], `${id}.wav`, { type: 'audio/wav' }),
  });

  it('uploads bytes and each recording date, retaining only failed files for retry', async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce({ id: 'server-one' })
      .mockRejectedValueOnce(new Error('network'));
    const result = await uploadPendingMedia('case-1', [makeMedia('one', '2026-09-26'), makeMedia('two', '2026-09-27')], upload);

    expect(result.failed).toBe(1);
    expect(result.files[0].id).toBe('server-one');
    expect(result.files[0].file).toBeUndefined();
    expect(result.files[1].file).toBeInstanceOf(File);
    const firstPayload = upload.mock.calls[0][0] as FormData;
    expect(firstPayload.get('caseId')).toBe('case-1');
    expect(firstPayload.get('recordedAt')).toBe('2026-09-26');
    expect(firstPayload.get('documentType')).toBe('AM_THANH');
    expect(firstPayload.get('file')).toBeInstanceOf(File);

    const retry = vi.fn().mockResolvedValue({ id: 'server-two' });
    const afterRetry = await uploadPendingMedia('case-1', result.files, retry);
    expect(afterRetry.failed).toBe(0);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(afterRetry.files.map((item) => item.id)).toEqual(['server-one', 'server-two']);
  });

  it('classifies an MP3 without a browser MIME as audio while preserving bytes', async () => {
    const source = new File(['sound-bytes'], 'interview.mp3');
    const prepared = prepareMediaFile(source);
    expect(prepared.type).toBe('audio/mpeg');
    const upload = vi.fn().mockResolvedValue({ id: 'media-1' });
    await uploadPendingMedia('case-1', [{ ...makeMedia('one', '2026-09-20'), file: prepared, type: prepared.type }], upload);
    const body = upload.mock.calls[0][0] as FormData;
    expect(body.get('documentType')).toBe('AM_THANH');
    expect((body.get('file') as File).size).toBe(source.size);
  });

  it('loads every page of both media categories without silently cutting off older files', async () => {
    const audio = Array.from({ length: 101 }, (_, index) => ({ id: `audio-${index}` }));
    const video = [{ id: 'video-1' }];
    const get = vi.fn(async (url: string) => {
      const isAudio = url.includes('documentType=AM_THANH');
      const offset = Number(new URL(url, 'http://local').searchParams.get('offset'));
      const all = isAudio ? audio : video;
      return { data: all.slice(offset, offset + 100), total: all.length };
    });
    const records = await loadCaseMediaDocuments('case-1', get);
    expect(records).toHaveLength(102);
    expect(records.at(-1)?.id).toBe('video-1');
    expect(get).toHaveBeenCalledTimes(3);
    expect(get.mock.calls.some(([url]) => url.includes('documentType=AM_THANH') && url.includes('offset=100'))).toBe(true);
  });
});
