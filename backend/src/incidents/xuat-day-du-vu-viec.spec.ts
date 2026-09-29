import {
  COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC,
  KHAI_COT_XUAT_VU_VIEC_DAY_DU,
} from './xuat-day-du-vu-viec';

describe('Incident full-field export registry', () => {
  it('covers editable, result, metadata and legacy fields', () => {
    const keys = KHAI_COT_XUAT_VU_VIEC_DAY_DU.map((column) => column.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'id',
        'code',
        'name',
        'benVu',
        'cmndNguoiToGiac',
        'nhanXet',
        'ngayVietDon',
        'ketQuaXuLy',
        'metadata',
        'legacyRaw',
        'documents',
      ]),
    );
    expect(Object.keys(COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC)).toEqual(
      expect.arrayContaining(keys),
    );
    expect(keys).not.toContain('timKiemBd');
    expect(keys).not.toContain('sttSort');
  });

  it('exports active attachment metadata without internal storage paths', () => {
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC.documents).toHaveProperty(
      'where.deletedAt',
      null,
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC.documents).toHaveProperty(
      'select.originalName',
      true,
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC.documents).not.toHaveProperty(
      'select.filePath',
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC.documents).not.toHaveProperty(
      'select.fileName',
    );
  });
});
