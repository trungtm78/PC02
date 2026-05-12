/**
 * Seed các ngày lễ / ngày đặc biệt Việt Nam, Công an, Quân đội.
 *
 * Idempotent — chạy lại sẽ upsert theo unique (date, title).
 *
 * Hai cách chạy:
 *   1. Standalone: `npx ts-node prisma/seed-holidays.ts`
 *   2. Từ seed.ts: import `seedHolidays(prisma)`
 */

import { PrismaClient, HolidayCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type SeedHoliday = {
  date: string; // ISO YYYY-MM-DD
  title: string;
  shortTitle?: string;
  category: HolidayCategory;
  isOfficialDayOff?: boolean;
  description?: string;
  isRecurring?: boolean;
  lunarDate?: string;
};

// Năm tham chiếu — Tết âm lịch + Giỗ Tổ phải tính theo từng năm cụ thể
const YEAR = new Date().getFullYear();

/**
 * Tết Nguyên Đán & Giỗ Tổ thay đổi theo âm lịch hàng năm.
 * Bảng dưới đây áp dụng cho 2026 (mùng 1 Tết = 17/02/2026, Giỗ Tổ = 18/04/2026).
 * Khi sang năm 2027, admin cần cập nhật ngày cụ thể qua DB hoặc UI.
 */
const LUNAR_2026 = {
  tetMung1: '2026-02-17',
  tetMung2: '2026-02-18',
  tetMung3: '2026-02-19',
  gioTo: '2026-04-26', // 10/3 âm = 26/4/2026
};

const HOLIDAYS: SeedHoliday[] = [
  // ── QUỐC GIA (NATIONAL) ───────────────────────────────────────────────
  {
    date: `${YEAR}-01-01`,
    title: 'Tết Dương lịch',
    shortTitle: 'Tết Dương',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: 'Ngày đầu năm dương lịch — nghỉ chính thức 1 ngày',
    isRecurring: true,
  },
  {
    date: LUNAR_2026.tetMung1,
    title: 'Tết Nguyên Đán (Mùng 1)',
    shortTitle: 'Tết Mùng 1',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: 'Mùng 1 Tết Âm lịch — nghỉ chính thức',
    isRecurring: false,
    lunarDate: 'Mùng 1 Tháng Giêng',
  },
  {
    date: LUNAR_2026.tetMung2,
    title: 'Tết Nguyên Đán (Mùng 2)',
    shortTitle: 'Tết Mùng 2',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: 'Mùng 2 Tết Âm lịch — nghỉ chính thức',
    isRecurring: false,
    lunarDate: 'Mùng 2 Tháng Giêng',
  },
  {
    date: LUNAR_2026.tetMung3,
    title: 'Tết Nguyên Đán (Mùng 3)',
    shortTitle: 'Tết Mùng 3',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: 'Mùng 3 Tết Âm lịch — nghỉ chính thức',
    isRecurring: false,
    lunarDate: 'Mùng 3 Tháng Giêng',
  },
  {
    date: LUNAR_2026.gioTo,
    title: 'Giỗ Tổ Hùng Vương',
    shortTitle: 'Giỗ Tổ',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: 'Ngày Giỗ Tổ Hùng Vương — 10/3 âm lịch — nghỉ chính thức 1 ngày',
    isRecurring: false,
    lunarDate: '10/3 Âm lịch',
  },
  {
    date: `${YEAR}-04-30`,
    title: 'Ngày Giải phóng miền Nam, Thống nhất đất nước',
    shortTitle: 'Giải phóng MN',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: '30/04/1975 — nghỉ chính thức 1 ngày',
    isRecurring: true,
  },
  {
    date: `${YEAR}-09-02`,
    title: 'Quốc khánh Nước CHXHCN Việt Nam',
    shortTitle: 'Quốc khánh',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: '02/09/1945 — nghỉ chính thức',
    isRecurring: true,
  },

  // ── CÔNG AN (POLICE) ──────────────────────────────────────────────────
  {
    date: `${YEAR}-08-19`,
    title: 'Ngày truyền thống Công an Nhân dân Việt Nam',
    shortTitle: 'TT CAND',
    category: HolidayCategory.POLICE,
    description: 'Kỷ niệm thành lập lực lượng CAND (19/8/1945) và Ngày hội Toàn dân bảo vệ ANTQ',
    isRecurring: true,
  },
  {
    date: `${YEAR}-02-21`,
    title: 'Ngày truyền thống lực lượng Cảnh sát giao thông',
    shortTitle: 'TT CSGT',
    category: HolidayCategory.POLICE,
    description: 'Thành lập lực lượng CSGT (21/02/1946)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-10-04`,
    title: 'Ngày truyền thống lực lượng Cảnh sát PCCC và CNCH',
    shortTitle: 'TT PCCC',
    category: HolidayCategory.POLICE,
    description: 'Thành lập lực lượng Cảnh sát Phòng cháy chữa cháy và Cứu nạn cứu hộ (04/10/1961)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-04-18`,
    title: 'Ngày truyền thống lực lượng Cảnh sát Hình sự',
    shortTitle: 'TT CSHS',
    category: HolidayCategory.POLICE,
    description: 'Thành lập lực lượng Cảnh sát Hình sự (18/4/1946)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-03-03`,
    title: 'Ngày truyền thống lực lượng An ninh Nhân dân',
    shortTitle: 'TT ANND',
    category: HolidayCategory.POLICE,
    description: 'Thành lập lực lượng An ninh Nhân dân (03/3/1959)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-06-04`,
    title: 'Ngày truyền thống lực lượng Cảnh sát QLHC về TTXH',
    shortTitle: 'TT QLHC',
    category: HolidayCategory.POLICE,
    description: 'Cảnh sát Quản lý hành chính về trật tự xã hội (04/6/1946)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-11-09`,
    title: 'Ngày Pháp luật Việt Nam',
    shortTitle: 'Ngày PL VN',
    category: HolidayCategory.POLICE,
    description: 'Ngày Pháp luật nước CHXHCN Việt Nam (09/11/1946)',
    isRecurring: true,
  },

  // ── QUÂN ĐỘI (MILITARY) ───────────────────────────────────────────────
  {
    date: `${YEAR}-12-22`,
    title: 'Ngày thành lập Quân đội Nhân dân Việt Nam',
    shortTitle: 'TT QĐND',
    category: HolidayCategory.MILITARY,
    description: 'Thành lập Quân đội Nhân dân Việt Nam (22/12/1944) và Ngày Hội Quốc phòng toàn dân',
    isRecurring: true,
  },
  {
    date: `${YEAR}-12-19`,
    title: 'Ngày Toàn quốc kháng chiến',
    shortTitle: 'Toàn quốc KC',
    category: HolidayCategory.MILITARY,
    description: 'Lời kêu gọi toàn quốc kháng chiến của Chủ tịch Hồ Chí Minh (19/12/1946)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-05-07`,
    title: 'Ngày thành lập Quân chủng Hải quân',
    shortTitle: 'TT Hải quân',
    category: HolidayCategory.MILITARY,
    description: 'Quân chủng Hải quân Nhân dân Việt Nam (07/5/1955)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-03-03`,
    title: 'Ngày truyền thống Bộ đội Biên phòng',
    shortTitle: 'TT Biên phòng',
    category: HolidayCategory.MILITARY,
    description: 'Bộ đội Biên phòng (03/3/1959)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-10-22`,
    title: 'Ngày thành lập Quân chủng Phòng không - Không quân',
    shortTitle: 'TT PK-KQ',
    category: HolidayCategory.MILITARY,
    description: 'Quân chủng Phòng không - Không quân (22/10/1963)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-07-27`,
    title: 'Ngày Thương binh - Liệt sỹ',
    shortTitle: 'TB-LS',
    category: HolidayCategory.MILITARY,
    description: 'Ngày Thương binh - Liệt sỹ (27/7/1947) — tri ân người có công với cách mạng',
    isRecurring: true,
  },

  // ── QUỐC TẾ / KỶ NIỆM (INTERNATIONAL) ─────────────────────────────────
  {
    date: `${YEAR}-03-08`,
    title: 'Ngày Quốc tế Phụ nữ',
    shortTitle: '8/3',
    category: HolidayCategory.INTERNATIONAL,
    description: 'Ngày Quốc tế Phụ nữ',
    isRecurring: true,
  },
  {
    date: `${YEAR}-05-01`,
    title: 'Ngày Quốc tế Lao động',
    shortTitle: '1/5',
    category: HolidayCategory.NATIONAL,
    isOfficialDayOff: true,
    description: 'Ngày Quốc tế Lao động — nghỉ chính thức',
    isRecurring: true,
  },
  {
    date: `${YEAR}-06-01`,
    title: 'Ngày Quốc tế Thiếu nhi',
    shortTitle: '1/6',
    category: HolidayCategory.INTERNATIONAL,
    description: 'Ngày Quốc tế Thiếu nhi',
    isRecurring: true,
  },
  {
    date: `${YEAR}-10-20`,
    title: 'Ngày Phụ nữ Việt Nam',
    shortTitle: '20/10',
    category: HolidayCategory.INTERNATIONAL,
    description: 'Thành lập Hội Liên hiệp Phụ nữ Việt Nam (20/10/1930)',
    isRecurring: true,
  },
  {
    date: `${YEAR}-11-20`,
    title: 'Ngày Nhà giáo Việt Nam',
    shortTitle: '20/11',
    category: HolidayCategory.INTERNATIONAL,
    description: 'Ngày Nhà giáo Việt Nam (20/11/1982)',
    isRecurring: true,
  },
];

export async function seedHolidays(
  prisma: PrismaClient,
): Promise<{ upserted: number; total: number }> {
  console.log(`Seeding ${HOLIDAYS.length} holidays for year ${YEAR}...`);
  let upserted = 0;
  for (const h of HOLIDAYS) {
    await prisma.holiday.upsert({
      where: { date_title: { date: new Date(h.date), title: h.title } },
      update: {
        shortTitle: h.shortTitle ?? null,
        category: h.category,
        isOfficialDayOff: h.isOfficialDayOff ?? false,
        description: h.description ?? null,
        isRecurring: h.isRecurring ?? true,
        lunarDate: h.lunarDate ?? null,
      },
      create: {
        date: new Date(h.date),
        title: h.title,
        shortTitle: h.shortTitle,
        category: h.category,
        isOfficialDayOff: h.isOfficialDayOff ?? false,
        description: h.description,
        isRecurring: h.isRecurring ?? true,
        lunarDate: h.lunarDate,
      },
    });
    upserted++;
  }
  const total = await prisma.holiday.count();
  console.log(`Seed holidays: ${upserted} entries upserted. Total in DB: ${total}`);
  return { upserted, total };
}

// Standalone execution
if (require.main === module) {
  const adapter = new PrismaPg({
    connectionString:
      process.env['DATABASE_URL'] ??
      'postgresql://pc02_user:password@localhost:5432/pc02_case_mgmt?schema=public',
  });
  const prisma = new PrismaClient({ adapter });
  seedHolidays(prisma)
    .then((r) => {
      console.log('Result:', r);
      return prisma.$disconnect();
    })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
