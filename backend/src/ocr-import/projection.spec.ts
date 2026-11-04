import { OCR_FORM_FIELDS } from './khai-o-form.generated';
import { FIELD_POLICY, mayAiFill } from './chinh-sach-o';
import { sampleBundle } from './evidence/evidence.fixture';
import {
  NOT_PROJECTED_YET,
  PROJECTION_RULES,
  projectToForm,
  type FieldFill,
} from './projection';

const byField = (fills: FieldFill[]) =>
  Object.fromEntries(fills.map((f) => [f.field, f]));

describe('projectToForm (Petition)', () => {
  it('fills the complainant block from the person with the COMPLAINANT role', () => {
    const { fills } = projectToForm(sampleBundle(), 'petition');
    const f = byField(fills);
    expect(f.tenCungCap.value).toBe('Nguyễn Thị Hương');
    expect(f.sdtCungCap.value).toBe('0901234567');
    expect(f.sinhNamCungCap.value).toBe('1990');
    expect(f.cccdCungCap.value).toBe('079190012345'); // spaces removed
    expect(f.ngayCapCccd.value).toBe('2021-04-09');
    expect(f.noiCapCccd.value).toBe('Cục Cảnh sát QLHC về TTXH');
    expect(f.diaChiCungCap.value).toBe(
      '12/3 Lê Lợi, phường Bến Nghé, TP. Hồ Chí Minh',
    );
  });

  it('carries the quote and page that back each value, and its claim kind', () => {
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f.tenCungCap.provenance).toEqual({
      claimKind: 'QUOTED',
      pageId: 'p2',
      quote: 'Họ và tên: Nguyễn Thị Hương',
    });
  });

  it('keeps the policy of each field: identity needs confirmation, plain text does not', () => {
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f.cccdCungCap.policy).toBe('AI_FILL_MUST_CONFIRM');
    expect(f.noiCapCccd.policy).toBe('AI_FILL');
    expect(f.description.policy).toBe('AI_FILL');
  });

  it('takes the transfer slip number and date from the TRANSFER_SLIP document, not from the complaint', () => {
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f.soPhieuChuyen.value).toBe('A100/PC-VP');
    expect(f.ngayPhieuChuyen.value).toBe('2026-10-28');
    expect(f.ngayVietDon.value).toBe('2026-09-29');
  });

  it('puts the loss amount in VND as a number, from the LOSS_TOTAL amount only', () => {
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f['statistic.soTienBiThietHai'].value).toBe(495253647);
  });

  it('refuses to pick between conflicting loss amounts: nothing is filled, the candidates are reported', () => {
    const bundle = sampleBundle();
    bundle.amounts.push({
      ...bundle.amounts[0],
      id: 'a3',
      digits: '478.481.432',
      valueVnd: 478481432,
    });
    const { fills, skips } = projectToForm(bundle, 'petition');
    expect(byField(fills)['statistic.soTienBiThietHai']).toBeUndefined();
    const skip = skips.find((s) => s.field === 'statistic.soTienBiThietHai');
    expect(skip?.reason).toBe('AMOUNT_CONFLICT');
    expect(skip?.candidates).toEqual([478481432, 495253647]);
  });

  it('the same amount stated twice is not a conflict', () => {
    const bundle = sampleBundle();
    bundle.amounts.push({ ...bundle.amounts[0], id: 'a3' });
    expect(
      byField(projectToForm(bundle, 'petition').fills)[
        'statistic.soTienBiThietHai'
      ].value,
    ).toBe(495253647);
  });

  it('counts only people with the VICTIM role, and fills nothing when there is none', () => {
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f['statistic.soLuongBiHai'].value).toBe(1);

    const bundle = sampleBundle();
    bundle.people[0].roles = ['COMPLAINANT'];
    expect(
      byField(projectToForm(bundle, 'petition').fills)[
        'statistic.soLuongBiHai'
      ],
    ).toBeUndefined();
  });

  it('turns the offence article into a pending crime lookup, flagged when it was only inferred', () => {
    const quoted = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(quoted.crimeChinhId.pending).toEqual({
      kind: 'CRIME_BY_ARTICLE',
      article: 174,
      law: 'BLHS 2015',
    });
    expect(quoted.crimeChinhId.warnings).not.toContain('INFERRED_VALUE');

    const bundle = sampleBundle();
    bundle.legalAssessments[0].claimKind = 'INFERRED';
    const inferred = byField(projectToForm(bundle, 'petition').fills);
    expect(inferred.crimeChinhId.warnings).toContain('INFERRED_VALUE');
  });

  it('falls back to the offence name when the paperwork names the offence but no article', () => {
    const bundle = sampleBundle();
    bundle.legalAssessments[0].article = null;
    const f = byField(projectToForm(bundle, 'petition').fills);
    expect(f.crimeChinhId.pending).toEqual({
      kind: 'CRIME_BY_NAME',
      name: 'Lừa đảo chiếm đoạt tài sản',
    });
    expect(f.crimeChinhId.policy).toBe('AI_FILL_MUST_CONFIRM');
  });

  it('skips the offence when there is neither an article nor a name', () => {
    const bundle = sampleBundle();
    bundle.legalAssessments[0].article = null;
    bundle.legalAssessments[0].offence = '  ';
    const { fills, skips } = projectToForm(bundle, 'petition');
    expect(byField(fills).crimeChinhId).toBeUndefined();
    expect(skips.find((s) => s.field === 'crimeChinhId')?.reason).toBe(
      'NO_ARTICLE',
    );
  });

  it('never fills a field the form does not have: the accused go to the incident field only', () => {
    const petition = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(petition.nghiVanDoiTuong).toBeUndefined();
    const incident = byField(projectToForm(sampleBundle(), 'incident').fills);
    expect(incident.nghiVanDoiTuong.value).toBe('Trần Văn Bình');
  });

  it('an accused person is never turned into anything but the suspicion text', () => {
    const { fills } = projectToForm(sampleBundle(), 'incident');
    expect(fills.some((f) => /bican|suspect/i.test(f.field))).toBe(false);
  });

  it('writes the summary as an opening paragraph followed by the numbered points', () => {
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f.description.value).toBe(
      'Bà Nguyễn Thị Hương tố cáo ông Trần Văn Bình lừa đảo chiếm đoạt tài sản.\n' +
        '1. Bị chiếm đoạt 495.253.647 đồng.\n' +
        '2. Đề nghị xác minh và khởi tố vụ án.',
    );
  });

  it('lists the distinct places of the events (a field of the incident and case forms) and the modus operandi', () => {
    const incident = byField(projectToForm(sampleBundle(), 'incident').fills);
    expect(incident.noiXayRa.value).toBe('TP. Dĩ An; TP. Thủ Đức');
    expect(
      byField(projectToForm(sampleBundle(), 'petition').fills).noiXayRa,
    ).toBeUndefined();
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f.phuongThucThuDoan.value).toBe(
      'Hứa giới thiệu công trình để nhận tiền ứng trước rồi bỏ đi.',
    );
  });

  it('uses the earliest dated event for the offence date and says so', () => {
    const f = byField(projectToForm(sampleBundle(), 'petition').fills);
    expect(f.ngayXayRa.value).toBe('2023-09-17');
    expect(f.ngayXayRa.warnings).toContain('EARLIEST_EVENT_USED');
  });

  it('skips a date that is not complete and real instead of inventing one', () => {
    const bundle = sampleBundle();
    bundle.documents[1].date = { raw: 'ngày .. tháng 09 năm 2026', iso: null };
    const { fills, skips } = projectToForm(bundle, 'petition');
    expect(byField(fills).ngayVietDon).toBeUndefined();
    expect(skips.find((s) => s.field === 'ngayVietDon')?.reason).toBe(
      'DATE_INCOMPLETE',
    );
  });

  it('warns when there are several complainants and uses the first', () => {
    const bundle = sampleBundle();
    bundle.people.push({ ...bundle.people[0], id: 'u9', name: 'Lê Văn C' });
    const f = byField(projectToForm(bundle, 'petition').fills);
    expect(f.tenCungCap.value).toBe('Nguyễn Thị Hương');
    expect(f.tenCungCap.warnings).toContain('MULTIPLE_COMPLAINANTS');
  });

  it('flags an ID number that is neither 9 nor 12 digits, but still proposes it for confirmation', () => {
    const bundle = sampleBundle();
    bundle.people[0].idNumber = '0791900123';
    const f = byField(projectToForm(bundle, 'petition').fills);
    expect(f.cccdCungCap.value).toBe('0791900123');
    expect(f.cccdCungCap.warnings).toContain('ID_NUMBER_FORMAT');
  });

  it('is empty, not an error, when the paperwork says nothing', () => {
    const bundle = sampleBundle();
    bundle.people = [];
    bundle.amounts = [];
    bundle.events = [];
    bundle.legalAssessments = [];
    bundle.modusOperandi = null;
    const { fills } = projectToForm(bundle, 'petition');
    expect(fills.map((f) => f.field)).toEqual(
      expect.not.arrayContaining(['tenCungCap', 'crimeChinhId', 'noiXayRa']),
    );
  });
});

describe('GATE: projection rules and the field policy agree', () => {
  const fillable = new Set(
    (['petition', 'incident', 'case'] as const).flatMap((e) =>
      OCR_FORM_FIELDS[e].map((f) => f.field).filter(mayAiFill),
    ),
  );

  it('every fillable field has a rule or is explicitly listed as not projected yet, with a reason', () => {
    const unaccounted = [...fillable].filter(
      (f) => !(f in PROJECTION_RULES) && !(f in NOT_PROJECTED_YET),
    );
    expect(unaccounted).toEqual([]);
    for (const reason of Object.values(NOT_PROJECTED_YET)) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('no rule exists for a field the policy forbids, and no rule is also listed as pending', () => {
    for (const field of Object.keys(PROJECTION_RULES)) {
      expect(FIELD_POLICY[field]).toBeDefined();
      expect(mayAiFill(field)).toBe(true);
      expect(field in NOT_PROJECTED_YET).toBe(false);
    }
  });

  it('no fill of any entity ever targets a NEVER_AI field', () => {
    for (const entity of ['petition', 'incident', 'case'] as const) {
      const { fills } = projectToForm(sampleBundle(), entity);
      for (const fill of fills)
        expect(FIELD_POLICY[fill.field]).not.toBe('NEVER_AI');
    }
  });
});
