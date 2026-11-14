import { CriteriaMatrixController } from './criteria-matrix.controller';
import { CriteriaMatrixError } from './criteria-matrix.service';
import { ReportConfigError } from './report-config.service';

describe('CriteriaMatrixController', () => {
  const file = { buffer: Buffer.from('x') } as Express.Multer.File;
  const service = { export: jest.fn(), import: jest.fn() };
  const controller = new CriteriaMatrixController(service as never);

  beforeEach(() => {
    service.export.mockReset();
    service.import.mockReset().mockResolvedValue({ applied: false, configVersion: 3, teams: [] });
  });

  it('without "apply" the file is only read, whatever revision is or is not sent', async () => {
    await controller.upload('r1', file, {});
    await controller.upload('r1', file, { apply: 'yes', expectedConfigVersion: 'abc' });
    expect(service.import.mock.calls).toEqual([
      ['r1', file.buffer, { apply: false }],
      ['r1', file.buffer, { apply: false }],
    ]);
  });

  it('applying sends the revision the preview was shown at', async () => {
    await controller.upload('r1', file, { apply: 'true', expectedConfigVersion: ' 7 ' });
    expect(service.import).toHaveBeenCalledWith('r1', file.buffer, { apply: true, expectedConfigVersion: 7 });
  });

  it.each([undefined, '', 'abc', '7.5', '-1', '1e3', 'NaN'])(
    'applying with the revision %j is refused: there is no "whatever it is now"',
    (expectedConfigVersion) => {
      expect(() => controller.upload('r1', file, { apply: 'true', expectedConfigVersion })).toThrow(
        expect.objectContaining({ response: { code: 'MATRIX_REVISION_REQUIRED' } }),
      );
      expect(service.import).not.toHaveBeenCalled();
    },
  );

  it('no file at all is refused with its code', () => {
    expect(() => controller.upload('r1', undefined, { apply: 'true', expectedConfigVersion: '1' })).toThrow(
      expect.objectContaining({ response: { code: 'MATRIX_FILE_MISSING' } }),
    );
  });

  it('a refused file answers 400 with its reasons; a moved revision 409; a missing report 404; another config refusal 400', async () => {
    service.import.mockRejectedValueOnce(new CriteriaMatrixError([{ code: 'MATRIX_NOT_RECOGNISED' }]));
    await expect(controller.upload('r1', file, {})).rejects.toMatchObject({
      status: 400,
      response: { code: 'CRITERIA_MATRIX_INVALID', details: [{ code: 'MATRIX_NOT_RECOGNISED' }] },
    });
    service.import.mockRejectedValueOnce(new ReportConfigError('moved', 'REVISION_CONFLICT'));
    await expect(controller.upload('r1', file, {})).rejects.toMatchObject({ status: 409, response: { code: 'REVISION_CONFLICT' } });
    service.import.mockRejectedValueOnce(new ReportConfigError('old file', 'MATRIX_FILE_STALE'));
    await expect(controller.upload('r1', file, {})).rejects.toMatchObject({ status: 409, response: { code: 'MATRIX_FILE_STALE' } });
    service.import.mockRejectedValueOnce(new ReportConfigError('none', 'REPORT_NOT_FOUND'));
    await expect(controller.upload('r1', file, {})).rejects.toMatchObject({ status: 404 });
    service.import.mockRejectedValueOnce(new ReportConfigError('empty', 'TARGET_SUBSET_EMPTY'));
    await expect(controller.upload('r1', file, {})).rejects.toMatchObject({ status: 400, response: { code: 'TARGET_SUBSET_EMPTY' } });
    service.import.mockRejectedValueOnce(new Error('boom'));
    await expect(controller.upload('r1', file, {})).rejects.toThrow('boom');
  });

  it('the download is sent as an attachment under the name the service gives', async () => {
    service.export.mockResolvedValue({ fileName: 'bc-ma-tran-tieu-chi.xlsx', fileBuffer: Buffer.from('f') });
    const res = { setHeader: jest.fn(), send: jest.fn() };
    await controller.download('r1', res as never);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('bc-ma-tran-tieu-chi.xlsx'));
    expect(res.send).toHaveBeenCalledWith(Buffer.from('f'));
  });
});
