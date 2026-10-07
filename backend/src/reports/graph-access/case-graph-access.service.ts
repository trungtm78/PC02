import { ForbiddenException, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { CaseFieldSchemaService } from '../../cases/governance/case-field-schema.service';
import { CaseChildAccessService } from '../../case-child-access/case-child-access.service';

export interface GraphActor {
  actorId: string;
  purpose: 'read' | 'export';
  query: Record<string, unknown>;
  seen: Set<string>;
  inputs: Set<string>;
  required?: string[];
}
export const graphActor = new AsyncLocalStorage<GraphActor>();
export function withCaseGraphInputs<T>(keys: string[], handler: () => T): T {
  const actor = graphActor.getStore();
  return actor
    ? graphActor.run({ ...actor, required: keys }, handler)
    : handler();
}
export const GRAPH_PRISMA = 'CASE_GRAPH_PRISMA';
export const RAW_GRAPH_PRISMA = Symbol('RAW_GRAPH_PRISMA');
type Args = Record<string, unknown>;
type Delegate = Record<string, (args: Args) => Promise<unknown>>;
const readOperations = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);
const operators = new Set([
  'AND',
  'OR',
  'NOT',
  'is',
  'isNot',
  'some',
  'every',
  'none',
  'in',
  'notIn',
  'equals',
  'contains',
  'startsWith',
  'endsWith',
  'mode',
  'gte',
  'gt',
  'lte',
  'lt',
  'not',
  '_count',
  '_sum',
  '_avg',
  '_min',
  '_max',
]);

@Injectable()
export class CaseGraphAccessService {
  readonly core: CaseGovernanceService;
  readonly fields: CaseFieldSchemaService;
  readonly child: CaseChildAccessService;
  constructor(private readonly prisma: PrismaService) {
    this.prisma =
      (Reflect.get(prisma, RAW_GRAPH_PRISMA) as unknown as
        | PrismaService
        | undefined) ?? prisma;
    prisma = this.prisma;
    this.core = new CaseGovernanceService(prisma);
    this.fields = new CaseFieldSchemaService(prisma, this.core);
    this.child = new CaseChildAccessService(prisma, this.core);
  }
  current() {
    const actor = graphActor.getStore();
    if (!actor?.actorId)
      throw new ForbiddenException('Authenticated graph actor required');
    return actor;
  }
  run<T>(
    actorId: string,
    handler: () => T,
    purpose: 'read' | 'export' = 'read',
    query: Args = {},
  ) {
    if (!actorId)
      throw new ForbiddenException('Authenticated graph actor required');
    return graphActor.run(
      { actorId, purpose, query, seen: new Set(), inputs: new Set() },
      handler,
    );
  }
  private keys(
    value: unknown,
    prefix = '',
    result = new Set<string>(),
  ): Set<string> {
    if (Array.isArray(value)) {
      for (const child of value) this.keys(child, prefix, result);
    } else if (value && typeof value === 'object' && !(value instanceof Date))
      for (const [key, child] of Object.entries(value)) {
        if (!operators.has(key)) {
          result.add(key);
          if (prefix) result.add(prefix + '.' + key);
        }
        this.keys(
          child,
          operators.has(key) ? prefix : prefix ? prefix + '.' + key : key,
          result,
        );
      }
    return result;
  }
  async where(args: Args = {}, extraKeys: string[] = []) {
    const actor = this.current();
    if (actor.purpose === 'export')
      await this.core.assertGeneralExport(this.prisma, {
        actorId: actor.actorId,
      });
    if (
      !(await this.core.hasEntityPermission(
        this.prisma,
        actor.actorId,
        'Case',
        'read',
      ))
    )
      return { id: { in: [] } };
    const keys = new Set([
      ...extraKeys,
      ...(actor.required ?? []),
      ...this.keys(args.where),
      ...this.keys(args.orderBy),
      ...this.keys(args.select),
      ...this.keys(args._sum),
      ...this.keys(args._avg),
      ...(Array.isArray(args.by)
        ? args.by.filter((v): v is string => typeof v === 'string')
        : []),
    ]);
    keys.forEach((key) => actor.inputs.add(key));
    const visible = await this.fields.readableNativeWhere(
      this.prisma,
      { actorId: actor.actorId },
      [...keys],
    );
    const search = await this.fields.policyAwareSearchWhere(
      this.prisma,
      { actorId: actor.actorId },
      actor.query,
      visible,
      true,
    );
    const where = {
      AND: [args.where ?? {}, visible, ...(search ? [search] : [])],
    };
    if (actor.purpose === 'export')
      await this.fields.assertQueryReadable(
        this.prisma,
        { actorId: actor.actorId },
        { cot: [...keys].join(',') },
        'export',
        where,
      );
    return where;
  }
  async ids(keys: string[] = []) {
    const where = await this.where({}, keys);
    return (
      await this.prisma.case.findMany({ where, select: { id: true } })
    ).map((row) => row.id);
  }
  async snapshotAllowed(snapshot: unknown): Promise<boolean> {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const provenance = (
      snapshot as { _caseGovernance?: { ids?: unknown; keys?: unknown } }
    )._caseGovernance;
    if (
      !provenance ||
      !Array.isArray(provenance.ids) ||
      !Array.isArray(provenance.keys)
    )
      return false;
    const ids = provenance.ids.filter(
      (id): id is string => typeof id === 'string',
    );
    const keys = provenance.keys.filter(
      (key): key is string => typeof key === 'string',
    );
    const where = await this.where({ where: { id: { in: ids } } }, keys);
    return (await this.prisma.case.count({ where })) === ids.length;
  }
  private async cached(row: unknown): Promise<unknown> {
    if (Array.isArray(row))
      return Promise.all(row.map((value) => this.cached(value)));
    if (!row || typeof row !== 'object') return row;
    const record = row as Args;
    let snapshot = record.snapshot ?? record.computedData;
    if (!snapshot && record.summary && typeof record.id === 'string')
      snapshot = (
        await this.prisma.monthlyReportPackage.findUnique({
          where: { id: record.id },
          select: { snapshot: true },
        })
      )?.snapshot;
    if (!snapshot) return row;
    const caseData =
      record.loaiBaoCao === 'VU_AN' ||
      (snapshot &&
        typeof snapshot === 'object' &&
        Array.isArray((snapshot as { appendices?: unknown }).appendices));
    if (!caseData) return row;
    if (await this.snapshotAllowed(snapshot)) {
      const proof = (
        snapshot as { _caseGovernance: { ids: string[]; keys: string[] } }
      )._caseGovernance;
      proof.ids.forEach((id) => this.current().seen.add(id));
      proof.keys.forEach((key) => this.current().inputs.add(key));
      return row;
    }
    if (this.current().purpose === 'export')
      throw new ForbiddenException(
        'Current Case report provenance unavailable',
      );
    const safe: Args = {
      ...record,
      caseAuthorization: 'UNAVAILABLE',
      detailWorkbook: null,
      summaryWorkbook: null,
    };
    if (record.computedData)
      safe.computedData = { caseAuthorization: 'UNAVAILABLE' };
    if (snapshot && typeof snapshot === 'object' && 'appendices' in snapshot) {
      const data = snapshot as { appendices?: Args[] };
      safe.snapshot = {
        ...data,
        appendices: data.appendices?.map((appendix) =>
          ['PL04', 'PL05', 'PL06'].includes(String(appendix.code))
            ? {
                ...appendix,
                rows: [],
                totals: null,
                caseAuthorization: 'UNAVAILABLE',
              }
            : appendix,
        ),
      };
      safe.summary = { caseAuthorization: 'UNAVAILABLE' };
    }
    return safe;
  }
  wrap(client: PrismaService = this.prisma): PrismaService {
    return new Proxy(client, {
      get: (target, key) => {
        if (key === RAW_GRAPH_PRISMA) return target;
        const value = Reflect.get(target, key) as unknown;
        if (key === '$transaction')
          return (
            handler: (tx: PrismaService) => Promise<unknown>,
            options: unknown,
          ) =>
            (
              value as (
                handler: (tx: PrismaService) => Promise<unknown>,
                options: unknown,
              ) => Promise<unknown>
            ).call(
              target,
              (tx: PrismaService) => handler(this.wrap(tx)),
              options,
            ) as Promise<unknown>;
        if (
          !['case', 'monthlyReportPackage', 'reportTdcDraft'].includes(
            String(key),
          )
        )
          return typeof value === 'function'
            ? ((value as (...args: unknown[]) => unknown).bind(
                target,
              ) as unknown)
            : value;
        const delegate = value as Delegate;
        return new Proxy(delegate, {
          get: (db, operation) => {
            const invoke = Reflect.get(db, operation) as (
              args: Args,
            ) => Promise<unknown>;
            return async (args: Args = {}) => {
              const actor = this.current();
              const input = { ...args };
              if (key === 'case' && readOperations.has(String(operation)))
                input.where = await this.where(args);
              let evidenceUnavailable = false;
              if (
                key === 'case' &&
                input.include &&
                typeof input.include === 'object' &&
                'evidences' in input.include &&
                !(await this.core.hasEntityPermission(
                  this.prisma,
                  actor.actorId,
                  'Evidence',
                  'read',
                ))
              ) {
                const include = { ...(input.include as Args) };
                delete include.evidences;
                input.include = include;
                evidenceUnavailable = true;
              }
              if (
                key !== 'case' &&
                ['update', 'delete'].includes(String(operation)) &&
                input.where &&
                typeof input.where === 'object'
              ) {
                const existing = await db.findUnique({ where: input.where });
                const authorized = await this.cached(existing);
                if (
                  authorized &&
                  typeof authorized === 'object' &&
                  'caseAuthorization' in authorized &&
                  authorized.caseAuthorization === 'UNAVAILABLE'
                )
                  throw new ForbiddenException(
                    'Current Case report sources are unavailable for mutation',
                  );
              }
              if (
                key !== 'case' &&
                ['create', 'update'].includes(String(operation)) &&
                input.data &&
                typeof input.data === 'object'
              ) {
                const data = { ...(input.data as Args) };
                for (const field of ['snapshot', 'computedData'])
                  if (data[field] && typeof data[field] === 'object')
                    data[field] = {
                      ...(data[field] as Args),
                      _caseGovernance: {
                        ids: [...actor.seen],
                        keys: [...actor.inputs],
                      },
                    };
                input.data = data;
              }
              const result = (await invoke.call(db, input)) as unknown;
              if (key !== 'case') return this.cached(result);
              if (
                !readOperations.has(String(operation)) ||
                ['count', 'aggregate', 'groupBy'].includes(String(operation))
              )
                return result;
              const serialize = async (row: unknown) => {
                if (
                  !row ||
                  typeof row !== 'object' ||
                  !('id' in row) ||
                  typeof row.id !== 'string'
                )
                  return row;
                actor.seen.add(row.id);
                let result = await this.core.serializeCaseResult(
                  this.prisma,
                  row.id,
                  row,
                  { actorId: actor.actorId },
                );
                result = await this.child.redactCaseLinks(
                  result,
                  actor.actorId,
                );
                if (evidenceUnavailable)
                  result = {
                    ...(result as Args),
                    id: row.id,
                    evidenceAuthorization: 'UNAVAILABLE',
                  } as typeof result;
                if (actor.purpose === 'export') {
                  const parent = await this.core.assertCaseReadable(
                    this.prisma,
                    row.id,
                    { actorId: actor.actorId },
                  );
                  result = await this.fields.filterCustomFields(
                    {
                      ...(result as Args),
                      id: row.id,
                      fieldDefinitionVersionId: parent.fieldDefinitionVersionId,
                    },
                    { actorId: actor.actorId },
                    this.prisma,
                    'export',
                  );
                }
                return result;
              };
              return Array.isArray(result)
                ? Promise.all(result.map(serialize))
                : serialize(result);
            };
          },
        });
      },
    });
  }
}
