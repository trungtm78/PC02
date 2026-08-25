import {
  buildEntityPlaceholders,
  buildTemplatePlaceholders,
  escapeForDelimiters,
} from './entity-placeholders';

describe('buildEntityPlaceholders', () => {
  it('VU_AN: map field Case → placeholder', () => {
    const p = buildEntityPlaceholders(
      'VU_AN',
      { caseCode: 'VA-2026-001', name: 'Vụ X', crime: 'Trộm cắp', status: 'DANG_DIEU_TRA' },
      {},
    );
    expect(p.soVuAn).toBe('VA-2026-001');
    expect(p.tenVuAn).toBe('Vụ X');
    expect(p.toiDanh).toBe('Trộm cắp');
  });

  it('VU_VIEC: map field Incident → placeholder', () => {
    const p = buildEntityPlaceholders(
      'VU_VIEC',
      { code: 'VV-2026-001', name: 'Việc Y', nguonPhatTin: 'Tố giác', description: 'Nội dung' },
      {},
    );
    expect(p.soVuViec).toBe('VV-2026-001');
    expect(p.tenVuViec).toBe('Việc Y');
    expect(p.nguonTin).toBe('Tố giác');
    expect(p.noiDung).toBe('Nội dung');
  });

  it('manualValues bổ sung/ghi đè biến', () => {
    const p = buildEntityPlaceholders('VU_AN', { caseCode: 'C1' }, { ghiChu: 'tay nhập', soVuAn: 'OVERRIDE' });
    expect(p.ghiChu).toBe('tay nhập');
    expect(p.soVuAn).toBe('OVERRIDE');
  });

  it('escape token người dùng ({ } < >) chống injection docxtemplater', () => {
    const p = buildEntityPlaceholders('VU_AN', { name: 'A{x}B' }, {});
    expect(p.tenVuAn).not.toContain('{');
    expect(p.tenVuAn).not.toContain('}');
  });

  it('[codex P2] dieuTraVien = firstName + lastName (User không có fullName)', () => {
    const p = buildEntityPlaceholders(
      'VU_AN',
      { caseCode: 'C1', investigator: { firstName: 'A', lastName: 'Nguyễn Văn' } },
      {},
    );
    expect(p.dieuTraVien).toBe('Nguyễn Văn A');
  });

  it('field thiếu → chuỗi rỗng (không "undefined")', () => {
    const p = buildEntityPlaceholders('VU_AN', { caseCode: 'C1' }, {});
    expect(p.toiDanh).toBe('');
  });
});

describe('buildTemplatePlaceholders (mapping-driven)', () => {
  it('auto: key = name tự do, value = resolveField(field)', () => {
    const p = buildTemplatePlaceholders(
      'DON_THU',
      [{ name: 'Họ tên người gửi', source: 'auto', field: 'ghiTen' }],
      { senderName: 'Trần Bình' },
    );
    expect(p['Họ tên người gửi']).toBe('Trần Bình');
  });

  it('manual: value = manualValues[name]', () => {
    const p = buildTemplatePlaceholders(
      'DON_THU',
      [{ name: 'Ghi chú', source: 'manual' }],
      {},
      { 'Ghi chú': 'nhập tay' },
    );
    expect(p['Ghi chú']).toBe('nhập tay');
  });

  it('field soVanBan lấy số từ manualValues.soVanBan (cấp khi in)', () => {
    const p = buildTemplatePlaceholders(
      'DON_THU',
      [{ name: 'Số', source: 'auto', field: 'soVanBan' }],
      {},
      { soVanBan: '123/PC02' },
    );
    expect(p['Số']).toBe('123/PC02');
  });

  it('[codex P1] auto-field rỗng: manualValues[name] override (popup bổ sung thông tin thiếu)', () => {
    const p = buildTemplatePlaceholders(
      'VU_AN',
      [{ name: 'dieuTraVien', source: 'auto', field: 'dieuTraVien', required: true }],
      {}, // record không có investigator → resolve rỗng
      { dieuTraVien: 'Thiếu tá Nguyễn An' }, // người dùng nhập tại popup
    );
    expect(p.dieuTraVien).toBe('Thiếu tá Nguyễn An');
  });

  it('fallback field=name khi thiếu field (tương thích template cũ)', () => {
    const p = buildTemplatePlaceholders(
      'VU_AN',
      [{ name: 'soVuAn', source: 'auto' }],
      { caseCode: 'VA-1' },
    );
    expect(p.soVuAn).toBe('VA-1');
  });

  it('escape theo delimiter [[ ]]: giá trị chứa [[ ]] không tạo tag giả', () => {
    const p = buildTemplatePlaceholders(
      'DON_THU',
      [{ name: 'x', source: 'manual' }],
      {},
      { x: '[[deXuat]]' },
      { start: '[[', end: ']]' },
    );
    expect(p.x).not.toContain('[[');
    expect(p.x).not.toContain(']]');
  });
});

describe('escapeForDelimiters', () => {
  it('mặc định { } → homoglyph (không còn { })', () => {
    const out = escapeForDelimiters('A{x}B');
    expect(out).not.toContain('{');
    expect(out).not.toContain('}');
  });

  it('delimiter «» → phá chuỗi « » trong giá trị', () => {
    const out = escapeForDelimiters('«hack»', { start: '«', end: '»' });
    // start/end là 1 ký tự → chèn ZWSP sau, không còn match « ... » liền mạch
    expect(out).not.toBe('«hack»');
  });
});
