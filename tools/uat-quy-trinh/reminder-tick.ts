/**
 * Drives `ProcessingReminderService.tick(now)` with chosen instants against a LOCAL database, for the UAT of the
 * reminders (decision C12). The application runs the tick every 15 minutes at the real clock and offers no route to
 * choose the instant, so this wires the service by hand, the way the CLI
 * `backend/src/processing-flow/cli/apply-flows-to-open-records.ts` wires its services: no HTTP server, no schedulers.
 *
 * Use (cwd = backend, DATABASE_URL set explicitly):
 *   TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../tools/uat-quy-trinh/reminder-tick.ts <recordId> <iso> [<iso> ...]
 * Prints one JSON line per instant: `{ now, result }`. Only the given record is planned (`onlyRecordIds`).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { join } from 'node:path';

const BACKEND = join(__dirname, '../../backend');
const src = (file: string) => require(join(BACKEND, 'src', file));

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) throw new Error('REFUSED: DATABASE_URL must be a local database');
  const [recordId, ...instants] = process.argv.slice(2);
  if (!recordId || instants.length === 0) throw new Error('usage: reminder-tick.ts <recordId> <iso> [<iso> ...]');

  const { PrismaClient } = require(join(BACKEND, 'node_modules/@prisma/client'));
  const { PrismaPg } = require(join(BACKEND, 'node_modules/@prisma/adapter-pg'));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const prisma = db as never;
    const { AuditService } = src('audit/audit.service');
    const { FeatureFlagsService } = src('feature-flags/feature-flags.service');
    const { TeamsService } = src('teams/teams.service');
    const { UnitScopeService } = src('auth/services/unit-scope.service');
    const { RecordGateway } = src('processing-flow/gateway/record-gateway');
    const { PetitionAdapter } = src('processing-flow/gateway/petition.adapter');
    const { IncidentAdapter } = src('processing-flow/gateway/incident.adapter');
    const { CaseAdapter } = src('processing-flow/gateway/case.adapter');
    const { NotificationEventService } = src('notifications/notification-event.service');
    const { RecipientResolverService } = src('notifications/recipient-resolver.service');
    const { ProcessingReminderService } = src('processing-flow/reminders/processing-reminder.service');

    const audit = new AuditService(prisma);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    // No open screens in this process: the bell has nobody to ring.
    const notifications = new NotificationEventService(prisma, { notifyUser: () => undefined } as never, new RecipientResolverService(prisma));
    const reminders = new ProcessingReminderService(prisma, new FeatureFlagsService(prisma), gateway, notifications);
    reminders.onlyRecordIds = [recordId];
    for (const iso of instants) {
      const now = new Date(iso);
      if (Number.isNaN(now.getTime())) throw new Error(`not an instant: ${iso}`);
      const result = await reminders.tick(now);
      console.log(`TICK ${JSON.stringify({ now: now.toISOString(), result })}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(`TICK-FAILED ${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
