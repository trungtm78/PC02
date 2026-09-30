import {
  buildFormExport,
  readValue,
} from '../common/xuat-danh-sach/xuat-day-du-model';
import { TRUONG_FORM_VU_VIEC } from '../common/xuat-danh-sach/khai-truong-ho-so.generated';
import { COT_TAI_LIEU } from '../cases/xuat-day-du-vu-an';

const registry = buildFormExport('Incident', TRUONG_FORM_VU_VIEC);
export const KHAI_COT_XUAT_VU_VIEC_DAY_DU = registry.columns;
export const COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC = {
  ...registry.select,
  documents: {
    where: { deletedAt: null },
    select: {
      incidentId: true,
      title: true,
      description: true,
      originalName: true,
      mimeType: true,
      size: true,
      documentType: true,
      recordedAt: true,
    },
  },
};
export const COT_TAI_LIEU_VU_VIEC = COT_TAI_LIEU.map((column) =>
  column.key === 'caseId'
    ? {
        ...column,
        key: 'incidentId',
        doc: (row: Record<string, unknown>) => readValue(row.incidentId),
      }
    : column,
);
