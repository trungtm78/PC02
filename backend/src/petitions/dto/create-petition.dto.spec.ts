import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePetitionDto } from './create-petition.dto';

// Field-parity tab "Thông tin" form cũ /doi-1/Them — 3 field mới.
describe('CreatePetitionDto — field-parity Đơn thư', () => {
  const base = {
    receivedDate: '2026-06-26',
    petitionType: 'TO_CAO',
    senderIsAnonymous: true,
  };

  it('chấp nhận ngayDeXuat/phanLoaiNguonTin/dieuTraVien hợp lệ', async () => {
    const dto = plainToInstance(CreatePetitionDto, {
      ...base,
      ngayDeXuat: '2026-06-20',
      phanLoaiNguonTin: 'don-cong-van-ban-dau',
      dieuTraVien: 'Nguyễn Văn A',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.dieuTraVien).toBe('Nguyễn Văn A');
    expect(dto.phanLoaiNguonTin).toBe('don-cong-van-ban-dau');
  });

  it('từ chối phanLoaiNguonTin ngoài whitelist (bảo vệ discriminator)', async () => {
    const dto = plainToInstance(CreatePetitionDto, { ...base, phanLoaiNguonTin: 'gia-tri-bay' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phanLoaiNguonTin')).toBe(true);
  });

  it('từ chối ngayDeXuat sai định dạng ngày', async () => {
    const dto = plainToInstance(CreatePetitionDto, { ...base, ngayDeXuat: 'không-phải-ngày' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ngayDeXuat')).toBe(true);
  });

  it('trim phanLoaiNguonTin/dieuTraVien', async () => {
    const dto = plainToInstance(CreatePetitionDto, {
      ...base,
      phanLoaiNguonTin: '  vu-an-ban-dau  ',
      dieuTraVien: '  Trần B  ',
    });
    await validate(dto);
    expect(dto.phanLoaiNguonTin).toBe('vu-an-ban-dau');
    expect(dto.dieuTraVien).toBe('Trần B');
  });
});
