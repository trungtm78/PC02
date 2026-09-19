import { lapKeHoach, suaNgayTdc, type DongTdc } from './sua-ngay-tdc-vu-viec';

/**
 * Bù Ngày đề xuất cho 118 vụ việc TĐC đã nạp (hệ cũ đảo ô ngày/năm — xem ngay-tiep-nhan-tdc.spec). Dữ liệu mẫu là
 * bản thô prod thật của hồ sơ 11 (→ 2036, tương lai) và 108 (→ 2009, quá khứ trông hợp lý nhưng sai).
 */
const dong = (
  id: string,
  ngayDeXuat: string | null,
  raw: Record<string, unknown>,
  description = '',
): DongTdc => ({
  id,
  code: `VV-LEGACY-TamDinhChi_vu_viec_21:${id}`,
  ngayDeXuat: ngayDeXuat ? new Date(ngayDeXuat) : null,
  description,
  legacyRaw: { __sourceCollection: 'TamDinhChi_vu_viec_21', ...raw },
});

const H11 = dong(
  '11',
  '2036-05-12T00:00:00Z',
  {
    tiep_nhan_so: 1193,
    tiep_nhan_ngay: 2020,
    tiep_nhan_thang: 11,
    tiep_nhan_nam: 30,
  },
  'Hủy hoại tài sản\n\nĐiều luật: 178 · Số tiếp nhận: 1193/30 · Ghi chú: HS',
);
const H108 = dong('108', '2009-01-13T00:00:00Z', {
  tiep_nhan_so: 5,
  tiep_nhan_ngay: 2024,
  tiep_nhan_thang: 7,
  tiep_nhan_nam: 3,
});
const DUNG = dong('9', '2021-02-17T00:00:00Z', {
  tiep_nhan_ngay: 17,
  tiep_nhan_thang: 2,
  tiep_nhan_nam: 21,
});

describe('lapKeHoach', () => {
  it('chỉ đưa vào kế hoạch hồ sơ có ngày SAI; hồ sơ đã đúng bỏ qua (chạy lại ra 0)', () => {
    const kh = lapKeHoach([H11, H108, DUNG]);
    expect(
      kh.map((k) => [k.id, k.ngayMoi?.toISOString().slice(0, 10)]),
    ).toEqual([
      ['11', '2020-11-30'],
      ['108', '2024-07-03'],
    ]);
  });

  it('mô tả: sửa "Số tiếp nhận: 1193/30" → "1193/2020" CHỈ khi còn nguyên dòng bộ nạp cũ sinh', () => {
    const [k] = lapKeHoach([H11]);
    expect(k.moTaMoi).toBe(
      'Hủy hoại tài sản\n\nĐiều luật: 178 · Số tiếp nhận: 1193/2020 · Ghi chú: HS',
    );
    // Cán bộ đã sửa mô tả (không còn chuỗi cũ) → không động vào.
    const [k2] = lapKeHoach([{ ...H11, description: 'Đã viết lại' }]);
    expect(k2.moTaMoi).toBeUndefined();
  });

  it('bản thô không suy được ngày có thật → không sửa ngày (không đoán)', () => {
    const hong = dong('7', '2030-01-01T00:00:00Z', {
      tiep_nhan_ngay: 2021,
      tiep_nhan_thang: 2,
      tiep_nhan_nam: 31,
    });
    expect(lapKeHoach([hong])).toEqual([]);
  });
});

describe('suaNgayTdc', () => {
  const gia = (rows: DongTdc[]) => {
    const ghi: Array<{ id: string; data: Record<string, unknown> }> = [];
    const nhatKy: unknown[] = [];
    const prisma = {
      incident: {
        findMany: jest.fn().mockResolvedValue(rows),
        update: jest.fn(
          (a: { where: { id: string }; data: Record<string, unknown> }) => {
            ghi.push({ id: a.where.id, data: a.data });
            return Promise.resolve({});
          },
        ),
      },
      auditLog: {
        create: jest.fn((a: unknown) => {
          nhatKy.push(a);
          return Promise.resolve({});
        }),
      },
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
    };
    return { prisma, ghi, nhatKy };
  };

  it('chạy thử: KHÔNG ghi gì, trả số hồ sơ sẽ sửa', async () => {
    const { prisma, ghi } = gia([H11, H108, DUNG]);
    const kq = await suaNgayTdc(prisma as never, false, () => undefined);
    expect(kq).toEqual({ seSua: 2, daSua: 0 });
    expect(ghi).toEqual([]);
  });

  it('ghi thật: sửa ngày (+ mô tả khi được), GIỮ updatedAt cũ, một dòng nhật ký có trước/sau', async () => {
    const { prisma, ghi, nhatKy } = gia([
      { ...H11, updatedAt: new Date('2026-07-23T00:00:00Z') },
    ]);
    const kq = await suaNgayTdc(prisma as never, true, () => undefined);
    expect(kq).toEqual({ seSua: 1, daSua: 1 });
    expect(ghi[0].id).toBe('11');
    expect((ghi[0].data.ngayDeXuat as Date).toISOString().slice(0, 10)).toBe(
      '2020-11-30',
    );
    expect(ghi[0].data.updatedAt).toEqual(new Date('2026-07-23T00:00:00Z'));
    expect(String(ghi[0].data.description)).toContain('1193/2020');
    expect(JSON.stringify(nhatKy)).toContain('INCIDENT_TDC_NGAY_TIEP_NHAN_SUA');
    expect(JSON.stringify(nhatKy)).toContain('2036-05-12');
  });
});
