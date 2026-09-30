/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { MonthlyReportBuilderService } from './monthly-report-builder.service';

describe('MonthlyReportBuilderService recovery cohorts', () => {
  const builder = new MonthlyReportBuilderService({} as any);
  const start = new Date('2026-09-01T00:00:00.000Z');
  const end = new Date('2026-09-30T23:59:59.999Z');
  const base = {
    status: 'DANG_XAC_MINH',
    updatedAt: new Date('2026-09-20T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    statusHistory: [
      {
        toStatus: 'DANG_XAC_MINH',
        createdAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    ],
    actionPlans: [],
    vksMeetings: [],
    lyDoTamDinhChiVuViec: [],
  };

  function metric(appendix: any, key: string) {
    return appendix.metrics.find((item: any) => item.key === key);
  }

  it('keeps a prior-period recovery in carry-over when it completes during this month and uses its real outcome', () => {
    const record = {
      ...base,
      id: 'i-carry',
      code: 'VV-CARRY',
      ngayPhucHoiVV: new Date('2026-08-01T00:00:00.000Z'),
      ketQuaPhucHoiVuViec: 'QUYET_DINH_KHOI_TO',
      statusHistory: [
        ...base.statusHistory,
        {
          toStatus: 'DA_GIAI_QUYET',
          createdAt: new Date('2026-09-15T00:00:00.000Z'),
        },
      ],
    };
    const appendix = (builder as any).buildSummary(
      'PL07',
      [record],
      start,
      end,
      [],
      false,
      false,
    );

    expect(metric(appendix, '3.1').value).toBe(1);
    expect(metric(appendix, '3.3.1').value).toBe(1);
    expect(metric(appendix, '3.3.4').value).toBe(0);
  });

  it('does not invent a transferred recovery without a recovery date', () => {
    const record = {
      ...base,
      id: 'i-transfer-missing',
      code: 'VV-MISSING',
      createdAt: new Date('2026-09-05T00:00:00.000Z'),
      chuyenTuDonVi: 'Đơn vị A',
      ngayPhucHoiVV: null,
    };
    const appendix = (builder as any).buildSummary(
      'PL07',
      [record],
      start,
      end,
      [],
      false,
      false,
    );

    expect(metric(appendix, '3.2').value).toBe(0);
    expect(metric(appendix, '3.2').issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TRANSFERRED_RECOVERY_DATE_REQUIRED:i-transfer-missing',
        }),
      ]),
    );
  });

  it('places a recovered transfer in exactly one source cohort', () => {
    const record = {
      ...base,
      id: 'i-transfer',
      code: 'VV-TRANSFER',
      createdAt: new Date('2026-09-05T00:00:00.000Z'),
      chuyenTuDonVi: 'Đơn vị A',
      ngayPhucHoiVV: new Date('2026-09-06T00:00:00.000Z'),
      ketQuaPhucHoiVuViec: 'DANG_XAC_MINH',
    };
    const appendix = (builder as any).buildSummary(
      'PL07',
      [record],
      start,
      end,
      [],
      false,
      false,
    );

    expect(metric(appendix, '3').value).toBe(0);
    expect(metric(appendix, '3.2').value).toBe(1);
    expect(metric(appendix, '3.3').value).toBe(1);
  });

  it('does not count an action plan created after the report cutoff', () => {
    const record = {
      ...base,
      id: 'i-plan',
      code: 'VV-PLAN',
      status: 'TAM_DINH_CHI',
      ngayHetThoiHieuVV: new Date('2027-01-01T00:00:00.000Z'),
      statusHistory: [
        {
          toStatus: 'TAM_DINH_CHI',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      ],
      lyDoTamDinhChiVuViec: ['CAN_CU_KHAC'],
      actionPlans: [
        {
          ngayLap: new Date('2026-09-10T00:00:00.000Z'),
          tienDo: 'DAM_BAO',
          createdAt: new Date('2026-10-15T00:00:00.000Z'),
          updatedAt: new Date('2026-10-15T00:00:00.000Z'),
        },
      ],
    };
    const appendix = (builder as any).buildSummary(
      'PL07',
      [record],
      start,
      end,
      [],
      false,
      false,
    );

    expect(metric(appendix, '5.6').value).toBe(0);
  });

  it('counts a record deleted during the month in opening stock but not closing stock', () => {
    const record = {
      ...base,
      id: 'i-deleted',
      code: 'VV-DELETED',
      deletedAt: new Date('2026-09-15T00:00:00.000Z'),
      status: 'TAM_DINH_CHI',
      ngayHetThoiHieuVV: new Date('2027-01-01T00:00:00.000Z'),
      lyDoTamDinhChiVuViec: ['CAN_CU_KHAC'],
      statusHistory: [
        {
          toStatus: 'TAM_DINH_CHI',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      ],
    };
    const appendix = (builder as any).buildSummary(
      'PL07',
      [record],
      start,
      end,
      [],
      false,
      false,
    );

    expect(metric(appendix, '1').value).toBe(1);
    expect(metric(appendix, '5').value).toBe(0);
  });

  it('omits a subject deleted before the detail cutoff while retaining active subjects', () => {
    const cells = (builder as any).detailCells(
      {
        ...base,
        id: 'c1',
        caseCode: 'VA-1',
        code: undefined,
        subjects: [
          {
            fullName: 'Đã xóa',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            deletedAt: new Date('2026-09-15T00:00:00.000Z'),
          },
          {
            fullName: 'Còn hiệu lực',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            deletedAt: null,
          },
        ],
      },
      end,
    );

    expect(cells.subjectName).toBe('Còn hiệu lực');
  });

  it('uses persisted form fields and keeps report lineage compact', () => {
    const record = {
      ...base,
      id: 'c-real',
      code: undefined,
      caseCode: 'VA-REAL',
      name: 'Vụ án thực',
      tenCungCap: 'Người cung cấp',
      vatChungMoTa: 'Dao',
      noiLuuTruBaoQuan: 'Kho A',
      dieuTraVien: 'Đồng chí A',
      metadata: { vatChung: 'Giá trị cũ' },
      legacyRaw: { huge: 'x'.repeat(10000) },
      subjects: [],
    };
    const cells = (builder as any).detailCells(record, end);
    expect(cells).toMatchObject({
      reporter: 'Người cung cấp',
      evidence: 'Dao',
      storage: 'Kho A',
      officer: 'Đồng chí A',
    });
    const contribution = (builder as any).contribution(
      'PL04',
      'ROW',
      record,
      1,
      'MEMBER_AT_CUTOFF',
      end,
    );
    expect(JSON.stringify(contribution.snapshot)).not.toContain('huge');
    expect(contribution.snapshot.record).toBeUndefined();
    const lineage: any[] = [];
    const appendices = (builder as any).buildDetails(
      [],
      [record],
      end,
      lineage,
      false,
    );
    const row = appendices.find((item: any) => item.code === 'PL04').rows[0];
    expect(row.cells).not.toHaveProperty('reporter');
    expect(Object.keys(row.cells)).toHaveLength(
      lineage.filter((item) => item.appendix === 'PL04' && item.cellKey).length,
    );
  });

  it('fills detail cells from normalized crime, evidence and investigator records', () => {
    const cells = (builder as any).detailCells(
      {
        ...base,
        code: undefined,
        crime: null,
        crimeChinh: { name: 'Tội danh đã chọn' },
        investigator: {
          lastName: 'Nguyễn',
          firstName: 'An',
          updatedAt: new Date('2026-08-01'),
        },
        evidences: [
          {
            name: 'Vật chứng A',
            storageLocation: 'Kho số 1',
            updatedAt: new Date('2026-08-01'),
          },
        ],
        subjects: [],
      },
      end,
    );
    expect(cells).toMatchObject({
      crime: 'Tội danh đã chọn',
      evidence: 'Vật chứng A',
      storage: 'Kho số 1',
      officer: 'Nguyễn An',
    });
  });

  it('does not present subject values changed after cutoff as historical detail values', () => {
    const record = {
      ...base,
      id: 'c-subject-history',
      caseCode: 'VA-SUBJECT-HISTORY',
      code: undefined,
      subjects: [
        {
          id: 's1',
          fullName: 'Tên hiện tại',
          address: 'Địa chỉ hiện tại',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-10-15T00:00:00.000Z'),
          deletedAt: null,
        },
      ],
    };
    const contributions: any[] = [];
    const appendices = (builder as any).buildDetails(
      [],
      [record],
      end,
      contributions,
      false,
    );
    const row = appendices.find((item: any) => item.code === 'PL04').rows[0];

    expect(row.cells.subjectName).toBe('Cần xác minh');
    expect(row.cells.address).toBe('Cần xác minh');
    expect(row.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'HISTORICAL_SUBJECT_VALUE_UNKNOWN:s1:subjectName',
          severity: 'ERROR',
          field: 'subjectName',
        }),
      ]),
    );
  });

  it('flags subject summary metrics when a contributing subject changed after the metric date', () => {
    const record = {
      ...base,
      id: 'c-subject-summary',
      caseCode: 'VA-SUBJECT-SUMMARY',
      code: undefined,
      status: 'TAM_DINH_CHI',
      ngayHetThoiHieu: new Date('2027-01-01T00:00:00.000Z'),
      lyDoTamDinhChiVuAn: ['KHAC'],
      subjects: [
        {
          id: 's2',
          fullName: 'Tên sau kỳ',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-10-15T00:00:00.000Z'),
          deletedAt: null,
        },
      ],
      statusHistory: [
        {
          toStatus: 'TAM_DINH_CHI',
          changedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      ],
    };
    const appendix = (builder as any).buildSummary(
      'PL08',
      [record],
      start,
      end,
      [],
      true,
      false,
    );

    expect(metric(appendix, '1.subject').issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'HISTORICAL_SUBJECT_VALUE_UNKNOWN:s2',
          severity: 'ERROR',
        }),
      ]),
    );
  });
});
