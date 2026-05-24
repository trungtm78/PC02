import { generateIncidentCode } from './incident-code.util';

describe('generateIncidentCode', () => {
  const year = new Date().getFullYear();
  const prefix = `VV-${year}-`;

  it('generates VV-YYYY-00001 when no existing codes', async () => {
    const tx = {
      incident: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const code = await generateIncidentCode(tx);
    expect(code).toBe(`${prefix}00001`);
  });

  it('generates next sequential code after the latest', async () => {
    const tx = {
      incident: {
        findFirst: jest.fn().mockResolvedValue({ code: `${prefix}00042` }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const code = await generateIncidentCode(tx);
    expect(code).toBe(`${prefix}00043`);
  });

  it('throws after 3 consecutive conflicts', async () => {
    const tx = {
      incident: {
        findFirst: jest.fn().mockResolvedValue({ code: `${prefix}00001` }),
        findUnique: jest.fn().mockResolvedValue({ id: 'conflict-id' }),
      },
    } as any;

    await expect(generateIncidentCode(tx)).rejects.toThrow(
      'generateIncidentCode: failed after 3 retries',
    );
  });
});
