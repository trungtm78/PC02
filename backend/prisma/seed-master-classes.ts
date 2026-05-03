/**
 * Seed MasterClass data
 * Run: npx ts-node prisma/seed-master-classes.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

interface Entry { type: string; code: string; name: string; order: number }

const DATA: Entry[] = [
  // 00 - Giới tính
  { type: '00', code: 'NAM', name: 'Nam', order: 1 },
  { type: '00', code: 'NU', name: 'Nữ', order: 2 },
  { type: '00', code: 'KHAC', name: 'Khác', order: 3 },

  // 01 - Loại vụ việc
  { type: '01', code: 'VPHC', name: 'Vi phạm hành chính', order: 1 },
  { type: '01', code: 'TCDS', name: 'Tranh chấp dân sự', order: 2 },
  { type: '01', code: 'ANTT', name: 'An ninh trật tự', order: 3 },
  { type: '01', code: 'KHAC', name: 'Khác', order: 4 },

  // 02 - Loại đơn thư
  { type: '02', code: 'TC', name: 'Tố cáo', order: 1 },
  { type: '02', code: 'KN', name: 'Khiếu nại', order: 2 },
  { type: '02', code: 'KNG', name: 'Kiến nghị', order: 3 },
  { type: '02', code: 'PA', name: 'Phản ánh', order: 4 },

  // 03 - Mức độ ưu tiên
  { type: '03', code: 'CAO', name: 'Cao', order: 1 },
  { type: '03', code: 'TB', name: 'Trung bình', order: 2 },
  { type: '03', code: 'THAP', name: 'Thấp', order: 3 },

  // 04 - Nhóm tuổi
  { type: '04', code: 'U18', name: 'Dưới 18', order: 1 },
  { type: '04', code: '18-30', name: '18-30', order: 2 },
  { type: '04', code: '30-45', name: '30-45', order: 3 },
  { type: '04', code: '45-60', name: '45-60', order: 4 },
  { type: '04', code: 'O60', name: 'Trên 60', order: 5 },

  // 05 - Trình độ học vấn
  { type: '05', code: 'TH', name: 'Tiểu học', order: 1 },
  { type: '05', code: 'THCS', name: 'THCS', order: 2 },
  { type: '05', code: 'THPT', name: 'THPT', order: 3 },
  { type: '05', code: 'CD', name: 'Cao đẳng', order: 4 },
  { type: '05', code: 'DH', name: 'Đại học', order: 5 },
  { type: '05', code: 'SDH', name: 'Sau đại học', order: 6 },

  // 06 - Loại vật chứng
  { type: '06', code: 'TIEN', name: 'Tiền', order: 1 },
  { type: '06', code: 'TL', name: 'Tài liệu', order: 2 },
  { type: '06', code: 'DV', name: 'Đồ vật', order: 3 },
  { type: '06', code: 'VK', name: 'Vũ khí', order: 4 },
  { type: '06', code: 'MT', name: 'Ma túy', order: 5 },
  { type: '06', code: 'KHAC', name: 'Khác', order: 6 },

  // 07 - Phân loại vụ án (broad categories)
  { type: '07', code: 'HS', name: 'Hình sự', order: 1 },
  { type: '07', code: 'KT', name: 'Kinh tế', order: 2 },
  { type: '07', code: 'MT', name: 'Ma túy', order: 3 },
  { type: '07', code: 'ANTT', name: 'An ninh trật tự', order: 4 },
  { type: '07', code: 'KHAC', name: 'Khác', order: 5 },
  // 07 - Tội danh cụ thể (BLHS 2015) — dùng cho dropdown crime field trong CaseFormPage
  { type: '07', code: 'D123', name: 'Giết người (Điều 123 BLHS)', order: 10 },
  { type: '07', code: 'D134', name: 'Cố ý gây thương tích (Điều 134 BLHS)', order: 11 },
  { type: '07', code: 'D168', name: 'Cướp tài sản (Điều 168 BLHS)', order: 12 },
  { type: '07', code: 'D170', name: 'Cưỡng đoạt tài sản (Điều 170 BLHS)', order: 13 },
  { type: '07', code: 'D173', name: 'Trộm cắp tài sản (Điều 173 BLHS)', order: 14 },
  { type: '07', code: 'D174', name: 'Lừa đảo chiếm đoạt tài sản (Điều 174 BLHS)', order: 15 },
  { type: '07', code: 'D178', name: 'Hủy hoại tài sản (Điều 178 BLHS)', order: 16 },
  { type: '07', code: 'D193', name: 'Tàng trữ trái phép chất ma túy (Điều 193 BLHS)', order: 17 },
  { type: '07', code: 'D194', name: 'Vận chuyển trái phép chất ma túy (Điều 194 BLHS)', order: 18 },
  { type: '07', code: 'D248', name: 'Sản xuất trái phép chất ma túy (Điều 248 BLHS)', order: 19 },
  { type: '07', code: 'D260', name: 'Vi phạm quy định về tham gia GTĐB (Điều 260 BLHS)', order: 20 },
  { type: '07', code: 'D331', name: 'Lợi dụng quyền tự do dân chủ (Điều 331 BLHS)', order: 21 },
  { type: '07', code: 'D-KHAC', name: 'Tội danh khác', order: 99 },

  // 08 - Viện Kiểm sát
  { type: '08', code: 'VKS-TC', name: 'Viện Kiểm sát nhân dân tối cao', order: 1 },
  { type: '08', code: 'VKS-TP', name: 'VKSND TP.HCM', order: 2 },
  { type: '08', code: 'VKS-Q1', name: 'VKSND Quận 1', order: 3 },
  { type: '08', code: 'VKS-Q3', name: 'VKSND Quận 3', order: 4 },
  { type: '08', code: 'VKS-Q5', name: 'VKSND Quận 5', order: 5 },
  { type: '08', code: 'VKS-Q10', name: 'VKSND Quận 10', order: 6 },
  { type: '08', code: 'VKS-TPHCM', name: 'VKSND TP.HCM', order: 7 },
  { type: '08', code: 'VKS-HN', name: 'Viện Kiểm sát nhân dân TP. Hà Nội', order: 8 },
  { type: '08', code: 'VKS-DN', name: 'Viện Kiểm sát nhân dân TP. Đà Nẵng', order: 9 },
];

export async function seedMasterClasses(client: PrismaClient) {
  console.log(`Seeding ${DATA.length} master class entries...`);
  for (const e of DATA) {
    await client.masterClass.upsert({
      where: { type_code: { type: e.type, code: e.code } },
      update: { name: e.name, order: e.order, isActive: true },
      create: { type: e.type, code: e.code, name: e.name, order: e.order, isActive: true },
    });
  }
  const types = [...new Set(DATA.map(d => d.type))];
  for (const t of types) {
    const c = await client.masterClass.count({ where: { type: t } });
    console.log(`  Type ${t}: ${c} entries`);
  }
  return DATA.length;
}

async function main() {
  const count = await seedMasterClasses(prisma);
  console.log(`Done. Seeded ${count} entries.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
