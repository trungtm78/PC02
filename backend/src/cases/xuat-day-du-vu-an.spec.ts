import {
  COT_CAN_CHO_XUAT_DAY_DU_VU_AN,
  COT_DOI_TUONG,
  COT_VAT_CHUNG,
  COT_TAI_LIEU,
  KHAI_COT_XUAT_VU_AN_DAY_DU,
} from './xuat-day-du-vu-an';

describe('Case full-field export registry', () => {
  it('covers identity and form fields with Vietnamese headings', () => {
    const keys = KHAI_COT_XUAT_VU_AN_DAY_DU.map((column) => column.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'id',
        'caseCode',
        'name',
        'caseType',
        'tenCungCap',
        'cccdCungCap',
        'utdt_soQuyetDinhUyThac',
        'utdt_donViGiao',
        'statistic.soDangKyHoSo',
      ]),
    );
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN).toMatchObject({ metadata: true, statistic: true });
    expect(keys).not.toEqual(expect.arrayContaining(['metadata', 'legacyRaw', 'subjects', 'evidences', 'documents']));
    expect(KHAI_COT_XUAT_VU_AN_DAY_DU.find((c) => c.key === 'utdt_donViGiao')?.tieuDe).toBe('Đơn vị giao');
    expect(keys).not.toContain('timKiemBd');
    expect(keys).not.toContain('sttSort');
  });

  it('reads form values from their stored columns', () => {
    const column = KHAI_COT_XUAT_VU_AN_DAY_DU.find(
      (item) => item.key === 'utdt_donViGiao',
    );
    expect(column?.doc({ id: '1', donViGiao: 'PC01' })).toBe('PC01');
    expect(KHAI_COT_XUAT_VU_AN_DAY_DU.find(
      (item) => item.key === 'utdt_lyDoKhongThucHienDuoc',
    )?.doc({ id: '1', metadata: { lyDoKhongThucHienDuoc: 'Chưa đủ tài liệu' } })).toBe('Chưa đủ tài liệu');
    expect(KHAI_COT_XUAT_VU_AN_DAY_DU.find(
      (item) => item.key === 'statistic.soDoiTuong',
    )?.doc({ id: '1', statistic: { soDoiTuong: 3 } })).toBe(3);
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
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.subjects).toMatchObject({
      where: { deletedAt: null },
      select: { caseId: true, fullName: true },
    });
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.evidences).toMatchObject({
      where: { deletedAt: null },
      select: { caseId: true, name: true },
    });
    expect(COT_CAN_CHO_XUAT_DAY_DU_VU_AN.subjects.select).not.toHaveProperty('legacyRaw');
    expect(COT_DOI_TUONG[0].tieuDe).toBe('Mã định danh hồ sơ');
    expect(COT_VAT_CHUNG[0].key).toBe('caseId');
    expect(COT_TAI_LIEU[0].key).toBe('caseId');
  });
});
