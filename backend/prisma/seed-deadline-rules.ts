/**
 * Seed initial DeadlineRuleVersion rows for the 12 BLTTHS / Luật Tố cáo /
 * Luật Khiếu nại deadline keys. Idempotent — `id` is deterministic so reruns
 * are no-ops.
 *
 * Runs after Prisma migrate; the migration `20260511_deadline_rule_versioning`
 * also seeds these from existing system_settings rows when those exist (legacy
 * migration path). This seeder is the source of truth for FRESH databases.
 */
import { PrismaClient, DeadlineRuleStatus } from '@prisma/client';

interface SeedRule {
  ruleKey: string;
  value: number;
  label: string;
  legalBasis: string;
  documentType: string;
  documentNumber: string;
  documentIssuer: string;
}

const INITIAL_RULES: SeedRule[] = [
  // BLTTHS 2015 (Đ.146-149)
  { ruleKey: 'THOI_HAN_XAC_MINH',       value: 20,  label: 'Thời hạn xác minh ban đầu',         legalBasis: 'Điều 147 khoản 1 BLTTHS 2015', documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_GIA_HAN_1',      value: 60,  label: 'Thời hạn gia hạn lần 1',            legalBasis: 'Điều 147 khoản 2 BLTTHS 2015', documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_GIA_HAN_2',      value: 60,  label: 'Thời hạn gia hạn lần 2',            legalBasis: 'Điều 147 khoản 2 BLTTHS 2015', documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_TOI_DA',         value: 140, label: 'Thời hạn giải quyết tối đa',        legalBasis: 'Điều 147 BLTTHS 2015 (20 + 60 + 60)', documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_PHUC_HOI',       value: 30,  label: 'Thời hạn giải quyết sau phục hồi',  legalBasis: 'Điều 149 BLTTHS 2015',         documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_PHAN_LOAI',      value: 1,   label: 'Thời hạn phân loại nguồn tin',      legalBasis: 'Điều 146 khoản 3 BLTTHS (24h)',documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'SO_LAN_GIA_HAN_TOI_DA',   value: 2,   label: 'Số lần gia hạn tối đa',             legalBasis: 'Điều 147 khoản 2 BLTTHS 2015', documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_GUI_QD_VKS',     value: 1,   label: 'Thời hạn gửi QĐ cho VKS',           legalBasis: 'Điều 148 khoản 2 BLTTHS (24h)', documentType: 'BLTTHS', documentNumber: '101/2015/QH13', documentIssuer: 'Quốc hội' },
  // Luật Tố cáo 2018 / Luật Khiếu nại 2011
  { ruleKey: 'THOI_HAN_TO_CAO',         value: 30,  label: 'Thời hạn giải quyết tố cáo',        legalBasis: 'Điều 30 khoản 1 Luật Tố cáo 2018', documentType: 'Khác', documentNumber: '25/2018/QH14', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_KHIEU_NAI',      value: 30,  label: 'Thời hạn giải quyết khiếu nại',     legalBasis: 'Điều 28 khoản 1 Luật Khiếu nại 2011', documentType: 'Khác', documentNumber: '02/2011/QH13', documentIssuer: 'Quốc hội' },
  { ruleKey: 'THOI_HAN_KIEN_NGHI',      value: 15,  label: 'Thời hạn xử lý kiến nghị',          legalBasis: 'Quy chế nội bộ',               documentType: 'Khác', documentNumber: 'INITIAL', documentIssuer: 'BCA' },
  { ruleKey: 'THOI_HAN_PHAN_ANH',       value: 15,  label: 'Thời hạn xử lý phản ánh',           legalBasis: 'Quy chế nội bộ',               documentType: 'Khác', documentNumber: 'INITIAL', documentIssuer: 'BCA' },
];

export async function seedDeadlineRules(prisma: PrismaClient): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const now = new Date();

  for (const r of INITIAL_RULES) {
    const id = `rule_init_${r.ruleKey}`;
    const existing = await prisma.deadlineRuleVersion.findUnique({ where: { id } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.deadlineRuleVersion.create({
      data: {
        id,
        ruleKey: r.ruleKey,
        value: r.value,
        label: r.label,
        legalBasis: r.legalBasis,
        documentType: r.documentType,
        documentNumber: r.documentNumber,
        documentIssuer: r.documentIssuer,
        documentDate: null,
        reason: 'Khởi tạo từ seed ban đầu — cần được admin bổ sung tài liệu chính thức nếu thay đổi',
        status: DeadlineRuleStatus.active,
        effectiveFrom: now,
        proposedById: null,
        proposedByType: 'SYSTEM',
        migrationConfidence: 'legacy-default',
      },
    });
    created++;
  }

  return { created, skipped };
}
