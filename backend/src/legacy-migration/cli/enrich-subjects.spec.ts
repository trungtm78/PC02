import { duyetVuAn } from './enrich-subjects';

const EMPTY = new Set<string>();

describe('duyetVuAn — sinh nghi can/bị hại từ tóm tắt + trường nghi vấn', () => {
  it('nghi can tên trần từ nghi_van_doi_tuong → tạo bản ghi, định danh null', () => {
    const { toCreate } = duyetVuAn('c1', null, 'Nguyễn Minh Trung, Lê Tiến Thành', EMPTY);
    expect(toCreate).toHaveLength(2);
    expect(toCreate[0]).toMatchObject({ fullName: 'Nguyễn Minh Trung', type: 'SUSPECT', dateOfBirth: null, idNumber: null, address: null });
    expect(String(toCreate[0].notes)).toContain('chưa đủ định danh');
  });

  it('điền định danh khi tên nghi vấn CŨNG có SN/CCCD trong tóm tắt', () => {
    const tomTat = 'Đối tượng: Nguyễn Minh Trung (SN: 1990, CCCD: 079090001234, HKTT: quận 5) thực hiện hành vi.';
    const { toCreate } = duyetVuAn('c1', tomTat, 'Nguyễn Minh Trung', EMPTY);
    // tom_tat đã tạo (vai trò rõ "Đối tượng") — nghi_van trùng tên → không nhân đôi.
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]).toMatchObject({ fullName: 'Nguyễn Minh Trung', idNumber: '079090001234' });
    expect(toCreate[0].dateOfBirth).toBeInstanceOf(Date);
  });

  it('khử trùng theo tên đã có (coSan) — idempotent', () => {
    const coSan = new Set(['SUSPECT|nguyen minh trung']);
    const { toCreate } = duyetVuAn('c1', null, 'Nguyễn Minh Trung, Trần Văn B', coSan);
    expect(toCreate.map((c) => c.fullName)).toEqual(['Trần Văn B']);
  });

  it('bị hại có nhãn trong tóm tắt → tạo type VICTIM', () => {
    const tomTat = 'bị hại: Lý Ngân Giang (SN: 2008, HKTT: An Giang) bị chiếm đoạt tài sản.';
    const { toCreate } = duyetVuAn('c1', tomTat, null, EMPTY);
    expect(toCreate.find((c) => c.type === 'VICTIM')?.fullName).toBe('Lý Ngân Giang');
  });

  it('người chưa rõ vai trò (không nhãn) → chuaRoVaiTro, KHÔNG tạo Subject', () => {
    const tomTat = 'Nguyễn Văn X (SN: 1985) có mặt tại hiện trường.';
    const { toCreate, chuaRoVaiTro } = duyetVuAn('c1', tomTat, null, EMPTY);
    expect(toCreate).toHaveLength(0);
    expect(chuaRoVaiTro.map((d) => d.hoTen)).toContain('Nguyễn Văn X');
  });

  it('quốc tịch trong ngoặc ghi vào notes', () => {
    const { toCreate } = duyetVuAn('c1', null, 'BRIGOLA ROWENA BOLALIN (Philipin)', EMPTY);
    expect(String(toCreate[0].notes)).toContain('Quốc tịch: Philipin');
  });

  it('nguồn rỗng → không tạo gì', () => {
    expect(duyetVuAn('c1', null, null, EMPTY).toCreate).toEqual([]);
  });
});
