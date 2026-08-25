import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateInvestigationSupplementDto } from './dto/create-investigation-supplement.dto';

/**
 * Bảng "Danh sách điều tra bổ sung" của hệ cũ có năm cột, trong đó ba cột là mốc ngày:
 * ngày tiếp nhận án ĐTBS, ngày trả hồ sơ của Viện kiểm sát, ngày trả hồ sơ của Toà án.
 *
 * Ba cột ấy đã có ở lược đồ nhưng DTO chưa khai — mà máy chủ bật `forbidNonWhitelisted`,
 * nên gửi lên là cả lời gọi bị từ chối 400, không phải bỏ qua ba trường.
 */
const HOP_LE = {
  caseId: 'case-1',
  type: 'Điều tra bổ sung',
  decisionNumber: '12/QD-DTBS',
  reason: 'VKS trả hồ sơ',
};

describe('CreateInvestigationSupplementDto — ba mốc ngày của bảng ĐTBS hệ cũ', () => {
  it('nhận đủ ba mốc ngày', async () => {
    const errors = await validate(
      plainToInstance(CreateInvestigationSupplementDto, {
        ...HOP_LE,
        ngayTiepNhanDTBS: '2026-08-01T00:00:00.000Z',
        ngayTraHoSoVKS: '2026-08-05T00:00:00.000Z',
        ngayTraHoSoToaAn: '2026-08-09T00:00:00.000Z',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property)).toEqual([]);
  });

  it.each(['ngayTiepNhanDTBS', 'ngayTraHoSoVKS', 'ngayTraHoSoToaAn'])(
    'từ chối ngày sai định dạng ở "%s" thay vì nuốt lặng',
    async (key) => {
      const errors = await validate(
        plainToInstance(CreateInvestigationSupplementDto, { ...HOP_LE, [key]: 'hôm qua' }),
      );
      expect(errors.map((e) => e.property)).toContain(key);
    },
  );

  it('ba mốc ngày là tuỳ chọn — bảng hệ cũ cho phép để trống', async () => {
    const errors = await validate(plainToInstance(CreateInvestigationSupplementDto, HOP_LE), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual([]);
  });
});
