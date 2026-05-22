/**
 * Seed test Cán bộ Phường (CAP) user — DEV/LOCAL ONLY (v0.35a).
 *
 * Creates user `phuongbn` + UserTeam → Team "P-BN" (Phường Bến Nghé) for
 * end-to-end testing of per-ward scoping flow. Links existing Team P-BN
 * (from seed-teams.ts) to Directory(WARD) via exact officialCode=27298 match.
 *
 * Triple-gated in seed.ts:
 *   NODE_ENV !== 'production' AND NODE_ENV !== 'test' AND SEED_TEST_CAP_USER === 'true'
 *
 * Production deploy will NEVER invoke this (per /autoplan UC2 security CRITICAL).
 *
 * Usage:
 *   SEED_TEST_CAP_USER=true SEED_ADMIN_PASSWORD='SeedOnly@2026' npx ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const TEST_PHUONG_BN_USERNAME = 'phuongbn';
const TEST_PHUONG_BN_TEAM_CODE = 'P-BN';
const PHUONG_BN_OFFICIAL_CODE = '27298'; // verified in data/admin-units/v2025-1300.json
const HCM_PROVINCE_CODE = 'HCM';

export async function seedTestCapUser(prisma: PrismaClient): Promise<void> {
  // 1. Find existing Team "P-BN" (seed-teams.ts:73-74)
  const team = await prisma.team.findUnique({
    where: { code: TEST_PHUONG_BN_TEAM_CODE },
  });
  if (!team) {
    console.warn(
      `[seedTestCapUser] Team ${TEST_PHUONG_BN_TEAM_CODE} not found — run seedTeams first. Skip.`,
    );
    return;
  }

  // 2. Find Directory WARD "Bến Nghé" — Phase 3 Codex #4 fix: exact officialCode
  //    + parent province via parentId resolution. NO fuzzy contains query.
  const hcmProvince = await prisma.directory.findFirst({
    where: { type: 'PROVINCE', code: HCM_PROVINCE_CODE, isActive: true },
    select: { id: true },
  });
  if (!hcmProvince) {
    throw new Error(
      `[seedTestCapUser] Province ${HCM_PROVINCE_CODE} not found. Run seedAdminUnits first.`,
    );
  }
  const wardBN = await prisma.directory.findFirst({
    where: {
      type: 'WARD',
      isActive: true,
      officialCode: PHUONG_BN_OFFICIAL_CODE,
      parentId: hcmProvince.id,
    },
  });
  if (!wardBN) {
    throw new Error(
      `[seedTestCapUser] Ward Bến Nghé (officialCode=${PHUONG_BN_OFFICIAL_CODE}, parent=${HCM_PROVINCE_CODE}) not found. ` +
        'Run seedAdminUnits (v2025-1300 dataset) first.',
    );
  }

  // 3. Link Team P-BN với wardId nếu chưa link đúng
  if (team.wardId !== wardBN.id) {
    await prisma.team.update({
      where: { id: team.id },
      data: { wardId: wardBN.id },
    });
  }

  // 4. Find OFFICER role (seed.ts đã tạo)
  const officerRole = await prisma.role.findUnique({ where: { name: 'OFFICER' } });
  if (!officerRole) {
    console.warn('[seedTestCapUser] OFFICER role missing — run main seed first. Skip.');
    return;
  }

  // 5. Create or update user `phuongbn`
  const rawPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!rawPassword || rawPassword.length < 8) {
    console.warn(
      '[seedTestCapUser] SEED_ADMIN_PASSWORD env var missing (min 8 chars) — skip.',
    );
    return;
  }
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const existing = await prisma.user.findUnique({
    where: { username: TEST_PHUONG_BN_USERNAME },
  });
  const user = existing
    ? await prisma.user.update({
        where: { username: TEST_PHUONG_BN_USERNAME },
        data: {
          passwordHash,
          isActive: true,
          roleId: officerRole.id,
          twoFaSetupRequired: false,
        },
      })
    : await prisma.user.create({
        data: {
          username: TEST_PHUONG_BN_USERNAME,
          email: 'phuongbn@pc02.local',
          firstName: 'Cán bộ',
          lastName: 'Phường Bến Nghé',
          passwordHash,
          isActive: true,
          roleId: officerRole.id,
          twoFaSetupRequired: false,
        },
      });

  // 6. UserTeam membership idempotent
  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId: user.id, teamId: team.id } },
    update: {},
    create: { userId: user.id, teamId: team.id, isLeader: false },
  });

  console.log(
    `[seedTestCapUser] User '${TEST_PHUONG_BN_USERNAME}' + Team ${TEST_PHUONG_BN_TEAM_CODE} ↔ Ward ${wardBN.name}`,
  );
}
