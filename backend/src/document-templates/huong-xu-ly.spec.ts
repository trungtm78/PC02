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
  /**
   * MỘT cột duy nhất từ 10/09/2026. Trước đó form có hai ô cùng nghĩa ghi vào hai cột, và hàm
   * này phải đoán bằng `donViXuLy || donViGiaiQuyet`.
   *
   * Cột thắng là `donViGiaiQuyet` vì đo trên máy thật: nó có dữ liệu ở 46.723/46.741 hồ sơ
   * (`donViXuLy`: 0), nó là cột của hệ cũ, và danh sách / bộ lọc / thẻ thống kê / xuất Excel
   * của Đơn thư CHỈ đọc cột ấy.
   */
  it('đọc donViGiaiQuyet — cột duy nhất', () => {
    expect(resolveField('DON_THU', 'donViNhan', { donViGiaiQuyet: 'Đội 4' })).toBe('Đội 4');
  });

  /** Cột cũ không còn tiếng nói: có giá trị ở đó cũng KHÔNG được lấy. */
  it('KHÔNG đọc donViXuLy nữa, kể cả khi cột ấy có giá trị', () => {
    expect(
      resolveField('DON_THU', 'donViNhan', { donViXuLy: 'Đội 8', donViGiaiQuyet: 'Đội 4' }),
    ).toBe('Đội 4');
    expect(resolveField('DON_THU', 'donViNhan', { donViXuLy: 'Đội 8' })).toBe('');
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

  /**
   * [hotfix 15/09/2026] Tên tổ THẬT trong CSDL là "Tổ công tác Số 2" (đo prod: 10 tổ "Tổ công tác Số
   * 1..10"), nên bản in ghi "Lưu: PC02-Đ1 (Tổ công tác Số 2)" — sai quy ước văn bản "(Tổ 2)". Các ca
   * trên dùng dữ liệu giả "Tổ 5" nên không bắt được. Tên không đánh số ("Tổ Truy nã", "Đội 7") giữ nguyên.
   */
  it('tên thật "Tổ công tác Số 2" của người đăng nhập → "Tổ 2"', () => {
    expect(
      resolveField('DON_THU', 'toNhanDon', {}, {
        actor: { teamName: 'Tổ công tác Số 2' },
      } as never),
    ).toBe('Tổ 2');
  });

  it('rút gọn cả tổ phân công của hồ sơ, không phân biệt hoa thường/khoảng trắng', () => {
    expect(
      resolveField(
        'DON_THU',
        'toNhanDon',
        { assignedTeam: { name: '  tổ công tác số  10 ' } },
        { actor: {} } as never,
      ),
    ).toBe('Tổ 10');
  });

  it('tên tổ không theo mẫu "Tổ công tác Số N" → giữ nguyên', () => {
    for (const ten of ['Tổ Truy nã', 'Tổ Tăng cường CS1', 'Đội 7']) {
      expect(
        resolveField('DON_THU', 'toNhanDon', {}, {
          actor: { teamName: ten },
        } as never),
      ).toBe(ten);
    }
  });

  it('dòng "Lưu:" đầy đủ với tên tổ thật', () => {
    const ra = resolveField(
      'DON_THU',
      'noiNhan',
      { canBoDeXuat: { firstName: 'Văn', lastName: 'Phạm Thanh' } },
      {
        actor: {
          firstName: 'Huy',
          lastName: 'Nguyễn Văn',
          teamName: 'Tổ công tác Số 2',
        },
      } as never,
    );
    expect(ra).toContain('- Lưu: PC02-Đ1 (Tổ 2), V.Huy.');
    expect(ra).not.toContain('Tổ công tác');
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

/**
 * Ô đơn vị đã là CẢ CÂU đề xuất → in NGUYÊN VĂN, đúng biến thể 3 của mẫu hệ cũ
 * (`Đề xuất: ${don_vi_giai_quyet}./.`). Cả ba biến thể hệ cũ đều ghi "Kính gửi" bằng chữ cứng.
 *
 * Trước bản này, hồ sơ 2026-11725 in ra "Giao Lưu đơn; Hướng dẫn khởi kiện tại TAND tiếp nhận
 * kiểm tra, xác minh…" và "Kính gửi: - Ban chỉ huy Lưu đơn; Hướng dẫn khởi kiện tại TAND." — đo
 * 13/09/2026 có ~1.600 đơn thư mang kiểu nội dung này.
 */
describe('ô đơn vị là cả câu đề xuất — in nguyên văn như biến thể 3 hệ cũ', () => {
  const CAU = 'Lưu đơn; Hướng dẫn khởi kiện tại TAND';

  it.each(['GIAO_DON', 'CHUYEN_DON', 'TRA_LUU_DON', ''])(
    'deXuat với hướng "%s" → nguyên văn, không bọc khuôn câu',
    (huong) => {
      expect(resolveField('DON_THU', 'deXuat', { huongXuLy: huong, donViGiaiQuyet: CAU })).toBe(
        CAU,
      );
    },
  );

  it('"Chuyển Đ/c … để chỉ đạo" không bị bọc thành "Giao Chuyển …"', () => {
    const v = 'Chuyển Đ/c Phú - Phó Trưởng phòng để chỉ đạo Đội 8';
    expect(resolveField('DON_THU', 'deXuat', { huongXuLy: 'GIAO_DON', donViGiaiQuyet: v })).toBe(v);
  });

  it.each(['GIAO_DON', 'CHUYEN_DON', 'TRA_LUU_DON', ''])(
    'kinhGui với hướng "%s" → chữ cứng hệ cũ, không ghép câu vào sau "Ban chỉ huy"',
    (huong) => {
      expect(resolveField('DON_THU', 'kinhGui', { huongXuLy: huong, donViGiaiQuyet: CAU })).toBe(
        '- Ban chỉ huy PC02;\n- Ban chỉ huy Đội 1.',
      );
    },
  );

  /** Chống hồi quy: tên đơn vị bình thường vẫn đi đúng khuôn câu cũ. */
  it('tên đơn vị bình thường vẫn bọc khuôn câu Giao đơn', () => {
    expect(resolveField('DON_THU', 'deXuat', HO_SO_GIAO)).toBe(
      'Giao Đội 4 tiếp nhận kiểm tra, xác minh, báo cáo Đ/c Chỉ huy Phòng phụ trách để giải quyết theo quy định',
    );
  });

  /** Người nhận "Đồng chí …" KHÔNG phải câu — giữ khuôn Giao như biến thể 1 hệ cũ. */
  it('"Đồng chí Minh - Phó Trưởng phòng…" là người nhận, vẫn bọc khuôn Giao', () => {
    expect(
      resolveField('DON_THU', 'deXuat', {
        huongXuLy: 'GIAO_DON',
        donViGiaiQuyet: 'Đồng chí Minh - Phó Trưởng phòng để chỉ đạo Đội 8',
      }),
    ).toMatch(/^Giao Đồng chí Minh/);
  });
});
