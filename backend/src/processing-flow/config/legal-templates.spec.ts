import { normaliseSteps } from './flow-steps';
import { LEGAL_TEMPLATES, legalTemplate } from './legal-templates';
import { validateSteps } from './validate-steps';

/** One step of a template, reduced to the figures a later edit must change on purpose. */
const figures = (key: string) =>
  legalTemplate(key)?.steps.map((s) => ({
    name: s.name,
    duration: `${s.durationValue} ${s.durationUnit}`,
    anchor: s.anchor,
    thresholds: `${s.redDays}/${s.yellowDays}/${s.greenDays}`,
    setsRecordDeadline: s.setsRecordDeadline ?? false,
    requiresApproval: s.requiresApproval ?? false,
    extensions: (s.maxExtensions ?? 0) > 0 ? `${s.maxExtensions} x ${s.extensionValue} ${s.extensionUnit}` : 'none',
    legalBasis: s.legalBasis,
    variants: (s.variants ?? []).map(
      (v) => `${v.conditionKey}=${v.conditionValue}: ${v.durationValue} ${v.durationUnit}, ${v.maxExtensions} x ${v.extensionValue} ${v.extensionUnit}`,
    ),
  }));

describe('the legal template catalogue', () => {
  it('holds exactly these five templates', () => {
    expect(LEGAL_TEMPLATES.map((t) => [t.key, t.recordKind, t.name])).toEqual([
      ['INCIDENT_CRIME_REPORT', 'INCIDENT', 'Tố giác, tin báo về tội phạm, kiến nghị khởi tố'],
      ['CASE_INVESTIGATION', 'CASE', 'Điều tra vụ án hình sự'],
      ['PETITION_DENUNCIATION', 'PETITION', 'Tố cáo'],
      ['PETITION_COMPLAINT', 'PETITION', 'Khiếu nại'],
      ['PETITION_RECOMMENDATION', 'PETITION', 'Kiến nghị, phản ánh'],
    ]);
    expect(legalTemplate('NOT_A_TEMPLATE')).toBeUndefined();
  });

  it('crime reports: 20 days to check, two extensions of two months (Article 147)', () => {
    expect(figures('INCIDENT_CRIME_REPORT')).toEqual([
      {
        name: 'Kiểm tra, xác minh',
        duration: '20 DAY',
        anchor: 'RECEIVED',
        thresholds: '1/3/5',
        setsRecordDeadline: true,
        requiresApproval: true,
        extensions: '2 x 2 MONTH',
        legalBasis: 'Điều 147 BLTTHS 2015',
        variants: [],
      },
    ]);
  });

  it('investigation of a criminal case: by the gravity of the crime (Article 172)', () => {
    expect(figures('CASE_INVESTIGATION')).toEqual([
      {
        name: 'Điều tra',
        // Its own figures are those of the least serious crime: the shortest deadline the law knows.
        duration: '2 MONTH',
        anchor: 'PROSECUTED',
        thresholds: '3/7/15',
        setsRecordDeadline: true,
        requiresApproval: true,
        extensions: '1 x 2 MONTH',
        legalBasis: 'Điều 172 BLTTHS 2015',
        variants: [
          'CRIME_GRAVITY=IT_NGHIEM_TRONG: 2 MONTH, 1 x 2 MONTH',
          'CRIME_GRAVITY=NGHIEM_TRONG: 3 MONTH, 2 x 3 MONTH',
          'CRIME_GRAVITY=RAT_NGHIEM_TRONG: 4 MONTH, 2 x 4 MONTH',
          'CRIME_GRAVITY=DAC_BIET_NGHIEM_TRONG: 4 MONTH, 3 x 4 MONTH',
        ],
      },
    ]);
    // The stored extension of a serious crime is the first one; the description says what the second one is.
    expect(legalTemplate('CASE_INVESTIGATION')?.steps[0].description).toContain('lần thứ hai không quá 02 tháng');
  });

  it('denunciations: 30 days from acceptance, two extensions of 30 days (Article 30)', () => {
    expect(figures('PETITION_DENUNCIATION')).toEqual([
      {
        name: 'Giải quyết tố cáo',
        duration: '30 DAY',
        anchor: 'ACCEPTED',
        thresholds: '2/5/10',
        setsRecordDeadline: true,
        requiresApproval: true,
        extensions: '2 x 30 DAY',
        legalBasis: 'Điều 30 Luật Tố cáo 2018',
        variants: [],
      },
    ]);
  });

  it('complaints: 10 days to accept, then 30 days to settle (Articles 27 and 28)', () => {
    expect(figures('PETITION_COMPLAINT')).toEqual([
      {
        name: 'Thụ lý',
        duration: '10 DAY',
        anchor: 'RECEIVED',
        thresholds: '1/3/5',
        setsRecordDeadline: false,
        requiresApproval: false,
        extensions: 'none',
        legalBasis: 'Điều 27 Luật Khiếu nại 2011',
        variants: [],
      },
      {
        name: 'Giải quyết khiếu nại lần đầu',
        duration: '30 DAY',
        anchor: 'ACCEPTED',
        thresholds: '2/5/10',
        setsRecordDeadline: true,
        requiresApproval: true,
        extensions: 'none',
        legalBasis: 'Điều 28 Luật Khiếu nại 2011',
        variants: [],
      },
    ]);
    expect(legalTemplate('PETITION_COMPLAINT')?.steps[1].description).toContain('45 ngày');
  });

  it('recommendations and reflections: the 15 days the system applies today, said to be unchecked', () => {
    expect(figures('PETITION_RECOMMENDATION')).toEqual([
      {
        name: 'Xử lý, trả lời',
        duration: '15 DAY',
        anchor: 'RECEIVED',
        thresholds: '1/3/5',
        setsRecordDeadline: true,
        requiresApproval: false,
        extensions: 'none',
        legalBasis: 'Thời hạn đang áp dụng trong hệ thống; chưa đối chiếu Luật Tiếp công dân 2013',
        variants: [],
      },
    ]);
  });

  it('every step names its legal basis and is worked by the unit holding the record, and nothing else', () => {
    for (const template of LEGAL_TEMPLATES) {
      for (const step of template.steps) {
        expect(step.legalBasis).toBeTruthy();
        expect(step.parties).toEqual([{ partyKind: 'RECORD_TEAM', role: 'MAIN' }]);
        // A template never carries a key (each flow made from it gets its own) nor a verification.
        expect(Object.keys(step)).not.toEqual(expect.arrayContaining(['stepKey']));
        expect(Object.keys(step)).not.toEqual(expect.arrayContaining(['legalVerifiedAt']));
      }
    }
  });

  it('every template can be saved as it stands and published without a correction', () => {
    for (const template of LEGAL_TEMPLATES) {
      const steps = normaliseSteps(template.steps);
      expect({ key: template.key, issues: validateSteps(steps, template.recordKind) }).toEqual({ key: template.key, issues: [] });
    }
  });

  it('the catalogue cannot be changed by a caller', () => {
    expect(Object.isFrozen(LEGAL_TEMPLATES)).toBe(true);
    expect(Object.isFrozen(LEGAL_TEMPLATES[0].steps[0])).toBe(true);
  });
});
