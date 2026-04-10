/**
 * Seed Missing Directory Types
 * Creates directory entries for FK selects that currently use hardcoded options.
 * Run: npx ts-node prisma/seed-directory-types.ts
 * Idempotent: uses upsert on type+code unique constraint.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

interface DirectoryEntry {
  type: string;
  code: string;
  name: string;
  order: number;
}

const DIRECTORY_DATA: DirectoryEntry[] = [
  // ── INCIDENT_TYPE (Loại vụ việc) ─────────────────────────────────────────
  { type: 'INCIDENT_TYPE', code: 'VPHC', name: 'Vi phạm hành chính', order: 1 },
  { type: 'INCIDENT_TYPE', code: 'TCDS', name: 'Tranh chấp dân sự', order: 2 },
  { type: 'INCIDENT_TYPE', code: 'ANTT', name: 'An ninh trật tự', order: 3 },
  { type: 'INCIDENT_TYPE', code: 'KHAC', name: 'Khác', order: 4 },

  // ── PETITION_TYPE (Loại đơn thư) ─────────────────────────────────────────
  { type: 'PETITION_TYPE', code: 'TC', name: 'Tố cáo', order: 1 },
  { type: 'PETITION_TYPE', code: 'KN', name: 'Khiếu nại', order: 2 },
  { type: 'PETITION_TYPE', code: 'KNG', name: 'Kiến nghị', order: 3 },
  { type: 'PETITION_TYPE', code: 'PA', name: 'Phản ánh', order: 4 },

  // ── PRIORITY (Mức độ ưu tiên) ────────────────────────────────────────────
  { type: 'PRIORITY', code: 'CAO', name: 'Cao', order: 1 },
  { type: 'PRIORITY', code: 'TB', name: 'Trung bình', order: 2 },
  { type: 'PRIORITY', code: 'THAP', name: 'Thấp', order: 3 },

  // ── GENDER (Giới tính) ───────────────────────────────────────────────────
  { type: 'GENDER', code: 'NAM', name: 'Nam', order: 1 },
  { type: 'GENDER', code: 'NU', name: 'Nữ', order: 2 },
  { type: 'GENDER', code: 'KHAC', name: 'Khác', order: 3 },

  // ── AGE_GROUP (Nhóm tuổi) ────────────────────────────────────────────────
  { type: 'AGE_GROUP', code: 'U18', name: 'Dưới 18', order: 1 },
  { type: 'AGE_GROUP', code: '18-30', name: '18-30', order: 2 },
  { type: 'AGE_GROUP', code: '30-45', name: '30-45', order: 3 },
  { type: 'AGE_GROUP', code: '45-60', name: '45-60', order: 4 },
  { type: 'AGE_GROUP', code: 'O60', name: 'Trên 60', order: 5 },

  // ── EDUCATION_LEVEL (Trình độ học vấn) ───────────────────────────────────
  { type: 'EDUCATION_LEVEL', code: 'TH', name: 'Tiểu học', order: 1 },
  { type: 'EDUCATION_LEVEL', code: 'THCS', name: 'THCS', order: 2 },
  { type: 'EDUCATION_LEVEL', code: 'THPT', name: 'THPT', order: 3 },
  { type: 'EDUCATION_LEVEL', code: 'CD', name: 'Cao đẳng', order: 4 },
  { type: 'EDUCATION_LEVEL', code: 'DH', name: 'Đại học', order: 5 },
  { type: 'EDUCATION_LEVEL', code: 'SDH', name: 'Sau đại học', order: 6 },

  // ── EVIDENCE_TYPE (Loại vật chứng) ───────────────────────────────────────
  { type: 'EVIDENCE_TYPE', code: 'TIEN', name: 'Tiền', order: 1 },
  { type: 'EVIDENCE_TYPE', code: 'TL', name: 'Tài liệu', order: 2 },
  { type: 'EVIDENCE_TYPE', code: 'DV', name: 'Đồ vật', order: 3 },
  { type: 'EVIDENCE_TYPE', code: 'VK', name: 'Vũ khí', order: 4 },
  { type: 'EVIDENCE_TYPE', code: 'MT', name: 'Ma túy', order: 5 },
  { type: 'EVIDENCE_TYPE', code: 'KHAC', name: 'Khác', order: 6 },

  // ── CASE_CLASSIFICATION (Phân loại vụ án ban đầu) ────────────────────────
  { type: 'CASE_CLASSIFICATION', code: 'HS', name: 'Hình sự', order: 1 },
  { type: 'CASE_CLASSIFICATION', code: 'KT', name: 'Kinh tế', order: 2 },
  { type: 'CASE_CLASSIFICATION', code: 'MT', name: 'Ma túy', order: 3 },
  { type: 'CASE_CLASSIFICATION', code: 'ANTT', name: 'An ninh trật tự', order: 4 },
  { type: 'CASE_CLASSIFICATION', code: 'KHAC', name: 'Khác', order: 5 },

  // ── PROSECUTION_OFFICE (Viện Kiểm sát) ──────────────────────────────────
  { type: 'PROSECUTION_OFFICE', code: 'VKS-TC', name: 'Viện Kiểm sát nhân dân tối cao', order: 1 },
  { type: 'PROSECUTION_OFFICE', code: 'VKS-TP', name: 'Viện Kiểm sát nhân dân TP.HCM', order: 2 },
  { type: 'PROSECUTION_OFFICE', code: 'VKS-HN', name: 'Viện Kiểm sát nhân dân TP. Hà Nội', order: 3 },
  { type: 'PROSECUTION_OFFICE', code: 'VKS-DN', name: 'Viện Kiểm sát nhân dân TP. Đà Nẵng', order: 4 },
];

async function main() {
  console.log(`Seeding ${DIRECTORY_DATA.length} directory entries...`);

  let created = 0;
  let existing = 0;

  for (const entry of DIRECTORY_DATA) {
    const result = await prisma.directory.upsert({
      where: { type_code: { type: entry.type, code: entry.code } },
      update: { name: entry.name, order: entry.order, isActive: true },
      create: {
        type: entry.type,
        code: entry.code,
        name: entry.name,
        order: entry.order,
        isActive: true,
      },
    });

    if (result.createdAt.getTime() > Date.now() - 5000) {
      created++;
    } else {
      existing++;
    }
  }

  // Summary by type
  const types = [...new Set(DIRECTORY_DATA.map(d => d.type))];
  for (const type of types) {
    const count = await prisma.directory.count({ where: { type } });
    console.log(`  ${type}: ${count} entries`);
  }

  console.log(`Done. ${created} created, ${existing} already existed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
