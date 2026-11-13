import { HttpStatus } from '@nestjs/common';
import { OcrImportError } from './ocr-import-error';
import { OcrIntakeService } from './ocr-intake.service';

const user = { id: 'u1', email: 'u@x', role: 'OFFICER', roleId: 'role-1' };

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

function setup(options: { granted?: Array<[string, string]> } = {}) {
  const granted = options.granted ?? [];
  const prisma = {
    rolePermission: {
      count: jest.fn(
        ({
          where,
        }: {
          where: { permission: { action: string; subject: string } };
        }) =>
          Promise.resolve(
            granted.some(
              ([a, s]) =>
                a === where.permission.action && s === where.permission.subject,
            )
              ? 1
              : 0,
          ),
      ),
    },
    ocrPage: {
      count: jest.fn(() => Promise.resolve(0)),
      findUnique: jest.fn(),
    },
  };
  const sessions = {
    createSession: jest.fn((entity: string) =>
      Promise.resolve({ id: 's1', entity }),
    ),
    getSession: jest.fn(() => Promise.resolve({ id: 's1', status: 'OPEN' })),
    addPage: jest.fn(),
    removePage: jest.fn(() => Promise.resolve({ pageSetRevision: 3 })),
    listPages: jest.fn(),
  };
  const pdfSandbox = { split: jest.fn() };
  const storage = {
    saveOriginal: jest.fn(),
    savePdfPage: jest.fn(),
    deleteFiles: jest.fn(() => Promise.resolve(1)),
    read: jest.fn(),
  };
  const queue = {
    enqueue: jest.fn(() => Promise.resolve({ id: 'j1', deduplicated: false })),
  };
  const sendPolicy = { assertForRole: jest.fn(() => Promise.resolve()) };
  const service = new OcrIntakeService(
    prisma as never,
    sessions as never,
    storage as never,
    queue as never,
    sendPolicy as never,
    pdfSandbox as never,
  );
  return { service, prisma, sessions, storage, queue, sendPolicy, pdfSandbox };
}

describe('OcrIntakeService', () => {
  describe('opening a session', () => {
    it('needs write permission on the kind of record being created', async () => {
      const { service, sessions } = setup({ granted: [['write', 'Incident']] });
      expect(await codeOf(service.openSession('PETITION', user))).toBe(
        'OCR_FORBIDDEN',
      );
      expect(sessions.createSession).not.toHaveBeenCalled();
      await service.openSession('INCIDENT', user);
      expect(sessions.createSession).toHaveBeenCalledWith('INCIDENT', {
        id: 'u1',
      });
    });

    it('maps each kind of record to its own subject', async () => {
      for (const [entity, subject] of [
        ['PETITION', 'Petition'],
        ['INCIDENT', 'Incident'],
        ['CASE', 'Case'],
      ] as const) {
        const { service, sessions } = setup({ granted: [['write', subject]] });
        await service.openSession(entity, user);
        expect(sessions.createSession).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('uploading a page', () => {
    const stored = {
      sha256: 'a'.repeat(64),
      mimeType: 'image/jpeg',
      sizeBytes: 3,
      originalPath: 's1/a.jpg',
    };

    it('stores the original, then records the page', async () => {
      const { service, sessions, storage } = setup();
      storage.saveOriginal.mockResolvedValue(stored);
      sessions.addPage.mockResolvedValue({
        page: { id: 'p1' },
        pageSetRevision: 1,
      });
      const result = await service.uploadPage('s1', Buffer.from('abc'), user);
      expect(storage.saveOriginal).toHaveBeenCalledWith(
        's1',
        Buffer.from('abc'),
      );
      expect(sessions.addPage).toHaveBeenCalledWith('s1', stored, { id: 'u1' });
      expect(result).toEqual({
        page: { id: 'p1' },
        pages: [{ id: 'p1' }],
        pageSetRevision: 1,
      });
    });

    it('removes the file again when the page could not be added and nothing else uses it', async () => {
      const { service, sessions, storage } = setup();
      storage.saveOriginal.mockResolvedValue(stored);
      sessions.addPage.mockRejectedValue(
        new OcrImportError('OCR_TOO_MANY_PAGES', HttpStatus.CONFLICT),
      );
      expect(
        await codeOf(service.uploadPage('s1', Buffer.from('abc'), user)),
      ).toBe('OCR_TOO_MANY_PAGES');
      expect(storage.deleteFiles).toHaveBeenCalledWith(['s1/a.jpg']);
    });

    it('keeps the file when a page row (live or removed) still points at it', async () => {
      const { service, sessions, storage, prisma } = setup();
      storage.saveOriginal.mockResolvedValue(stored);
      prisma.ocrPage.count.mockResolvedValue(1);
      sessions.addPage.mockRejectedValue(
        new OcrImportError('OCR_PAGE_DUPLICATE', HttpStatus.CONFLICT),
      );
      expect(
        await codeOf(service.uploadPage('s1', Buffer.from('abc'), user)),
      ).toBe('OCR_PAGE_DUPLICATE');
      expect(storage.deleteFiles).not.toHaveBeenCalled();
    });

    it("does not even store the file when the session is not the caller's", async () => {
      const { service, sessions, storage } = setup();
      sessions.getSession.mockRejectedValue(
        new OcrImportError('OCR_SESSION_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
      expect(
        await codeOf(service.uploadPage('s1', Buffer.from('abc'), user)),
      ).toBe('OCR_SESSION_NOT_FOUND');
      expect(storage.saveOriginal).not.toHaveBeenCalled();
    });
  });

  describe('uploading a PDF', () => {
    const pdfBytes = Buffer.from('%PDF-1.4 whole file');

    it('splits it in the sandbox and adds each page to the session, in order', async () => {
      const { service, sessions, storage, pdfSandbox } = setup();
      pdfSandbox.split.mockResolvedValue([
        new Uint8Array([1]),
        new Uint8Array([2]),
      ]);
      sessions.listPages.mockResolvedValue([]);
      storage.savePdfPage
        .mockResolvedValueOnce({
          sha256: 'a',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          originalPath: 's1/a.pdf',
        })
        .mockResolvedValueOnce({
          sha256: 'b',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          originalPath: 's1/b.pdf',
        });
      sessions.addPage
        .mockResolvedValueOnce({ page: { id: 'p1' }, pageSetRevision: 1 })
        .mockResolvedValueOnce({ page: { id: 'p2' }, pageSetRevision: 2 });

      const result = await service.uploadPage('s1', pdfBytes, user);

      expect(pdfSandbox.split).toHaveBeenCalledWith(pdfBytes);
      expect(storage.saveOriginal).not.toHaveBeenCalled();
      expect(result).toEqual({
        page: { id: 'p1' },
        pages: [{ id: 'p1' }, { id: 'p2' }],
        pageSetRevision: 2,
      });
    });

    it('refuses before adding anything when the pages would not fit the session', async () => {
      const { service, sessions, storage, pdfSandbox } = setup();
      pdfSandbox.split.mockResolvedValue(
        Array.from({ length: 5 }, () => new Uint8Array([1])),
      );
      sessions.listPages.mockResolvedValue(
        Array.from({ length: 17 }, (_, i) => ({ id: `p${i}` })),
      );
      expect(await codeOf(service.uploadPage('s1', pdfBytes, user))).toBe(
        'OCR_TOO_MANY_PAGES',
      );
      expect(storage.savePdfPage).not.toHaveBeenCalled();
    });

    const file = (name: string) => ({
      sha256: name,
      mimeType: 'application/pdf',
      sizeBytes: 1,
      originalPath: `s1/${name}.pdf`,
    });

    it('adds a page that repeats inside the PDF once instead of failing on the second copy', async () => {
      const { service, sessions, storage, pdfSandbox } = setup();
      pdfSandbox.split.mockResolvedValue([
        new Uint8Array([1]),
        new Uint8Array([1]),
        new Uint8Array([2]),
      ]);
      sessions.listPages.mockResolvedValue([]);
      storage.savePdfPage
        .mockResolvedValueOnce(file('a'))
        .mockResolvedValueOnce(file('a'))
        .mockResolvedValueOnce(file('b'));
      sessions.addPage
        .mockResolvedValueOnce({ page: { id: 'p1' }, pageSetRevision: 1 })
        .mockResolvedValueOnce({ page: { id: 'p2' }, pageSetRevision: 2 });
      const result = await service.uploadPage('s1', pdfBytes, user);
      expect(sessions.addPage).toHaveBeenCalledTimes(2);
      expect(result.pages).toEqual([{ id: 'p1' }, { id: 'p2' }]);
    });

    it('refuses the whole PDF when one of its pages is already in the session, and leaves no files behind', async () => {
      const { service, sessions, storage, pdfSandbox } = setup();
      pdfSandbox.split.mockResolvedValue([
        new Uint8Array([1]),
        new Uint8Array([2]),
      ]);
      sessions.listPages.mockResolvedValue([{ id: 'p0', sha256: 'b' }]);
      storage.savePdfPage
        .mockResolvedValueOnce(file('a'))
        .mockResolvedValueOnce(file('b'));
      expect(await codeOf(service.uploadPage('s1', pdfBytes, user))).toBe(
        'OCR_PAGE_DUPLICATE',
      );
      expect(sessions.addPage).not.toHaveBeenCalled();
      expect(storage.deleteFiles).toHaveBeenCalledWith([
        's1/a.pdf',
        's1/b.pdf',
      ]);
    });

    it('takes back the pages already added when a later one fails', async () => {
      const { service, sessions, storage, prisma, pdfSandbox } = setup();
      pdfSandbox.split.mockResolvedValue([
        new Uint8Array([1]),
        new Uint8Array([2]),
      ]);
      sessions.listPages.mockResolvedValue([]);
      storage.savePdfPage
        .mockResolvedValueOnce(file('a'))
        .mockResolvedValueOnce(file('b'));
      sessions.addPage
        .mockResolvedValueOnce({ page: { id: 'p1' }, pageSetRevision: 1 })
        .mockRejectedValueOnce(
          new OcrImportError('OCR_TOO_MANY_PAGES', HttpStatus.CONFLICT),
        );
      // The first file is held by the page row that was just taken back; the second never got a row.
      (prisma.ocrPage.count as jest.Mock).mockImplementation(
        ({ where }: { where: { originalPath: string } }) =>
          Promise.resolve(where.originalPath === 's1/a.pdf' ? 1 : 0),
      );
      expect(await codeOf(service.uploadPage('s1', pdfBytes, user))).toBe(
        'OCR_TOO_MANY_PAGES',
      );
      expect(sessions.removePage).toHaveBeenCalledWith('s1', 'p1', {
        id: 'u1',
      });
      expect(storage.deleteFiles).toHaveBeenCalledWith(['s1/b.pdf']);
    });

    it('a plain image still goes the old way and the answer keeps the same shape', async () => {
      const { service, sessions, storage } = setup();
      storage.saveOriginal.mockResolvedValue({
        sha256: 'a'.repeat(64),
        mimeType: 'image/jpeg',
        sizeBytes: 3,
        originalPath: 's1/a.jpg',
      });
      sessions.addPage.mockResolvedValue({
        page: { id: 'p1' },
        pageSetRevision: 1,
      });
      expect(await service.uploadPage('s1', Buffer.from('abc'), user)).toEqual({
        page: { id: 'p1' },
        pages: [{ id: 'p1' }],
        pageSetRevision: 1,
      });
    });
  });

  describe('requesting a reading', () => {
    it('asks the send policy about the role of the caller, then queues the work', async () => {
      const { service, queue, sendPolicy } = setup();
      expect(await service.requestRead('s1', 'ANALYSE', user)).toEqual({
        id: 'j1',
        deduplicated: false,
      });
      expect(sendPolicy.assertForRole).toHaveBeenCalledWith('u1', 'role-1');
      expect(queue.enqueue).toHaveBeenCalledWith('s1', 'ANALYSE', { id: 'u1' });
    });

    it('queues nothing when the policy refuses', async () => {
      const { service, queue, sendPolicy } = setup();
      sendPolicy.assertForRole.mockRejectedValue(
        new OcrImportError('OCR_FORBIDDEN', HttpStatus.FORBIDDEN),
      );
      expect(await codeOf(service.requestRead('s1', 'READ', user))).toBe(
        'OCR_FORBIDDEN',
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('viewing a page image', () => {
    it("serves the original of a page of the caller's own session", async () => {
      const { service, sessions, storage, prisma } = setup();
      sessions.listPages.mockResolvedValue([{ id: 'p1' }]);
      prisma.ocrPage.findUnique.mockResolvedValue({
        id: 'p1',
        originalPath: 's1/a.jpg',
        mimeType: 'image/jpeg',
      });
      storage.read.mockResolvedValue(Buffer.from('bytes'));
      expect(await service.pageImage('s1', 'p1', user)).toEqual({
        bytes: Buffer.from('bytes'),
        mimeType: 'image/jpeg',
      });
    });

    it('refuses a page that is not in the session', async () => {
      const { service, sessions, storage } = setup();
      sessions.listPages.mockResolvedValue([{ id: 'other' }]);
      expect(await codeOf(service.pageImage('s1', 'p1', user))).toBe(
        'OCR_PAGE_NOT_FOUND',
      );
      expect(storage.read).not.toHaveBeenCalled();
    });
  });
});
