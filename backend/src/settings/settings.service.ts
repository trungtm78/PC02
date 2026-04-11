import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private cache: Map<string, string> = new Map();
  private cacheTimestamp = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — single-instance assumption

  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
    return { success: true, data: settings };
  }

  async getValue(key: string): Promise<string | null> {
    // Check cache (TTL 5 min)
    if (Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS && this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    // Refresh entire cache
    const settings = await this.prisma.systemSetting.findMany();
    this.cache.clear();
    for (const s of settings) {
      this.cache.set(s.key, s.value);
    }
    this.cacheTimestamp = Date.now();

    return this.cache.get(key) ?? null;
  }

  async getNumericValue(key: string, fallback: number): Promise<number> {
    const val = await this.getValue(key);
    if (val === null) return fallback;
    const num = parseInt(val, 10);
    return isNaN(num) ? fallback : num;
  }

  async getDeadlines() {
    const keys = [
      'THOI_HAN_XAC_MINH',
      'THOI_HAN_GIA_HAN_1',
      'THOI_HAN_GIA_HAN_2',
      'THOI_HAN_TOI_DA',
      'THOI_HAN_PHUC_HOI',
      'THOI_HAN_PHAN_LOAI',
      'SO_LAN_GIA_HAN_TOI_DA',
      'THOI_HAN_GUI_QD_VKS',
    ];

    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    const result: Record<string, { value: string; label: string; unit: string | null; legalBasis: string | null }> = {};
    for (const s of settings) {
      result[s.key] = { value: s.value, label: s.label, unit: s.unit, legalBasis: s.legalBasis };
    }

    return { success: true, data: result };
  }

  async updateValue(key: string, value: string) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      return { success: false, message: `Cấu hình '${key}' không tồn tại` };
    }

    const updated = await this.prisma.systemSetting.update({
      where: { key },
      data: { value },
    });

    // Invalidate cache
    this.cache.clear();
    this.cacheTimestamp = 0;

    return { success: true, data: updated, message: 'Cập nhật cấu hình thành công' };
  }

  async seed() {
    const defaults = [
      { key: 'THOI_HAN_XAC_MINH', value: '20', label: 'Thời hạn xác minh ban đầu', unit: 'ngày', legalBasis: 'Đ.147 BLTTHS 2015' },
      { key: 'THOI_HAN_GIA_HAN_1', value: '60', label: 'Thời hạn gia hạn lần 1', unit: 'ngày', legalBasis: 'Đ.147 khoản 2 BLTTHS' },
      { key: 'THOI_HAN_GIA_HAN_2', value: '60', label: 'Thời hạn gia hạn lần 2', unit: 'ngày', legalBasis: 'Đ.147 khoản 2 BLTTHS' },
      { key: 'THOI_HAN_TOI_DA', value: '120', label: 'Thời hạn giải quyết tối đa', unit: 'ngày', legalBasis: 'Đ.147 BLTTHS (tổng cộng)' },
      { key: 'THOI_HAN_PHUC_HOI', value: '30', label: 'Thời hạn giải quyết sau phục hồi', unit: 'ngày', legalBasis: 'Đ.149 BLTTHS' },
      { key: 'THOI_HAN_PHAN_LOAI', value: '1', label: 'Thời hạn phân loại nguồn tin', unit: 'ngày', legalBasis: 'Đ.146 khoản 3 (24h)' },
      { key: 'SO_LAN_GIA_HAN_TOI_DA', value: '2', label: 'Số lần gia hạn tối đa', unit: 'lần', legalBasis: 'Đ.147 khoản 2 BLTTHS' },
      { key: 'THOI_HAN_GUI_QD_VKS', value: '1', label: 'Thời hạn gửi QĐ cho VKS', unit: 'ngày', legalBasis: 'Đ.148 khoản 2 (24h)' },
    ];

    for (const d of defaults) {
      await this.prisma.systemSetting.upsert({
        where: { key: d.key },
        create: d,
        update: {}, // Don't overwrite admin edits
      });
    }

    return { success: true, message: `Seeded ${defaults.length} settings` };
  }
}
