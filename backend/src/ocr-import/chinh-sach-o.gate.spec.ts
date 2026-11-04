import { OCR_FORM_FIELDS } from './khai-o-form.generated';
import {
  FIELD_POLICY,
  mayAiFill,
  policyFor,
  type FieldPolicy,
} from './chinh-sach-o';

const allFields = [
  ...new Set(
    (['petition', 'incident', 'case'] as const).flatMap((e) =>
      OCR_FORM_FIELDS[e].map((f) => f.field),
    ),
  ),
];

const byPolicy = (p: FieldPolicy) =>
  Object.entries(FIELD_POLICY)
    .filter(([, v]) => v === p)
    .map(([k]) => k);

describe('GATE: every form field has an explicit AI policy', () => {
  it('reads a real catalogue, so an empty one cannot make this gate pass', () => {
    expect(allFields.length).toBeGreaterThan(120);
  });

  it('classifies every field of every entity', () => {
    const unclassified = allFields.filter((f) => !(f in FIELD_POLICY));
    expect(unclassified).toEqual([]);
  });

  it('has no stale entry for a field that no form has any more', () => {
    const known = new Set(allFields);
    const stale = Object.keys(FIELD_POLICY).filter((f) => !known.has(f));
    expect(stale).toEqual([]);
  });

  it('seeded fault: an unclassified field is refused, never defaulted to allowed', () => {
    expect(() => policyFor('someFieldAddedLater')).toThrow('has no AI policy');
    expect(mayAiFill('someFieldAddedLater' as never)).toBe(false);
  });
});

describe('policy safety invariants', () => {
  it('identity, amount and legal-charge fields can never be filled without confirmation', () => {
    const mustBeConfirmedOrBlocked = [
      'tenCungCap',
      'cccdCungCap',
      'ngayCapCccd',
      'sinhNamCungCap',
      'sdtCungCap',
      'crimeChinhId',
      'ngayVietDon',
      'ngayXayRa',
      'statistic.soTienBiThietHai',
      'nghiVanDoiTuong',
    ];
    for (const f of mustBeConfirmedOrBlocked) {
      expect([f, FIELD_POLICY[f]]).not.toEqual([f, 'AI_FILL']);
      expect(FIELD_POLICY[f]).toBeDefined();
    }
    expect(FIELD_POLICY.cccdCungCap).toBe('AI_FILL_MUST_CONFIRM');
    expect(FIELD_POLICY['statistic.soTienBiThietHai']).toBe(
      'AI_FILL_MUST_CONFIRM',
    );
  });

  it('officer decisions, assignments and prosecution-stage fields are never filled by AI', () => {
    const decision =
      /^(soQ|ngayQ|soQuyetDinh|ngayQuyetDinh|canCu|lyDo|soKLDT|ngayKLDT|soBanAn|ngayBanAn|ngayKhoiTo|ngayDinhChi|ngayTamDinhChi|ngayPhucHoi|soPhucHoi|ngayTach|soQDTach|ngayNhap|soQDNhap|ngayHetThoiHieu|tdcKhacPhuc|khacPhuc|tienDo)/;
    const offenders = allFields.filter(
      (f) => decision.test(f) && FIELD_POLICY[f] !== 'NEVER_AI',
    );
    expect(offenders).toEqual([]);
    for (const f of [
      'dieuTraVienText',
      'lanhDaoToTung',
      'huongXuLy',
      'donViGiaiQuyet',
      'deXuat',
      'nhanXet',
      'ghiChuTrungDon',
      'baoCaoBanGiamDoc',
      'laCongNgheCao',
    ]) {
      expect(FIELD_POLICY[f]).toBe('NEVER_AI');
    }
  });

  it('statistics fields are never filled, except the two amounts a complaint states', () => {
    const allowed = new Set([
      'statistic.soTienBiThietHai',
      'statistic.soLuongBiHai',
    ]);
    const offenders = allFields.filter(
      (f) =>
        f.startsWith('statistic.') &&
        !allowed.has(f) &&
        FIELD_POLICY[f] !== 'NEVER_AI',
    );
    expect(offenders).toEqual([]);
    expect(FIELD_POLICY['statistic.soLuongBiHai']).toBe('AI_FILL_MUST_CONFIRM');
  });

  it('only a small, reviewed set of fields may be filled', () => {
    const fillable = [
      ...byPolicy('AI_FILL'),
      ...byPolicy('AI_FILL_MUST_CONFIRM'),
    ];
    expect(fillable.length).toBeGreaterThan(10);
    expect(fillable.length).toBeLessThan(40);
  });

  it('mayAiFill is true exactly for the two fill policies', () => {
    expect(mayAiFill('description')).toBe(true);
    expect(mayAiFill('cccdCungCap')).toBe(true);
    expect(mayAiFill('nhanXet')).toBe(false);
  });
});
