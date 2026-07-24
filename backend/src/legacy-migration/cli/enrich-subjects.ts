/**
 * Tạo nghi can / bị hại cho VỤ ÁN từ dữ liệu cũ, khử trùng theo TÊN (và số định danh khi có).
 *
 * Hai nguồn:
 *   1. `tom_tat_noi_dung` — bóc người có mẫu "Tên (SN: yyyy [, CCCD…])" kèm vai trò từ ngữ cảnh
 *      (bocDoiTuong). Người CHƯA rõ vai trò → metadata.doiTuongChuaPhanVai (không tạo — chống vu oan).
 *   2. `nghi_van_doi_tuong` — TRƯỜNG CHUYÊN BIỆT khai báo nghi can; vai trò biết chắc là SUSPECT.
 *      Phần lớn TÊN TRẦN (không SN/CCCD). "Có gì điền đó": tạo bản ghi chỉ có tên; nếu tên đó CŨNG
 *      xuất hiện kèm SN/CCCD trong tóm tắt thì điền đủ.
 *
 * Địa chỉ/số lượng bị hại nằm ở `dia-chi-bi-hai`/`so_luong_bi_hai` → đã vào Case.metadata qua
 * buildCase (biHai/soLuongBiHai), giao diện hiển thị; ở đây không lặp lại.
 *
 * An toàn: idempotent theo (caseId, tên chuẩn hoá, vai trò) — chạy lại chỉ THÊM tên mới, không
 * đè. `dateOfBirth`/`idNumber`/`address` để NULL khi không có (cột đã nullable) — trống trung
 * thực hơn bịa. Mặc định GHI; `--dry` chỉ báo cáo.
 */
import { PrismaClient, SubjectType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { bocDoiTuong, bocTenDanhSach, normalizeTen, type DoiTuong, type VaiTro } from './subject-extract';

interface CaseRow {
  caseId: string;
  tomTat: string | null;
  nghiVan: string | null;
}

/** Dựng data tạo Subject từ một đối tượng đã bóc — field thiếu để null (không sentinel). */
function toSubjectData(caseId: string, hoTen: string, vaiTro: VaiTro, d: Partial<DoiTuong>, notes: string) {
  return {
    caseId,
    fullName: hoTen,
    dateOfBirth: d.namSinh ? new Date(Date.UTC(d.namSinh, 0, 1)) : null,
    idNumber: d.cccd ?? d.cmnd ?? d.hoChieu ?? null,
    address: d.diaChi ?? null,
    phone: d.soDienThoai ?? null,
    type: vaiTro as SubjectType,
    notes,
  };
}

/**
 * Lõi THUẦN (test được): từ tóm tắt + trường nghi vấn của MỘT vụ án, sinh danh sách Subject cần
 * tạo và nhóm người chưa rõ vai trò. `coSan` = khoá `vai trò|tên chuẩn hoá` đã có (khử trùng).
 */
export function duyetVuAn(
  caseId: string,
  tomTat: string | null,
  nghiVan: string | null,
  coSan: Set<string>,
): { toCreate: ReturnType<typeof toSubjectData>[]; chuaRoVaiTro: DoiTuong[] } {
  const themTrongVu = new Set<string>();
  const toCreate: ReturnType<typeof toSubjectData>[] = [];
  const chuaRoVaiTro: DoiTuong[] = [];

  const tomTatDts = tomTat ? bocDoiTuong(tomTat) : [];
  const dinhDanhTheoTen = new Map<string, DoiTuong>();
  for (const d of tomTatDts) dinhDanhTheoTen.set(normalizeTen(d.hoTen), d);

  // 1. tom_tat: người có vai trò rõ → tạo; chưa rõ → metadata.
  for (const d of tomTatDts) {
    if (d.vaiTro === 'UNKNOWN') {
      chuaRoVaiTro.push(d);
      continue;
    }
    const khoa = `${d.vaiTro}|${normalizeTen(d.hoTen)}`;
    if (coSan.has(khoa) || themTrongVu.has(khoa)) continue;
    themTrongVu.add(khoa);
    toCreate.push(
      toSubjectData(caseId, d.hoTen, d.vaiTro, d, `Trích tự động từ tóm tắt hồ sơ (cần rà soát). Trích dẫn: "${d.trichDan}"`),
    );
  }

  // 2. nghi_van_doi_tuong → SUSPECT (vai trò biết chắc). Điền định danh nếu tên có trong tóm tắt.
  for (const t of nghiVan ? bocTenDanhSach(nghiVan, 'SUSPECT') : []) {
    const normName = normalizeTen(t.hoTen);
    const khoa = `SUSPECT|${normName}`;
    if (coSan.has(khoa) || themTrongVu.has(khoa)) continue;
    themTrongVu.add(khoa);
    const id = dinhDanhTheoTen.get(normName);
    const qt = t.quocTich ? ` Quốc tịch: ${t.quocTich}.` : '';
    if (id && (id.cccd || id.cmnd || id.hoChieu || id.namSinh)) {
      toCreate.push(
        toSubjectData(caseId, t.hoTen, 'SUSPECT', id, `Trích tự động từ trường nghi vấn đối tượng (định danh lấy từ tóm tắt).${qt}`),
      );
    } else {
      toCreate.push(
        toSubjectData(caseId, t.hoTen, 'SUSPECT', {}, `Trích tự động từ trường nghi vấn đối tượng — chưa đủ định danh.${qt}`),
      );
    }
  }

  return { toCreate, chuaRoVaiTro };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    // Dọn sentinel của các bản ghi di trú CŨ (trước khi cột nullable): DOB 1900-01-01 và
    // idNumber/address rỗng → NULL, để giao diện hiện "—" trung thực.
    let donDob = 0;
    let donId = 0;
    if (!dryRun) {
      donDob = (
        await prisma.subject.updateMany({
          where: { dateOfBirth: new Date(Date.UTC(1900, 0, 1)) },
          data: { dateOfBirth: null },
        })
      ).count;
      donId = (await prisma.subject.updateMany({ where: { idNumber: '' }, data: { idNumber: null } })).count;
      await prisma.subject.updateMany({ where: { address: '' }, data: { address: null } });
    }

    const rows = await prisma.$queryRaw<CaseRow[]>`
      SELECT c.id AS "caseId",
             s.raw->>'tom_tat_noi_dung' AS "tomTat",
             s.raw->>'nghi_van_doi_tuong' AS "nghiVan"
      FROM cases c
      JOIN legacy_staging s ON s."sourceFile"||':'||s."sourceId" = c."legacySourceId"
      WHERE c."legacySourceId" IS NOT NULL`;

    // Bản ghi đối tượng ĐANG có → khoá (caseId, vai trò|tên chuẩn hoá) để khử trùng idempotent.
    const existing = await prisma.subject.findMany({ select: { caseId: true, fullName: true, type: true } });
    const daCo = new Map<string, Set<string>>();
    for (const e of existing) {
      const set = daCo.get(e.caseId) ?? new Set<string>();
      set.add(`${e.type}|${normalizeTen(e.fullName)}`);
      daCo.set(e.caseId, set);
    }

    let soVuThem = 0;
    const dem = { suspectTomTat: 0, suspectNghiVan: 0, victim: 0, chuaPhanVai: 0, coDinhDanh: 0 };

    for (const r of rows) {
      const coSan = daCo.get(r.caseId) ?? new Set<string>();
      const { toCreate, chuaRoVaiTro } = duyetVuAn(r.caseId, r.tomTat, r.nghiVan, coSan);

      for (const c of toCreate) {
        if (c.idNumber) dem.coDinhDanh++;
        if (c.type === 'VICTIM') dem.victim++;
        else if (String(c.notes).includes('nghi vấn đối tượng')) dem.suspectNghiVan++;
        else dem.suspectTomTat++;
      }

      if (toCreate.length) {
        soVuThem++;
        if (!dryRun) await prisma.subject.createMany({ data: toCreate });
      }

      // Người chưa rõ vai trò → metadata.doiTuongChuaPhanVai (không tạo Subject).
      if (chuaRoVaiTro.length) {
        dem.chuaPhanVai += chuaRoVaiTro.length;
        if (!dryRun) {
          const cur = (await prisma.case.findUnique({ where: { id: r.caseId }, select: { metadata: true } }))
            ?.metadata as Record<string, unknown> | null;
          if (!cur?.doiTuongChuaPhanVai) {
            await prisma.case.update({
              where: { id: r.caseId },
              data: {
                metadata: {
                  ...(cur ?? {}),
                  doiTuongChuaPhanVai: chuaRoVaiTro.map((d) => ({
                    hoTen: d.hoTen,
                    namSinh: d.namSinh,
                    diaChi: d.diaChi,
                    cccd: d.cccd,
                    trichDan: d.trichDan,
                  })),
                },
              },
            });
          }
        }
      }
    }

    console.log(dryRun ? '\n— CHẠY THỬ, KHÔNG GHI GÌ —\n' : '\n— ĐÃ GHI —\n');
    if (!dryRun) console.log(`Dọn sentinel cũ: DOB 1900→null ${donDob} · idNumber ''→null ${donId}`);
    console.log(`Vụ án khảo sát            : ${rows.length}`);
    console.log(`Vụ án được thêm đối tượng : ${soVuThem}`);
    console.log(`  nghi can từ tóm tắt     : ${dem.suspectTomTat}`);
    console.log(`  nghi can từ trường nghi vấn: ${dem.suspectNghiVan}`);
    console.log(`  bị hại (từ tóm tắt)     : ${dem.victim}`);
    console.log(`  trong đó có định danh   : ${dem.coDinhDanh}`);
    console.log(`  chưa rõ vai trò → metadata: ${dem.chuaPhanVai}`);
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
