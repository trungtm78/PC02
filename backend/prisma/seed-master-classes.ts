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

  // 07 - Phân loại vụ án
  { type: '07', code: 'HS', name: 'Hình sự', order: 1 },
  { type: '07', code: 'KT', name: 'Kinh tế', order: 2 },
  { type: '07', code: 'MT', name: 'Ma túy', order: 3 },
  { type: '07', code: 'ANTT', name: 'An ninh trật tự', order: 4 },
  { type: '07', code: 'KHAC', name: 'Khác', order: 5 },

  // 08 - Viện Kiểm sát
  { type: '08', code: 'VKS-TC', name: 'Viện Kiểm sát nhân dân tối cao', order: 1 },
  { type: '08', code: 'VKS-TP', name: 'Viện Kiểm sát nhân dân TP.HCM', order: 2 },
  { type: '08', code: 'VKS-HN', name: 'Viện Kiểm sát nhân dân TP. Hà Nội', order: 3 },
  { type: '08', code: 'VKS-DN', name: 'Viện Kiểm sát nhân dân TP. Đà Nẵng', order: 4 },
];

async function main() {
  console.log(`Seeding ${DATA.length} master class entries...`);
  for (const e of DATA) {
    await prisma.masterClass.upsert({
      where: { type_code: { type: e.type, code: e.code } },
      update: { name: e.name, order: e.order, isActive: true },
      create: { type: e.type, code: e.code, name: e.name, order: e.order, isActive: true },
    });
  }
  const types = [...new Set(DATA.map(d => d.type))];
  for (const t of types) {
    const c = await prisma.masterClass.count({ where: { type: t } });
    console.log(`  Type ${t}: ${c} entries`);
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
