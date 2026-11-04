import type { EvidenceBundle } from './evidence.schema';

const ref = (pageId: string, quote: string) => ({ pageId, quote });
const date = (raw: string, iso: string | null) => ({ raw, iso });

/**
 * A synthetic bundle shaped like the analysis stage's output for a transfer slip plus a typed complaint.
 * Every name, number and place is invented. Tests mutate a fresh copy per call.
 */
export function sampleBundle(): EvidenceBundle {
  return {
    documents: [
      {
        id: 'd1',
        docType: 'TRANSFER_SLIP',
        number: 'A100/PC-VP',
        date: date('28/10/2026', '2026-10-28'),
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
        roles: ['COMPLAINANT', 'VICTIM'],
        idNumber: '079 190 012 345',
        idIssueDate: date('09/04/2021', '2021-04-09'),
        idIssuePlace: 'Cục Cảnh sát QLHC về TTXH',
        birthDate: date('02/09/1990', '1990-09-02'),
        birthYear: '1990',
        phone: '0901234567',
        address: '12/3 Lê Lợi, phường Bến Nghé, TP. Hồ Chí Minh',
        claimKind: 'QUOTED',
        evidence: [ref('p2', 'Họ và tên: Nguyễn Thị Hương')],
      },
      {
        id: 'u2',
        entityType: 'PERSON',
        name: 'Trần Văn Bình',
        roles: ['ACCUSED'],
        idNumber: null,
        idIssueDate: null,
        idIssuePlace: null,
        birthDate: null,
        birthYear: null,
        phone: null,
        address: 'Thôn A, xã B, tỉnh C',
        claimKind: 'QUOTED',
        evidence: [ref('p2', 'ông Trần Văn Bình')],
      },
      {
        id: 'o1',
        entityType: 'ORGANIZATION',
        name: 'Văn phòng cơ quan A',
        roles: ['FORWARDING_AGENCY'],
        idNumber: null,
        idIssueDate: null,
        idIssuePlace: null,
        birthDate: null,
        birthYear: null,
        phone: null,
        address: null,
        claimKind: 'QUOTED',
        evidence: [ref('p1', 'Văn phòng cơ quan A')],
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
      {
        id: 'a2',
        amountKind: 'ADVANCE_PAID',
        digits: '20.000.000',
        words: null,
        valueVnd: 20000000,
        date: date('19/09/2023', '2023-09-19'),
        purpose: 'tạm ứng',
        claimKind: 'QUOTED',
        evidence: [ref('p3', '20 triệu đồng')],
      },
    ],
    events: [
      {
        id: 'e1',
        date: date('17 tháng 9 năm 2023', '2023-09-17'),
        place: 'TP. Dĩ An',
        description: 'Được giới thiệu giao thầu công trình.',
        personIds: ['u1', 'u2'],
        amountIds: [],
        claimKind: 'QUOTED',
        evidence: [ref('p2', 'Ngày 17 tháng 9 năm 2023')],
      },
      {
        id: 'e2',
        date: date('18/09/2023', '2023-09-18'),
        place: 'TP. Thủ Đức',
        description: 'Gặp nhau tại quán cà phê.',
        personIds: ['u1', 'u2'],
        amountIds: [],
        claimKind: 'QUOTED',
        evidence: [ref('p2', 'café tại quán')],
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
    contradictions: [],
    points: [
      { id: 'k1', text: 'Bị chiếm đoạt 495.253.647 đồng.', segmentIds: ['s1'] },
      {
        id: 'k2',
        text: 'Đề nghị xác minh và khởi tố vụ án.',
        segmentIds: ['s2'],
      },
    ],
    noPointSegmentIds: [],
    unreadable: [],
    summary: {
      opening:
        'Bà Nguyễn Thị Hương tố cáo ông Trần Văn Bình lừa đảo chiếm đoạt tài sản.',
      pointIds: ['k1', 'k2'],
    },
    modusOperandi: {
      text: 'Hứa giới thiệu công trình để nhận tiền ứng trước rồi bỏ đi.',
      claimKind: 'QUOTED',
      evidence: [ref('p3', 'đã dùng thủ đoạn gian dối')],
    },
    mixedBundleWarning: false,
  };
}
