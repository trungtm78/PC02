/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * Cấu hình giao diện "bấm vào dòng": giá trị hợp lệ, mặc định, danh sách trắng, và đồng bộ với migration gieo khoá.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BAM_DONG_GIA_TRI,
  BAM_DONG_MAC_DINH,
  DANH_SACH_BAM_DONG_GIA_TRI,
  KHOA_GIAO_DIEN,
} from '../common/constants/giao-dien.constants';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';

const mockPrisma = {
  systemSetting: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};
const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

describe('cấu hình giao diện — bấm vào dòng', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(SettingsService);
    jest.clearAllMocks();
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
  });

  it('7 khoá, mỗi khoá có mặc định hợp lệ; ba màn Đơn thư = KHONG, còn lại = XEM', () => {
    expect(KHOA_GIAO_DIEN).toHaveLength(7);
    for (const k of KHOA_GIAO_DIEN) expect(DANH_SACH_BAM_DONG_GIA_TRI).toContain(BAM_DONG_MAC_DINH[k]);
    expect(BAM_DONG_MAC_DINH.BAM_DONG_DON_THU).toBe('KHONG');
    expect(BAM_DONG_MAC_DINH.BAM_DONG_DON_THU_PHUONG).toBe('KHONG');
    expect(BAM_DONG_MAC_DINH.BAM_DONG_DON_TRUNG).toBe('KHONG');
    for (const k of ['BAM_DONG_VU_VIEC', 'BAM_DONG_VU_AN', 'BAM_DONG_TONG_HOP', 'BAM_DONG_UY_THAC']) {
      expect(BAM_DONG_MAC_DINH[k]).toBe('XEM');
    }
    expect(Object.keys(SETTINGS_KEY).filter((k) => k.startsWith('BAM_DONG_')).sort()).toEqual(
      [...KHOA_GIAO_DIEN].sort(),
    );
  });

  describe('updateValue — danh mục giá trị', () => {
    it('giá trị lạ → 400 và KHÔNG ghi', async () => {
      await expect(service.updateValue('BAM_DONG_DON_THU', 'NHAY_VAO_TRANG_KHAC')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.systemSetting.update).not.toHaveBeenCalled();
    });

    it('rỗng hoặc sai kiểu chữ hoa/thường → 400', async () => {
      await expect(service.updateValue('BAM_DONG_VU_AN', '')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.updateValue('BAM_DONG_VU_AN', 'xem')).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(Object.values(BAM_DONG_GIA_TRI))('giá trị hợp lệ %s được lưu', async (v) => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({ key: 'BAM_DONG_VU_VIEC', value: 'XEM', unit: null });
      mockPrisma.systemSetting.update.mockResolvedValue({ key: 'BAM_DONG_VU_VIEC', value: v });
      const r = await service.updateValue('BAM_DONG_VU_VIEC', v, 'admin-1');
      expect(r.success).toBe(true);
      expect(mockPrisma.systemSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { value: v } }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SETTING_UPDATED' }));
    });

    it('khoá KHÔNG thuộc danh mục vẫn nhận mọi giá trị (không chặn nhầm khoá khác)', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({ key: 'TEN_TRUONG_PHONG', value: '', unit: null });
      mockPrisma.systemSetting.update.mockResolvedValue({});
      const r = await service.updateValue('TEN_TRUONG_PHONG', 'bất kỳ chữ gì');
      expect(r.success).toBe(true);
    });
  });

  describe('getGiaoDien', () => {
    it('chưa có dòng nào → trả mặc định trong mã cho đủ 7 khoá', async () => {
      const r = await service.getGiaoDien();
      expect(r.data).toEqual(BAM_DONG_MAC_DINH);
    });

    it('lấy giá trị admin đã đặt', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([{ key: 'BAM_DONG_DON_THU', value: 'SUA_HAI_CHAM' }]);
      const r = await service.getGiaoDien();
      expect(r.data.BAM_DONG_DON_THU).toBe('SUA_HAI_CHAM');
      expect(r.data.BAM_DONG_VU_AN).toBe('XEM');
    });

    it('giá trị trong CSDL không còn hợp lệ → mặc định, không chuyển nguyên giá trị lạ cho giao diện', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([{ key: 'BAM_DONG_VU_AN', value: 'RAC' }]);
      const r = await service.getGiaoDien();
      expect(r.data.BAM_DONG_VU_AN).toBe('XEM');
    });

    it('DANH SÁCH TRẮNG: không lộ khoá nào ngoài 7 khoá giao diện (2FA, thời hạn…)', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { key: 'TWO_FA_ENABLED', value: 'true' },
        { key: 'TEN_TRUONG_PHONG', value: 'Nguyễn Văn A' },
        { key: 'BAM_DONG_VU_VIEC', value: 'SUA' },
      ]);
      const r = await service.getGiaoDien();
      expect(Object.keys(r.data).sort()).toEqual([...KHOA_GIAO_DIEN].sort());
      expect(JSON.stringify(r)).not.toContain('Nguyễn Văn A');
    });
  });

  it('seed() gieo đủ 7 khoá giao diện với mặc định trong mã', async () => {
    await service.seed();
    const goi = mockPrisma.systemSetting.upsert.mock.calls.map((c: any[]) => c[0].create);
    for (const k of KHOA_GIAO_DIEN) {
      expect(goi.find((d: any) => d.key === k)?.value).toBe(BAM_DONG_MAC_DINH[k]);
    }
  });

  describe('đồng bộ với migration gieo khoá (R-C5)', () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '../../prisma/migrations/20261008090000_bam_dong_settings/migration.sql'),
      'utf-8',
    );

    it.each([...KHOA_GIAO_DIEN])('migration gieo %s đúng giá trị mặc định', (k) => {
      expect(sql).toContain(`'${k}', '${BAM_DONG_MAC_DINH[k]}'`);
    });

    it('migration idempotent: ON CONFLICT DO NOTHING (không đè giá trị admin đã đặt)', () => {
      expect(sql).toMatch(/ON CONFLICT \("key"\) DO NOTHING/);
    });

    it('migration không chứa khoá giao diện nào ngoài 7 khoá', () => {
      const khoa = [...sql.matchAll(/'(BAM_DONG_[A-Z_]+)'/g)].map((m) => m[1]);
      expect(new Set(khoa)).toEqual(new Set(KHOA_GIAO_DIEN));
    });
  });
});
