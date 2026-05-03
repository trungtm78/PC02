import { Test, TestingModule } from '@nestjs/testing';
import { PassThrough } from 'stream';
import { PhuLuc16ExportService } from './phu-luc-1-6-export.service';

describe('PhuLuc16ExportService', () => {
  let service: PhuLuc16ExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PhuLuc16ExportService],
    }).compile();
    service = module.get<PhuLuc16ExportService>(PhuLuc16ExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('export() sets xlsx content-type headers and completes', async () => {
    const stream = new PassThrough();
    const setHeader = jest.fn();
    const res = Object.assign(stream, { setHeader }) as any;

    // Drain the stream so ExcelJS writer doesn't block
    stream.resume();

    await expect(service.export(1, [], res)).resolves.not.toThrow();
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }, 15000);
});
