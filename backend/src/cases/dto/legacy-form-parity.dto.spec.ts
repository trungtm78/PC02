import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCaseDto } from './create-case.dto';
import { UpdateCaseDto } from './update-case.dto';

/**
 * Máy chủ bật `forbidNonWhitelisted`, nên field nào form gửi lên mà DTO không khai thì cả
 * lời gọi bị từ chối 400 — không phải bỏ qua field ấy. Nghĩa là thiếu một dòng khai ở đây
 * là cán bộ không lưu được hồ sơ, chứ không phải mất một ô.
 *
 * Danh sách dưới đây là các ô hệ cũ vừa được đưa về đúng vị trí trên form (epic 26/08/2026).
 */
const O_HE_CU_MOI: Record<string, unknown> = {
  phanLoaiNguonTinBanDau: 'vu_an',
  ngayXayRa: '2026-08-01T00:00:00.000Z',
  noiXayRaPhuongXa: 'Phường Bến Nghé',
  baoCaoBanGiamDocText: 'Báo cáo Ban Giám đốc ngày 12/8',
  soQDPhanCongNguonTin: '12/QĐ-PC02',
  ngayQDPhanCongNguonTin: '2026-08-02T00:00:00.000Z',
  soQDKhongKhoiTo: '05/QĐ-KKT',
  ngayQDKhongKhoiTo: '2026-08-03T00:00:00.000Z',
  canCuKhongKhoiTo: 'Điều 157 khoản 2 BLTTHS',
  lyDoKhongKhoiTo: ['khong_co_su_viec', 'khong_cau_thanh'],
  chuyenVuViecDonViKhac: 'CV 88 ngày 04/8, chuyển CAQ1',
  nhapVaoVuViecSo: '2026-1122',
  phanLoaiDanSu: 'TB 09 ngày 05/8',
  vuViecTamDungTruoc2015: true,
  soQDTamDinhChiNguonTin: '07/QĐ-TĐC',
  ngayQDTamDinhChiNguonTin: '2026-08-05T00:00:00.000Z',
  canCuTamDinhChiNguonTin: 'Điều 148 BLTTHS',
  lyDoTamDinhChiNguonTin: ['chua_co_giam_dinh'],
  ngayHetThoiHieuVuViec: '2031-08-05T00:00:00.000Z',
  khacPhucLyDoTDCVuViec: 'BB trao đổi VKS số 12',
  tienDoKhacPhucTDCVuViec: 'Đang chờ kết quả giám định',
  soPhucHoiNguonTin: '02/QĐ-PH',
  ngayPhucHoiNguonTin: '2026-08-20T00:00:00.000Z',
  vatChungMoTa: '01 điện thoại iPhone 13',
  lenhNhapKho: 'PN 33 ngày 06/8',
  noiLuuTruBaoQuan: 'Kho vật chứng PC02',
  toiDanhChinhKhoiToId: 'crime-174',
};

function dto(extra: Record<string, unknown> = {}) {
  return plainToInstance(CreateCaseDto, {
    name: 'Vụ án thử',
    caseProvenance: 'DIRECT_DISCOVERY',
    ...extra,
  });
}

describe('CreateSubjectInlineDto — thêm đối tượng không làm hỏng cả lần lưu', () => {
  /**
   * Hộp thoại thêm đối tượng chỉ bắt buộc họ tên, còn lược đồ cho phép mọi ô khác trống.
   * Nếu DTO khắt khe hơn cả hai thì thêm một nhân chứng chưa rõ ngày sinh sẽ trả 400 và
   * KHÔNG lưu được hồ sơ — hỏng nặng hơn hẳn việc thiếu vài ô của một đối tượng.
   */
  it('nhận đối tượng chỉ có họ tên', async () => {
    const errors = await validate(
      plainToInstance(CreateCaseDto, {
        name: 'Vụ án thử',
        caseProvenance: 'DIRECT_DISCOVERY',
        subjects: [{ fullName: 'Nguyễn Văn A', type: 'WITNESS' }],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property)).toEqual([]);
  });

  it('vẫn bắt buộc họ tên — không có tên thì không phải một đối tượng', async () => {
    const errors = await validate(
      plainToInstance(CreateCaseDto, {
        name: 'Vụ án thử',
        caseProvenance: 'DIRECT_DISCOVERY',
        subjects: [{ idNumber: '079123456789' }],
      }),
    );
    expect(errors.map((e) => e.property)).toContain('subjects');
  });
});

describe('CreateCaseDto — ô hệ cũ đưa về đúng vị trí trên form', () => {
  it('nhận đủ mọi ô hệ cũ mới, không báo lỗi hợp lệ', async () => {
    const errors = await validate(dto(O_HE_CU_MOI), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((e) => e.property)).toEqual([]);
  });

  it.each(Object.keys(O_HE_CU_MOI))('khai field "%s" — thiếu là cán bộ không lưu được hồ sơ', (key) => {
    // `forbidNonWhitelisted` chỉ chặn field KHÔNG khai; field đã khai luôn nằm trong
    // instance sau khi biến đổi. Đây là cách chốt "DTO có biết field này" mà không phụ
    // thuộc thứ tự thuộc tính.
    const instance = dto({ [key]: O_HE_CU_MOI[key] }) as unknown as Record<string, unknown>;
    expect(instance[key]).toBeDefined();
  });

  it('KHÔNG nhận caseCode — ô đó là số hiệu tự sinh, không phải ô nhập tay', async () => {
    const errors = await validate(dto({ caseCode: '2026-9999' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toContain('caseCode');
  });

  it('từ chối ngày sai định dạng thay vì nuốt lặng', async () => {
    const errors = await validate(dto({ ngayXayRa: 'hôm qua' }));
    expect(errors.map((e) => e.property)).toContain('ngayXayRa');
  });

  it('từ chối lý do không khởi tố không phải mảng chuỗi', async () => {
    const errors = await validate(dto({ lyDoKhongKhoiTo: 'khong_co_su_viec' }));
    expect(errors.map((e) => e.property)).toContain('lyDoKhongKhoiTo');
  });

  it('UpdateCaseDto kế thừa đủ — sửa hồ sơ cũ cũng lưu được', async () => {
    const errors = await validate(
      plainToInstance(UpdateCaseDto, O_HE_CU_MOI),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property)).toEqual([]);
  });
});
