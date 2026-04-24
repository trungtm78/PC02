/**
 * seed-sample-data.ts
 * Nạp dữ liệu mẫu toàn diện cho PC02 Case Management System
 *
 * Bao gồm:
 *  - Master data: Directory (Tội danh, Đơn vị, Quận/Huyện, Phường/Xã, Nghề nghiệp, Quốc tịch)
 *  - Users: 5 điều tra viên test
 *  - Cases: 20 vụ án ở các trạng thái khác nhau
 *  - Subjects: bị can / nạn nhân / nhân chứng
 *  - Lawyers: luật sư cho một số vụ
 *  - Petitions: 10 đơn thư
 *  - Incidents: 10 vụ việc
 *  - Proposals, Delegations, Conclusions mẫu
 *
 * Run: npx ts-node prisma/seed-sample-data.ts
 */

import { PrismaClient, CaseStatus, SubjectType, SubjectStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString:
    process.env['DATABASE_URL'] ??
    'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

async function upsertDir(type: string, code: string, name: string, parentId?: string, order = 0) {
  return prisma.directory.upsert({
    where: { type_code: { type, code } },
    update: { name },
    create: { type, code, name, parentId, order, isActive: true },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu...\n');

  // ── 1. MASTER DATA: Tội danh ──────────────────────────────────────────────
  console.log('📋 1. Nạp danh mục tội danh...');
  const crimes = await Promise.all([
    upsertDir('CRIME', 'DIEU-123', 'Giết người (Điều 123 BLHS)', undefined, 1),
    upsertDir('CRIME', 'DIEU-134', 'Cố ý gây thương tích (Điều 134 BLHS)', undefined, 2),
    upsertDir('CRIME', 'DIEU-168', 'Cướp tài sản (Điều 168 BLHS)', undefined, 3),
    upsertDir('CRIME', 'DIEU-170', 'Cưỡng đoạt tài sản (Điều 170 BLHS)', undefined, 4),
    upsertDir('CRIME', 'DIEU-173', 'Trộm cắp tài sản (Điều 173 BLHS)', undefined, 5),
    upsertDir('CRIME', 'DIEU-174', 'Lừa đảo chiếm đoạt tài sản (Điều 174 BLHS)', undefined, 6),
    upsertDir('CRIME', 'DIEU-178', 'Hủy hoại tài sản (Điều 178 BLHS)', undefined, 7),
    upsertDir('CRIME', 'DIEU-193', 'Tàng trữ trái phép chất ma túy (Điều 193 BLHS)', undefined, 8),
    upsertDir('CRIME', 'DIEU-194', 'Vận chuyển trái phép chất ma túy (Điều 194 BLHS)', undefined, 9),
    upsertDir('CRIME', 'DIEU-248', 'Sản xuất trái phép chất ma túy (Điều 248 BLHS)', undefined, 10),
    upsertDir('CRIME', 'DIEU-260', 'Vi phạm quy định về tham gia GTĐB (Điều 260 BLHS)', undefined, 11),
    upsertDir('CRIME', 'DIEU-331', 'Lợi dụng quyền tự do dân chủ (Điều 331 BLHS)', undefined, 12),
  ]);
  console.log(`   ✓ ${crimes.length} tội danh`);

  // ── 2. MASTER DATA: Đơn vị công an ───────────────────────────────────────
  console.log('📋 2. Nạp danh mục đơn vị...');
  const orgs = await Promise.all([
    upsertDir('ORG', 'CATP-HCM', 'Công an TP. Hồ Chí Minh', undefined, 1),
    upsertDir('ORG', 'CAQ1', 'Công an Quận 1', undefined, 2),
    upsertDir('ORG', 'CAQ3', 'Công an Quận 3', undefined, 3),
    upsertDir('ORG', 'CAQ5', 'Công an Quận 5', undefined, 4),
    upsertDir('ORG', 'CAQ7', 'Công an Quận 7', undefined, 5),
    upsertDir('ORG', 'CAQ10', 'Công an Quận 10', undefined, 6),
    upsertDir('ORG', 'CAQ12', 'Công an Quận 12', undefined, 7),
    upsertDir('ORG', 'CATB', 'Công an Quận Tân Bình', undefined, 8),
    upsertDir('ORG', 'CABTH', 'Công an Quận Bình Thạnh', undefined, 9),
    upsertDir('ORG', 'CAPN', 'Công an Quận Phú Nhuận', undefined, 10),
    upsertDir('ORG', 'CACC', 'Công an Huyện Củ Chi', undefined, 11),
    upsertDir('ORG', 'CAHM', 'Công an Huyện Hóc Môn', undefined, 12),
  ]);
  console.log(`   ✓ ${orgs.length} đơn vị`);

  // ── 3. MASTER DATA: Quận/Huyện ────────────────────────────────────────────
  console.log('📋 3. Nạp danh mục quận/huyện...');
  const districts = await Promise.all([
    upsertDir('DISTRICT', 'Q1', 'Quận 1', undefined, 1),
    upsertDir('DISTRICT', 'Q3', 'Quận 3', undefined, 2),
    upsertDir('DISTRICT', 'Q5', 'Quận 5', undefined, 3),
    upsertDir('DISTRICT', 'Q7', 'Quận 7', undefined, 4),
    upsertDir('DISTRICT', 'Q10', 'Quận 10', undefined, 5),
    upsertDir('DISTRICT', 'Q12', 'Quận 12', undefined, 6),
    upsertDir('DISTRICT', 'QTB', 'Quận Tân Bình', undefined, 7),
    upsertDir('DISTRICT', 'QBTH', 'Quận Bình Thạnh', undefined, 8),
    upsertDir('DISTRICT', 'QPN', 'Quận Phú Nhuận', undefined, 9),
    upsertDir('DISTRICT', 'HCC', 'Huyện Củ Chi', undefined, 10),
    upsertDir('DISTRICT', 'HHM', 'Huyện Hóc Môn', undefined, 11),
  ]);
  console.log(`   ✓ ${districts.length} quận/huyện`);

  // ── 4. MASTER DATA: Phường/Xã ─────────────────────────────────────────────
  console.log('📋 4. Nạp danh mục phường/xã...');
  const q1 = districts.find(d => d.code === 'Q1')!;
  const q3 = districts.find(d => d.code === 'Q3')!;
  const qtb = districts.find(d => d.code === 'QTB')!;
  const wards = await Promise.all([
    upsertDir('WARD', 'P-BEN-NGHE', 'Phường Bến Nghé', q1.id, 1),
    upsertDir('WARD', 'P-BEN-THANH', 'Phường Bến Thành', q1.id, 2),
    upsertDir('WARD', 'P-NGUYEN-THAI-BINH', 'Phường Nguyễn Thái Bình', q1.id, 3),
    upsertDir('WARD', 'P-VO-THI-SAU', 'Phường Võ Thị Sáu', q3.id, 4),
    upsertDir('WARD', 'P-6-Q3', 'Phường 6 (Quận 3)', q3.id, 5),
    upsertDir('WARD', 'P-TAY-THANH', 'Phường Tây Thạnh', qtb.id, 6),
    upsertDir('WARD', 'P-PHU-THANH', 'Phường Phú Thạnh', qtb.id, 7),
  ]);
  console.log(`   ✓ ${wards.length} phường/xã`);

  // ── 5. MASTER DATA: Nghề nghiệp ───────────────────────────────────────────
  console.log('📋 5. Nạp danh mục nghề nghiệp...');
  const occupations = await Promise.all([
    upsertDir('OCCUPATION', 'LAO-DONG-TU-DO', 'Lao động tự do', undefined, 1),
    upsertDir('OCCUPATION', 'BUON-BAN', 'Buôn bán', undefined, 2),
    upsertDir('OCCUPATION', 'CONG-NHAN', 'Công nhân', undefined, 3),
    upsertDir('OCCUPATION', 'NHAN-VIEN-VP', 'Nhân viên văn phòng', undefined, 4),
    upsertDir('OCCUPATION', 'HOC-SINH-SV', 'Học sinh / Sinh viên', undefined, 5),
    upsertDir('OCCUPATION', 'KHONG-NGHE', 'Không nghề nghiệp', undefined, 6),
    upsertDir('OCCUPATION', 'KHAC', 'Nghề nghiệp khác', undefined, 7),
  ]);
  console.log(`   ✓ ${occupations.length} nghề nghiệp`);

  // ── 6. MASTER DATA: Quốc tịch ────────────────────────────────────────────
  console.log('📋 6. Nạp danh mục quốc tịch...');
  const nationalities = await Promise.all([
    upsertDir('NATIONALITY', 'VN', 'Việt Nam', undefined, 1),
    upsertDir('NATIONALITY', 'CN', 'Trung Quốc', undefined, 2),
    upsertDir('NATIONALITY', 'KH', 'Campuchia', undefined, 3),
    upsertDir('NATIONALITY', 'US', 'Hoa Kỳ', undefined, 4),
    upsertDir('NATIONALITY', 'OTHER', 'Quốc tịch khác', undefined, 5),
  ]);
  console.log(`   ✓ ${nationalities.length} quốc tịch`);

  // ── 7. Users: Điều tra viên ───────────────────────────────────────────────
  console.log('👤 7. Nạp tài khoản điều tra viên...');
  const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
  const officerRole = await prisma.role.findFirst({ where: { name: 'OFFICER' } });

  if (!adminRole || !officerRole) {
    throw new Error('Chạy seed.ts trước để tạo roles!');
  }

  // Password MUST come from env var (never hardcoded)
  const rawOfficerPassword = process.env.SEED_OFFICER_PASSWORD;
  if (!rawOfficerPassword || rawOfficerPassword.length < 8) {
    console.error('\nERROR: SEED_OFFICER_PASSWORD env var required (min 8 chars).');
    console.error('Set it in backend/.env or shell before running this seed.\n');
    process.exit(1);
  }
  const pwHash = await bcrypt.hash(rawOfficerPassword, 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'dtv01@pc02.catp.gov.vn' },
      update: {},
      create: {
        email: 'dtv01@pc02.catp.gov.vn', username: 'dtv01',
        passwordHash: pwHash, firstName: 'Nguyễn Văn', lastName: 'Thành',
        workId: 'PC02-DTV-001', phone: '0901000011',
        roleId: officerRole.id, isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'dtv02@pc02.catp.gov.vn' },
      update: {},
      create: {
        email: 'dtv02@pc02.catp.gov.vn', username: 'dtv02',
        passwordHash: pwHash, firstName: 'Trần Thị', lastName: 'Mai',
        workId: 'PC02-DTV-002', phone: '0901000012',
        roleId: officerRole.id, isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'dtv03@pc02.catp.gov.vn' },
      update: {},
      create: {
        email: 'dtv03@pc02.catp.gov.vn', username: 'dtv03',
        passwordHash: pwHash, firstName: 'Lê Minh', lastName: 'Tuấn',
        workId: 'PC02-DTV-003', phone: '0901000013',
        roleId: officerRole.id, isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'dtv04@pc02.catp.gov.vn' },
      update: {},
      create: {
        email: 'dtv04@pc02.catp.gov.vn', username: 'dtv04',
        passwordHash: pwHash, firstName: 'Phạm Văn', lastName: 'Hùng',
        workId: 'PC02-DTV-004', phone: '0901000014',
        roleId: officerRole.id, isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'dtv05@pc02.catp.gov.vn' },
      update: {},
      create: {
        email: 'dtv05@pc02.catp.gov.vn', username: 'dtv05',
        passwordHash: pwHash, firstName: 'Hoàng Thị', lastName: 'Lan',
        workId: 'PC02-DTV-005', phone: '0901000015',
        roleId: officerRole.id, isActive: true,
      },
    }),
  ]);
  console.log(`   ✓ ${users.length} điều tra viên (password: $SEED_OFFICER_PASSWORD)`);

  const [dtv1, dtv2, dtv3, dtv4, dtv5] = users;

  // ── Shorthand refs ────────────────────────────────────────────────────────
  const crimeTheft    = crimes.find(c => c.code === 'DIEU-173')!;
  const crimeRobbery  = crimes.find(c => c.code === 'DIEU-168')!;
  const crimeDrug     = crimes.find(c => c.code === 'DIEU-193')!;
  const crimeFraud    = crimes.find(c => c.code === 'DIEU-174')!;
  const crimeAssault  = crimes.find(c => c.code === 'DIEU-134')!;
  const crimeMurder   = crimes.find(c => c.code === 'DIEU-123')!;
  const crimeTraffic  = crimes.find(c => c.code === 'DIEU-260')!;
  const crimeExtort   = crimes.find(c => c.code === 'DIEU-170')!;
  const nationalityVN = nationalities.find(n => n.code === 'VN')!;
  const occLabor      = occupations.find(o => o.code === 'LAO-DONG-TU-DO')!;
  const occStudent    = occupations.find(o => o.code === 'HOC-SINH-SV')!;
  const distQ1        = districts.find(d => d.code === 'Q1')!;
  const distQ3        = districts.find(d => d.code === 'Q3')!;
  const distQTB       = districts.find(d => d.code === 'QTB')!;
  const wardBN        = wards.find(w => w.code === 'P-BEN-NGHE')!;
  const wardVTS       = wards.find(w => w.code === 'P-VO-THI-SAU')!;

  // ── 8. CASES: 20 vụ án ────────────────────────────────────────────────────
  console.log('⚖️  8. Nạp 20 vụ án...');

  const caseDefs: Array<{
    name: string; crime: string; status: CaseStatus; unit: string;
    investigatorId: string; deadline: Date; subjectsCount?: number;
  }> = [
    // Tiếp nhận (5 vụ) - chờ phân công
    { name: 'Vụ trộm cắp xe máy tại chung cư Sunrise City', crime: 'Trộm cắp tài sản', status: 'TIEP_NHAN', unit: 'Công an Quận 7', investigatorId: dtv1.id, deadline: daysFromNow(30) },
    { name: 'Vụ lừa đảo đầu tư tài chính qua mạng', crime: 'Lừa đảo chiếm đoạt tài sản', status: 'TIEP_NHAN', unit: 'Công an Quận 1', investigatorId: dtv2.id, deadline: daysFromNow(45) },
    { name: 'Vụ tàng trữ ma túy tại phường Tây Thạnh', crime: 'Tàng trữ trái phép chất ma túy', status: 'TIEP_NHAN', unit: 'Công an Quận Tân Bình', investigatorId: dtv3.id, deadline: daysFromNow(20) },
    { name: 'Vụ cưỡng đoạt tài sản nhóm thanh thiếu niên', crime: 'Cưỡng đoạt tài sản', status: 'TIEP_NHAN', unit: 'Công an Quận 3', investigatorId: dtv4.id, deadline: daysFromNow(25) },
    { name: 'Vụ tai nạn giao thông chết người đường Lê Văn Sỹ', crime: 'Vi phạm quy định về tham gia GTĐB', status: 'TIEP_NHAN', unit: 'Công an Quận 3', investigatorId: dtv5.id, deadline: daysFromNow(15) },

    // Đang xác minh (3 vụ)
    { name: 'Vụ cướp giật điện thoại khu vực Bến Thành', crime: 'Cướp tài sản', status: 'DANG_XAC_MINH', unit: 'Công an Quận 1', investigatorId: dtv1.id, deadline: daysFromNow(10), subjectsCount: 2 },
    { name: 'Vụ trộm tại siêu thị BigC Hoàng Văn Thụ', crime: 'Trộm cắp tài sản', status: 'DANG_XAC_MINH', unit: 'Công an Quận Tân Bình', investigatorId: dtv2.id, deadline: daysFromNow(18) },
    { name: 'Vụ hủy hoại tài sản mâu thuẫn hàng xóm', crime: 'Hủy hoại tài sản', status: 'DANG_XAC_MINH', unit: 'Công an Quận 10', investigatorId: dtv3.id, deadline: daysFromNow(22) },

    // Đang điều tra (5 vụ)
    { name: 'Vụ án ma túy đường dây liên tỉnh', crime: 'Vận chuyển trái phép chất ma túy', status: 'DANG_DIEU_TRA', unit: 'Công an TP. Hồ Chí Minh', investigatorId: dtv1.id, deadline: daysFromNow(60), subjectsCount: 4 },
    { name: 'Vụ lừa đảo chiếm đoạt đất đai Huyện Củ Chi', crime: 'Lừa đảo chiếm đoạt tài sản', status: 'DANG_DIEU_TRA', unit: 'Công an Huyện Củ Chi', investigatorId: dtv2.id, deadline: daysFromNow(40), subjectsCount: 2 },
    { name: 'Vụ cố ý gây thương tích tại quán nhậu đường Bùi Viện', crime: 'Cố ý gây thương tích', status: 'DANG_DIEU_TRA', unit: 'Công an Quận 1', investigatorId: dtv3.id, deadline: daysFromNow(35), subjectsCount: 3 },
    { name: 'Vụ trộm cắp tài sản có tổ chức', crime: 'Trộm cắp tài sản', status: 'DANG_DIEU_TRA', unit: 'Công an Quận 12', investigatorId: dtv4.id, deadline: daysFromNow(50), subjectsCount: 5 },
    { name: 'Vụ giết người mâu thuẫn gia đình phường Võ Thị Sáu', crime: 'Giết người', status: 'DANG_DIEU_TRA', unit: 'Công an Quận 3', investigatorId: dtv5.id, deadline: daysFromNow(90), subjectsCount: 1 },

    // Đã xác minh (2 vụ)
    { name: 'Vụ trộm cắp xe đạp điện tại trường học', crime: 'Trộm cắp tài sản', status: 'DA_XAC_MINH', unit: 'Công an Quận 5', investigatorId: dtv1.id, deadline: daysFromNow(20), subjectsCount: 1 },
    { name: 'Vụ lừa đảo bán hàng online giả mạo', crime: 'Lừa đảo chiếm đoạt tài sản', status: 'DA_XAC_MINH', unit: 'Công an Quận Bình Thạnh', investigatorId: dtv2.id, deadline: daysFromNow(28) },

    // Quá hạn (2 vụ - deadline đã qua)
    { name: 'Vụ trộm cắp tài sản trong nhà trọ (QUÁ HẠN)', crime: 'Trộm cắp tài sản', status: 'DANG_DIEU_TRA', unit: 'Công an Huyện Hóc Môn', investigatorId: dtv3.id, deadline: daysAgo(5), subjectsCount: 1 },
    { name: 'Vụ cưỡng đoạt tài sản học sinh (QUÁ HẠN)', crime: 'Cưỡng đoạt tài sản', status: 'DANG_XAC_MINH', unit: 'Công an Quận Phú Nhuận', investigatorId: dtv4.id, deadline: daysAgo(10) },

    // Đã kết luận / lưu trữ (3 vụ)
    { name: 'Vụ trộm cắp tài sản siêu thị Coopmart - Đã kết luận', crime: 'Trộm cắp tài sản', status: 'DA_KET_LUAN', unit: 'Công an Quận 10', investigatorId: dtv5.id, deadline: daysAgo(30), subjectsCount: 2 },
    { name: 'Vụ ma túy cá nhân sử dụng - Đình chỉ điều tra', crime: 'Tàng trữ trái phép chất ma túy', status: 'DINH_CHI', unit: 'Công an Quận Tân Bình', investigatorId: dtv1.id, deadline: daysAgo(15), subjectsCount: 1 },
    { name: 'Vụ lừa đảo nhỏ lẻ - Đã lưu trữ', crime: 'Lừa đảo chiếm đoạt tài sản', status: 'DA_LUU_TRU', unit: 'Công an Quận 1', investigatorId: dtv2.id, deadline: daysAgo(45) },
  ];

  const createdCases: Array<{ id: string; name: string }> = [];
  for (const def of caseDefs) {
    const existing = await prisma.case.findFirst({ where: { name: def.name } });
    if (!existing) {
      const c = await prisma.case.create({
        data: {
          name: def.name, crime: def.crime, status: def.status,
          unit: def.unit, investigatorId: def.investigatorId,
          deadline: def.deadline, subjectsCount: def.subjectsCount ?? 0,
        },
      });
      createdCases.push({ id: c.id, name: c.name });
    } else {
      createdCases.push({ id: existing.id, name: existing.name });
    }
  }
  console.log(`   ✓ ${createdCases.length} vụ án`);

  // ── 9. SUBJECTS: bị can / nạn nhân ───────────────────────────────────────
  console.log('👥 9. Nạp bị can / nạn nhân...');
  const caseRobbery = createdCases.find(c => c.name.includes('Bến Thành'))!;
  const caseDrug    = createdCases.find(c => c.name.includes('đường dây liên tỉnh'))!;
  const caseMurder  = createdCases.find(c => c.name.includes('Võ Thị Sáu'))!;
  const caseTheft1  = createdCases.find(c => c.name.includes('siêu thị Coopmart'))!;

  const subjectDefs = [
    // Bị can vụ cướp Bến Thành
    { caseId: caseRobbery.id, crimeId: crimeRobbery.id, type: 'SUSPECT' as SubjectType, status: 'DETAINED' as SubjectStatus,
      fullName: 'Nguyễn Văn Long', dob: '2000-03-12', gender: 'MALE',
      idNumber: '079200012345', address: '12 Lý Tự Trọng, Q1', phone: '0356001234',
      districtId: distQ1.id, wardId: wardBN.id, nationalityId: nationalityVN.id, occupationId: occLabor.id },
    { caseId: caseRobbery.id, crimeId: crimeRobbery.id, type: 'SUSPECT' as SubjectType, status: 'DETAINED' as SubjectStatus,
      fullName: 'Trần Đình Khải', dob: '1998-07-22', gender: 'MALE',
      idNumber: '079198067890', address: '88 Phạm Ngũ Lão, Q1', phone: '0912345678',
      districtId: distQ1.id, nationalityId: nationalityVN.id, occupationId: occLabor.id },
    // Nạn nhân vụ cướp
    { caseId: caseRobbery.id, crimeId: crimeRobbery.id, type: 'VICTIM' as SubjectType, status: 'INVESTIGATING' as SubjectStatus,
      fullName: 'Phạm Thị Hương', dob: '1995-11-08', gender: 'FEMALE',
      idNumber: '079195098765', address: '5 Đinh Tiên Hoàng, Q1', phone: '0981234567',
      districtId: distQ1.id, nationalityId: nationalityVN.id, occupationId: occLabor.id },

    // Bị can vụ ma túy
    { caseId: caseDrug.id, crimeId: crimeDrug.id, type: 'SUSPECT' as SubjectType, status: 'DETAINED' as SubjectStatus,
      fullName: 'Lê Văn Dũng', dob: '1990-05-30', gender: 'MALE',
      idNumber: '079190043210', address: '45 Võ Thị Sáu, Q3', phone: '0765432100',
      districtId: distQ3.id, wardId: wardVTS.id, nationalityId: nationalityVN.id, occupationId: occLabor.id },
    { caseId: caseDrug.id, crimeId: crimeDrug.id, type: 'SUSPECT' as SubjectType, status: 'WANTED' as SubjectStatus,
      fullName: 'Hoàng Minh Tú', dob: '1985-12-01', gender: 'MALE',
      idNumber: '079185011223', address: 'Không xác định', phone: null,
      nationalityId: nationalityVN.id, occupationId: occLabor.id },

    // Bị can vụ giết người
    { caseId: caseMurder.id, crimeId: crimeMurder.id, type: 'SUSPECT' as SubjectType, status: 'DETAINED' as SubjectStatus,
      fullName: 'Võ Văn Bình', dob: '1975-08-15', gender: 'MALE',
      idNumber: '079175056789', address: '22 Nguyễn Đình Chiểu, Q3', phone: '0908765432',
      districtId: distQ3.id, nationalityId: nationalityVN.id, occupationId: occLabor.id },
    // Nạn nhân vụ giết người
    { caseId: caseMurder.id, crimeId: crimeMurder.id, type: 'VICTIM' as SubjectType, status: 'INVESTIGATING' as SubjectStatus,
      fullName: 'Võ Thị Cẩm Vân', dob: '1978-02-14', gender: 'FEMALE',
      idNumber: '079178034567', address: '22 Nguyễn Đình Chiểu, Q3', phone: null,
      districtId: distQ3.id, nationalityId: nationalityVN.id, occupationId: occLabor.id },

    // Bị can vụ trộm Coopmart
    { caseId: caseTheft1.id, crimeId: crimeTheft.id, type: 'SUSPECT' as SubjectType, status: 'RELEASED' as SubjectStatus,
      fullName: 'Nguyễn Thị Ngọc', dob: '2003-04-20', gender: 'FEMALE',
      idNumber: '079203078901', address: '300 Lý Thường Kiệt, Q10', phone: '0376543210',
      districtId: distQTB.id, nationalityId: nationalityVN.id, occupationId: occStudent.id },
  ];

  let subjectCount = 0;
  for (const s of subjectDefs) {
    const existing = await prisma.subject.findFirst({ where: { idNumber: s.idNumber } });
    if (!existing) {
      await prisma.subject.create({
        data: {
          fullName: s.fullName, dateOfBirth: new Date(s.dob), gender: s.gender,
          idNumber: s.idNumber, address: s.address, phone: s.phone ?? undefined,
          type: s.type, status: s.status,
          caseId: s.caseId, crimeId: s.crimeId,
          districtId: s.districtId, wardId: s.wardId,
          nationalityId: s.nationalityId, occupationId: s.occupationId,
        },
      });
      subjectCount++;
    }
  }
  console.log(`   ✓ ${subjectCount} đối tượng mới`);

  // ── 10. LAWYERS ────────────────────────────────────────────────────────────
  console.log('⚖️  10. Nạp luật sư...');
  const lawyerDefs = [
    { caseId: caseRobbery.id, fullName: 'Luật sư Nguyễn Hoàng Nam', barNumber: 'LS-HCM-2021-001', lawFirm: 'Văn phòng Luật sư Công Lý', phone: '0901111001' },
    { caseId: caseDrug.id,    fullName: 'Luật sư Trần Văn Phước',   barNumber: 'LS-HCM-2019-042', lawFirm: 'VP Luật sư Phước & Cộng sự', phone: '0901111002' },
    { caseId: caseMurder.id,  fullName: 'Luật sư Lê Thị Kim Oanh',  barNumber: 'LS-HCM-2018-077', lawFirm: 'Đoàn Luật sư TP.HCM', phone: '0901111003' },
  ];
  let lawyerCount = 0;
  for (const l of lawyerDefs) {
    const existing = await prisma.lawyer.findFirst({ where: { barNumber: l.barNumber } });
    if (!existing) {
      await prisma.lawyer.create({ data: l });
      lawyerCount++;
    }
  }
  console.log(`   ✓ ${lawyerCount} luật sư mới`);

  // ── 11. PETITIONS: 10 đơn thư ─────────────────────────────────────────────
  console.log('📄 11. Nạp đơn thư...');
  const petitionDefs = [
    { stt: 'DT-2026-001', senderName: 'Nguyễn Văn An', unit: 'Công an Quận 1',
      summary: 'Tố cáo hàng xóm chiếm đất trái phép', status: 'MOI_TIEP_NHAN' as const,
      receivedDate: daysAgo(5), deadline: daysFromNow(25) },
    { stt: 'DT-2026-002', senderName: 'Trần Thị Bích', unit: 'Công an Quận 3',
      summary: 'Khiếu nại quyết định xử phạt hành chính', status: 'DANG_XU_LY' as const,
      receivedDate: daysAgo(10), deadline: daysFromNow(20) },
    { stt: 'DT-2026-003', senderName: 'Lê Văn Cường', unit: 'Công an Quận 5',
      summary: 'Tố cáo lừa đảo hợp đồng kinh tế', status: 'DANG_XU_LY' as const,
      receivedDate: daysAgo(15), deadline: daysFromNow(15) },
    { stt: 'DT-2026-004', senderName: 'Phạm Thị Dung', unit: 'Công an Quận 7',
      summary: 'Khiếu nại bị trộm tài sản chưa giải quyết', status: 'CHO_PHE_DUYET' as const,
      receivedDate: daysAgo(20), deadline: daysFromNow(10) },
    { stt: 'DT-2026-005', senderName: 'Hoàng Văn Em', unit: 'Công an Quận 10',
      summary: 'Tố cáo buôn bán hàng giả', status: 'DA_GIAI_QUYET' as const,
      receivedDate: daysAgo(45), deadline: daysAgo(5) },
    { stt: 'DT-2026-006', senderName: 'Vũ Thị Fang', unit: 'Công an Quận Tân Bình',
      summary: 'Khiếu nại về tiếng ồn gây ô nhiễm môi trường', status: 'MOI_TIEP_NHAN' as const,
      receivedDate: daysAgo(2), deadline: daysFromNow(28) },
    { stt: 'DT-2026-007', senderName: 'Đặng Minh Giang', unit: 'Công an Quận Bình Thạnh',
      summary: 'Tố cáo cán bộ nhận hối lộ', status: 'DA_CHUYEN_VU_AN' as const,
      receivedDate: daysAgo(60), deadline: daysAgo(20) },
    { stt: 'DT-2026-008', senderName: 'Bùi Thị Hoa', unit: 'Công an Huyện Củ Chi',
      summary: 'Khiếu nại tranh chấp đất đai', status: 'DANG_XU_LY' as const,
      receivedDate: daysAgo(8), deadline: daysFromNow(22) },
    { stt: 'DT-2026-009', senderName: 'Ngô Văn Ích', unit: 'Công an Quận Phú Nhuận',
      summary: 'Tố cáo bạo lực gia đình', status: 'DA_CHUYEN_VU_VIEC' as const,
      receivedDate: daysAgo(30), deadline: daysAgo(10) },
    { stt: 'DT-2026-010', senderName: 'Đinh Thị Kim', unit: 'Công an Huyện Hóc Môn',
      summary: 'Tố cáo tình trạng cho vay nặng lãi', status: 'MOI_TIEP_NHAN' as const,
      receivedDate: daysAgo(1), deadline: daysFromNow(29) },
  ];

  let petitionCount = 0;
  for (const p of petitionDefs) {
    const existing = await prisma.petition.findFirst({ where: { stt: p.stt } });
    if (!existing) {
      await prisma.petition.create({
        data: {
          stt: p.stt, senderName: p.senderName, unit: p.unit,
          summary: p.summary, status: p.status as any,
          receivedDate: p.receivedDate, deadline: p.deadline,
          petitionType: 'KHIEU_NAI' as any,
          enteredById: dtv1.id, assignedToId: dtv1.id,
        },
      });
      petitionCount++;
    }
  }
  console.log(`   ✓ ${petitionCount} đơn thư mới`);

  // ── 12. INCIDENTS: 10 vụ việc ────────────────────────────────────────────
  console.log('🚨 12. Nạp vụ việc...');
  const incidentDefs = [
    { code: 'VV-2026-001', name: 'Vụ việc trộm cắp xe máy khu dân cư Bình Thạnh', incidentType: 'Trộm cắp tài sản', unitId: 'Công an Quận Bình Thạnh', status: 'TIEP_NHAN' as const, deadline: daysFromNow(20), investigatorId: dtv1.id },
    { code: 'VV-2026-002', name: 'Vụ việc mâu thuẫn tranh chấp đất đai Củ Chi', incidentType: 'Tranh chấp dân sự', unitId: 'Công an Huyện Củ Chi', status: 'DANG_XAC_MINH' as const, deadline: daysFromNow(30), investigatorId: dtv2.id },
    { code: 'VV-2026-003', name: 'Vụ việc đánh nhau tại quán bar đường Bùi Viện', incidentType: 'Gây rối trật tự công cộng', unitId: 'Công an Quận 1', status: 'DA_GIAI_QUYET' as const, deadline: daysAgo(10), investigatorId: dtv3.id },
    { code: 'VV-2026-004', name: 'Vụ việc trẻ em bị nghi ngờ bạo hành', incidentType: 'Bạo lực gia đình', unitId: 'Công an Quận Tân Bình', status: 'DANG_XAC_MINH' as const, deadline: daysFromNow(15), investigatorId: dtv4.id },
    { code: 'VV-2026-005', name: 'Vụ việc cháy nhà dân nghi do chập điện', incidentType: 'Cháy nổ', unitId: 'Công an Quận 10', status: 'DA_CHUYEN_VU_AN' as const, deadline: daysAgo(5), investigatorId: dtv5.id },
    { code: 'VV-2026-006', name: 'Vụ việc phát hiện tàng trữ vũ khí trái phép', incidentType: 'Tàng trữ vũ khí', unitId: 'Công an Quận 12', status: 'TIEP_NHAN' as const, deadline: daysFromNow(10), investigatorId: dtv1.id },
    { code: 'VV-2026-007', name: 'Vụ việc lừa đảo qua điện thoại người cao tuổi', incidentType: 'Lừa đảo', unitId: 'Công an Quận Phú Nhuận', status: 'DANG_XAC_MINH' as const, deadline: daysFromNow(25), investigatorId: dtv2.id },
    { code: 'VV-2026-008', name: 'Vụ việc tụ tập đua xe trái phép Hóc Môn', incidentType: 'Vi phạm giao thông', unitId: 'Công an Huyện Hóc Môn', status: 'TAM_DINH_CHI' as const, deadline: daysAgo(15), investigatorId: dtv3.id },
    { code: 'VV-2026-009', name: 'Vụ việc mua bán chất kích thích online', incidentType: 'Ma túy', unitId: 'Công an Quận 5', status: 'TIEP_NHAN' as const, deadline: daysFromNow(12), investigatorId: dtv4.id },
    { code: 'VV-2026-010', name: 'Vụ việc quán nhậu gây ô nhiễm tiếng ồn', incidentType: 'Vi phạm môi trường', unitId: 'Công an Quận 3', status: 'QUA_HAN' as const, deadline: daysAgo(8), investigatorId: dtv5.id },
  ];

  let incidentCount = 0;
  for (const inc of incidentDefs) {
    const existing = await prisma.incident.findFirst({ where: { code: inc.code } });
    if (!existing) {
      await prisma.incident.create({
        data: {
          code: inc.code, name: inc.name,
          incidentType: inc.incidentType, unitId: inc.unitId,
          status: inc.status as any,
          deadline: inc.deadline, investigatorId: inc.investigatorId,
          fromDate: daysAgo(30), toDate: daysAgo(1),
        },
      });
      incidentCount++;
    }
  }
  console.log(`   ✓ ${incidentCount} vụ việc mới`);

  // ── 13. PROPOSALS: đề xuất khởi tố ────────────────────────────────────────
  console.log('📝 13. Nạp đề xuất khởi tố...');
  const caseFraud = createdCases.find(c => c.name.includes('đường dây liên tỉnh'))!;
  const proposalDefs = [
    { proposalNumber: 'DX-2026-001', relatedCaseId: caseRobbery.id, caseType: 'Vụ án', content: 'Đề xuất khởi tố vụ án cướp giật tại Bến Thành', unit: 'Công an Quận 1', status: 'DA_GUI' as const, createdById: dtv1.id, sentDate: daysAgo(3) },
    { proposalNumber: 'DX-2026-002', relatedCaseId: caseFraud.id, caseType: 'Vụ án', content: 'Đề xuất khởi tố vụ án ma túy đường dây liên tỉnh', unit: 'Công an TP. HCM', status: 'CO_PHAN_HOI' as const, createdById: dtv1.id, sentDate: daysAgo(10), response: 'Chấp thuận, chuyển hồ sơ lên Viện KSND', responseDate: daysAgo(2) },
    { proposalNumber: 'DX-2026-003', relatedCaseId: caseMurder.id, caseType: 'Vụ án', content: 'Đề xuất khởi tố bị can Võ Văn Bình về tội giết người', unit: 'Công an Quận 3', status: 'CHO_GUI' as const, createdById: dtv5.id },
  ];
  let propCount = 0;
  for (const p of proposalDefs) {
    const existing = await prisma.proposal.findFirst({ where: { proposalNumber: p.proposalNumber } });
    if (!existing) {
      await prisma.proposal.create({ data: p as any });
      propCount++;
    }
  }
  console.log(`   ✓ ${propCount} đề xuất`);

  // ── 14. DELEGATIONS: ủy thác điều tra ────────────────────────────────────
  console.log('📋 14. Nạp ủy thác điều tra...');
  const delegationDefs = [
    { delegationNumber: 'UT-001/2026', receivingUnit: 'Công an tỉnh Bình Dương', content: 'Ủy thác xác minh nhân thân bị can Lê Văn Dũng', relatedCaseId: caseFraud.id, status: 'RECEIVED' as const, createdById: dtv1.id, delegationDate: daysAgo(5) },
    { delegationNumber: 'UT-002/2026', receivingUnit: 'Công an tỉnh Long An', content: 'Ủy thác xác minh nơi ở bị can Hoàng Minh Tú', relatedCaseId: caseFraud.id, status: 'PENDING' as const, createdById: dtv1.id, delegationDate: daysAgo(2) },
    { delegationNumber: 'UT-003/2026', receivingUnit: 'Công an Quận 7', content: 'Ủy thác lấy lời khai nhân chứng vụ án cướp', relatedCaseId: caseRobbery.id, status: 'COMPLETED' as const, createdById: dtv1.id, delegationDate: daysAgo(15), completedDate: daysAgo(3) },
  ];
  let delegCount = 0;
  for (const d of delegationDefs) {
    const existing = await prisma.delegation.findFirst({ where: { delegationNumber: d.delegationNumber } });
    if (!existing) {
      await prisma.delegation.create({ data: d as any });
      delegCount++;
    }
  }
  console.log(`   ✓ ${delegCount} ủy thác`);

  // ── 15. CONCLUSIONS: kết luận vụ án ──────────────────────────────────────
  console.log('📑 15. Nạp kết luận...');
  const concDefs = [
    { caseId: caseTheft1.id, type: 'Kết luận chính thức', content: 'Bị can Nguyễn Thị Ngọc đã thực hiện hành vi trộm cắp tài sản. Đề nghị truy tố theo khoản 1 Điều 173 BLHS.', authorId: dtv5.id, status: 'DA_DUYET' as const },
    { caseId: caseRobbery.id, type: 'Kết luận sơ bộ', content: 'Xác định có dấu hiệu tội phạm. Tiếp tục điều tra làm rõ vai trò đồng phạm.', authorId: dtv1.id, status: 'CHO_DUYET' as const },
  ];
  let concCount = 0;
  for (const c of concDefs) {
    const existing = await prisma.conclusion.findFirst({ where: { caseId: c.caseId, type: c.type } });
    if (!existing) {
      await prisma.conclusion.create({ data: c as any });
      concCount++;
    }
  }
  console.log(`   ✓ ${concCount} kết luận`);

  // ── Tổng kết ──────────────────────────────────────────────────────────────
  console.log('\n✅ Hoàn tất nạp dữ liệu mẫu!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Tài khoản điều tra viên (password: $SEED_OFFICER_PASSWORD):');
  console.log('  dtv01@pc02.catp.gov.vn  (Nguyễn Văn Thành)');
  console.log('  dtv02@pc02.catp.gov.vn  (Trần Thị Mai)');
  console.log('  dtv03@pc02.catp.gov.vn  (Lê Minh Tuấn)');
  console.log('  dtv04@pc02.catp.gov.vn  (Phạm Văn Hùng)');
  console.log('  dtv05@pc02.catp.gov.vn  (Hoàng Thị Lan)');
  console.log('Admin: admin@pc02.local (password: $SEED_ADMIN_PASSWORD)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
