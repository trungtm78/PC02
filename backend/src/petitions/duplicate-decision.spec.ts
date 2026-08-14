import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PetitionDuplicateDecision, PetitionStatus } from '@prisma/client';
import { PetitionsService } from './petitions.service';

/**
 * First argument of a mock call, typed loosely on purpose.
 *
 * `jest.fn(async () => …)` infers a zero-length argument tuple, so reading
 * `mock.calls[0][0]` stops type-checking — and the arguments are exactly what
 * these tests assert on. Adding a dummy parameter to every mock just to widen
 * the tuple trades a type error for an unused-variable one.
 */
function firstArg(mock: jest.Mock): any {
  return mock.mock.calls[0][0];
}

/**
 * C4. The screen used to offer "hợp nhất" as if it meant "delete the other
 * one". Under the Law on Complaints and the Law on Denunciations it cannot:
 * each petition carries its own duty to accept, its own deadline and its own
 * written reply to its own sender. These tests pin the three things that makes
 * true — the secondary survives, both files get the audit entry, and a
 * "not a duplicate" verdict is stored rather than dropped.
 */

const PRIMARY = {
  id: 'p-1',
  stt: 'DT-2026-00001',
  status: PetitionStatus.MOI_TIEP_NHAN,
  senderName: 'Nguyễn Văn A',
  senderPhone: '0901111111',
  senderAddress: 'Quận 1',
  suspectedPerson: 'X',
};
const DUPLICATE = {
  id: 'p-2',
  stt: 'DT-2026-00002',
  status: PetitionStatus.MOI_TIEP_NHAN,
  senderName: 'Nguyễn Văn A',
  senderPhone: '0901111111',
  senderAddress: 'Quận 1',
  suspectedPerson: 'X',
};

function makeService(overrides: Record<string, any> = {}) {
  const fn = (impl: () => any) => jest.fn(() => Promise.resolve(impl()));
  // The return values are deliberately fixed rather than echoing the input:
  // every assertion in this file reads the recorded call, not the reply.
  const tx = {
    petitionDuplicateLink: {
      create: fn(() => ({ id: 'link-1' })),
      update: fn(() => ({ id: 'link-1' })),
    },
    petition: { update: fn(() => ({})) },
  };
  const prisma = {
    petition: {
      findMany: fn(() => [PRIMARY, DUPLICATE]),
    },
    petitionDuplicateLink: {
      findFirst: fn(() => null),
      findMany: fn(() => []),
      count: fn(() => 0),
    },
    $transaction: jest.fn((cb: any) => cb(tx)),
    ...overrides,
  };
  const audit = { log: fn(() => undefined) };

  // Qua constructor thật — xem ghi chú ở `bulk-operations.spec.ts`. Bốn dep
  // sau không nằm trên đường đi của quyết định trùng đơn.
  const svc = new PetitionsService(
    prisma as never,
    audit as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
  return { svc, prisma, audit, tx };
}

const DTO = {
  primaryPetitionId: 'p-1',
  duplicatePetitionId: 'p-2',
  decision: PetitionDuplicateDecision.DA_HOP_NHAT,
  reason: 'Cùng người gửi, cùng nội dung, gửi hai lần trong một tuần.',
};

describe('decideDuplicate', () => {
  it('files the secondary away instead of deleting it', async () => {
    const { svc, tx } = makeService();

    await svc.decideDuplicate(DTO, 'user-1', null);

    expect(tx.petition.update).toHaveBeenCalledWith({
      where: { id: 'p-2' },
      data: { status: PetitionStatus.DA_LUU_DON },
    });
    // The thing this whole model exists to prevent.
    expect((tx.petition as any).delete).toBeUndefined();
  });

  it('audits both petitions, each under its own subjectId', async () => {
    // The decision belongs on both files. Logging only the survivor leaves the
    // filed-away petition with no explanation of why its status changed.
    const { svc, audit } = makeService();

    await svc.decideDuplicate(DTO, 'user-1', null);

    const subjects = audit.log.mock.calls
      .map((c: any[]) => c[0].subjectId)
      .sort();
    expect(subjects).toEqual(['p-1', 'p-2']);
    expect(
      audit.log.mock.calls.every(
        (c: any[]) => c[0].action === 'PETITION_DUPLICATE_DECIDED',
      ),
    ).toBe(true);
  });

  it('stores the score the decision rested on', async () => {
    const { svc, tx } = makeService();

    await svc.decideDuplicate(DTO, 'user-1', null);

    const data = firstArg(tx.petitionDuplicateLink.create as jest.Mock).data;
    expect(data.matchedCriteria).toBe(4);
    expect(data.comparedCriteria).toBe(4);
    expect(data.reason).toBe(DTO.reason);
  });

  it('records "not a duplicate" without touching either status', async () => {
    // Storing the negative is what stops the next sweep re-suggesting the pair
    // and the next officer re-deciding it from scratch.
    const { svc, tx } = makeService();

    await svc.decideDuplicate(
      { ...DTO, decision: PetitionDuplicateDecision.KHONG_TRUNG },
      'user-1',
      null,
    );

    expect(tx.petitionDuplicateLink.create).toHaveBeenCalled();
    expect(tx.petition.update).not.toHaveBeenCalled();
  });

  it('refuses to mark a petition as a duplicate of itself', async () => {
    const { svc } = makeService();

    await expect(
      svc.decideDuplicate(
        { ...DTO, duplicatePetitionId: 'p-1' },
        'user-1',
        null,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses when either petition is outside the caller scope', async () => {
    // Only one of the two came back from the scoped query.
    const { svc } = makeService({
      petition: { findMany: jest.fn(() => Promise.resolve([PRIMARY])) },
    });

    await expect(svc.decideDuplicate(DTO, 'user-1', null)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('does not say which petition was out of scope', async () => {
    // Naming it turns this endpoint into a probe for records in other units.
    const { svc } = makeService({
      petition: { findMany: jest.fn(() => Promise.resolve([PRIMARY])) },
    });

    await expect(svc.decideDuplicate(DTO, 'user-1', null)).rejects.toThrow(
      /không tìm thấy đơn thư, hoặc đơn nằm ngoài phạm vi/i,
    );
  });

  it('refuses a second live decision on the same petition', async () => {
    const { svc } = makeService({
      petitionDuplicateLink: {
        findFirst: jest.fn(() => Promise.resolve({ id: 'existing' })),
      },
    });

    await expect(svc.decideDuplicate(DTO, 'user-1', null)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('revertDuplicate', () => {
  function makeRevertService(link: any) {
    const { svc, prisma, audit, tx } = makeService({
      petitionDuplicateLink: {
        findFirst: jest.fn(() => Promise.resolve(link)),
      },
    });
    return { svc, prisma, audit, tx };
  }

  const LIVE_MERGE = {
    id: 'link-1',
    decision: PetitionDuplicateDecision.DA_HOP_NHAT,
    duplicatePetitionId: 'p-2',
    primaryPetitionId: 'p-1',
    primaryPetition: { id: 'p-1', stt: 'DT-2026-00001' },
    duplicatePetition: {
      id: 'p-2',
      stt: 'DT-2026-00002',
      status: PetitionStatus.DA_LUU_DON,
    },
  };

  it('keeps the row and stamps who undid it and why', async () => {
    // A hard delete leaves the next officer looking at a pair with no history
    // and no idea it had already been argued over once.
    const { svc, tx } = makeRevertService(LIVE_MERGE);

    await svc.revertDuplicate(
      'link-1',
      { revertReason: 'Xác minh lại: hai người khác nhau.' },
      'user-2',
      null,
    );

    const data = firstArg(tx.petitionDuplicateLink.update as jest.Mock).data;
    expect(data.revertedById).toBe('user-2');
    expect(data.revertReason).toBe('Xác minh lại: hai người khác nhau.');
    expect(data.revertedAt).toBeInstanceOf(Date);
  });

  it('brings the filed-away petition back', async () => {
    const { svc, tx } = makeRevertService(LIVE_MERGE);

    await svc.revertDuplicate(
      'link-1',
      { revertReason: 'Xác minh lại: hai người khác nhau.' },
      'user-2',
      null,
    );

    expect(tx.petition.update).toHaveBeenCalledWith({
      where: { id: 'p-2' },
      data: { status: PetitionStatus.MOI_TIEP_NHAN },
    });
  });

  it('leaves the status alone when the officer moved it on since', async () => {
    // Only the status this merge set is undone. Guessing further would be
    // inventing history the system does not have.
    const { svc, tx } = makeRevertService({
      ...LIVE_MERGE,
      duplicatePetition: {
        ...LIVE_MERGE.duplicatePetition,
        status: PetitionStatus.DANG_XU_LY,
      },
    });

    await svc.revertDuplicate(
      'link-1',
      { revertReason: 'Xác minh lại: hai người khác nhau.' },
      'user-2',
      null,
    );

    expect(tx.petition.update).not.toHaveBeenCalled();
  });

  it('does not change any status when undoing a "not a duplicate"', async () => {
    const { svc, tx } = makeRevertService({
      ...LIVE_MERGE,
      decision: PetitionDuplicateDecision.KHONG_TRUNG,
      duplicatePetition: {
        ...LIVE_MERGE.duplicatePetition,
        status: PetitionStatus.MOI_TIEP_NHAN,
      },
    });

    await svc.revertDuplicate(
      'link-1',
      { revertReason: 'Ghi nhầm cặp đơn.' },
      'user-2',
      null,
    );

    expect(tx.petition.update).not.toHaveBeenCalled();
  });

  it('audits both files again', async () => {
    const { svc, audit } = makeRevertService(LIVE_MERGE);

    await svc.revertDuplicate(
      'link-1',
      { revertReason: 'Xác minh lại: hai người khác nhau.' },
      'user-2',
      null,
    );

    expect(
      audit.log.mock.calls.map((c: any[]) => c[0].subjectId).sort(),
    ).toEqual(['p-1', 'p-2']);
    expect(firstArg(audit.log as jest.Mock).action).toBe(
      'PETITION_DUPLICATE_REVERTED',
    );
  });

  it('refuses a link that is already reverted or out of scope', async () => {
    const { svc } = makeRevertService(null);

    await expect(
      svc.revertDuplicate(
        'link-1',
        { revertReason: 'Ghi nhầm cặp đơn.' },
        'user-2',
        null,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('listDuplicateLinks', () => {
  it('hides reverted decisions by default', async () => {
    const { svc, prisma } = makeService();

    await svc.listDuplicateLinks({}, null);

    expect(
      firstArg(prisma.petitionDuplicateLink.findMany as jest.Mock).where
        .revertedAt,
    ).toBeNull();
  });

  it('includes them when asked, accepting the string a query string carries', async () => {
    const { svc, prisma } = makeService();

    await svc.listDuplicateLinks({ includeReverted: 'true' }, null);

    expect(
      firstArg(prisma.petitionDuplicateLink.findMany as jest.Mock).where
        .revertedAt,
    ).toBeUndefined();
  });

  it('caps the page size so a caller cannot ask for everything', async () => {
    const { svc, prisma } = makeService();

    await svc.listDuplicateLinks({ limit: 5000 }, null);

    expect(
      firstArg(prisma.petitionDuplicateLink.findMany as jest.Mock).take,
    ).toBe(100);
  });
});
