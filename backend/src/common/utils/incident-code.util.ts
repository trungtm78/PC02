import { PrismaClient, Prisma } from '@prisma/client';

export async function generateIncidentCode(
  tx: PrismaClient | Prisma.TransactionClient,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VV-${year}-`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await tx.incident.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let seq = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-')[2] ?? '0', 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    const candidate = `${prefix}${String(seq).padStart(5, '0')}`;

    const conflict = await tx.incident.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!conflict) return candidate;
  }

  throw new Error('generateIncidentCode: failed after 3 retries');
}
