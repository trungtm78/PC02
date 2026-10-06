import { IncidentsHandoffController } from './incidents-handoff.controller';
describe('Intake controller preserves live argument and version contracts', () => {
  const handoffs = {
    ensureEnabled: jest.fn(),
    inbox: jest.fn(),
    send: jest.fn(),
    history: jest.fn(),
    accept: jest.fn(),
    cancel: jest.fn(),
  };
  const incidents = { create: jest.fn() };
  const controller = new IncidentsHandoffController(
    handoffs as never,
    incidents as never,
  );
  const req = {
    dataScope: { teamIds: ['team1'] },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'synthetic' },
  };
  beforeEach(() => jest.clearAllMocks());
  it('intake forwards Idempotency-Key fifth and mode sixth after the feature guard', async () => {
    const dto = { name: 'Synthetic' };
    await controller.intake(
      dto as never,
      { id: 'actor' } as never,
      req as never,
      'key1',
    );
    expect(handoffs.ensureEnabled).toHaveBeenCalledTimes(1);
    expect(incidents.create).toHaveBeenCalledWith(
      dto,
      'actor',
      { ipAddress: '127.0.0.1', userAgent: 'synthetic' },
      req.dataScope,
      'key1',
      { intake: true },
    );
  });
  it('disabled intake cannot invoke ordinary creation', async () => {
    handoffs.ensureEnabled.mockRejectedValueOnce(new Error('disabled'));
    await expect(
      controller.intake(
        { name: 'Synthetic' } as never,
        { id: 'actor' } as never,
        req as never,
      ),
    ).rejects.toThrow('disabled');
    expect(incidents.create).not.toHaveBeenCalled();
  });
  it('inbox forwards bounded pagination input and read scope', async () => {
    await controller.inbox(req as never, '20', '10');
    expect(handoffs.inbox).toHaveBeenCalledWith(req.dataScope, 20, 10);
  });
  it('send carries dossier ID, target/version/key, caller and write scope', async () => {
    const dto = {
      toTeamId: 'team2',
      expectedUpdatedAt: '2026-10-06',
      requestKey: 'key',
    };
    await controller.send(
      'i1',
      dto as never,
      { id: 'actor' } as never,
      req as never,
    );
    expect(handoffs.send).toHaveBeenCalledWith(
      'i1',
      dto,
      'actor',
      req.dataScope,
    );
  });
  it('read-only history retains dossier scope', async () => {
    await controller.history('i1', req as never);
    expect(handoffs.history).toHaveBeenCalledWith('i1', req.dataScope);
  });
  it('accept and cancel forward both optimistic versions to the exact ledger', async () => {
    const dto = {
      expectedUpdatedAt: '2026-10-06',
      expectedHandoffUpdatedAt: '2026-10-06',
    };
    await controller.accept(
      'i1',
      'h1',
      dto as never,
      { id: 'actor' } as never,
      req as never,
    );
    await controller.cancel(
      'i1',
      'h1',
      dto as never,
      { id: 'actor' } as never,
      req as never,
    );
    expect(handoffs.accept).toHaveBeenCalledWith(
      'i1',
      'h1',
      dto,
      'actor',
      req.dataScope,
    );
    expect(handoffs.cancel).toHaveBeenCalledWith(
      'i1',
      'h1',
      dto,
      'actor',
      req.dataScope,
    );
  });
});
