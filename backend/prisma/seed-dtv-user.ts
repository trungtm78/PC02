/**
 * Seed: Add dtv@pc02.catp.gov.vn test user for E2E tests
 * TASK-2026-260202
 * Run: npx ts-node prisma/seed-dtv-user.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Ensure OFFICER role exists
  const officerRole = await prisma.role.upsert({
    where: { name: 'OFFICER' },
    update: {},
    create: {
      name: 'OFFICER',
      description: 'Case officer - read/write own cases',
    },
  });
  console.log('Officer role:', officerRole.name);

  // Create dtv test user — password MUST come from env (never hardcoded)
  const rawPassword = process.env.SEED_DTV_PASSWORD;
  if (!rawPassword || rawPassword.length < 8) {
    console.error('\nERROR: SEED_DTV_PASSWORD env var required (min 8 chars).');
    console.error('Set it in backend/.env or shell before running this seed.\n');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(rawPassword, 12);
  const dtvUser = await prisma.user.upsert({
    where: { email: 'dtv@pc02.catp.gov.vn' },
    update: { passwordHash, isActive: true },
    create: {
      email: 'dtv@pc02.catp.gov.vn',
      username: 'dtv_officer',
      passwordHash,
      firstName: 'Điều Tra',
      lastName: 'Viên',
      workId: 'PC02-DTV-001',
      roleId: officerRole.id,
      isActive: true,
    },
  });
  console.log('DTV user created/updated:', dtvUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
