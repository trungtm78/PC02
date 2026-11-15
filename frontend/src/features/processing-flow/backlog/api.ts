import { api } from '@/lib/api';
import { triggerDownload } from '@/features/document-templates/export.api';
import type { TrackingItemsDto } from '../tracking/types';
import { DEFAULT_ROLE, type BacklogCell, type BacklogFilters, type BacklogUnitsDto, type OnTimeQuery, type OnTimeReportDto, type UnappliedCell, type UnappliedRecordsDto } from './types';

const data = <T>(r: { data: T }): T => r.data;

const BASE = '/processing/backlog';
/** The rows of a cell are the tracking list, narrowed to the unit and the band of the cell. */
const ITEMS = '/processing/tracking/items';

/** The name of the file when the server sends none (it normally does, with the day of the figures). */
export const EXPORT_FALLBACK_NAME = 'ton-dong-theo-don-vi.xlsx';

/** Only what is set goes on the wire: the server validates every key it is sent. The default role is left out. */
const filterParams = (filters: Pick<BacklogFilters, 'kind' | 'role'> & { from: string | null; to: string | null }): Record<string, string> => ({
  ...(filters.kind ? { kind: filters.kind } : {}),
  ...(filters.role !== DEFAULT_ROLE ? { role: filters.role } : {}),
  ...(filters.from ? { from: filters.from } : {}),
  ...(filters.to ? { to: filters.to } : {}),
});

/** The unit filter: that unit, and with the roll-up every unit under it (the server walks the tree). */
const unitParams = (unitId: string | null, rolledUp: boolean): Record<string, string | boolean> => ({
  ...(unitId ? { teamId: unitId } : {}),
  ...(rolledUp ? { rollup: true } : {}),
});

export interface CellItemsQuery extends BacklogFilters, BacklogCell {
  /** The `asOf` the table answered: the rows are judged at the instant the numbers were. */
  asOf: string;
  page: number;
  pageSize: number;
}

/**
 * The calls of the screen "Tồn đọng theo đơn vị". The server answers 404 while the switch `processing_flow_records`
 * is off and 403 without `read:ProcessingStep`.
 */
export const backlogApi = {
  /**
   * Asked with no `asOf`: the server uses its clock and says which instant that was. `rolledUp`: the server answers the
   * top units with the sums under them (the ONE definition of the roll-up, which the export writes too).
   */
  units: (filters: BacklogFilters, rolledUp: boolean) =>
    api.get<BacklogUnitsDto>(`${BASE}/units`, { params: { ...filterParams(filters), ...unitParams(filters.unitId, rolledUp) } }).then(data),

  /** The records one number of the column "Chưa áp quy trình" counts: the server's same condition, one unit, one kind. */
  unapplied: (cell: UnappliedCell, page: number, pageSize: number) =>
    api.get<UnappliedRecordsDto>(`${BASE}/unapplied`, { params: { kind: cell.kind, teamId: cell.teamId, page, pageSize } }).then(data),

  cellItems: (query: CellItemsQuery) =>
    api
      .get<TrackingItemsDto>(ITEMS, {
        params: {
          ...filterParams(query),
          teamId: query.teamId,
          band: query.band,
          asOf: query.asOf,
          page: query.page,
          pageSize: query.pageSize,
        },
      })
      .then(data),

  onTime: (query: OnTimeQuery) =>
    api.get<OnTimeReportDto>(`${BASE}/on-time`, { params: { ...filterParams(query), ...(query.unitId ? unitParams(query.unitId, query.rolledUp) : {}) } }).then(data),

  /**
   * The table as an Excel file, saved to the person's disk: rolled up when the screen is, and with `asOf` the file holds
   * the figures on screen. The name
   * is the one the server sends (Content-Disposition); the fallback is used only when it sends none.
   */
  exportUnits: async (filters: BacklogFilters, asOf: string | null, rolledUp: boolean): Promise<void> => {
    const response = await api.get<Blob>(`${BASE}/units/export`, {
      params: { ...filterParams(filters), ...(asOf ? { asOf } : {}), ...unitParams(filters.unitId, rolledUp) },
      responseType: 'blob',
    });
    triggerDownload(response, EXPORT_FALLBACK_NAME);
  },
};
