import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decomposeLegacyRecord, legacyKey, type LegacyRecord } from './legacy-mapper';
import { buildMigrationReport, type MigrationReport } from './migration-report';

// Provenance import (Case/Incident có cột; Petition KHÔNG có → không set). actorId = người chạy di trú.
const IMPORTED = (actorId: string) => ({
  importedFrom: 'legacy-db',
  importedAt: new Date(),
  importedById: actorId,
});


/**
 * Đổi khoá ngoại dạng số sang dạng `connect` cho Vụ việc/Vụ án.
 *
 * Khi trong cùng một lệnh có BẤT KỲ trường quan hệ nào (ví dụ `linkedPetition: {connect}`),
 * Prisma chuyển sang kiểu đầu vào nghiêm ngặt và TỪ CHỐI mọi khoá ngoại dạng số còn lại
 * ("Unknown argument `createdById`"). Trộn hai kiểu là hỏng — nên quy về một kiểu.
 * Giá trị rỗng thì bỏ hẳn: gán `connect` với id rỗng sẽ ném lỗi khoá ngoại.
 */
const FK_RELATIONS: Record<string, string> = {
  createdById: 'createdBy',
  investigatorId: 'investigator',
  assignedTeamId: 'assignedTeam',
  importedById: 'importedBy',
  // Tội danh chính của Vụ việc (thêm 27/08/2026). `resolveCrime` đặt khoá ngoại vô hướng, còn
  // lệnh ghi Vụ việc là kiểu nghiêm ngặt — thiếu dòng này là Prisma ném "Unknown argument
  // `crimeChinhId`" và HỎNG CẢ bản ghi, đúng cái bẫy đã làm hỏng 4.915 đơn thư hôm 25/08.
  crimeChinhId: 'crimeChinh',
};

function toRelationConnect(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const [scalar, relation] of Object.entries(FK_RELATIONS)) {
    if (!(scalar in out)) continue;
    const id = out[scalar];
    delete out[scalar];
    if (typeof id === 'string' && id.trim()) out[relation] = { connect: { id } };
  }
  return out;
}

export interface CommitResult {
  created: {
    petitions: number;
    incidents: number;
    cases: number;
    guidance: number;
    exchanges: number;
    proposals: number;
    lawyers: number;
  };
  skipped: number;
  errors: { legacyId: string; message: string }[];
  report: MigrationReport;
}

/**
 * Chay lai di tru khong duoc de len chu can bo da go.
 *
 * Nhanh cap nhat ghi de toan bo cot da anh xa. Voi phan lon cot thi day la chu dinh: chay lai
 * de sua mot lan nap sai. Nhung O NOI DUNG thi khac — do la o can bo sua nhieu nhat, va sua
 * xong ma chay lai di tru thi chu bien mat, khong dau vet.
 *
 * Chi giu khi o dich DA CO CHU. O trong van duoc dien binh thuong.
 *
 * NO KY THUAT da khai: nhanh cap nhat van de len ~50 cot khac theo dung kieu nay. Sua tron ven
 * la viec cua mot dot rieng — o day chi chan dung cho o vua duoc noi day.
 */
const O_KHONG_DE_KHI_DA_CO = ['detailContent', 'summary', 'receiveDate'] as const;

/** Ô đã có giá trị thật chưa — chữ có nội dung, hoặc một mốc ngày hợp lệ. */
function daCoGiaTri(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  return false;
}

export function giuChuCanBoDaGo(
  data: Record<string, unknown>,
  danCo: Record<string, unknown>,
): void {
  for (const o of O_KHONG_DE_KHI_DA_CO) {
    if (daCoGiaTri(danCo[o])) delete data[o];
  }
}

@Injectable()
export class LegacyMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Dry-run: KHÔNG mutate DB. Trả báo cáo đối soát.
  dryRun(records: LegacyRecord[]): MigrationReport {
    return buildMigrationReport(records);
  }

  // Resolve crimeChinhLegacyValue → crimeChinhId qua master Crime (theo legacyValue).
  // tx phải được truyền từ $transaction để đảm bảo đọc trong cùng boundary.
  private async resolveCrime(tx: any, data: Record<string, unknown>, target: 'petition' | 'case' | 'incident' = 'petition'): Promise<void> {
    const lv = data.crimeChinhLegacyValue as number | undefined;
    delete data.crimeChinhLegacyValue;
    // Cả ba thực thể nay đều có cột `crimeChinhId` (FK master Crime) → resolve chung.
    if (lv === undefined) return;
    const crime = await tx.crime.findFirst({ where: { legacyValue: lv } });
    if (!crime) return;
    // Hai payload chốt HAI kiểu Prisma khác nhau, nên cách nối tội danh cũng phải khác —
    // và mỗi kiểu TỪ CHỐI dạng của kiểu kia:
    //   • Vụ án dùng `connect` cho createdBy/investigator/linkedPetition → kiểu "checked",
    //     từ chối khoá ngoại vô hướng ("Unknown argument `crimeChinhId`").
    //   • Đơn thư dùng khoá ngoại vô hướng → kiểu "unchecked", từ chối quan hệ `crimeChinh`.
    // Đo trên dữ liệu thật 25/08: dùng chung một dạng làm hỏng 4.915 đơn thư; đây là lượt
    // CẬP NHẬT nên hỏng nghĩa là sửa đổi ở hệ cũ không sang được hệ mới.
    if (target === 'case') data.crimeChinh = { connect: { id: crime.id } };
    else data.crimeChinhId = crime.id;
  }

  // Commit: upsert theo legacySourceId (idempotent re-run). Mỗi record 1 transaction nhỏ; lỗi 1 record không chặn record khác.
  async commit(records: LegacyRecord[], actorId: string): Promise<CommitResult> {
    const created = {
      petitions: 0,
      incidents: 0,
      cases: 0,
      guidance: 0,
      exchanges: 0,
      proposals: 0,
      lawyers: 0,
    };
    const errors: { legacyId: string; message: string }[] = [];
    let skipped = 0;

    for (const rec of records) {
      // Khoá PHẢI kèm tên collection nguồn — `ho_so.id` [1,2,3,4] trùng 100% với `ho_so_doi_1`,
      // khoá trần sẽ ghi đè hồ sơ 2017 bằng hồ sơ 2026. Cùng hàm với mapper để tra cứu và ghi
      // không bao giờ lệch nhau.
      const legacyId = legacyKey(rec) ?? '';
      if (!legacyId) {
        skipped++;
        continue;
      }
      try {
        const d = decomposeLegacyRecord(rec);
        // KHÔNG bịa ngày: hồ sơ thiếu ngày bắt buộc bị chặn lại và đếm được, thay vì mang
        // ngày hôm nay (~4.400 hồ sơ nguồn không parse được ngày).
        if (d.petition && !(d.petition.receivedDate instanceof Date)) {
          errors.push({
            legacyId,
            message: 'MISSING_REQUIRED_DATE: receivedDate — không parse được ngày tiếp nhận, bỏ qua để không bịa ngày',
          });
          continue;
        }
        if (
          !d.petition &&
          !d.incident &&
          !d.case &&
          !d.guidance &&
          !d.exchange &&
          !d.proposal &&
          !d.lawyer
        ) {
          skipped++;
          continue;
        }
        // Đếm delta CỤC BỘ trong tx, chỉ cộng vào tổng SAU khi tx commit thành công (Codex P1):
        // nếu bước sau rollback, counter/audit không báo nhầm "đã tạo".
        const delta = await this.prisma.$transaction(async (tx: any) => {
          const d2 = { petitions: 0, incidents: 0, cases: 0, guidance: 0, exchanges: 0, proposals: 0, lawyers: 0 };
          // Theo dõi id petition/incident tạo trong CÙNG record → linking provenance (Codex P1#4).
          let linkedPetitionId: string | undefined;
          let linkedIncidentId: string | undefined;

          if (d.petition) {
            const data = { ...d.petition };
            await this.resolveCrime(tx, data);
            const existing = await tx.petition.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              giuChuCanBoDaGo(data, existing);
              await tx.petition.update({ where: { id: existing.id }, data });
              linkedPetitionId = existing.id;
            } else {
              const row = await tx.petition.create({
                data: {
                  stt: `DT-LEGACY-${legacyId}`,
                  receivedDate: data.receivedDate as Date,
                  senderName: (data.senderName as string) ?? '(di trú)',
                  status: 'MOI_TIEP_NHAN',
                  ...data,
                },
              });
              linkedPetitionId = row.id;
              d2.petitions++;
            }
          }
          if (d.incident) {
            const data = { ...d.incident };
            // Doi ma toi danh cu -> khoa ngoai. Khong goi thi khoa trung gian
            // `crimeChinhLegacyValue` con nguyen trong lenh ghi va Prisma tu choi CA ban ghi.
            await this.resolveCrime(tx, data, 'incident');
            const existing = await tx.incident.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.incident.update({ where: { id: existing.id }, data: toRelationConnect(data) });
              linkedIncidentId = existing.id;
            } else {
              const row = await tx.incident.create({
                data: {
                  code: `VV-LEGACY-${legacyId}`,
                  status: 'TIEP_NHAN',
                  // Cột mảng NOT NULL nhưng KHÔNG có default ở tầng CSDL — không truyền
                  // tường minh là dính NullConstraintViolation. Đặt TRƯỚC ...data để bản
                  // ghi nào có giá trị thật vẫn ghi đè được.
                  lyDoKhongKhoiTo: [],
                  lyDoTamDinhChiVuViec: [],
                  ...toRelationConnect({ ...IMPORTED(actorId), ...data }),
                },
              });
              linkedIncidentId = row.id;
              d2.incidents++;
            }
          }
          let caseRow: { id: string } | undefined;
          if (d.case) {
            const data = { ...d.case };
            await this.resolveCrime(tx, data, 'case');
            // Provenance: ưu tiên liên kết 1→nhiều cùng record; else hint (vd UY_THAC); else TRANSFERRED.
            // Set rõ cả 2 FK (null khi không dùng) để thỏa CHECK case_provenance_fk_consistency.
            let caseProvenance: string;
            // Case.linkedPetition/linkedIncident là quan hệ 1-1, Prisma KHÔNG nhận khoá
            // ngoại dạng vô hướng ở đây — phải dùng `connect`. Truyền `linkedPetitionId: <id>`
            // ném "Unknown argument", làm hỏng đúng những bản ghi sinh CẢ đơn thư LẪN vụ án
            // trong cùng một hồ sơ (48 hồ sơ trên dữ liệu thật).
            let link: Record<string, unknown>;
            if (linkedPetitionId) {
              caseProvenance = 'FROM_PETITION';
              link = { linkedPetition: { connect: { id: linkedPetitionId } } };
            } else if (linkedIncidentId) {
              caseProvenance = 'FROM_INCIDENT';
              link = { linkedIncident: { connect: { id: linkedIncidentId } } };
            } else {
              caseProvenance = d.caseProvenanceHint ?? 'TRANSFERRED';
              link = {};
            }
            const existing = await tx.case.findFirst({
              where: { legacySourceId: legacyId },
              select: { id: true, metadata: true },
            });
            if (existing) {
              // Nạp lại GHI ĐÈ cả cột metadata. Giữ lại `trichTuDong` (mốc tố tụng bóc tự
              // động bởi enrich-totung) — nếu không, mỗi lần re-import lại xoá thầm lặng
              // 619 ngày khởi tố / 634 chuyển vụ án cho tới khi chạy lại enrich.
              const cu = toRelationConnect(data) as Record<string, unknown>;
              const oldMeta = (existing.metadata ?? {}) as Record<string, unknown>;
              const newMeta = (cu.metadata ?? {}) as Record<string, unknown>;
              if (oldMeta.trichTuDong && !newMeta.trichTuDong) {
                cu.metadata = { ...newMeta, trichTuDong: oldMeta.trichTuDong };
              }
              // Chạy lại di trú không được đè lên thứ cán bộ đã sửa (codex bắt 27/08/2026).
              // `receiveDate` là ô form ĐÒI, nên nó là ô cán bộ chắc chắn có động vào.
              giuChuCanBoDaGo(cu, existing as unknown as Record<string, unknown>);
              caseRow = await tx.case.update({
                where: { id: existing.id },
                data: { caseProvenance, ...link, ...cu },
              });
            } else {
              caseRow = await tx.case.create({
                data: {
                  status: 'TIEP_NHAN',
                  caseProvenance,
                  ...link,
                  // Xem ghi chú ở phần tạo Vụ việc: mảng NOT NULL không có default.
                  lyDoTamDinhChiVuAn: [],
                  ...toRelationConnect({ ...IMPORTED(actorId), ...data }),
                },
              });
              d2.cases++;
            }
            // Thống kê mở rộng 1-1 (Codex P1#7) — upsert theo caseId (unique), chỉ khi có dữ liệu.
            if (d.statistic && caseRow?.id) {
              await tx.caseStatistic.upsert({
                where: { caseId: caseRow.id },
                create: { caseId: caseRow.id, ...d.statistic },
                update: { ...d.statistic },
              });
            }
          }

          // ── Tier ③ — idempotent upsert theo legacySourceId (Codex P1#3) ──
          if (d.guidance) {
            const data = { ...d.guidance };
            const existing = await tx.guidanceRecord.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.guidanceRecord.update({ where: { id: existing.id }, data });
            } else {
              await tx.guidanceRecord.create({ data });
              d2.guidance++;
            }
          }
          if (d.exchange) {
            const data = { ...d.exchange };
            const existing = await tx.exchange.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.exchange.update({ where: { id: existing.id }, data });
            } else {
              await tx.exchange.create({ data });
              d2.exchanges++;
            }
          }
          if (d.proposal) {
            const data = { ...d.proposal };
            const existing = await tx.proposal.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.proposal.update({ where: { id: existing.id }, data });
            } else {
              // proposalNumber @unique NOT NULL → sinh deterministic để idempotent.
              await tx.proposal.create({ data: { proposalNumber: `DX-LEGACY-${legacyId}`, ...data } });
              d2.proposals++;
            }
          }
          if (d.lawyer && caseRow?.id) {
            const data = { ...d.lawyer };
            const existing = await tx.lawyer.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.lawyer.update({ where: { id: existing.id }, data });
            } else {
              // caseId (FK NOT NULL) = host Case; barNumber @unique NOT NULL → deterministic.
              await tx.lawyer.create({
                data: { caseId: caseRow.id, barNumber: `LS-LEGACY-${legacyId}`, ...data },
              });
              d2.lawyers++;
            }
          }
          return d2;
        });
        // Chỉ cộng vào tổng khi tx đã commit thành công (không cộng nếu rollback).
        created.petitions += delta.petitions;
        created.incidents += delta.incidents;
        created.cases += delta.cases;
        created.guidance += delta.guidance;
        created.exchanges += delta.exchanges;
        created.proposals += delta.proposals;
        created.lawyers += delta.lawyers;
      } catch (e) {
        errors.push({ legacyId, message: (e as Error).message });
      }
    }

    await this.audit.log({
      userId: actorId,
      action: 'LEGACY_MIGRATION_COMMIT',
      subject: 'LegacyMigration',
      subjectId: 'batch',
      metadata: { created, skipped, errorCount: errors.length },
    });

    return { created, skipped, errors, report: buildMigrationReport(records) };
  }

  // Rollback: xóa entity đã di trú theo danh sách legacySourceId (chỉ record do di trú tạo).
  async rollback(legacyIds: string[], actorId: string): Promise<{ deleted: number }> {
    let deleted: number;
    try {
      deleted = await this.prisma.$transaction(async (tx: any) => {
        const where = { where: { legacySourceId: { in: legacyIds } } };
        // Thứ tự FK: lawyer (lawyer.caseId → cases Restrict) trước case; case (linkedPetition/
        // linkedIncident Restrict) trước petition/incident. Guidance/Exchange/Proposal độc lập.
        const lw = await tx.lawyer.deleteMany(where);
        const c = await tx.case.deleteMany(where);
        const p = await tx.petition.deleteMany(where);
        const i = await tx.incident.deleteMany(where);
        const g = await tx.guidanceRecord.deleteMany(where);
        const e = await tx.exchange.deleteMany(where);
        const pr = await tx.proposal.deleteMany(where);
        return lw.count + c.count + p.count + i.count + g.count + e.count + pr.count;
      });
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('Foreign key constraint') || msg.includes('P2003')) {
        throw new BadRequestException(
          'Không thể rollback: một số bản ghi có dữ liệu con liên kết. Hãy xóa dữ liệu con trước khi rollback.',
        );
      }
      throw e;
    }
    await this.audit.log({
      userId: actorId,
      action: 'LEGACY_MIGRATION_ROLLBACK',
      subject: 'LegacyMigration',
      subjectId: 'batch',
      metadata: { deleted, legacyIds },
    });
    return { deleted };
  }
}
