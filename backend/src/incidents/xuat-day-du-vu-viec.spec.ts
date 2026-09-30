import {
  COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC,
  COT_TAI_LIEU_VU_VIEC,
  KHAI_COT_XUAT_VU_VIEC_DAY_DU,
} from './xuat-day-du-vu-viec';

describe('Incident full-field export registry', () => {
  it('limits attachment export to active display metadata', () => {
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
  it('covers identity and form fields without technical columns', () => {
    const keys = KHAI_COT_XUAT_VU_VIEC_DAY_DU.map((column) => column.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'id',
        'code',
        'name',
        'tenCungCap',
        'cccdCungCap',
        'ngayVietDon',
      ]),
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_VIEC).toMatchObject({ metadata: true });
    expect(keys).not.toEqual(expect.arrayContaining(['metadata', 'legacyRaw', 'documents']));
    expect(keys).not.toContain('timKiemBd');
    expect(keys).not.toContain('sttSort');
  });

  it('reads form data and links the document sheet by incident ID', () => {
    const column = KHAI_COT_XUAT_VU_VIEC_DAY_DU.find(
      (item) => item.key === 'tenCungCap',
    );
    expect(column?.doc({ id: '1', benVu: 'Nguyễn A' })).toBe('Nguyễn A');
    expect(KHAI_COT_XUAT_VU_VIEC_DAY_DU.find(
      (item) => item.key === 'statistic.soDangKyHoSo',
    )?.doc({ id: '1', metadata: { soDangKyHoSo: 'HS-01' } })).toBe('HS-01');
    expect(COT_TAI_LIEU_VU_VIEC[0].key).toBe('incidentId');
  });
});
