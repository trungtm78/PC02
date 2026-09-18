import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UserTableLayoutsService } from './user-table-layouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { LuuMatDoDto } from './dto/luu-mat-do.dto';

/**
 * Mật độ dòng của bảng danh sách (18/09/2026, PR-F2 — mẫu Airtable "row height"): Gọn (1 dòng) / Đọc (5 dòng,
 * MẶC ĐỊNH theo yêu cầu anh) / Đầy đủ. Nhớ THEO CÁN BỘ, theo từng bảng, ở máy chủ — cùng kho với bố cục cột.
 *   • mọi truy vấn kẹp `userId` (không ai đọc/ghi mật độ của người khác)
 *   • chỉ nhận ba giá trị, chỉ bảng trong danh sách trắng
 *   • ghi mật độ KHÔNG đụng bố cục cột; "Đặt lại cột" KHÔNG xoá mật độ đã chọn
 */
const kho = {
  userTableLayout: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn((a: { create: object }) =>
      Promise.resolve({ id: 'l1', ...a.create }),
    ),
    deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
  },
};

describe('UserTableLayoutsService — mật độ dòng', () => {
  let svc: UserTableLayoutsService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        UserTableLayoutsService,
        { provide: PrismaService, useValue: kho },
      ],
    }).compile();
    svc = mod.get(UserTableLayoutsService);
    jest.clearAllMocks();
  });

  it('đọc: chỉ của chính người ấy, bản đồ theo bảng, bỏ giá trị lạ trong CSDL', async () => {
    kho.userTableLayout.findMany.mockResolvedValue([
      { tableKey: 'petitions', matDo: 'gon' },
      { tableKey: 'cases', matDo: 'la-hoac-hong' },
    ]);
    expect(await svc.listMatDo('u1')).toEqual({ petitions: 'gon' });
    expect(kho.userTableLayout.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', matDo: { not: null } },
      select: { tableKey: true, matDo: true },
    });
  });

  it('ghi: kẹp userId, chỉ đổi mật độ — hàng mới thì bố cục cột rỗng (= theo mã)', async () => {
    await svc.luuMatDo('u1', 'incidents', 'day-du');
    expect(kho.userTableLayout.upsert).toHaveBeenCalledWith({
      where: { userId_tableKey: { userId: 'u1', tableKey: 'incidents' } },
      create: {
        userId: 'u1',
        tableKey: 'incidents',
        columns: {},
        matDo: 'day-du',
      },
      update: { matDo: 'day-du' },
    });
  });

  it('bảng lạ → 400', async () => {
    await expect(svc.luuMatDo('u1', 'khong-co', 'gon')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('màn Đơn thư phường được nhớ mật độ', async () => {
    await svc.luuMatDo('u1', 'ward-petitions', 'gon');
    expect(kho.userTableLayout.upsert).toHaveBeenCalled();
  });

  /**
   * MỘT lệnh ghi có điều kiện, không đọc-rồi-ghi: hai tab cùng bấm "Đặt lại" thì hàng có thể bị xoá giữa lúc đọc và
   * lúc cập nhật → cập nhật ném P2025 thành 500 (rà mã PR-F2).
   */
  it('"Đặt lại cột" GIỮ mật độ đã chọn: có mật độ thì chỉ làm rỗng bố cục cột', async () => {
    kho.userTableLayout.updateMany.mockResolvedValue({ count: 1 });
    expect(await svc.reset('u1', 'petitions')).toEqual({ deleted: 1 });
    expect(kho.userTableLayout.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', tableKey: 'petitions', matDo: { not: null } },
      data: { columns: {} },
    });
    expect(kho.userTableLayout.deleteMany).not.toHaveBeenCalled();
  });

  it('"Đặt lại cột" khi chưa chọn mật độ → xoá hàng như cũ', async () => {
    kho.userTableLayout.updateMany.mockResolvedValue({ count: 0 });
    await svc.reset('u1', 'petitions');
    expect(kho.userTableLayout.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', tableKey: 'petitions' },
    });
  });

  it('DTO chỉ nhận gon | doc | day-du', async () => {
    expect(
      await validate(plainToInstance(LuuMatDoDto, { matDo: 'doc' })),
    ).toEqual([]);
    const loi = await validate(
      plainToInstance(LuuMatDoDto, { matDo: 'rat-cao' }),
    );
    expect(loi.map((e) => e.property)).toEqual(['matDo']);
  });
});
