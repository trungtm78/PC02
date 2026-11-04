import { sampleBundle } from '../evidence/evidence.fixture';
import { projectToForm } from '../projection';
import { normalizeForQuote, verifyBundle, type VerifyContext } from './verify';

const transcripts = {
  p1: 'Văn phòng cơ quan A\nPHIẾU CHUYỂN nguồn tin về tội phạm',
  p2:
    'ĐƠN TỐ CÁO\nHọ và tên: Nguyễn Thị Hương\nCăn cước số: 079190012345\n' +
    'ông Trần Văn Bình\nNgày 17 tháng 9 năm 2023 gặp nhau café tại quán\n' +
    'số tiền 495.253.647 đồng',
  p3:
    'Điều 174 Bộ luật hình sự 2015\n20 triệu đồng\nđã dùng thủ đoạn gian dối\n' +
    'Xác minh và khởi tố vụ án',
};

const ctx = (overrides: Partial<VerifyContext> = {}): VerifyContext => ({
  transcripts,
  segmentIds: ['s1', 's2'],
  ...overrides,
});
const codes = (issues: Array<{ code: string }>) => issues.map((i) => i.code);

describe('normalizeForQuote', () => {
  it('ignores case, spacing, punctuation and Unicode composition', () => {
    const a = normalizeForQuote('Họ  và tên : Nguyễn Thị Hương');
    const b = normalizeForQuote('họ và tên: nguyễn thị hương'.normalize('NFD'));
    expect(a).toBe(b);
  });
});

describe('verifyBundle: quotes', () => {
  it('keeps a bundle whose every quote is on the cited page, and reports nothing', () => {
    const { cleaned, issues } = verifyBundle(sampleBundle(), ctx());
    expect(issues).toEqual([]);
    expect(cleaned.people).toHaveLength(3);
  });

  it('drops a QUOTED claim whose quote is not on the page, and says which one', () => {
    const bundle = sampleBundle();
    bundle.people[1].evidence = [
      { pageId: 'p2', quote: 'một câu không hề có trong giấy' },
    ];
    const { cleaned, issues } = verifyBundle(bundle, ctx());
    expect(cleaned.people.map((p) => p.id)).toEqual(['u1', 'o1']);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'QUOTE_NOT_FOUND',
        severity: 'DROPPED',
        path: 'people[1]',
      }),
    );
  });

  it('drops a claim that cites a page that does not exist or gives no quote at all', () => {
    const bundle = sampleBundle();
    bundle.amounts[0].evidence = [{ pageId: 'p9', quote: '495.253.647 đồng' }];
    bundle.legalAssessments[0].evidence = [];
    const { cleaned, issues } = verifyBundle(bundle, ctx());
    expect(cleaned.amounts.map((a) => a.id)).toEqual(['a2']);
    expect(cleaned.legalAssessments).toEqual([]);
    expect(codes(issues)).toEqual(
      expect.arrayContaining(['PAGE_UNKNOWN', 'QUOTE_MISSING']),
    );
  });

  it('keeps an INFERRED claim without a verifiable quote: an inference is not a quotation', () => {
    const bundle = sampleBundle();
    bundle.legalAssessments[0].claimKind = 'INFERRED';
    bundle.legalAssessments[0].evidence = [
      { pageId: 'p3', quote: 'không có trong giấy' },
    ];
    const { cleaned } = verifyBundle(bundle, ctx());
    expect(cleaned.legalAssessments).toHaveLength(1);
    expect(cleaned.legalAssessments[0].evidence).toEqual([]);
  });

  it('drops the modus operandi when its quote cannot be found', () => {
    const bundle = sampleBundle();
    bundle.modusOperandi!.evidence = [{ pageId: 'p3', quote: 'bịa' }];
    expect(verifyBundle(bundle, ctx()).cleaned.modusOperandi).toBeNull();
  });

  it('a fabricated value never reaches the form: the projection after verification omits it', () => {
    const bundle = sampleBundle();
    bundle.people[0].evidence = [
      { pageId: 'p2', quote: 'Họ và tên: Người Không Có' },
    ];
    const { cleaned } = verifyBundle(bundle, ctx());
    const fields = projectToForm(cleaned, 'petition').fills.map((f) => f.field);
    expect(fields).not.toContain('tenCungCap');
    expect(fields).not.toContain('cccdCungCap');
  });

  it('removes references to a dropped person from events', () => {
    const bundle = sampleBundle();
    bundle.people[1].evidence = [{ pageId: 'p2', quote: 'không có' }];
    const { cleaned } = verifyBundle(bundle, ctx());
    expect(cleaned.events[0].personIds).toEqual(['u1']);
  });
});

describe('verifyBundle: amounts', () => {
  it('corrects the model reading of a figure from the digits as written', () => {
    const bundle = sampleBundle();
    bundle.amounts[0].valueVnd = 495253000;
    const { cleaned, issues } = verifyBundle(bundle, ctx());
    expect(cleaned.amounts[0].valueVnd).toBe(495253647);
    expect(codes(issues)).toContain('AMOUNT_VALUE_CORRECTED');
  });

  it('withholds an amount whose words and digits disagree, reporting both readings', () => {
    const bundle = sampleBundle();
    bundle.amounts[0].words =
      'Bốn trăm chín mươi lăm triệu hai trăm năm mươi ba nghìn sáu trăm bốn mươi tám đồng';
    const { cleaned, issues } = verifyBundle(bundle, ctx());
    expect(cleaned.amounts[0].valueVnd).toBeNull();
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'AMOUNT_WORDS_MISMATCH',
        detail: { digits: 495253647, words: 495253648 },
      }),
    );
  });

  it('accepts digits and words that agree, and an amount with only one of them', () => {
    const bundle = sampleBundle();
    bundle.amounts[1].digits = null;
    bundle.amounts[1].words = 'Hai mươi triệu đồng';
    expect(codes(verifyBundle(bundle, ctx()).issues)).toEqual([]);
  });
});

describe('verifyBundle: identity and dates', () => {
  it('flags a 12-digit ID number whose encoded birth year disagrees with the stated one', () => {
    const bundle = sampleBundle();
    bundle.people[0].idNumber = '079095012345'; // encodes 1995 (male, 1900s)
    const { issues } = verifyBundle(bundle, ctx());
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'ID_BIRTH_YEAR_MISMATCH',
        path: 'people[0]',
        detail: { encoded: 1995, stated: 1990 },
      }),
    );
  });

  it('accepts a matching ID number, including the 2000s century code', () => {
    const bundle = sampleBundle();
    bundle.people[0].idNumber = '079290012345'; // 2 = male born 2000-2099 -> 2090? year digits 90
    bundle.people[0].birthYear = '2090';
    bundle.people[0].birthDate = null;
    expect(codes(verifyBundle(bundle, ctx()).issues)).not.toContain(
      'ID_BIRTH_YEAR_MISMATCH',
    );
  });

  it('does not check a 9-digit old ID number', () => {
    const bundle = sampleBundle();
    bundle.people[0].idNumber = '012345678';
    expect(codes(verifyBundle(bundle, ctx()).issues)).not.toContain(
      'ID_BIRTH_YEAR_MISMATCH',
    );
  });

  it('flags an ID issued before the holder was born', () => {
    const bundle = sampleBundle();
    bundle.people[0].idIssueDate = { raw: '09/04/1980', iso: '1980-04-09' };
    expect(codes(verifyBundle(bundle, ctx()).issues)).toContain(
      'ID_ISSUED_BEFORE_BIRTH',
    );
  });

  it('blanks an ISO date that is not a real calendar day', () => {
    const bundle = sampleBundle();
    bundle.documents[1].date = { raw: '31/02/2026', iso: '2026-02-31' };
    const { cleaned, issues } = verifyBundle(bundle, ctx());
    expect(cleaned.documents[1].date?.iso).toBeNull();
    expect(codes(issues)).toContain('DATE_INVALID');
  });
});

describe('verifyBundle: structure and coverage', () => {
  it('reports a reference to something that does not exist, and removes it', () => {
    const bundle = sampleBundle();
    bundle.events[0].personIds.push('ghost');
    const { cleaned, issues } = verifyBundle(bundle, ctx());
    expect(cleaned.events[0].personIds).not.toContain('ghost');
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'BROKEN_REFERENCE' }),
    );
  });

  it('reports a transcript segment that no point covers and that is not declared point-free', () => {
    const { issues } = verifyBundle(
      sampleBundle(),
      ctx({ segmentIds: ['s1', 's2', 's3'] }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'UNASSIGNED_SEGMENT',
        detail: { segmentId: 's3' },
      }),
    );
  });

  it('accepts a segment listed as carrying no point', () => {
    const bundle = sampleBundle();
    bundle.noPointSegmentIds = ['s3'];
    expect(
      codes(
        verifyBundle(bundle, ctx({ segmentIds: ['s1', 's2', 's3'] })).issues,
      ),
    ).toEqual([]);
  });

  it('counts a segment as covered when a point cites it, with no separate list', () => {
    const bundle = sampleBundle();
    bundle.points[0].segmentIds = ['s1', 's3'];
    expect(
      codes(
        verifyBundle(bundle, ctx({ segmentIds: ['s1', 's2', 's3'] })).issues,
      ),
    ).not.toContain('UNASSIGNED_SEGMENT');
  });

  it('reports a point the summary leaves out', () => {
    const bundle = sampleBundle();
    bundle.summary.pointIds = ['k1'];
    expect(verifyBundle(bundle, ctx()).issues).toContainEqual(
      expect.objectContaining({
        code: 'POINT_NOT_IN_SUMMARY',
        detail: { pointId: 'k2' },
      }),
    );
  });

  it('reports a grouped figure in the transcript that the analysis never mentions', () => {
    const extra = {
      ...transcripts,
      p3: transcripts.p3 + '\nđã chuyển thêm 28.500.000 đồng',
    };
    const { issues } = verifyBundle(
      sampleBundle(),
      ctx({ transcripts: extra }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'FIGURE_NOT_IN_ANALYSIS',
        detail: { value: 28500000 },
      }),
    );
  });

  it('does not mistake an ID number or a plain year for a figure', () => {
    expect(codes(verifyBundle(sampleBundle(), ctx()).issues)).not.toContain(
      'FIGURE_NOT_IN_ANALYSIS',
    );
  });
});

describe('verifyBundle: purity', () => {
  it('does not modify the bundle it is given', () => {
    const bundle = sampleBundle();
    bundle.people[1].evidence = [{ pageId: 'p2', quote: 'không có' }];
    const before = JSON.stringify(bundle);
    verifyBundle(bundle, ctx());
    expect(JSON.stringify(bundle)).toBe(before);
  });

  it('issues never carry transcript text, only codes, paths, ids and numbers', () => {
    const bundle = sampleBundle();
    bundle.people[0].evidence = [
      { pageId: 'p2', quote: 'Họ và tên: Người Không Có' },
    ];
    const text = JSON.stringify(verifyBundle(bundle, ctx()).issues);
    expect(text).not.toContain('Người Không Có');
    expect(text).not.toContain('079190012345');
  });
});
