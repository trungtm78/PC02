import { resolveField } from './field-catalog';

/**
 * Ba hướng xử lý quyết định BA ô cùng lúc trên Phiếu đề xuất: câu "Đề xuất", ô "Kính gửi", và
 * (gián tiếp) trạng thái hồ sơ. Ca kiểm ở đây chốt hai ô đầu — thứ người dân cầm trên tay.
 *
 * Ca chống hồi quy quan trọng nhất nằm ở `describe('hồ sơ chưa có hướng')`: hành vi cũ đã được
 * đo khớp hệ cũ 22/22 mục ngày 09/09/2026, và không được phép đổi khi thêm ba hướng.
 */

const HO_SO_GIAO = { huongXuLy: 'GIAO_DON', donViGiaiQuyet: 'Đội 4' };
const HO_SO_CHUYEN = { huongXuLy: 'CHUYEN_DON', donViGiaiQuyet: 'Công an phường Bến Nghé' };
const HO_SO_TRA = { huongXuLy: 'TRA_LUU_DON', donViGiaiQuyet: 'Tổ công tác số 6' };

describe('donViCuaHoSo — một luật dùng chung cho deXuat · kinhGui · donViNhan', () => {
  it('ưu tiên donViXuLy khi hồ sơ mới đã ghi cột ấy', () => {
    expect(
      resolveField('DON_THU', 'donViNhan', { donViXuLy: 'Đội 8', donViGiaiQuyet: 'Đội 4' }),
    ).toBe('Đội 8');
  });

  /**
   * Đây là lỗi anh báo bằng ảnh chụp: `Kính gửi:` trống trên Phiếu chuyển đơn.
   * Đo 09/09/2026: cột `donViXuLy` rỗng ở CẢ 47.169 hồ sơ — hệ cũ đổ vào `donViGiaiQuyet`.
   */
  it('lùi về donViGiaiQuyet — 47.169 hồ sơ di trú không có donViXuLy', () => {
    expect(resolveField('DON_THU', 'donViNhan', { donViGiaiQuyet: 'Đội 4' })).toBe('Đội 4');
  });

  it('cả hai rỗng → chuỗi rỗng, không in ký tự thừa', () => {
    expect(resolveField('DON_THU', 'donViNhan', {})).toBe('');
  });
});

describe('deXuat — ba khuôn câu theo hướng xử lý', () => {
  it('Giao đơn', () => {
    expect(resolveField('DON_THU', 'deXuat', HO_SO_GIAO)).toBe(
      'Giao Đội 4 tiếp nhận kiểm tra, xác minh, báo cáo Đ/c Chỉ huy Phòng phụ trách để giải quyết theo quy định',
    );
  });

  it('Chuyển đơn', () => {
    expect(resolveField('DON_THU', 'deXuat', HO_SO_CHUYEN)).toBe(
      'Chuyển Công an phường Bến Nghé để xem xét, giải quyết theo quy định và đề nghị thông báo kết quả cho PC02 Công an TP Hồ Chí Minh',
    );
  });

  it('Trả đơn/Lưu đơn — chỉ tên đơn vị', () => {
    expect(resolveField('DON_THU', 'deXuat', HO_SO_TRA)).toBe('Tổ công tác số 6');
  });

  it('cán bộ tự viết thì luôn dùng chữ của cán bộ, không ghép đè', () => {
    expect(
      resolveField('DON_THU', 'deXuat', { ...HO_SO_CHUYEN, deXuat: 'Chuyển VKSND xem xét' }),
    ).toBe('Chuyển VKSND xem xét');
  });
});

describe('kinhGui — đổi theo hướng xử lý', () => {
  it('Giao đơn → hai dòng Ban chỉ huy, dòng sau là đơn vị được giao', () => {
    expect(resolveField('DON_THU', 'kinhGui', HO_SO_GIAO)).toBe(
      '- Ban chỉ huy PC02;\n- Ban chỉ huy Đội 4.',
    );
  });

  it('Chuyển đơn → chỉ đơn vị giải quyết', () => {
    expect(resolveField('DON_THU', 'kinhGui', HO_SO_CHUYEN)).toBe(
      '- Công an phường Bến Nghé.',
    );
  });

  it('Trả đơn/Lưu đơn → hai dòng Ban chỉ huy như Giao đơn', () => {
    expect(resolveField('DON_THU', 'kinhGui', HO_SO_TRA)).toBe(
      '- Ban chỉ huy PC02;\n- Ban chỉ huy Tổ công tác số 6.',
    );
  });

  /** Chưa chọn đơn vị thì KHÔNG in gạch đầu dòng cụt. */
  it('Giao đơn mà chưa chọn đơn vị → chỉ dòng PC02', () => {
    expect(resolveField('DON_THU', 'kinhGui', { huongXuLy: 'GIAO_DON' })).toBe(
      '- Ban chỉ huy PC02;',
    );
  });

  it('Chuyển đơn mà chưa chọn đơn vị → rỗng hẳn', () => {
    expect(resolveField('DON_THU', 'kinhGui', { huongXuLy: 'CHUYEN_DON' })).toBe('');
  });
});

describe('hồ sơ chưa có hướng — CHỐNG HỒI QUY bản in đã đo khớp hệ cũ', () => {
  it('deXuat rơi về khuôn Giao đơn, đúng bằng hành vi trước khi có huongXuLy', () => {
    expect(resolveField('DON_THU', 'deXuat', { donViGiaiQuyet: 'Đội 4' })).toBe(
      'Giao Đội 4 tiếp nhận kiểm tra, xác minh, báo cáo Đ/c Chỉ huy Phòng phụ trách để giải quyết theo quy định',
    );
  });

  it('kinhGui rơi về đúng chữ CỨNG của mẫu hệ cũ khi không có cả đơn vị', () => {
    expect(resolveField('DON_THU', 'kinhGui', {})).toBe(
      '- Ban chỉ huy PC02;\n- Ban chỉ huy Đội 1.',
    );
  });
});

describe('noiNhan — khối "Nơi nhận"', () => {
  const CAN_BO = { canBoDeXuat: { firstName: 'Văn', lastName: 'Phạm Thanh' } };

  it('có nguồn đơn → đủ bốn dòng', () => {
    expect(resolveField('DON_THU', 'noiNhan', { nguonDon: 'Bưu điện', ...CAN_BO })).toBe(
      [
        '- Như trên;',
        '- Đ/c Trưởng phòng (thay báo cáo);',
        '- Bưu điện (thay báo cáo);',
        '- Lưu: PC02-Đ1 (Tổ 2), T.Văn.',
      ].join('\n'),
    );
  });

  /**
   * Không có nguồn đơn thì BỎ HẲN dòng, không in `-  (thay báo cáo);`.
   * Đây là lý do khối này dựng ở máy chủ thay vì để bốn đoạn rời trong tệp Word: `.docx`
   * không bỏ được nguyên một đoạn khi giá trị rỗng.
   */
  it('không có nguồn đơn → ba dòng, không có gạch đầu dòng cụt', () => {
    expect(resolveField('DON_THU', 'noiNhan', CAN_BO)).toBe(
      ['- Như trên;', '- Đ/c Trưởng phòng (thay báo cáo);', '- Lưu: PC02-Đ1 (Tổ 2), T.Văn.'].join(
        '\n',
      ),
    );
  });

  /**
   * Ba mẫu Thông báo có khối NGẮN hơn — hệ cũ không có dòng nguồn đơn ở đó.
   * Dùng chung một biến với Phiếu chuyển đơn sẽ in thừa một dòng mà không ai phát hiện.
   */
  it('Thông báo: KHÔNG có dòng nguồn đơn dù hồ sơ có nguồn đơn', () => {
    expect(
      resolveField('DON_THU', 'noiNhanThongBao', { nguonDon: 'Bưu điện', ...CAN_BO }),
    ).toBe(
      ['- Như trên;', '- Đ/c Trưởng phòng (thay báo cáo);', '- Lưu: PC02-Đ1 (Tổ 2), T.Văn.'].join(
        '\n',
      ),
    );
  });

  it('Chuyển nguồn tin: thêm VKSND và PC01 theo quy định tố tụng', () => {
    expect(resolveField('DON_THU', 'noiNhanNguonTin', CAN_BO)).toBe(
      [
        '- Như trên;',
        '- Đ/c Trưởng phòng (thay báo cáo);',
        '- VKSND TP HCM;',
        '- PC01 CATP HCM;',
        '- Lưu: PC02-Đ1 (Tổ 2), T.Văn.',
      ].join('\n'),
    );
  });

  it('dùng tổ của người đang đăng nhập, không phải hằng số "Tổ 2"', () => {
    const ra = resolveField(
      'DON_THU',
      'noiNhan',
      CAN_BO,
      { actor: { firstName: 'Huy', lastName: 'Nguyễn Văn', teamName: 'Tổ 5' } } as any,
    );
    expect(ra).toContain('- Lưu: PC02-Đ1 (Tổ 5), V.Huy.');
  });
});

describe('toNhanDon — tổ ở dòng "Lưu:"', () => {
  it('lấy tổ của người đang đăng nhập', () => {
    expect(
      resolveField('DON_THU', 'toNhanDon', {}, { actor: { teamName: 'Tổ 5' } } as any),
    ).toBe('Tổ 5');
  });

  it('người đăng nhập không thuộc tổ nào → lùi về tổ được phân công của hồ sơ', () => {
    expect(
      resolveField(
        'DON_THU',
        'toNhanDon',
        { assignedTeam: { name: 'Tổ 3' } },
        { actor: {} } as any,
      ),
    ).toBe('Tổ 3');
  });

  /** Không suy được thì giữ đúng chữ cứng cũ để bản in không mất thông tin. */
  it('không suy được → giữ "Tổ 2" như mẫu cũ', () => {
    expect(resolveField('DON_THU', 'toNhanDon', {})).toBe('Tổ 2');
  });
});

describe('vietTatCanBo — người ĐĂNG NHẬP đứng trước (đảo ưu tiên có chủ ý)', () => {
  /**
   * Trước bản này thứ tự là canBoDeXuat → actor → enteredBy, nên bản in ghi "Lưu:" tên người
   * được chọn trên form chứ không phải người thật sự bấm In. Anh yêu cầu "tên user login".
   */
  it('người đăng nhập thắng cán bộ đề xuất chọn trên form', () => {
    expect(
      resolveField(
        'DON_THU',
        'vietTatCanBo',
        { canBoDeXuat: { firstName: 'Văn', lastName: 'Phạm Thanh' } },
        { actor: { firstName: 'Huy', lastName: 'Nguyễn Văn' } } as any,
      ),
    ).toBe('V.Huy');
  });

  it('không có người đăng nhập → lùi về cán bộ đề xuất', () => {
    expect(
      resolveField('DON_THU', 'vietTatCanBo', {
        canBoDeXuat: { firstName: 'Văn', lastName: 'Phạm Thanh' },
      }),
    ).toBe('T.Văn');
  });
});

describe('tenTruongPhong — không được rỗng, vì rỗng chính là lỗi đang sửa', () => {
  it('lấy từ ngữ cảnh khi máy chủ đã nạp cấu hình', () => {
    expect(
      resolveField('DON_THU', 'tenTruongPhong', {}, {
        tenTruongPhong: 'Thượng tá Trần Văn A',
      } as any),
    ).toBe('Thượng tá Trần Văn A');
  });

  it('chưa cấu hình → giá trị seed đo từ bản in hệ cũ, KHÔNG phải chuỗi rỗng', () => {
    expect(resolveField('DON_THU', 'tenTruongPhong', {})).toBe('Thượng tá Nguyễn Trung Hoà');
  });
});
