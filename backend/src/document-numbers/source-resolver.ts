import type { ResolutionContext } from './types';

const CTX_FIELD_MAP: Record<string, keyof ResolutionContext | 'userId'> = {
  workId: 'workId',
  username: 'username',
  departmentId: 'departmentId',
  id: 'userId',
};

const LOOKUP_TABLE_MAP: Record<string, keyof ResolutionContext> = {
  cases: 'caseId',
  incidents: 'incidentId',
  petitions: 'petitionId',
  directories: 'departmentId',
};

const PRISMA_MODEL_MAP: Record<string, string> = {
  cases: 'case',
  incidents: 'incident',
  petitions: 'petition',
  directories: 'directory',
};

const LOOKUP_FIELD_ALLOWLIST: Record<string, Set<string>> = {
  cases: new Set(['crime', 'caseType', 'name', 'status']),
  incidents: new Set(['incidentType', 'code', 'status']),
  petitions: new Set(['stt', 'status', 'petitionType']),
  directories: new Set(['code', 'name', 'shortName']),
};

export async function resolveSource(
  source: string,
  ctx: ResolutionContext,
  prisma: any,
): Promise<Date | string | number> {
  if (source === 'NOW') {
    return new Date();
  }

  if (source.startsWith('ctx:Login.')) {
    const field = source.slice('ctx:Login.'.length);
    if (!(field in CTX_FIELD_MAP)) {
      throw new Error(`Unknown ctx:Login field: ${field}`);
    }
    const ctxKey = CTX_FIELD_MAP[field] as keyof ResolutionContext;
    return (ctx[ctxKey] as string | undefined) ?? '';
  }

  if (source.startsWith('lookup:')) {
    const rest = source.slice('lookup:'.length); // "cases.crime"
    const dotIdx = rest.indexOf('.');
    const tableName = rest.slice(0, dotIdx);
    const fieldName = rest.slice(dotIdx + 1);

    if (!(tableName in LOOKUP_TABLE_MAP)) {
      throw new Error(`Unknown lookup table: ${tableName}`);
    }
    if (!LOOKUP_FIELD_ALLOWLIST[tableName]?.has(fieldName)) {
      throw new Error(`Field "${fieldName}" is not allowed for lookup table "${tableName}"`);
    }

    const ctxKey = LOOKUP_TABLE_MAP[tableName];
    const entityId = ctx[ctxKey] as string | undefined;
    if (!entityId) return '';

    const modelName = PRISMA_MODEL_MAP[tableName];
    const record = await prisma[modelName].findUnique({
      where: { id: entityId },
      select: { [fieldName]: true },
    });

    if (!record) return '';
    return (record[fieldName] as string | number | null | undefined) ?? '';
  }

  if (source.startsWith('setting:')) {
    const key = source.slice('setting:'.length);
    const record = await prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return record?.value ?? '';
  }

  throw new Error(`Unknown source type: ${source}`);
}
