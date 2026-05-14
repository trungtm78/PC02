/**
 * Standalone runner cho seedVnEvents — invokable via:
 *   DATABASE_URL=... npx ts-node prisma/seed-vn-events-runner.ts
 *   hoặc: npm run db:seed:events
 *
 * Tách runner riêng để có thể chạy trên prod mà không cần SEED_ADMIN_PASSWORD
 * (main `db:seed` script gate ở admin user step — block toàn bộ seeds sau đó).
 *
 * Pattern theo seed-event-categories-runner.ts.
 *
 * Idempotent: seedVnEvents upsert by deterministic ID `evt_*`. Re-run an toàn.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedVnEvents } from './seed-vn-events';

const adapter = new PrismaPg({
  connectionString:
    process.env['DATABASE_URL'] ??
    'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    // Resolve admin user ID for createdById FK.
    // Falls back to any ADMIN role user if admin@pc02.local doesn't exist
    // (e.g., dev seeds with different admin email).
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@pc02.local' },
          { role: { name: 'ADMIN' } },
        ],
      },
      select: { id: true, email: true },
    });

    if (!adminUser) {
      console.error(
        '\nERROR: No ADMIN user found. Run main `npm run db:seed` first to create the admin user.\n',
      );
      process.exit(1);
    }

    console.log(`Using createdBy = ${adminUser.email} (${adminUser.id})`);
    const { created, updated } = await seedVnEvents(prisma, adminUser.id);
    console.log(
      `✓ Seeded VN events: ${created} created, ${updated} updated (idempotent).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed VN events failed:', err);
  process.exit(1);
});
