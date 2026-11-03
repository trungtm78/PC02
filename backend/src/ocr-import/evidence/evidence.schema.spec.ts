import { z } from 'zod';
import { findProviderUnsafeParts } from '../../llm/provider-safe-schema';
import {
  EVIDENCE_BUNDLE_JSON_SCHEMA,
  EvidenceBundleSchema,
  type EvidenceBundle,
} from './evidence.schema';

const ref = (pageId: string, quote: string) => ({ pageId, quote });
const date = (raw: string, iso: string | null) => ({ raw, iso });

/** A synthetic complaint plus a transfer slip, in the shape the analysis stage must return. */
function validBundle(): EvidenceBundle {
  return {
    documents: [
      {
        id: 'd1',
        docType: 'TRANSFER_SLIP',
        number: '598/PC',
        date: date('16/10/2026', '2026-10-16'),
        issuer: 'Văn phòng cơ quan A',
        addressedTo: 'Phòng B',
        pageIds: ['p1'],
        relations: [{ targetId: 'd2', relation: 'FORWARDS' }],
      },
      {
        id: 'd2',
        docType: 'COMPLAINT',
        number: null,
        date: date('29/09/2026', '2026-09-29'),
        issuer: null,
        addressedTo: 'Cơ quan cảnh sát điều tra',
        pageIds: ['p2', 'p3'],
        relations: [],
      },
    ],
    people: [
      {
        id: 'u1',
        entityType: 'PERSON',
        name: 'Nguyễn Thị Hương',
        roles: ['COMPLAINANT'],
        idNumber: '079190012345',
        idIssueDate: null,
        idIssuePlace: null,
        birthDate: null,
        birthYear: '1990',
        phone: null,
        address: '12/3 Lê Lợi, TP. Hồ Chí Minh',
        claimKind: 'QUOTED',
        evidence: [ref('p2', 'Họ và tên: Nguyễn Thị Hương')],
      },
    ],
    amounts: [
      {
        id: 'a1',
        amountKind: 'LOSS_TOTAL',
        digits: '495.253.647',
        words:
          'Bốn trăm chín mươi lăm triệu hai trăm năm mươi ba nghìn sáu trăm bốn mươi bảy đồng',
        valueVnd: 495253647,
        date: null,
        purpose: 'chiếm đoạt tài sản',
        claimKind: 'QUOTED',
        evidence: [ref('p2', '495.253.647 đồng')],
      },
    ],
    events: [
      {
        id: 'e1',
        date: date('17 tháng 9 năm 2023', '2023-09-17'),
        place: 'TP. Dĩ An',
        description: 'Người tố cáo được giới thiệu giao thầu công trình.',
        personIds: ['u1'],
        amountIds: [],
        claimKind: 'QUOTED',
        evidence: [ref('p2', 'Ngày 17 tháng 9 năm 2023')],
      },
    ],
    legalAssessments: [
      {
        id: 'l1',
        offence: 'Lừa đảo chiếm đoạt tài sản',
        article: 174,
        law: 'BLHS 2015',
        reason: 'Người tố cáo nêu Điều 174.',
        claimKind: 'QUOTED',
        evidence: [ref('p3', 'Điều 174 Bộ luật hình sự 2015')],
      },
    ],
    sourceClass: {
      value: 'DENUNCIATION',
      reason: 'Người viết đơn tố cáo hành vi phạm tội.',
      claimKind: 'INFERRED',
      evidence: [ref('p2', 'ĐƠN TỐ CÁO')],
    },
    requests: [
      {
        id: 'r1',
        text: 'Xác minh và khởi tố vụ án hình sự.',
        evidence: [ref('p3', 'Xác minh và khởi tố vụ án')],
      },
    ],
    contradictions: [
      {
        id: 'c1',
        topic: 'AMOUNT',
        description: 'Hai số tiền khác nhau giữa các trang.',
        itemRefs: ['a1'],
        evidence: [],
      },
    ],
    points: [
      { id: 'k1', text: 'Bị chiếm đoạt 495.253.647 đồng.', segmentIds: ['s1'] },
    ],
    segmentCoverage: [
      { segmentId: 's1', pointIds: ['k1'], carriesNoPointReason: null },
      { segmentId: 's2', pointIds: [], carriesNoPointReason: 'national motto' },
    ],
    unreadable: [{ pageId: 'p3', note: 'stamp covers the date' }],
    summary: {
      opening: 'Bà Hương tố cáo bị chiếm đoạt tài sản.',
      pointIds: ['k1'],
    },
    mixedBundleWarning: false,
  };
}

describe('EvidenceBundleSchema', () => {
  it('accepts a complete, well-formed bundle', () => {
    expect(EvidenceBundleSchema.parse(validBundle())).toEqual(validBundle());
  });

  it('rejects an unknown claim kind, role or document type instead of passing them through', () => {
    const badKind = validBundle();
    (badKind.people[0] as { claimKind: string }).claimKind = 'GUESSED';
    expect(EvidenceBundleSchema.safeParse(badKind).success).toBe(false);

    const badRole = validBundle();
    (badRole.people[0].roles as string[]) = ['SUSPECT'];
    expect(EvidenceBundleSchema.safeParse(badRole).success).toBe(false);

    const badDoc = validBundle();
    (badDoc.documents[0] as { docType: string }).docType = 'MEMO';
    expect(EvidenceBundleSchema.safeParse(badDoc).success).toBe(false);
  });

  it('keeps accused and complainant as distinct roles: there is no SUSPECT / defendant role at all', () => {
    const roles =
      EvidenceBundleSchema.shape.people.element.shape.roles.element.options;
    expect(roles).toContain('COMPLAINANT');
    expect(roles).toContain('ACCUSED');
    expect(roles).not.toContain('SUSPECT');
    expect(roles).not.toContain('DEFENDANT');
  });

  it('rejects a non-integer VND amount and unknown extra keys (model drift)', () => {
    const fractional = validBundle();
    fractional.amounts[0].valueVnd = 12.5;
    expect(EvidenceBundleSchema.safeParse(fractional).success).toBe(false);

    const extra = { ...validBundle(), invented: true };
    expect(EvidenceBundleSchema.safeParse(extra).success).toBe(false);
  });

  it('requires every field: null is allowed where unknown, missing is not', () => {
    const missing = validBundle() as unknown as {
      people: Record<string, unknown>[];
    };
    delete missing.people[0].phone;
    expect(EvidenceBundleSchema.safeParse(missing).success).toBe(false);
  });

  it('exports a JSON schema every provider accepts (the cross-provider contract)', () => {
    expect(findProviderUnsafeParts(EVIDENCE_BUNDLE_JSON_SCHEMA)).toEqual([]);
    expect((EVIDENCE_BUNDLE_JSON_SCHEMA as { type: string }).type).toBe(
      'object',
    );
  });

  it('the provider-safe check really fails when the schema is made unsafe (seeded fault)', () => {
    const unsafe = z.strictObject({ s: z.string().regex(/x/) });
    expect(
      findProviderUnsafeParts(
        z.toJSONSchema(unsafe) as Record<string, unknown>,
      ),
    ).not.toEqual([]);
  });
});
