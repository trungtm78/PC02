import { RequestMethod } from '@nestjs/common';
import {
  PATH_METADATA,
  METHOD_METADATA,
  GUARDS_METADATA,
} from '@nestjs/common/constants';
import { CaseEvidenceGovernanceController } from './evidence-governance.controller';
import { CaseEvidenceGovernanceService } from './evidence-governance.service';
import { CaseEvidenceGovernanceModule } from './evidence-governance.module';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';

describe('Evidence HTTP contract preserves caller identity and versions', () => {
  const names = [
    'getSummary',
    'registerAsset',
    'verifyAsset',
    'appendCustody',
    'createPacket',
    'revisePacket',
    'submitPacket',
    'reviewPacket',
    'exportPacket',
    'revokePacket',
    'addHold',
    'releaseHold',
    'addRepresentation',
    'revokeRepresentation',
    'createRetention',
    'eligibility',
    'retentionTransition',
    'createDisposition',
    'dispositionTransition',
  ] as const;
  const result = { success: true, data: { id: 'persisted', revision: 3 } };
  const service = Object.fromEntries(
    names.map((name) => [name, jest.fn().mockResolvedValue(result)]),
  ) as Record<
    (typeof names)[number],
    jest.Mock<Promise<typeof result>, unknown[]>
  >;
  const controller = new CaseEvidenceGovernanceController(
    service as unknown as CaseEvidenceGovernanceService,
  );
  const user: AuthUser = {
    id: 'authenticated-actor',
    roleId: 'role',
    role: 'INVESTIGATOR',
    email: 'synthetic@example.invalid',
  };
  const req = {
    dataScope: { teamIds: ['visible'], userIds: ['authenticated-actor'] },
  } as ScopedRequest;
  const actor = { actorId: user.id, dataScope: req.dataScope };
  const body = {
    requestKey: 'same-content-key',
    expectedUpdatedAt: '2026-10-06T00:00:00.000Z',
    expectedRevision: 3,
  };
  const routes = [
    {
      method: 'summary',
      path: '/',
      verb: RequestMethod.GET,
      call: () => controller.summary('case1', user, req),
      service: 'getSummary',
      args: ['case1', actor],
    },
    {
      method: 'register',
      path: 'assets/register',
      verb: RequestMethod.POST,
      call: () => controller.register('case1', body, user, req),
      service: 'registerAsset',
      args: ['case1', body, actor],
    },
    {
      method: 'derivative',
      path: 'assets/:assetId/derivative',
      verb: RequestMethod.POST,
      call: () => controller.derivative('case1', 'asset1', body, user, req),
      service: 'registerAsset',
      args: ['case1', body, actor, 'asset1'],
    },
    {
      method: 'verify',
      path: 'assets/:assetId/verify',
      verb: RequestMethod.POST,
      call: () => controller.verify('case1', 'asset1', user, req),
      service: 'verifyAsset',
      args: ['case1', 'asset1', actor],
    },
    {
      method: 'custody',
      path: 'custody',
      verb: RequestMethod.POST,
      call: () => controller.custody('case1', body, user, req),
      service: 'appendCustody',
      args: ['case1', body, actor],
    },
    {
      method: 'createPacket',
      path: 'packets',
      verb: RequestMethod.POST,
      call: () => controller.createPacket('case1', body, user, req),
      service: 'createPacket',
      args: ['case1', body, actor],
    },
    {
      method: 'revisePacket',
      path: 'packets/:packetId',
      verb: RequestMethod.PATCH,
      call: () => controller.revisePacket('case1', 'packet1', body, user, req),
      service: 'revisePacket',
      args: ['case1', 'packet1', body, actor],
    },
    {
      method: 'submitPacket',
      path: 'packets/:packetId/submit',
      verb: RequestMethod.POST,
      call: () => controller.submitPacket('case1', 'packet1', body, user, req),
      service: 'submitPacket',
      args: ['case1', 'packet1', body, actor],
    },
    {
      method: 'reviewPacket',
      path: 'packets/:packetId/review',
      verb: RequestMethod.POST,
      call: () => controller.reviewPacket('case1', 'packet1', body, user, req),
      service: 'reviewPacket',
      args: ['case1', 'packet1', body, actor],
    },
    {
      method: 'exportPacket',
      path: 'packets/:packetId/export',
      verb: RequestMethod.POST,
      call: () => controller.exportPacket('case1', 'packet1', user, req),
      service: 'exportPacket',
      args: ['case1', 'packet1', actor],
    },
    {
      method: 'revokePacket',
      path: 'packets/:packetId/revoke',
      verb: RequestMethod.POST,
      call: () => controller.revokePacket('case1', 'packet1', body, user, req),
      service: 'revokePacket',
      args: ['case1', 'packet1', body, actor],
    },
    {
      method: 'addHold',
      path: 'holds',
      verb: RequestMethod.POST,
      call: () => controller.addHold('case1', body, user, req),
      service: 'addHold',
      args: ['case1', body, actor],
    },
    {
      method: 'releaseHold',
      path: 'holds/:holdId/release',
      verb: RequestMethod.POST,
      call: () => controller.releaseHold('case1', 'hold1', body, user, req),
      service: 'releaseHold',
      args: ['case1', 'hold1', body, actor],
    },
    {
      method: 'addRepresentation',
      path: 'representations',
      verb: RequestMethod.POST,
      call: () => controller.addRepresentation('case1', body, user, req),
      service: 'addRepresentation',
      args: ['case1', body, actor],
    },
    {
      method: 'revokeRepresentation',
      path: 'representations/:grantId/revoke',
      verb: RequestMethod.POST,
      call: () =>
        controller.revokeRepresentation('case1', 'grant1', body, user, req),
      service: 'revokeRepresentation',
      args: ['case1', 'grant1', body, actor],
    },
    {
      method: 'createRetention',
      path: 'retention',
      verb: RequestMethod.POST,
      call: () => controller.createRetention('case1', body, user, req),
      service: 'createRetention',
      args: ['case1', body, actor],
    },
    {
      method: 'eligibility',
      path: 'retention/eligibility',
      verb: RequestMethod.GET,
      call: () => controller.eligibility('case1', user, req),
      service: 'eligibility',
      args: ['case1', actor],
    },
    {
      method: 'reviseRetention',
      path: 'retention/:policyId',
      verb: RequestMethod.PATCH,
      call: () =>
        controller.reviseRetention('case1', 'policy1', body, user, req),
      service: 'retentionTransition',
      args: ['case1', 'policy1', 'revise', body, actor],
    },
    {
      method: 'reviewRetention',
      path: 'retention/:policyId/review',
      verb: RequestMethod.POST,
      call: () =>
        controller.reviewRetention('case1', 'policy1', body, user, req),
      service: 'retentionTransition',
      args: ['case1', 'policy1', 'review', body, actor],
    },
    {
      method: 'publishRetention',
      path: 'retention/:policyId/publish',
      verb: RequestMethod.POST,
      call: () =>
        controller.publishRetention('case1', 'policy1', body, user, req),
      service: 'retentionTransition',
      args: ['case1', 'policy1', 'publish', body, actor],
    },
    {
      method: 'createDisposition',
      path: 'dispositions',
      verb: RequestMethod.POST,
      call: () => controller.createDisposition('case1', body, user, req),
      service: 'createDisposition',
      args: ['case1', body, actor],
    },
    {
      method: 'reviseDisposition',
      path: 'dispositions/:dispositionId',
      verb: RequestMethod.PATCH,
      call: () =>
        controller.reviseDisposition('case1', 'disposition1', body, user, req),
      service: 'dispositionTransition',
      args: ['case1', 'disposition1', 'revise', body, actor],
    },
    {
      method: 'submitDisposition',
      path: 'dispositions/:dispositionId/submit',
      verb: RequestMethod.POST,
      call: () =>
        controller.submitDisposition('case1', 'disposition1', body, user, req),
      service: 'dispositionTransition',
      args: ['case1', 'disposition1', 'submit', body, actor],
    },
    {
      method: 'reviewDisposition',
      path: 'dispositions/:dispositionId/review',
      verb: RequestMethod.POST,
      call: () =>
        controller.reviewDisposition('case1', 'disposition1', body, user, req),
      service: 'dispositionTransition',
      args: ['case1', 'disposition1', 'review', body, actor],
    },
    {
      method: 'executeDisposition',
      path: 'dispositions/:dispositionId/execute',
      verb: RequestMethod.POST,
      call: () =>
        controller.executeDisposition('case1', 'disposition1', body, user, req),
      service: 'dispositionTransition',
      args: ['case1', 'disposition1', 'execute', body, actor],
    },
  ];
  beforeEach(() => jest.clearAllMocks());
  it('guards the complete evidence route tree and provides a shared service', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, CaseEvidenceGovernanceController),
    ).toBe('cases/:id/evidence-governance');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CaseEvidenceGovernanceController),
    ).toHaveLength(2);
    expect(
      Reflect.getMetadata('providers', CaseEvidenceGovernanceModule),
    ).toContain(CaseEvidenceGovernanceService);
  });
  it.each(routes)(
    '$verb $path retains authenticated actor, parent, target and exact transport version',
    async (route) => {
      const method = Object.getOwnPropertyDescriptor(
        CaseEvidenceGovernanceController.prototype,
        route.method,
      )?.value as object;
      expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(route.path);
      expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(route.verb);
      await expect(route.call()).resolves.toEqual(result);
      expect(
        service[route.service as (typeof names)[number]],
      ).toHaveBeenCalledWith(...route.args);
    },
  );
});
