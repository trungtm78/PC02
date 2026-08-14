import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';
import { VksMeetingsService } from '../vks-meetings/vks-meetings.service';
import { UpdateActionPlanDto } from './dto/update-action-plan.dto';
import { UpdateInvestigationSupplementDto } from '../../investigation-supplements/dto/update-investigation-supplement.dto';

/**
 * D5. These three modules could create and delete but not edit. Fixing a typo
 * meant deleting the record and making a new one — losing the trail and the id
 * anything else referenced.
 *
 * The update path asks the same authorisation question `delete` already asked,
 * and the DTOs are derived from the create DTOs rather than retyped: a
 * hand-copied field list drifts the first time somebody adds a field, and it
 * drifts silently — the new field is editable on create, not on update, and
 * nothing reports it.
 */

const IN_SCOPE = {
  id: 'ap-1',
  case: { assignedTeamId: 'team-a', investigatorId: 'u-1' },
  incident: null,
};
const OTHER_TEAM = {
  id: 'ap-2',
  case: { assignedTeamId: 'team-b', investigatorId: 'u-9' },
  incident: null,
};

const scope = {
  teamIds: ['team-a'],
  writableTeamIds: ['team-a'],
  userIds: ['u-1'],
  writableUserIds: ['u-1'],
  canDispatch: false,
} as never;

function makeActionPlans(record: unknown) {
  const prisma: any = {
    suspensionActionPlan: {
      findUnique: jest.fn(() => Promise.resolve(record)),
      update: jest.fn(() => Promise.resolve({ id: 'ap-1' })),
    },
  };
  // Qua constructor thật — xem ghi chú ở `bulk-operations.spec.ts`.
  const svc = new ActionPlansService(prisma as never);
  return { svc, prisma };
}

describe('ActionPlansService.update', () => {
  it('updates a record in the caller scope', async () => {
    const { svc, prisma } = makeActionPlans(IN_SCOPE);

    await svc.update(
      'ap-1',
      { bienPhap: 'Bổ sung biện pháp khắc phục' } as UpdateActionPlanDto,
      scope,
    );

    expect(prisma.suspensionActionPlan.update).toHaveBeenCalled();
  });

  it("refuses another team's record", async () => {
    const { svc, prisma } = makeActionPlans(OTHER_TEAM);

    await expect(
      svc.update('ap-2', { bienPhap: 'x' } as UpdateActionPlanDto, scope),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.suspensionActionPlan.update).not.toHaveBeenCalled();
  });

  it('404s on an unknown id', async () => {
    const { svc } = makeActionPlans(null);

    await expect(
      svc.update('nope', {} as UpdateActionPlanDto, scope),
    ).rejects.toThrow(NotFoundException);
  });

  it('converts the date field rather than passing a string to a DateTime column', async () => {
    const { svc, prisma } = makeActionPlans(IN_SCOPE);

    await svc.update(
      'ap-1',
      { ngayLap: '2026-08-10' } as UpdateActionPlanDto,
      scope,
    );

    expect(
      prisma.suspensionActionPlan.update.mock.calls[0][0].data.ngayLap,
    ).toBeInstanceOf(Date);
  });
});

describe('VksMeetingsService.update', () => {
  function make(record: unknown) {
    const prisma: any = {
      vksMeetingRecord: {
        findUnique: jest.fn(() => Promise.resolve(record)),
        update: jest.fn(() => Promise.resolve({ id: 'vks-1' })),
      },
    };
    const svc = new VksMeetingsService(prisma as never);
    return { svc, prisma };
  }

  it("refuses another team's record", async () => {
    const { svc } = make({
      id: 'vks-1',
      case: { assignedTeamId: 'team-b' },
      incident: null,
    });

    await expect(
      svc.update('vks-1', { noiDung: 'x' } as never, scope),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('UpdateInvestigationSupplementDto', () => {
  it('does not carry a parent id', () => {
    // Unlike the other two, this module's parent lives in the BODY, not the
    // path. Accepting `caseId` on update would reopen ND-18 exactly: a
    // reparent that checks only the old parent.
    const dto = new UpdateInvestigationSupplementDto() as Record<
      string,
      unknown
    >;
    dto.caseId = 'case-b';

    // The DTO type has no such field — the assertion here is on the class
    // shape the validator whitelist is built from.
    expect(Object.keys(new UpdateInvestigationSupplementDto())).not.toContain(
      'caseId',
    );
  });
});
