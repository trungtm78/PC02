import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import type { DataScope } from '../auth/services/unit-scope.service';

/**
 * CỔNG: tệp của hồ sơ ĐÃ CHUYỂN Vụ án — nhìn thấy thì phải tải xuống được.
 *
 * Khi đơn thư chuyển thành Vụ án, `petitions.service.ts:1449` GIỮ NGUYÊN `petitionId` và THÊM
 * `caseId`. Từ đó tệp có HAI cha, và hai đường đọc dùng hai luật khác nhau:
 *
 *   liệt kê  (`documents.service.ts:93`)  → OR( phạm vi Vụ án , phạm vi Đơn thư )
 *   tải/xem  (`documents.service.ts:174`) → phạm vi Đơn thư CHỈ KHI không có cha Vụ án
 *
 * Hệ quả: cán bộ đọc được đơn nhưng không đọc được vụ án thì THẤY tệp trong danh sách, bấm tải
 * và nhận 403. Không có thông báo nào giải thích, và cán bộ không có cách nào tự xử.
 *
 * Lượt soát mô hình ngoài 22/09/2026 chỉ ra khe hở này khi rà kế hoạch thêm khu tải tệp.
 */
const PHAM_VI_DON_THU: DataScope = {
  teamIds: ['to-don-thu'],
  userIds: [],
  writableTeamIds: ['to-don-thu'],
  writableUserIds: [],
};

/** Tệp có HAI cha: đơn thư của tổ mình, vụ án của tổ khác. */
const TEP_HAI_CHA = {
  id: 'd1',
  petitionId: 'p1',
  caseId: 'c1',
  incidentId: null,
  petition: { id: 'p1', assignedTeamId: 'to-don-thu', enteredById: 'u1', deletedAt: null },
  case: { id: 'c1', assignedTeamId: 'to-vu-an', investigatorId: 'u9' },
  incident: null,
};

function dungService(ban: unknown) {
  const findFirst = jest.fn().mockResolvedValue(ban);
  const svc = new DocumentsService(
    { document: { findFirst } } as never,
    {} as never,
    {} as never,
  );
  return { svc, findFirst };
}

describe('CỔNG: tệp có hai cha — thấy được thì tải được', () => {
  it('đọc được ĐƠN THƯ cha là đủ để mở tệp, dù không đọc được vụ án', async () => {
    const { svc } = dungService(TEP_HAI_CHA);
    await expect(svc.getById('d1', PHAM_VI_DON_THU)).resolves.toMatchObject({
      success: true,
    });
  });

  it('không đọc được CẢ HAI cha thì vẫn bị chặn', async () => {
    const { svc } = dungService(TEP_HAI_CHA);
    const nguoiLa: DataScope = {
      teamIds: ['to-khac'],
      userIds: [],
      writableTeamIds: ['to-khac'],
      writableUserIds: [],
    };
    await expect(svc.getById('d1', nguoiLa)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('đọc được VỤ ÁN cha cũng đủ — không phá luật cũ', async () => {
    const { svc } = dungService(TEP_HAI_CHA);
    const toVuAn: DataScope = {
      teamIds: ['to-vu-an'],
      userIds: [],
      writableTeamIds: ['to-vu-an'],
      writableUserIds: [],
    };
    await expect(svc.getById('d1', toVuAn)).resolves.toMatchObject({ success: true });
  });

  it('tệp CHỈ có cha đơn thư: luật cũ giữ nguyên', async () => {
    const { svc } = dungService({
      ...TEP_HAI_CHA,
      caseId: null,
      case: null,
    });
    await expect(svc.getById('d1', PHAM_VI_DON_THU)).resolves.toMatchObject({ success: true });
    await expect(
      svc.getById('d1', {
        teamIds: ['to-khac'],
        userIds: [],
        writableTeamIds: ['to-khac'],
        writableUserIds: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  /**
   * Nới phép đọc chỉ được làm hai đường BẰNG NHAU, không được rộng hơn đường liệt kê.
   *
   * `findAll` loại tệp của đơn thư đã xoá mềm (`{ petition: { AND: [phamVi, { deletedAt: null }] } }`,
   * chú thích "chain-of-custody bleeding prevention"). Bỏ sót điều đó ở đây thì XOÁ đơn thư
   * lại thành cách mở khoá tệp của một vụ án mình không được đọc — lượt soát mô hình ngoài
   * 22/09/2026 dựng đúng ca này.
   */
  it('đơn thư cha ĐÃ XOÁ MỀM: không cho qua, dù còn trong phạm vi', async () => {
    const { svc } = dungService({
      ...TEP_HAI_CHA,
      petition: { ...TEP_HAI_CHA.petition, deletedAt: new Date() },
    });
    await expect(svc.getById('d1', PHAM_VI_DON_THU)).rejects.toBeInstanceOf(ForbiddenException);
  });

  /** Chính tệp bị xoá mềm thì không tồn tại với mọi người, không phải chuyện phạm vi. */
  it('chính TỆP bị xoá mềm: không tìm thấy', async () => {
    const findFirst = jest.fn().mockImplementation(({ where }: { where: { deletedAt: unknown } }) =>
      where.deletedAt === null ? null : TEP_HAI_CHA,
    );
    const svc = new DocumentsService(
      { document: { findFirst } } as never,
      {} as never,
      {} as never,
    );
    await expect(svc.getById('d1', PHAM_VI_DON_THU)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('tệp CHỈ có cha vụ án: luật cũ giữ nguyên', async () => {
    const { svc } = dungService({
      ...TEP_HAI_CHA,
      petitionId: null,
      petition: null,
    });
    await expect(svc.getById('d1', PHAM_VI_DON_THU)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
