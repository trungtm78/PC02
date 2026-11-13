import { HttpStatus } from '@nestjs/common';
import { Readable } from 'node:stream';
import { OcrImportError } from './ocr-import-error';
import { OcrRereadService } from './ocr-reread.service';

const user = { id: 'u1', email: 'u@x', role: 'OFFICER', roleId: 'role-1' };
const scope = { teamIds: ['t1'] } as never;

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

const doc = (id: string, title: string, at: string) => ({
  id,
  title,
  createdAt: new Date(at),
});

function setup(
  options: {
    docs?: ReturnType<typeof doc>[];
    editAllowed?: boolean;
    downloadFails?: string;
    pdf?: boolean;
  } = {},
) {
  const docs = options.docs ?? [
    doc('d2', 'Bản scan trang 2', '2026-11-01T10:00:02Z'),
    doc('d1', 'Bản scan trang 1', '2026-11-01T10:00:01Z'),
  ];
  const documents = {
    getList: jest.fn(() =>
      Promise.resolve({ success: true, data: docs, total: docs.length }),
    ),
    openDownload: jest.fn((id: string) => {
      if (options.downloadFails === id)
        return Promise.reject(new Error('gone'));
      return Promise.resolve({
        success: true,
        data: {
          stream: Readable.from(
            Buffer.from(options.pdf ? `%PDF-1.4 ${id}` : `bytes-of-${id}`),
          ),
          originalName: `${id}.jpg`,
          mimeType: 'image/jpeg',
        },
      });
    }),
  };
  const sessions = {
    createSession: jest.fn(() => Promise.resolve({ id: 'sess-new' })),
    addPage: jest.fn(() =>
      Promise.resolve({ page: { id: 'p' }, pageSetRevision: 1 }),
    ),
    cancel: jest.fn(() => Promise.resolve()),
  };
  const storage = {
    savePdfPage: jest.fn((_s: string, bytes: Buffer) =>
      Promise.resolve({
        sha256: bytes.toString('hex').slice(0, 8),
        mimeType: 'application/pdf',
        sizeBytes: bytes.length,
        originalPath: `sess-new/${bytes.toString()}.pdf`,
      }),
    ),
    saveOriginal: jest.fn((_s: string, bytes: Buffer) =>
      Promise.resolve({
        sha256: bytes.toString('hex').slice(0, 8),
        mimeType: 'image/jpeg',
        sizeBytes: bytes.length,
        originalPath: `sess-new/${bytes.toString()}.jpg`,
      }),
    ),
  };
  const queue = {
    enqueue: jest.fn(() =>
      Promise.resolve({ id: 'job-1', deduplicated: false }),
    ),
  };
  const policy = {
    assertForRole: jest.fn(() => Promise.resolve()),
    requirePermission: jest.fn((_u: string, _r: string, action: string) =>
      options.editAllowed === false
        ? Promise.reject(
            new OcrImportError('OCR_FORBIDDEN', HttpStatus.FORBIDDEN, {
              action,
            }),
          )
        : Promise.resolve(),
    ),
  };
  const service = new OcrRereadService(
    documents as never,
    sessions as never,
    storage as never,
    queue as never,
    policy as never,
  );
  return { service, documents, sessions, storage, queue, policy };
}

describe('OcrRereadService', () => {
  it('reads the scans attached to a saved record again: authorised download of each, in page order, then a reading', async () => {
    const { service, documents, sessions, storage, queue } = setup();
    const result = await service.start('PETITION', 'pet-1', user, scope);

    expect(documents.getList).toHaveBeenCalledWith(
      expect.objectContaining({
        petitionId: 'pet-1',
        documentType: 'BAN_SCAN',
      }),
      scope,
      'u1',
    );
    // page order follows the title/creation order, not the order the list returned
    expect(documents.openDownload.mock.calls.map((c) => c[0])).toEqual([
      'd1',
      'd2',
    ]);
    expect(documents.openDownload).toHaveBeenCalledWith(
      'd1',
      { userId: 'u1' },
      scope,
    );
    expect(sessions.createSession).toHaveBeenCalledWith('PETITION', {
      id: 'u1',
    });
    expect(storage.saveOriginal).toHaveBeenCalledTimes(2);
    expect(sessions.addPage).toHaveBeenCalledTimes(2);
    expect(queue.enqueue).toHaveBeenCalledWith('sess-new', 'READ', {
      id: 'u1',
    });
    expect(result).toEqual({ sessionId: 'sess-new', jobId: 'job-1', pages: 2 });
  });

  it('reads scans that were attached from a PDF too: they are stored as PDF pages, not refused as images', async () => {
    const { service, storage, sessions } = setup({ pdf: true });
    await service.start('PETITION', 'pet-1', user, scope);
    expect(storage.savePdfPage).toHaveBeenCalledTimes(2);
    expect(storage.saveOriginal).not.toHaveBeenCalled();
    expect(sessions.addPage).toHaveBeenCalledTimes(2);
  });

  it('looks the scans up under the right parent for each kind of record', async () => {
    for (const [entity, key] of [
      ['PETITION', 'petitionId'],
      ['INCIDENT', 'incidentId'],
      ['CASE', 'caseId'],
    ] as const) {
      const { service, documents } = setup();
      await service.start(entity, 'rec-9', user, scope);
      expect(documents.getList).toHaveBeenCalledWith(
        expect.objectContaining({ [key]: 'rec-9' }),
        scope,
        'u1',
      );
    }
  });

  it('needs permission to edit the record and to send its scans to the providers', async () => {
    const denied = setup({ editAllowed: false });
    expect(await codeOf(denied.service.start('CASE', 'c1', user, scope))).toBe(
      'OCR_FORBIDDEN',
    );
    expect(denied.documents.getList).not.toHaveBeenCalled();
    expect(denied.policy.requirePermission).toHaveBeenCalledWith(
      'u1',
      'role-1',
      'edit',
      'Case',
    );

    const ok = setup();
    await ok.service.start('CASE', 'c1', user, scope);
    expect(ok.policy.assertForRole).toHaveBeenCalledWith('u1', 'role-1');
  });

  it('says so when the record has no scans, and opens no session', async () => {
    const { service, sessions } = setup({ docs: [] });
    expect(await codeOf(service.start('PETITION', 'pet-1', user, scope))).toBe(
      'OCR_NO_PAGES',
    );
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it('gives up cleanly when one scan cannot be read: the half-built session is cancelled', async () => {
    const { service, sessions, queue } = setup({ downloadFails: 'd2' });
    await expect(
      service.start('PETITION', 'pet-1', user, scope),
    ).rejects.toThrow('gone');
    expect(sessions.cancel).toHaveBeenCalledWith('sess-new', { id: 'u1' });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
