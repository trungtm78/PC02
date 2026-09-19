import { ForbiddenException } from '@nestjs/common';
import { chonToBaoCao, duocXemBanNhap, phamViTo } from './tdac-pham-vi';

/**
 * Báo cáo TĐC — phạm vi theo tổ (soát IDOR 19/09/2026).
 *
 * Trước bản vá: bản nháp chỉ cần quyền `read:Case` (cán bộ nào cũng có) → cán bộ liệt kê, mở, xuất MỌI bản nháp,
 * gồm số liệu tổ khác. Phần tính báo cáo: không gửi `teamIds` = TOÀN đơn vị, và cán bộ không thuộc tổ nào được thả.
 * Luật: quản trị không giới hạn; điều phối viên ĐỌC toàn bộ (ngoài phạm vi chỉ xem + phân công — quyết định
 * 19/09/2026); cán bộ chỉ các tổ mình đọc được, GHI chỉ tổ mình ghi được.
 */
const canBo = {
  teamIds: ['t1', 't2'],
  userIds: ['u1'],
  writableTeamIds: ['t1'],
  writableUserIds: ['u1'],
  canDispatch: false,
};

describe('phamViTo', () => {
  it('quản trị (không phạm vi) → không giới hạn', () => {
    expect(phamViTo(null, 'read')).toBeNull();
    expect(phamViTo(undefined, 'write')).toBeNull();
  });
  it('điều phối viên: ĐỌC không giới hạn, GHI theo tổ ghi được', () => {
    const dp = { ...canBo, canDispatch: true };
    expect(phamViTo(dp as never, 'read')).toBeNull();
    expect(phamViTo(dp as never, 'write')).toEqual(['t1']);
  });
  it('cán bộ: đọc = tổ đọc được, ghi = tổ ghi được', () => {
    expect(phamViTo(canBo as never, 'read')).toEqual(['t1', 't2']);
    expect(phamViTo(canBo as never, 'write')).toEqual(['t1']);
  });
});

describe('chonToBaoCao', () => {
  it('không giới hạn → giữ nguyên yêu cầu (kể cả rỗng = toàn đơn vị)', () => {
    expect(chonToBaoCao([], null)).toEqual([]);
    expect(chonToBaoCao(['t9'], null)).toEqual(['t9']);
  });
  it('cán bộ không gửi tổ → mặc định các tổ của mình, KHÔNG phải toàn đơn vị', () => {
    expect(chonToBaoCao([], ['t1', 't2'])).toEqual(['t1', 't2']);
  });
  it('cán bộ xin tổ ngoài phạm vi → 403', () => {
    expect(() => chonToBaoCao(['t1', 't9'], ['t1', 't2'])).toThrow(
      ForbiddenException,
    );
  });
  it('cán bộ không thuộc tổ nào → 403 (trước đây được thả)', () => {
    expect(() => chonToBaoCao([], [])).toThrow(ForbiddenException);
  });
});

describe('duocXemBanNhap', () => {
  const banNhap = (teamIds: string[], createdById = 'u-khac') => ({
    teamIds,
    createdById,
  });
  it('không giới hạn → xem được', () => {
    expect(duocXemBanNhap(banNhap(['t9']), 'u1', null)).toBe(true);
  });
  it('người tạo luôn xem được bản của mình', () => {
    expect(duocXemBanNhap(banNhap(['t9'], 'u1'), 'u1', ['t1'])).toBe(true);
  });
  it('mọi tổ của bản nháp nằm trong phạm vi → xem được', () => {
    expect(duocXemBanNhap(banNhap(['t1', 't2']), 'u1', ['t1', 't2'])).toBe(
      true,
    );
  });
  it('có tổ ngoài phạm vi → không', () => {
    expect(duocXemBanNhap(banNhap(['t1', 't9']), 'u1', ['t1', 't2'])).toBe(
      false,
    );
  });
  it('bản nháp TOÀN đơn vị (teamIds rỗng) → chỉ người không giới hạn hoặc người tạo', () => {
    expect(duocXemBanNhap(banNhap([]), 'u1', ['t1'])).toBe(false);
    expect(duocXemBanNhap(banNhap([], 'u1'), 'u1', ['t1'])).toBe(true);
  });
});
