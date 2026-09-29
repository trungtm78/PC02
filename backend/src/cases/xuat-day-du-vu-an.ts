import { buildFullModelExport } from '../common/xuat-danh-sach/xuat-day-du-model';

const registry = buildFullModelExport('Case', [
  'subjects',
  'evidences',
  'statistic',
  'documents',
]);
export const KHAI_COT_XUAT_VU_AN_DAY_DU = registry.columns;
export const COT_CAN_CHO_XUAT_DAY_DU_VU_AN = {
  ...registry.select,
  subjects: { where: { deletedAt: null } },
  evidences: { where: { deletedAt: null } },
  documents: {
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      originalName: true,
      mimeType: true,
      size: true,
      documentType: true,
      recordedAt: true,
      createdAt: true,
    },
  },
};
