import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePetitionDto } from './dto/update-petition.dto';

/**
 * Giới hạn độ dài của DTO phải LỚN HƠN dữ liệu thật đang có.
 *
 * Một giới hạn ngắn hơn dữ liệu không chặn được gì — dữ liệu đã nằm trong bảng rồi. Nó chỉ
 * làm hồ sơ di trú mở ra sửa được mà lưu lại không được, và thông báo lỗi nói về một ô cán bộ
 * không hề đụng tới. Cùng lớp với sự cố `sttCu` (#259), chỉ khác là ở đây lời gọi bị chặn vì
 * độ dài chứ không vì thiếu khai.
 *
 * `phanLoaiNguonTin` KHÔNG có trong bảng này: nó chỉ nhận một bộ từ vựng đóng, nên độ dài do
 * chính bộ từ vựng chặn và `cot-he-cu-ghi-duoc.spec.ts` đã kiểm bằng giá trị hợp lệ. Nhét một
 * chuỗi 20 chữ `x` vào đây chỉ chứng minh `@IsIn` còn sống, không chứng minh gì về độ dài.
 *
 * Số đo lấy từ máy chạy ngày 27/08/2026 — `max(length(...))` trên chính `legacyRaw` của
 * 46.499 đơn thư có dữ liệu cũ. Cột nào không có tên ở đây thì hoặc không phải chữ, hoặc
 * chưa có dữ liệu cũ nào.
 */
const DAI_NHAT_DO_DUOC: Readonly<Record<string, number>> = {
  ghiChuKhac: 2268,
  baoCaoBanGiamDocText: 532,
  donViGiaiQuyet: 329,
  deXuat: 322,
  soPhieuChuyen: 130,
  yeuCauBoSung: 92,
  dieuTraVien: 73,
  soQDPhanCongNguonTin: 38,
  phanLoaiToiPhamLinhVuc: 31,
  canCuTamDinhChiNguonTin: 28,
  soQDTamDinhChiNguonTin: 21,
  soPhucHoiNguonTin: 15,
  tinhTrang: 2,
  phanLoaiHoSoNoiBo: 2,
};


describe('Giá trị dài nhất trong dữ liệu cũ vẫn phải lưu được', () => {
  it.each(Object.entries(DAI_NHAT_DO_DUOC))(
    'cột "%s": chuỗi %i ký tự đi qua được DTO',
    async (col, dai) => {
      const dto = plainToInstance(UpdatePetitionDto, { [col]: 'x'.repeat(dai) });
      const loi = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(loi.map((e) => `${e.property}: ${Object.keys(e.constraints ?? {}).join(',')}`)).toEqual(
        [],
      );
    },
  );

  /** Bằng chứng ca kiểm trên có răng: vượt xa số đo thì phải bị chặn. */
  it('vẫn chặn chuỗi vượt xa mọi số đo', async () => {
    const dto = plainToInstance(UpdatePetitionDto, { donViGiaiQuyet: 'x'.repeat(5000) });
    const loi = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(loi.map((e) => e.property)).toEqual(['donViGiaiQuyet']);
  });
});
