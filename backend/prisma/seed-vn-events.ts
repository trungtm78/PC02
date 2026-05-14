/**
 * Seed ngày lễ + ngày truyền thống Việt Nam (national + công an + quân đội).
 *
 * Background: Migration 20260513120000_calendar_events_v2_phase1 đã seed 25
 * events (Tết, Quốc khánh, các ngày ngành phổ biến). v0.21.6.0 bổ sung 13
 * ngày còn thiếu mà anh chỉ ra. Tất cả dates đã verify qua WebSearch nguồn
 * chính thức (qdnd.vn, congan.*.gov.vn, baochinhphu.vn) — không invent dates.
 *
 * Idempotent: dùng deterministic ID `evt_${slug}` + create/update. Re-run
 * an toàn — sẽ refresh title/description, không tạo duplicate.
 *
 * Tất cả events scope=SYSTEM (visible to all), recurrenceRule=FREQ=YEARLY,
 * isOfficialDayOff=false (không phải ngày nghỉ chính thức theo BLLĐ).
 */
import { PrismaClient } from '@prisma/client';

export interface VnEvent {
  id: string;
  title: string;
  shortTitle?: string;
  description?: string;
  startDate: string; // YYYY-MM-DD (template year — recurrence sẽ lặp)
  categorySlug: 'national' | 'police' | 'military';
}

export const VN_EVENTS: readonly VnEvent[] = [
  // ── NATIONAL — Quốc gia ────────────────────────────────────────────────
  {
    id: 'evt_party_founding',
    title: 'Ngày thành lập Đảng Cộng sản Việt Nam',
    shortTitle: 'Thành lập Đảng CSVN',
    description:
      'Đảng Cộng sản Việt Nam được thành lập ngày 3/2/1930 tại Hương Cảng (Trung Quốc) do lãnh tụ Nguyễn Ái Quốc chủ trì hội nghị hợp nhất ba tổ chức cộng sản.',
    startDate: '2026-02-03',
    categorySlug: 'national',
  },
  {
    id: 'evt_youth_union_founding',
    title: 'Ngày thành lập Đoàn TNCS Hồ Chí Minh',
    shortTitle: 'Thành lập Đoàn TNCS HCM',
    description:
      'Ngày 26/3/1931, tại Hội nghị Ban Chấp hành Trung ương Đảng lần thứ hai, Đoàn Thanh niên Cộng sản Đông Dương (tiền thân của Đoàn TNCS Hồ Chí Minh) chính thức được thành lập.',
    startDate: '2026-03-26',
    categorySlug: 'national',
  },
  {
    id: 'evt_ho_chi_minh_birthday',
    title: 'Ngày sinh Chủ tịch Hồ Chí Minh',
    shortTitle: 'Sinh nhật Bác Hồ',
    description:
      'Chủ tịch Hồ Chí Minh (1890-1969), người sáng lập và rèn luyện Đảng Cộng sản Việt Nam, sinh ngày 19/5/1890 tại làng Hoàng Trù, xã Kim Liên, huyện Nam Đàn, tỉnh Nghệ An.',
    startDate: '2026-05-19',
    categorySlug: 'national',
  },
  {
    id: 'evt_vn_family_day',
    title: 'Ngày Gia đình Việt Nam',
    shortTitle: 'Ngày Gia đình VN',
    description:
      'Ngày 28/6 được Thủ tướng Chính phủ chọn làm Ngày Gia đình Việt Nam theo Quyết định số 72/2001/QĐ-TTg ngày 4/5/2001, nhằm đề cao giá trị gia đình truyền thống.',
    startDate: '2026-06-28',
    categorySlug: 'national',
  },
  {
    id: 'evt_hanoi_liberation',
    title: 'Ngày Giải phóng Thủ đô Hà Nội',
    shortTitle: 'Giải phóng Thủ đô',
    description:
      'Ngày 10/10/1954, các đơn vị Quân đội Nhân dân Việt Nam tiến vào tiếp quản Thủ đô Hà Nội, kết thúc 9 năm kháng chiến chống thực dân Pháp.',
    startDate: '2026-10-10',
    categorySlug: 'national',
  },

  // ── POLICE — Ngành Công An ─────────────────────────────────────────────
  // (NOTE: 19/8 Truyền thống CAND + Ngày Hội Toàn dân BV ANTQ — đã có
  //  trong migration cũ, không seed lại tránh duplicate.)
  {
    id: 'evt_police_mobile_force',
    title: 'Ngày truyền thống lực lượng Cảnh sát Cơ động',
    shortTitle: 'CS Cơ động',
    description:
      'Ngày 15/4/1974 tại Hà Nội, Bộ Nội vụ (nay là Bộ Công an) công bố Quyết định số 33 thành lập lực lượng Cảnh sát Bảo vệ (nay là Cảnh sát Cơ động). Ngày này được Luật Cảnh sát Cơ động chính thức công nhận là Ngày truyền thống.',
    startDate: '2026-04-15',
    categorySlug: 'police',
  },
  {
    id: 'evt_police_anti_drug_day',
    title: 'Ngày Toàn dân Phòng chống Ma túy',
    shortTitle: 'Toàn dân PC Ma túy',
    description:
      'Ngày 26/6 hằng năm vừa là Ngày Quốc tế Phòng chống Ma túy (do Liên Hợp Quốc lập) vừa là Ngày Toàn dân Phòng chống Ma túy của Việt Nam theo Quyết định số 93/2001/QĐ-TTg.',
    startDate: '2026-06-26',
    categorySlug: 'police',
  },
  {
    id: 'evt_police_economic_crime',
    title: 'Ngày truyền thống lực lượng Cảnh sát Kinh tế',
    shortTitle: 'CS Kinh tế',
    description:
      'Ngày 10/8/1956, Thủ tướng Chính phủ ban hành Thông tư số 1001/TTg quy định tổ chức Cảnh sát Nhân dân, xác định "Cảnh sát Kinh tế phụ trách bảo vệ công khai các nhà máy, hầm mỏ". Ngày này được lấy làm Ngày truyền thống của lực lượng.',
    startDate: '2026-08-10',
    categorySlug: 'police',
  },

  // ── MILITARY — Quân đội ────────────────────────────────────────────────
  {
    id: 'evt_military_special_forces',
    title: 'Ngày truyền thống Bộ đội Đặc công',
    shortTitle: 'Bộ đội Đặc công',
    description:
      'Ngày 19/3/1967 tại Trường Bồi dưỡng cán bộ Dân tộc Trung ương (Phùng Khoang, Từ Liêm, Hà Nội), Chủ tịch Hồ Chí Minh, Thủ tướng Phạm Văn Đồng và Đại tướng Võ Nguyên Giáp đã dự buổi biểu diễn kỹ thuật, chiến thuật đặc công và công bố quyết định thành lập Binh chủng Đặc công.',
    startDate: '2026-03-19',
    categorySlug: 'military',
  },
  {
    id: 'evt_military_artillery',
    title: 'Ngày truyền thống Binh chủng Pháo binh',
    shortTitle: 'Pháo binh QĐNDVN',
    description:
      'Ngày 29/6/1946 tại trại Vệ quốc đoàn Trung ương (40 Hàng Bài, Hà Nội), đồng chí Hoàng Văn Thái — Tổng Tham mưu trưởng — công bố quyết định thành lập Đoàn Pháo binh Thủ đô gồm 3 trung đội: Pháo đài Láng, Pháo đài Xuân Tảo, Pháo đài Xuân Canh.',
    startDate: '2026-06-29',
    categorySlug: 'military',
  },
  {
    id: 'evt_military_logistics',
    title: 'Ngày truyền thống ngành Hậu cần Quân đội',
    shortTitle: 'Hậu cần Quân đội',
    description:
      'Ngày 11/7/1950, Chủ tịch Hồ Chí Minh ký Sắc lệnh số 121/SL thành lập Tổng cục Cung cấp (tiền thân Tổng cục Hậu cần) gồm Cục Quân lương, Cục Quân trang, Cục Quân y, Cục Quân nhu, Cục Vận tải.',
    startDate: '2026-07-11',
    categorySlug: 'military',
  },
  {
    id: 'evt_military_southern_resistance',
    title: 'Ngày Nam Bộ Kháng chiến',
    shortTitle: 'Nam Bộ Kháng chiến',
    description:
      'Ngày 23/9/1945, nhân dân Sài Gòn-Chợ Lớn bắt đầu cuộc kháng chiến chống thực dân Pháp tái chiếm, mở đầu Cuộc kháng chiến Nam Bộ kéo dài đến 1954.',
    startDate: '2026-09-23',
    categorySlug: 'military',
  },
];

export async function seedVnEvents(
  prisma: PrismaClient,
  createdById: string,
): Promise<{ created: number; updated: number }> {
  const categories = await prisma.eventCategory.findMany({
    select: { id: true, slug: true },
  });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  let created = 0;
  let updated = 0;

  for (const evt of VN_EVENTS) {
    const categoryId = categoryBySlug.get(evt.categorySlug);
    if (!categoryId) {
      console.warn(
        `Skipping ${evt.id}: category '${evt.categorySlug}' not found`,
      );
      continue;
    }

    const existing = await prisma.calendarEvent.findUnique({
      where: { id: evt.id },
    });

    if (existing) {
      await prisma.calendarEvent.update({
        where: { id: evt.id },
        data: {
          title: evt.title,
          shortTitle: evt.shortTitle ?? null,
          description: evt.description ?? null,
          categoryId,
        },
      });
      updated++;
    } else {
      await prisma.calendarEvent.create({
        data: {
          id: evt.id,
          title: evt.title,
          shortTitle: evt.shortTitle ?? null,
          description: evt.description ?? null,
          startDate: new Date(evt.startDate),
          allDay: true,
          isOfficialDayOff: false,
          categoryId,
          scope: 'SYSTEM',
          recurrenceRule: 'FREQ=YEARLY',
          createdById,
        },
      });
      created++;
    }
  }

  return { created, updated };
}
