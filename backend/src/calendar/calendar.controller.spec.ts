import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

const mockService = {
  getEvents: jest.fn(),
};

describe('CalendarController — delegation', () => {
  let controller: CalendarController;

  beforeEach(async () => {
    const module = await buildControllerModule(CalendarController, CalendarService, mockService);
    controller = module.get(CalendarController);
    jest.clearAllMocks();
  });

  it('getEvents() delegates to service.getEvents with year and month', async () => {
    mockService.getEvents.mockResolvedValue({ data: [] });
    await controller.getEvents({ year: 2025, month: 5 });
    expect(mockService.getEvents).toHaveBeenCalledWith(2025, 5);
  });

  it('getEvents() passes undefined when query has no year/month', async () => {
    mockService.getEvents.mockResolvedValue({ data: [] });
    await controller.getEvents({});
    expect(mockService.getEvents).toHaveBeenCalledWith(undefined, undefined);
  });
});
