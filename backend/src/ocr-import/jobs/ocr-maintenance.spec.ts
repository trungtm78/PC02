import { OcrMaintenance } from './ocr-maintenance';

describe('OcrMaintenance', () => {
  it('removes expired sessions, then the files that belonged to them', async () => {
    const order: string[] = [];
    const sessions = {
      purgeExpired: jest.fn(() => {
        order.push('db');
        return Promise.resolve({
          files: ['s1/a.jpg', 's1/a.derived.jpg'],
          sessions: 1,
        });
      }),
    };
    const storage = {
      deleteFiles: jest.fn(() => {
        order.push('files');
        return Promise.resolve(2);
      }),
    };
    const maintenance = new OcrMaintenance(sessions as never, storage as never);

    const result = await maintenance.purge(new Date('2026-11-20T00:00:00Z'));

    expect(sessions.purgeExpired).toHaveBeenCalledWith(
      new Date('2026-11-20T00:00:00Z'),
    );
    expect(storage.deleteFiles).toHaveBeenCalledWith([
      's1/a.jpg',
      's1/a.derived.jpg',
    ]);
    expect(order).toEqual(['db', 'files']);
    expect(result).toEqual({ sessions: 1, files: 2 });
  });

  it('does not touch the disk when nothing expired', async () => {
    const sessions = {
      purgeExpired: jest.fn(() => Promise.resolve({ files: [], sessions: 0 })),
    };
    const storage = { deleteFiles: jest.fn() };
    const maintenance = new OcrMaintenance(sessions as never, storage as never);
    expect(await maintenance.purge(new Date())).toEqual({
      sessions: 0,
      files: 0,
    });
    expect(storage.deleteFiles).not.toHaveBeenCalled();
  });

  it('the scheduled run swallows an error so the next hour tries again', async () => {
    const sessions = {
      purgeExpired: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const maintenance = new OcrMaintenance(sessions as never, {} as never);
    await expect(maintenance.run()).resolves.toBeUndefined();
  });
});
