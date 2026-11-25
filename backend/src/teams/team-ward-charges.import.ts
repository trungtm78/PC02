import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { boDauTiengViet } from '../common/utils/chuan-hoa-ten.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCompressedSize,
  assertMagicBytes,
  assertNoZipBomb,
  assertWorkbookLimits,
  HostileXlsxError,
  stripImportFormula,
  withParserTimeout,
} from '../xlsx-imports/hostile-xlsx-guard';
import {
  WARD_CHARGE_AUDIT,
  WARD_CHARGE_ERROR,
  WARD_CHARGE_IMPORT_HEADERS,
  WARD_CHARGE_IMPORT_ISSUE as ISSUE,
  WARD_CHARGE_IMPORT_MAX_BYTES,
  WARD_CHARGE_PREVIEW_TTL_MS,
  WARD_CHARGE_PROVINCE_CODE,
} from './team-ward-charges.codes';
import { assertUsableWards, conflictsOf } from './team-ward-charges.service';

type Meta = { ipAddress?: string; userAgent?: string };

/** One finding of a row: a code the screen translates, and what it is about. */
export interface ImportIssue {
  code: string;
  ward?: string;
  teamName?: string;
  expected?: number;
  listed?: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  teamName: string;
  teamId: string | null;
  wards: { name: string; wardId: string | null; wardName: string | null }[];
  count: number | null;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ImportPreview {
  previewToken: string;
  rows: ImportPreviewRow[];
  totals: { rows: number; wards: number; errors: number; warnings: number };
  canConfirm: boolean;
}

/** One row of the file as read, before anything is matched. */
export interface ParsedRow {
  rowNumber: number;
  teamName: string;
  wardNames: string[];
  count: number | null;
}

interface StoredPreview {
  actorId: string;
  expiresAt: number;
  hasErrors: boolean;
  plan: { teamId: string; wardIds: string[] }[];
}

/** The total uncompressed size a 4-column, few-row workbook can reasonably have. */
const MAX_UNCOMPRESSED = 20 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 10_000;

/** Diacritics, case and every space removed: "Tổ công tác Số 4" equals "To cong tac so 4" and "Tổ công tác số  4". */
export const teamKey = (name: string): string => boDauTiengViet(name).replace(/\s+/g, '');

/** Leading and trailing spaces and punctuation, as the real file has them ("Khánh Hội ,", ": Vĩnh Tân", "Vĩnh Hội."). */
const EDGE_PUNCT = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;
const WARD_PREFIX = /^(phuong|xa|dac khu)\s+/;

/** A ward name, without punctuation at its edges, diacritics, case and the "Phường/Xã/Đặc khu" prefix. */
export const wardKey = (name: string): string =>
  boDauTiengViet(name.replace(EDGE_PUNCT, '')).replace(WARD_PREFIX, '').replace(EDGE_PUNCT, '').trim();

/**
 * The same, KEEPING the diacritics: the city has both "Xã Thạnh An" and "Xã Thanh An", which only the accents tell
 * apart. A name is matched on this key first, and diacritic-insensitively only when that finds nothing.
 */
export const wardExactKey = (name: string): string =>
  name
    .normalize('NFC')
    .replace(EDGE_PUNCT, '')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ')
    .replace(/^(phường|xã|đặc khu)\s+/u, '')
    .replace(EDGE_PUNCT, '')
    .trim();

/** The list of column C: names separated by commas (or semicolons, or line breaks), blanks dropped. */
export function splitWardList(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((piece) => piece.replace(EDGE_PUNCT, '').trim())
    .filter((piece) => piece.length > 0);
}

/** The value of a cell as the person sees it: the result of a formula, the text of rich text. */
export function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value as unknown;
  if (v && typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown; formula?: unknown; sharedFormula?: unknown };
    if ('result' in o || 'formula' in o || 'sharedFormula' in o) return o.result ?? null;
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join('');
    if (typeof o.text === 'string') return o.text;
    if (v instanceof Date) return v;
  }
  return v;
}

const textOf = (cell: ExcelJS.Cell): string => {
  const v = stripImportFormula(cellValue(cell));
  return v === null || v === undefined ? '' : String(v).trim();
};

const fileInvalid = (reason: string) => new BadRequestException({ code: WARD_CHARGE_ERROR.IMPORT_FILE_INVALID, details: [{ reason }] });

/**
 * The rows of the template's layout: one sheet, header STT | team | wards | count, then one row per team, and a final
 * "Tổng" row that is not a team. Every hostile-xlsx check runs before ExcelJS touches the bytes.
 */
export async function parseWardChargeWorkbook(buffer: Buffer): Promise<ParsedRow[]> {
  if (!buffer?.length) throw fileInvalid('EMPTY');
  if (buffer.length > WARD_CHARGE_IMPORT_MAX_BYTES) throw fileInvalid('TOO_LARGE');
  try {
    assertCompressedSize(buffer);
    await assertMagicBytes(buffer);
    assertNoZipBomb(buffer, MAX_UNCOMPRESSED);
  } catch (error) {
    if (error instanceof HostileXlsxError) throw fileInvalid(error.code);
    throw error;
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await withParserTimeout(async () => workbook.xlsx.load(buffer as never), PARSE_TIMEOUT_MS);
    assertWorkbookLimits(workbook);
  } catch (error) {
    if (error instanceof HostileXlsxError) throw fileInvalid(error.code);
    throw fileInvalid('UNREADABLE');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw fileInvalid('NO_SHEET');

  const header = sheet.getRow(1);
  const wanted = WARD_CHARGE_IMPORT_HEADERS.map((h) => boDauTiengViet(h));
  const got = [1, 2, 3, 4].map((c) => boDauTiengViet(textOf(header.getCell(c))));
  if (wanted.some((h, i) => got[i] !== h)) throw fileInvalid('HEADER');

  const rows: ParsedRow[] = [];
  const last = Math.min(sheet.rowCount, 2000);
  for (let r = 2; r <= last; r++) {
    const row = sheet.getRow(r);
    const first = textOf(row.getCell(1));
    const teamName = textOf(row.getCell(2));
    // The final "Tổng" row (merged across A:C): a total, not a team.
    if (boDauTiengViet(first) === 'tong' || boDauTiengViet(teamName) === 'tong') continue;
    const wards = textOf(row.getCell(3));
    if (!teamName && !wards) continue;
    const countRaw = cellValue(row.getCell(4));
    const count = typeof countRaw === 'number' ? countRaw : countRaw !== null && countRaw !== undefined && String(countRaw).trim() !== '' && Number.isFinite(Number(countRaw)) ? Number(countRaw) : null;
    rows.push({ rowNumber: r, teamName, wardNames: splitWardList(wards), count });
  }
  if (!rows.length) throw fileInvalid('NO_ROWS');
  return rows;
}

/**
 * Import of the charges from the Excel template: a preview that writes nothing and returns a token, then a confirm
 * that applies the previewed plan in one transaction (checked again there: things may have changed in between).
 */
@Injectable()
export class TeamWardChargesImportService {
  private readonly previews = new Map<string, StoredPreview>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(buffer: Buffer, actorId: string): Promise<ImportPreview> {
    const parsed = await parseWardChargeWorkbook(buffer);

    const teams = await this.prisma.team.findMany({ select: { id: true, name: true, status: true, wardId: true } });
    const teamsByKey = new Map<string, (typeof teams)[number][]>();
    for (const t of teams) teamsByKey.set(teamKey(t.name), [...(teamsByKey.get(teamKey(t.name)) ?? []), t]);

    const wardOf = await this.cityWards();

    // First pass: match every row's team, so a ward charged to a team listed LATER in the file is not an error.
    const matchedTeam = parsed.map((row) => {
      const candidates = teamsByKey.get(teamKey(row.teamName)) ?? [];
      return candidates.length === 1 ? candidates[0] : null;
    });
    const fileTeamIds = new Set(matchedTeam.filter((t): t is NonNullable<typeof t> => !!t).map((t) => t.id));

    const allWardIds = new Set<string>();
    for (const row of parsed) for (const name of row.wardNames) {
      const w = wardOf(name);
      if (w) allWardIds.add(w.id);
    }
    const charges = await this.prisma.teamWardCharge.findMany({
      where: { wardDirectoryId: { in: [...allWardIds] } },
      select: { wardDirectoryId: true, managerTeam: { select: { id: true, name: true } } },
    });
    const chargeOf = new Map(charges.map((c) => [c.wardDirectoryId, c.managerTeam]));

    const seenTeams = new Set<string>();
    const seenWards = new Set<string>();
    const plan: StoredPreview['plan'] = [];
    const rows: ImportPreviewRow[] = parsed.map((row, i) => {
      const errors: ImportIssue[] = [];
      const warnings: ImportIssue[] = [];
      const team = matchedTeam[i];
      if (!team) errors.push({ code: ISSUE.TEAM_NOT_FOUND, teamName: row.teamName });
      else if (team.status !== 'ACTIVE' || team.wardId !== null) errors.push({ code: ISSUE.TEAM_NOT_MANAGER, teamName: team.name });
      else if (seenTeams.has(team.id)) errors.push({ code: ISSUE.TEAM_TWICE, teamName: team.name });
      if (team) seenTeams.add(team.id);

      const wards = row.wardNames.map((name) => {
        const w = wardOf(name);
        if (!w) {
          errors.push({ code: ISSUE.WARD_NOT_FOUND, ward: name });
          return { name, wardId: null, wardName: null };
        }
        if (seenWards.has(w.id)) errors.push({ code: ISSUE.WARD_TWICE, ward: w.name });
        seenWards.add(w.id);
        const holder = chargeOf.get(w.id);
        if (holder && holder.id !== team?.id && !fileTeamIds.has(holder.id)) {
          errors.push({ code: ISSUE.WARD_CHARGED_OUTSIDE_FILE, ward: w.name, teamName: holder.name });
        }
        return { name, wardId: w.id, wardName: w.name };
      });
      if (row.count !== null && row.count !== row.wardNames.length) {
        warnings.push({ code: ISSUE.COUNT_MISMATCH, expected: row.count, listed: row.wardNames.length });
      }
      if (team) plan.push({ teamId: team.id, wardIds: wards.map((w) => w.wardId).filter((id): id is string => !!id) });
      return { rowNumber: row.rowNumber, teamName: row.teamName, teamId: team?.id ?? null, wards, count: row.count, errors, warnings };
    });

    const errorCount = rows.reduce((n, r) => n + r.errors.length, 0);
    const previewToken = randomUUID();
    this.sweep();
    this.previews.set(previewToken, { actorId, expiresAt: Date.now() + WARD_CHARGE_PREVIEW_TTL_MS, hasErrors: errorCount > 0, plan });
    return {
      previewToken,
      rows,
      totals: {
        rows: rows.length,
        wards: rows.reduce((n, r) => n + r.wards.length, 0),
        errors: errorCount,
        warnings: rows.reduce((n, r) => n + r.warnings.length, 0),
      },
      canConfirm: errorCount === 0,
    };
  }

  /**
   * Applies a preview. Every ward of the file goes to the team of its row (moving it from another team OF THE FILE);
   * with `replaceTeamsInFile`, the wards the teams of the file hold and the file does not list are removed, so their
   * sets become exactly the file's. A ward charged meanwhile to a team outside the file refuses the whole import.
   */
  async confirm(previewToken: unknown, replaceTeamsInFile: unknown, actorId: string, meta?: Meta) {
    const stored = typeof previewToken === 'string' ? this.previews.get(previewToken) : undefined;
    if (!stored || stored.actorId !== actorId || stored.expiresAt < Date.now()) {
      throw new NotFoundException({ code: WARD_CHARGE_ERROR.IMPORT_TOKEN_INVALID });
    }
    if (stored.hasErrors) throw new ConflictException({ code: WARD_CHARGE_ERROR.IMPORT_HAS_ERRORS });
    const replace = replaceTeamsInFile === true;
    const teamIds = [...new Set(stored.plan.map((p) => p.teamId))].sort();
    const wardIds = stored.plan.flatMap((p) => p.wardIds);
    const managerOf = new Map(stored.plan.flatMap((p) => p.wardIds.map((w) => [w, p.teamId] as const)));

    let summary: { added: number; moved: number; removed: number };
    try {
      summary = await this.prisma.$transaction(async (tx) => {
        // Locked in id order, so two imports over the same teams cannot deadlock.
        const locked = await tx.$queryRaw<{ id: string; status: string; wardId: string | null }[]>`
          SELECT id, status::text AS status, "wardId" FROM teams WHERE id = ANY(${teamIds}::text[]) ORDER BY id FOR UPDATE`;
        const bad = teamIds.filter((id) => {
          const t = locked.find((l) => l.id === id);
          return !t || t.status !== 'ACTIVE' || t.wardId !== null;
        });
        if (bad.length) throw new ConflictException({ code: WARD_CHARGE_ERROR.MANAGER_INVALID, details: bad.map((teamId) => ({ teamId })) });
        await assertUsableWards(tx, wardIds);
        const conflicts = await conflictsOf(tx, wardIds, teamIds);
        if (conflicts.length) throw new ConflictException({ code: WARD_CHARGE_ERROR.ALREADY_CHARGED, details: conflicts });

        let removed = 0;
        if (replace) {
          removed = (await tx.teamWardCharge.deleteMany({ where: { managerTeamId: { in: teamIds }, wardDirectoryId: { notIn: wardIds } } })).count;
        }
        const existing = await tx.teamWardCharge.findMany({ where: { wardDirectoryId: { in: wardIds } }, select: { id: true, wardDirectoryId: true, managerTeamId: true } });
        let moved = 0;
        for (const row of existing) {
          const target = managerOf.get(row.wardDirectoryId)!;
          if (row.managerTeamId !== target) {
            await tx.teamWardCharge.update({ where: { id: row.id }, data: { managerTeamId: target } });
            moved += 1;
          }
        }
        const have = new Set(existing.map((e) => e.wardDirectoryId));
        const fresh = wardIds.filter((w) => !have.has(w));
        if (fresh.length) {
          await tx.teamWardCharge.createMany({ data: fresh.map((w) => ({ wardDirectoryId: w, managerTeamId: managerOf.get(w)!, createdById: actorId })) });
        }
        return { added: fresh.length, moved, removed };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException({ code: WARD_CHARGE_ERROR.ALREADY_CHARGED, details: await conflictsOf(this.prisma, wardIds, teamIds) });
      }
      throw error;
    }
    this.previews.delete(previewToken as string);

    await this.audit.log({
      userId: actorId,
      action: WARD_CHARGE_AUDIT.IMPORTED,
      subject: 'Team',
      subjectId: teamIds.join(',').slice(0, 190) || 'none',
      metadata: { teams: teamIds.length, wards: wardIds.length, replaceTeamsInFile: replace, ...summary },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return summary;
  }

  /** The template: the same 4 columns, filled with the charges as they are now (export, edit, import back). */
  async template(): Promise<Buffer> {
    const teams = await this.prisma.team.findMany({
      where: { status: 'ACTIVE', wardId: null, wardCharges: { some: {} } },
      select: { name: true, order: true, wardCharges: { select: { ward: { select: { name: true } } } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow([...WARD_CHARGE_IMPORT_HEADERS]);
    sheet.getRow(1).font = { bold: true };
    teams.forEach((t, i) => {
      const names = t.wardCharges.map((c) => shortWardName(c.ward.name)).sort((a, b) => a.localeCompare(b, 'vi'));
      sheet.addRow([i + 1, t.name, names.length ? `${names.join(', ')}.` : '', names.length]);
    });
    sheet.columns = [{ width: 6 }, { width: 28 }, { width: 100 }, { width: 18 }];
    sheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** The city's active wards, by key; a key two wards share is ambiguous and matches neither. */
  private async cityWards() {
    const province = await this.prisma.directory.findFirst({ where: { type: 'PROVINCE', code: WARD_CHARGE_PROVINCE_CODE }, select: { id: true } });
    const wards = province
      ? await this.prisma.directory.findMany({
          where: { type: 'WARD', parentId: province.id, isActive: true, abolishedAt: null },
          select: { id: true, name: true },
        })
      : [];
    const exact = new Map<string, { id: string; name: string } | 'AMBIGUOUS'>();
    const loose = new Map<string, { id: string; name: string } | 'AMBIGUOUS'>();
    for (const w of wards) {
      for (const [map, key] of [[exact, wardExactKey(w.name)], [loose, wardKey(w.name)]] as const) {
        map.set(key, map.has(key) ? 'AMBIGUOUS' : w);
      }
    }
    /** The ward a name of the file means: by its accents first, then without them; null when none or not one. */
    return (name: string): { id: string; name: string } | null => {
      const hit = exact.get(wardExactKey(name)) ?? loose.get(wardKey(name));
      return hit && hit !== 'AMBIGUOUS' ? hit : null;
    };
  }

  private sweep() {
    const now = Date.now();
    for (const [token, p] of this.previews) if (p.expiresAt < now) this.previews.delete(token);
  }
}

/** "Phường Vườn Lài" → "Vườn Lài", as the file writes it. */
export function shortWardName(name: string): string {
  return name.replace(/^\s*(Phường|Xã|Đặc khu)\s+/iu, '').trim();
}
