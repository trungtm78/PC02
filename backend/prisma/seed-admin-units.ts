/**
 * Seed admin units (Tỉnh/Phường) using snapshot pattern (v0.34.0.0).
 *
 * Reads signed dataset from backend/data/admin-units/{version}.json with
 * SHA256 checksum verification. Idempotent: skips if version already ACTIVE
 * in admin_unit_dataset_imports ledger.
 *
 * Snapshot pattern: UPDATE existing Directory rows in place; mark abolished
 * rows isActive=false (existing query sites stay correct without retrofit).
 *
 * Used by: prisma/seed.ts (deploy-time automatic invoke)
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import * as path from 'path';
import { verifyChecksum } from './lib/checksum';

const CURRENT_VERSION = 'v2024-1279';
const DATASET_DIR = path.join(__dirname, '..', 'data', 'admin-units');

interface DatasetProvince {
  code: string;
  name: string;
  officialCode: string | null;
}

interface DatasetWard {
  code: string;
  name: string;
  type: string;
  provinceCode: string;
  officialCode: string | null;
}

interface Dataset {
  version: string;
  legalBasis: string;
  effectiveFrom: string;
  downloadedAt: string;
  sourceUrl: string;
  sourceNote: string;
  provinces: DatasetProvince[];
  wards: DatasetWard[];
}

export interface SeedResult {
  version: string;
  skipped: boolean;
  addedProvinces: number;
  addedWards: number;
  updatedWards: number;
  abolishedWards: number;
}

/**
 * Load dataset file + verify checksum. Throws on any I/O or checksum error.
 */
function loadDataset(version: string): Dataset {
  const jsonPath = path.join(DATASET_DIR, `${version}.json`);
  const shaPath = path.join(DATASET_DIR, `${version}.sha256`);
  verifyChecksum(jsonPath, shaPath);
  return JSON.parse(readFileSync(jsonPath, 'utf8')) as Dataset;
}

/**
 * Atomic snapshot import. Returns counts.
 */
export async function seedAdminUnits(
  prisma: PrismaClient,
  version: string = CURRENT_VERSION,
): Promise<SeedResult> {
  const dataset = loadDataset(version);

  // Idempotency check — read ledger
  const existing = await prisma.adminUnitDatasetImport.findUnique({
    where: { version: dataset.version },
    select: { status: true },
  });
  if (existing?.status === 'ACTIVE') {
    console.log(`[seedAdminUnits] Dataset ${dataset.version} already ACTIVE — skip`);
    return {
      version: dataset.version,
      skipped: true,
      addedProvinces: 0,
      addedWards: 0,
      updatedWards: 0,
      abolishedWards: 0,
    };
  }

  console.log(
    `[seedAdminUnits] Importing ${dataset.version} (${dataset.provinces.length} provinces, ${dataset.wards.length} wards)...`,
  );

  // Compute checksum once (used in ledger row)
  const checksum = readFileSync(path.join(DATASET_DIR, `${dataset.version}.sha256`), 'utf8')
    .trim()
    .split(/\s+/)[0];

  // /codex post-impl fix #2: Create IMPORTING ledger row OUTSIDE main transaction
  // so it survives rollback and operators see FAILED status after a crash.
  // upsert is safe: re-running after FAILED resets to IMPORTING.
  await prisma.adminUnitDatasetImport.upsert({
    where: { version: dataset.version },
    update: {
      status: 'IMPORTING',
      checksum,
      errorMessage: null,
      completedAt: null,
      addedProvinces: 0,
      addedWards: 0,
      updatedWards: 0,
      abolishedWards: 0,
    },
    create: {
      version: dataset.version,
      status: 'IMPORTING',
      checksum,
    },
  });

  // Atomic transaction — entire import succeeds or rolls back
  let result: SeedResult;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        // /codex post-impl fix #3: PG advisory lock to serialize concurrent imports.
        // Hash of class name "admin_unit_dataset_imports" → stable int.
        // Two parallel deploys hitting this seed → second blocks until first commits.
        // pattern reference: backend/src/deadline-rules/deadline-rules.service.ts:43
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(917530182)`);

        // 1. Mark previous ACTIVE → SUPERSEDED (max 1 row per partial unique index)
        // Skip if current dataset is the one being promoted (no self-supersede).
        await tx.adminUnitDatasetImport.updateMany({
          where: { status: 'ACTIVE', NOT: { version: dataset.version } },
          data: { status: 'SUPERSEDED' },
        });

        // 3. Upsert provinces (snapshot: UPDATE in place by (type, code))
        let addedProvinces = 0;
        for (const p of dataset.provinces) {
          const existing = await tx.directory.findUnique({
            where: { type_code: { type: 'PROVINCE', code: p.code } },
            select: { id: true },
          });
          if (existing) {
            await tx.directory.update({
              where: { id: existing.id },
              data: {
                name: p.name,
                officialCode: p.officialCode,
                sourceVersion: dataset.version,
                legalBasis: dataset.legalBasis,
                importedAt: new Date(),
                isActive: true,
                abolishedAt: null,
              },
            });
          } else {
            await tx.directory.create({
              data: {
                type: 'PROVINCE',
                code: p.code,
                name: p.name,
                officialCode: p.officialCode,
                sourceVersion: dataset.version,
                legalBasis: dataset.legalBasis,
                importedAt: new Date(),
                isActive: true,
              },
            });
            addedProvinces++;
          }
        }

        // 4. Build province code → DB id map for ward parentId
        const provinceRows = await tx.directory.findMany({
          where: { type: 'PROVINCE' },
          select: { id: true, code: true },
        });
        const provinceIdByCode = new Map(provinceRows.map((r) => [r.code, r.id]));

        // 5. Upsert wards
        let addedWards = 0;
        let updatedWards = 0;
        const datasetWardCodes = new Set<string>();
        for (const w of dataset.wards) {
          datasetWardCodes.add(w.code);
          const parentId = provinceIdByCode.get(w.provinceCode);
          if (!parentId) {
            // skip orphan (province not in dataset) — should never happen
            continue;
          }
          const existing = await tx.directory.findUnique({
            where: { type_code: { type: 'WARD', code: w.code } },
            select: { id: true },
          });
          if (existing) {
            await tx.directory.update({
              where: { id: existing.id },
              data: {
                name: w.name,
                parentId,
                officialCode: w.officialCode,
                sourceVersion: dataset.version,
                legalBasis: dataset.legalBasis,
                importedAt: new Date(),
                isActive: true,
                abolishedAt: null,
                metadata: { type: w.type, province: dataset.provinces.find((p) => p.code === w.provinceCode)?.name },
              },
            });
            updatedWards++;
          } else {
            await tx.directory.create({
              data: {
                type: 'WARD',
                code: w.code,
                name: w.name,
                parentId,
                officialCode: w.officialCode,
                sourceVersion: dataset.version,
                legalBasis: dataset.legalBasis,
                importedAt: new Date(),
                isActive: true,
                metadata: { type: w.type, province: dataset.provinces.find((p) => p.code === w.provinceCode)?.name },
              },
            });
            addedWards++;
          }
        }

        // 6. Detect abolished — DB rows active nhưng dataset không có
        const allDbWards = await tx.directory.findMany({
          where: { type: 'WARD', isActive: true },
          select: { id: true, code: true },
        });
        const toAbolish = allDbWards.filter((w) => !datasetWardCodes.has(w.code));
        let abolishedWards = 0;
        if (toAbolish.length > 0) {
          await tx.directory.updateMany({
            where: { id: { in: toAbolish.map((w) => w.id) } },
            data: { isActive: false, abolishedAt: new Date() },
          });
          abolishedWards = toAbolish.length;
        }

        // 7. Finalize ledger
        await tx.adminUnitDatasetImport.update({
          where: { version: dataset.version },
          data: {
            status: 'ACTIVE',
            completedAt: new Date(),
            addedProvinces,
            addedWards,
            updatedWards,
            abolishedWards,
          },
        });

        return {
          version: dataset.version,
          skipped: false,
          addedProvinces,
          addedWards,
          updatedWards,
          abolishedWards,
        };
      },
      { timeout: 120_000 }, // 10k upserts can take ~30-60s
    );
  } catch (err: any) {
    // Mark ledger FAILED so operator knows. Row exists from outer upsert
    // (fix #2), so this update always finds it. Use upsert as belt-and-suspenders.
    await prisma.adminUnitDatasetImport
      .upsert({
        where: { version: dataset.version },
        update: {
          status: 'FAILED',
          errorMessage: String(err?.message ?? err).slice(0, 1000),
          completedAt: new Date(),
        },
        create: {
          version: dataset.version,
          status: 'FAILED',
          checksum,
          errorMessage: String(err?.message ?? err).slice(0, 1000),
        },
      })
      .catch((markErr) => {
        // Last-resort log — operator must investigate via deploy log if this swallows
        console.error('[seedAdminUnits] Failed to mark ledger FAILED:', markErr);
      });
    throw err;
  }

  console.log(
    `[seedAdminUnits] ${dataset.version} imported: ` +
      `+${result.addedProvinces} provinces, +${result.addedWards} wards, ` +
      `~${result.updatedWards} updated, -${result.abolishedWards} abolished`,
  );
  return result;
}
