import { Test, TestingModule } from '@nestjs/testing';
import { CrimesController } from './crimes.controller';
import { CrimesService } from './crimes.service';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
};

describe('CrimesController', () => {
  let controller: CrimesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrimesController],
      providers: [{ provide: CrimesService, useValue: mockService }],
    }).compile();
    controller = module.get<CrimesController>(CrimesController);
    jest.clearAllMocks();
  });

  it('GET /crimes ủy quyền findAll với query', () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    const q = { pc02Only: true, search: 'giết' };
    void controller.findAll(q as never);
    expect(mockService.findAll).toHaveBeenCalledWith(q);
  });

  it('GET /crimes/:id ủy quyền findOne', () => {
    mockService.findOne.mockResolvedValue({ id: 'c1' });
    void controller.findOne('c1');
    expect(mockService.findOne).toHaveBeenCalledWith('c1');
  });
});
