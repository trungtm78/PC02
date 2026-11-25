import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamLifecycleService } from './team-lifecycle.service';
import { TeamMergeService } from './team-merge.service';
import { TeamWardChargesService } from './team-ward-charges.service';
import { TeamWardChargesImportService } from './team-ward-charges.import';
import { BadRequestException } from '@nestjs/common';

const mockService = {
  getList: jest.fn(),
  options: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
};

const mockLifecycle = { setStatus: jest.fn(), deleteIfEmpty: jest.fn(), deletionCheck: jest.fn() };
const mockMerge = { preview: jest.fn(), merge: jest.fn(), undo: jest.fn(), list: jest.fn() };
const mockWardCharges = { choices: jest.fn(), listFor: jest.fn(), replace: jest.fn() };
const mockWardChargeImport = { preview: jest.fn(), confirm: jest.fn(), template: jest.fn() };

describe('TeamsController — delegation', () => {
  let controller: TeamsController;

  beforeEach(async () => {
    const module = await buildControllerModule(TeamsController, TeamsService, mockService, [
      { token: TeamLifecycleService, mock: mockLifecycle },
      { token: TeamMergeService, mock: mockMerge },
      { token: TeamWardChargesService, mock: mockWardCharges },
      { token: TeamWardChargesImportService, mock: mockWardChargeImport },
    ]);
    controller = module.get(TeamsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    await controller.getList();
    expect(mockService.getList).toHaveBeenCalled();
  });

  it('getList() passes the requested state to the service', async () => {
    mockService.getList.mockResolvedValue([]);
    await controller.getList('ARCHIVED');
    expect(mockService.getList).toHaveBeenCalledWith('ARCHIVED');
  });

  it('getList() with no state asks for the default (active teams)', async () => {
    mockService.getList.mockResolvedValue([]);
    await controller.getList(undefined);
    expect(mockService.getList).toHaveBeenCalledWith(undefined);
  });

  it('getList() rejects a state that does not exist with a machine code', async () => {
    expect(() => controller.getList('DELETED')).toThrow(BadRequestException);
    try {
      controller.getList('DELETED');
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'TEAM_STATUS_UNKNOWN' });
    }
    expect(mockService.getList).not.toHaveBeenCalled();
  });

  it('getOptions() serves the picker list', async () => {
    mockService.options.mockResolvedValue([{ id: 't1' }]);
    await expect(controller.getOptions()).resolves.toEqual([{ id: 't1' }]);
  });

  it('delete() runs the guarded real delete through the lifecycle with the actor and audit info', async () => {
    mockLifecycle.deleteIfEmpty.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.delete('team-1', mockUser, req);
    expect(mockLifecycle.deleteIfEmpty).toHaveBeenCalledWith(
      'team-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    expect(mockService.delete).not.toHaveBeenCalled();
  });

  it('deletionCheck() serves the preview the confirmation dialog shows', async () => {
    mockLifecycle.deletionCheck.mockResolvedValue({ deletable: true, total: 0, blockers: [] });
    await expect(controller.deletionCheck('team-1')).resolves.toEqual({ deletable: true, total: 0, blockers: [] });
    expect(mockLifecycle.deletionCheck).toHaveBeenCalledWith('team-1');
  });

  it('mergePreview() asks the merge service what would happen, without changing anything', async () => {
    mockMerge.preview.mockResolvedValue({ summary: {} });
    await controller.mergePreview('src', { targetTeamId: 'dst' });
    expect(mockMerge.preview).toHaveBeenCalledWith('src', 'dst');
    expect(mockMerge.merge).not.toHaveBeenCalled();
  });

  it('merge() merges with the actor and audit info', async () => {
    mockMerge.merge.mockResolvedValue({ operationId: 'op1', summary: {} });
    await controller.merge('src', { targetTeamId: 'dst' }, mockUser, makeReq());
    expect(mockMerge.merge).toHaveBeenCalledWith(
      'src',
      'dst',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('undoMerge() undoes one operation as the actor', async () => {
    mockMerge.undo.mockResolvedValue({ restored: 3, skipped: 0 });
    await controller.undoMerge('op1', mockUser, makeReq());
    expect(mockMerge.undo).toHaveBeenCalledWith('op1', mockUser.id, expect.objectContaining({ ipAddress: '127.0.0.1' }));
  });

  it('listMerges() serves the recent operations', async () => {
    mockMerge.list.mockResolvedValue([{ id: 'op1' }]);
    await expect(controller.listMerges()).resolves.toEqual([{ id: 'op1' }]);
  });

  it('setStatus() hands the new state to the lifecycle with the actor and audit info', async () => {
    mockLifecycle.setStatus.mockResolvedValue({ id: 'team-1', status: 'ARCHIVED' });
    const req = makeReq();
    await controller.setStatus('team-1', { status: 'ARCHIVED' }, mockUser, req);
    expect(mockLifecycle.setStatus).toHaveBeenCalledWith(
      'team-1',
      'ARCHIVED',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'team-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('addMember() delegates to service.addMember with teamId, userId, requesterId', async () => {
    mockService.addMember.mockResolvedValue({ success: true });
    await controller.addMember('team-1', 'member-1', mockUser);
    expect(mockService.addMember).toHaveBeenCalledWith('team-1', 'member-1', mockUser.id);
  });

  it('removeMember() delegates to service.removeMember with teamId, memberId, requesterId', async () => {
    mockService.removeMember.mockResolvedValue({ success: true });
    await controller.removeMember('team-1', 'member-1', mockUser);
    expect(mockService.removeMember).toHaveBeenCalledWith('team-1', 'member-1', mockUser.id);
  });

  describe('wards in charge', () => {
    it('replaceWardCharges() hands the body, the actor and audit info to the service', async () => {
      await controller.replaceWardCharges('team-1', { wardIds: ['w1'] }, mockUser, makeReq());
      expect(mockWardCharges.replace).toHaveBeenCalledWith('team-1', { wardIds: ['w1'] }, mockUser.id, expect.objectContaining({ ipAddress: '127.0.0.1' }));
    });

    it('a preview without a file is a 400 carrying a code', () => {
      expect(() => controller.wardChargeImportPreview(undefined, mockUser)).toThrow(BadRequestException);
    });

    it('confirm passes the token and the replace flag as they came', async () => {
      await controller.wardChargeImportConfirm({ previewToken: 'tok', replaceTeamsInFile: true }, mockUser, makeReq());
      expect(mockWardChargeImport.confirm).toHaveBeenCalledWith('tok', true, mockUser.id, expect.anything());
    });

    it('every ward-charge route takes the permission of editing a team (PUT /teams/:id)', () => {
      const permissionOf = (name: keyof TeamsController) => Reflect.getMetadata('permissions', TeamsController.prototype[name]);
      const edit = permissionOf('update');
      expect(edit).toBeDefined();
      for (const name of ['wardChargeChoices', 'listWardCharges', 'replaceWardCharges', 'wardChargeImportPreview', 'wardChargeImportConfirm', 'wardChargeImportTemplate'] as const) {
        expect({ name, p: permissionOf(name) }).toEqual({ name, p: edit });
      }
    });
  });
});
