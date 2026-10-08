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

// 09/10/2026 — Giờ tiếp nhận (HH:mm 24 giờ, giờ VN). NULL/vắng = không biết giờ.
describe('CreatePetitionDto — gioTiepNhan', () => {
  const base = { receivedDate: '2026-06-26', petitionType: 'TO_CAO', senderIsAnonymous: true };
  const loiGio = async (v: unknown) => {
    const dto = plainToInstance(CreatePetitionDto, { ...base, gioTiepNhan: v });
    const errors = await validate(dto);
    return errors.some((e) => e.property === 'gioTiepNhan');
  };

  it.each(['00:00', '00:59', '09:30', '12:00', '19:07', '23:59'])('chấp nhận "%s"', async (v) => {
    expect(await loiGio(v)).toBe(false);
  });

  it('vắng khoá và null đều được (không biết giờ) — null là cách XOÁ giờ khi sửa', async () => {
    const vang = await validate(plainToInstance(CreatePetitionDto, { ...base }));
    expect(vang.some((e) => e.property === 'gioTiepNhan')).toBe(false);
    expect(await loiGio(null)).toBe(false);
  });

  it.each(['24:00', '9:30', '09:60', '0930', '09:30:00', '09-30', '', ' 09:30', '09:30 ', 'ab:cd', '25:00', '09:5'])(
    'TỪ CHỐI "%s"',
    async (v) => {
      expect(await loiGio(v)).toBe(true);
    },
  );

  it('từ chối kiểu không phải chuỗi', async () => {
    for (const v of [930, true, {}, ['09:30']]) expect(await loiGio(v)).toBe(true);
  });
});
