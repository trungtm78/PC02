import { CaseType } from '@prisma/client';
import {
  COT_CAN_CHO_XUAT_DAY_DU_VU_AN,
  KHAI_COT_XUAT_VU_AN_DAY_DU,
} from './xuat-day-du-vu-an';

describe('Case full-field export registry', () => {
  it('covers identity, editable, delegation, metadata and legacy fields', () => {
    const keys = KHAI_COT_XUAT_VU_AN_DAY_DU.map((column) => column.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'id',
        'caseCode',
        'name',
        'caseType',
        'tenCungCap',
        'cccdCungCap',
        'soQuyetDinhUyThac',
        'donViGiao',
        'metadata',
        'legacyRaw',
        'subjects',
        'evidences',
        'statistic',
        'documents',
      ]),
    );
    expect(Object.keys(COT_CAN_CHO_XUAT_DAY_DU_VU_AN)).toEqual(
      expect.arrayContaining(keys),
    );
    expect(keys).not.toContain('timKiemBd');
    expect(keys).not.toContain('sttSort');
  });

  it('renders JSON legacy values without discarding data', () => {
    const column = KHAI_COT_XUAT_VU_AN_DAY_DU.find(
      (item) => item.key === 'legacyRaw',
    );
    expect(
      column?.doc({
        id: '1',
        legacyRaw: { source: 'old' },
        caseType: CaseType.REGULAR,
      }),
    ).toBe('{"source":"old"}');
  });

  it('neutralizes formula-like user input in full-field cells', () => {
    const column = KHAI_COT_XUAT_VU_AN_DAY_DU.find(
      (item) => item.key === 'name',
    );
    expect(
      column?.doc({ id: '1', name: '=HYPERLINK("https://example.test")' }),
    ).toBe('\'=HYPERLINK("https://example.test")');
  });

  it('exports active attachments without internal storage paths', () => {
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.documents).toHaveProperty(
      'where.deletedAt',
      null,
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.documents).toHaveProperty(
      'select.originalName',
      true,
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.documents).not.toHaveProperty(
      'select.filePath',
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.documents).not.toHaveProperty(
      'select.fileName',
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.subjects).toEqual({
      where: { deletedAt: null },
    });
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.evidences).toEqual({
      where: { deletedAt: null },
    });
  });
});
