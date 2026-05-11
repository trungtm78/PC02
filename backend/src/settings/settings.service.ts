import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import {
  DEADLINE_RULE_KEY_SET,
  DEADLINE_RULE_KEYS,
} from '../deadline-rules/constants/deadline-rule-keys.constants';

/**
 * Hard-guard: the 12 deadline rule keys are managed by DeadlineRulesService
 * (table `deadline_rule_versions`) post-migration `20260511_deadline_rule_versioning`.
 * Any call here for those keys is a contract violation — surface it loudly
 * rather than silently returning stale data.
 */
function assertNotDeadlineKey(key: string): void {
  if (DEADLINE_RULE_KEY_SET.has(key)) {
    throw new BadRequestException(
      `[contract] '${key}' is a deadline rule managed by DeadlineRulesService. ` +
        `Call deadlineRules.getActiveValue('${key}') instead. ` +
        `Direct settings access for this key was removed in migration 20260511_deadline_rule_versioning.`,
    );
  }
}

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
    assertNotDeadlineKey(key);

    if (Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS && this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    const settings = await this.prisma.systemSetting.findMany();
    this.cache.clear();
    for (const s of settings) {
      this.cache.set(s.key, s.value);
    }
    this.cacheTimestamp = Date.now();

    return this.cache.get(key) ?? null;
  }

  async getNumericValue(key: string, fallback: number): Promise<number> {
    assertNotDeadlineKey(key);
    const val = await this.getValue(key);
    if (val === null) return fallback;
    const num = parseInt(val, 10);
    return isNaN(num) ? fallback : num;
  }

  /**
   * @deprecated The legacy /settings/deadlines endpoint returns deadline data
   * via DeadlineRulesService.listActive() now. This method is preserved only
   * to keep the route URL stable — internally it proxies a deprecation hint.
   */
  async getDeadlines() {
    return {
      success: false,
      message:
        'Endpoint chuyển sang /api/v1/deadline-rules. Vui lòng cập nhật client gọi getActiveDeadlineRules thay thế.',
      data: {},
    };
  }

  async updateValue(key: string, value: string) {
    assertNotDeadlineKey(key);

    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      return { success: false, message: `Cấu hình '${key}' không tồn tại` };
    }

    let normalizedValue = value;
    if (existing.unit === 'ngày' || existing.unit === 'lần') {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0 || num > 365) {
        return { success: false, message: `Giá trị phải là số nguyên từ 0 đến 365` };
      }
      normalizedValue = String(num);
    }

    const updated = await this.prisma.systemSetting.update({
      where: { key },
      data: { value: normalizedValue },
    });

    this.cache.clear();
    this.cacheTimestamp = 0;

    return { success: true, data: updated, message: 'Cập nhật cấu hình thành công' };
  }

  /**
   * Seed only non-deadline ops settings. Deadline rules (12 keys) are seeded
   * by `seedDeadlineRules.ts` into `deadline_rule_versions`.
   */
  async seed() {
    const defaults = [
      { key: SETTINGS_KEY.TWO_FA_ENABLED, value: 'false', label: 'Bật xác thực 2 lớp (2FA)', unit: null, legalBasis: null },
      { key: SETTINGS_KEY.CANH_BAO_SAP_HAN, value: '7', label: 'Ngưỡng cảnh báo sắp đến hạn (app mobile)', unit: 'ngày', legalBasis: null },
      { key: SETTINGS_KEY.THOI_HAN_XOA_VU_VIEC, value: '180', label: 'Số ngày giữ vụ việc đã xóa mềm', unit: 'ngày', legalBasis: 'Quy chế nội bộ' },
    ];

    for (const d of defaults) {
      await this.prisma.systemSetting.upsert({
        where: { key: d.key },
        create: d,
        update: {},
      });
    }

    // Defensive cleanup: if any deadline keys exist in system_settings post-migration
    // (e.g. someone manually inserted them), remove them.
    await this.prisma.systemSetting.deleteMany({
      where: { key: { in: [...DEADLINE_RULE_KEYS] } },
    });

    return { success: true, message: `Seeded ${defaults.length} ops settings (deadline rules managed by DeadlineRulesService)` };
  }
}
