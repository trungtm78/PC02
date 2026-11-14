import type { RecordKind } from '../gateway/record-snapshot';
import type { FlowStepInput } from './flow-steps';

/**
 * Flows an administrator can start from. Pure data: nothing here is written to the database until a person creates a
 * flow from a template, and that flow starts as a DRAFT.
 *
 * The figures come from secondary legal sources. Every step therefore names its legal basis and is created NOT
 * verified: a person compares it with the source text and confirms it on the settings screen. The thresholds (the
 * days before a deadline at which the alert colours start) are working conventions, not law.
 *
 * `legal-templates.spec.ts` pins every figure: changing one is a deliberate edit of both files.
 */
export interface LegalTemplate {
  /** Stable key (WIRE FORMAT: the screen sends it back when creating a flow). */
  key: string;
  recordKind: RecordKind;
  name: string;
  steps: readonly FlowStepInput[];
}

/** Every step of a template is worked by the unit holding the record. */
const RECORD_TEAM_IS_MAIN = [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }] as const;

const TEMPLATES: LegalTemplate[] = [
  {
    key: 'INCIDENT_CRIME_REPORT',
    recordKind: 'INCIDENT',
    name: 'Tố giác, tin báo về tội phạm, kiến nghị khởi tố',
    steps: [
      {
        name: 'Kiểm tra, xác minh',
        description:
          'Thời hạn 20 ngày kể từ ngày nhận được tố giác, tin báo về tội phạm, kiến nghị khởi tố. Vụ việc có nhiều tình tiết phức tạp có thể kéo dài tối đa 02 tháng; hết thời hạn đó có thể gia hạn một lần không quá 02 tháng.',
        durationValue: 20,
        durationUnit: 'DAY',
        anchor: 'RECEIVED',
        redDays: 1,
        yellowDays: 3,
        greenDays: 5,
        legalBasis: 'Điều 147 BLTTHS 2015',
        setsRecordDeadline: true,
        requiresApproval: true,
        maxExtensions: 2,
        extensionValue: 2,
        extensionUnit: 'MONTH',
        parties: RECORD_TEAM_IS_MAIN,
      },
    ],
  },
  {
    key: 'CASE_INVESTIGATION',
    recordKind: 'CASE',
    name: 'Điều tra vụ án hình sự',
    steps: [
      {
        name: 'Điều tra',
        description:
          'Thời hạn điều tra tính từ khi khởi tố vụ án, theo mức độ nghiêm trọng của tội phạm. Khi vụ án chưa ghi mức độ tội phạm, áp dụng thời hạn của tội phạm ít nghiêm trọng (ngắn nhất). Tội phạm nghiêm trọng được gia hạn hai lần: lần thứ nhất không quá 03 tháng, lần thứ hai không quá 02 tháng.',
        // The step's own figures apply while the gravity of the crime is not recorded: those of the least serious crime.
        durationValue: 2,
        durationUnit: 'MONTH',
        anchor: 'PROSECUTED',
        redDays: 3,
        yellowDays: 7,
        greenDays: 15,
        legalBasis: 'Điều 172 BLTTHS 2015',
        setsRecordDeadline: true,
        requiresApproval: true,
        maxExtensions: 1,
        extensionValue: 2,
        extensionUnit: 'MONTH',
        parties: RECORD_TEAM_IS_MAIN,
        variants: [
          { conditionKey: 'CRIME_GRAVITY', conditionValue: 'IT_NGHIEM_TRONG', durationValue: 2, durationUnit: 'MONTH', maxExtensions: 1, extensionValue: 2, extensionUnit: 'MONTH' },
          // Two extensions: the first of at most 3 months (stored), the second of at most 2 months (in the description).
          { conditionKey: 'CRIME_GRAVITY', conditionValue: 'NGHIEM_TRONG', durationValue: 3, durationUnit: 'MONTH', maxExtensions: 2, extensionValue: 3, extensionUnit: 'MONTH' },
          { conditionKey: 'CRIME_GRAVITY', conditionValue: 'RAT_NGHIEM_TRONG', durationValue: 4, durationUnit: 'MONTH', maxExtensions: 2, extensionValue: 4, extensionUnit: 'MONTH' },
          { conditionKey: 'CRIME_GRAVITY', conditionValue: 'DAC_BIET_NGHIEM_TRONG', durationValue: 4, durationUnit: 'MONTH', maxExtensions: 3, extensionValue: 4, extensionUnit: 'MONTH' },
        ],
      },
    ],
  },
  {
    key: 'PETITION_DENUNCIATION',
    recordKind: 'PETITION',
    name: 'Tố cáo',
    steps: [
      {
        name: 'Giải quyết tố cáo',
        description: 'Thời hạn giải quyết tố cáo tính từ ngày thụ lý tố cáo; được gia hạn theo quy định.',
        durationValue: 30,
        durationUnit: 'DAY',
        anchor: 'ACCEPTED',
        redDays: 2,
        yellowDays: 5,
        greenDays: 10,
        legalBasis: 'Điều 30 Luật Tố cáo 2018',
        setsRecordDeadline: true,
        requiresApproval: true,
        maxExtensions: 2,
        extensionValue: 30,
        extensionUnit: 'DAY',
        parties: RECORD_TEAM_IS_MAIN,
      },
    ],
  },
  {
    key: 'PETITION_COMPLAINT',
    recordKind: 'PETITION',
    name: 'Khiếu nại',
    steps: [
      {
        name: 'Thụ lý',
        description: 'Thời hạn thụ lý giải quyết khiếu nại tính từ ngày nhận được khiếu nại.',
        durationValue: 10,
        durationUnit: 'DAY',
        anchor: 'RECEIVED',
        redDays: 1,
        yellowDays: 3,
        greenDays: 5,
        legalBasis: 'Điều 27 Luật Khiếu nại 2011',
        parties: RECORD_TEAM_IS_MAIN,
      },
      {
        name: 'Giải quyết khiếu nại lần đầu',
        description: 'Thời hạn giải quyết khiếu nại lần đầu tính từ ngày thụ lý. Đối với vụ việc phức tạp, luật cho phép thời hạn đến 45 ngày.',
        durationValue: 30,
        durationUnit: 'DAY',
        anchor: 'ACCEPTED',
        redDays: 2,
        yellowDays: 5,
        greenDays: 10,
        legalBasis: 'Điều 28 Luật Khiếu nại 2011',
        setsRecordDeadline: true,
        requiresApproval: true,
        parties: RECORD_TEAM_IS_MAIN,
      },
    ],
  },
  {
    key: 'PETITION_RECOMMENDATION',
    recordKind: 'PETITION',
    name: 'Kiến nghị, phản ánh',
    steps: [
      {
        name: 'Xử lý, trả lời',
        durationValue: 15,
        durationUnit: 'DAY',
        anchor: 'RECEIVED',
        redDays: 1,
        yellowDays: 3,
        greenDays: 5,
        legalBasis: 'Thời hạn đang áp dụng trong hệ thống; chưa đối chiếu Luật Tiếp công dân 2013',
        setsRecordDeadline: true,
        parties: RECORD_TEAM_IS_MAIN,
      },
    ],
  },
];

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

export const LEGAL_TEMPLATES: readonly LegalTemplate[] = deepFreeze(TEMPLATES);

export function legalTemplate(key: string): LegalTemplate | undefined {
  return LEGAL_TEMPLATES.find((template) => template.key === key);
}
