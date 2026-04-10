/**
 * Unit Tests — Workflow Processing Pages Business Logic
 * TASK_ID: TASK-2026-260216 | EXECUTION_ID: INTAKE-20260226-01-A4B8
 *
 * Tests pure logic extracted from:
 *   - TransferAndReturnPage.tsx  (SCR-PF-01)
 *   - PetitionGuidancePage.tsx   (SCR-PF-02)
 *   - CaseExchangePage.tsx       (SCR-PF-03)
 *   - InvestigationDelegationPage.tsx (SCR-PF-04)
 *
 * Coverage target: ≥ 80% of branching logic
 */

import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// SCR-PF-01: TransferAndReturnPage — EC-02 (closed record guard)
// ═══════════════════════════════════════════════════════════════════════════════

type CaseStatus = string;
interface CaseRecord {
  id: string;
  status: CaseStatus;
  isClosed?: boolean;
}

/** Mirrors TransferAndReturnPage.tsx handleTransferClick guard logic */
function canTransferSelection(
  records: CaseRecord[],
  selectedIds: string[],
): { allowed: boolean; reason?: string } {
  if (selectedIds.length === 0) {
    return { allowed: false, reason: 'Chưa chọn hồ sơ nào' };
  }
  const selectedRecords = records.filter((r) => selectedIds.includes(r.id));
  const hasClosedRecord = selectedRecords.some((r) => r.isClosed);
  if (hasClosedRecord) {
    return {
      allowed: false,
      reason: 'Không thể chuyển hồ sơ đã ở trạng thái "Đã đóng".',
    };
  }
  return { allowed: true };
}

/** Mirrors filteredRecords logic (quick search) */
function filterRecords(records: CaseRecord[], quickSearch: string): CaseRecord[] {
  if (!quickSearch) return records;
  const q = quickSearch.toLowerCase();
  return records.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q),
  );
}

const MOCK_RECORDS: CaseRecord[] = [
  { id: 'DT-001', status: 'Đang xử lý', isClosed: false },
  { id: 'VV-002', status: 'Đang điều tra', isClosed: false },
  { id: 'VA-003', status: 'Đã đóng', isClosed: true },
  { id: 'DT-004', status: 'Mới tiếp nhận', isClosed: false },
];

describe('SCR-PF-01 TransferAndReturn — canTransferSelection()', () => {
  it('AC-04 / EC-02: blocks transfer when no records selected', () => {
    const result = canTransferSelection(MOCK_RECORDS, []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('EC-02: blocks transfer when a closed record is selected', () => {
    const result = canTransferSelection(MOCK_RECORDS, ['VA-003']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Đã đóng');
  });

  it('EC-02: blocks transfer when mix of open + closed records selected', () => {
    const result = canTransferSelection(MOCK_RECORDS, ['DT-001', 'VA-003']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Đã đóng');
  });

  it('allows transfer when only open records selected', () => {
    const result = canTransferSelection(MOCK_RECORDS, ['DT-001', 'VV-002']);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows transfer for single open record', () => {
    const result = canTransferSelection(MOCK_RECORDS, ['DT-004']);
    expect(result.allowed).toBe(true);
  });

  it('blocks transfer if only closed record selected (singleton)', () => {
    const result = canTransferSelection(MOCK_RECORDS, ['VA-003']);
    expect(result.allowed).toBe(false);
  });
});

describe('SCR-PF-01 TransferAndReturn — filterRecords()', () => {
  it('returns all records when quickSearch is empty', () => {
    expect(filterRecords(MOCK_RECORDS, '')).toHaveLength(4);
  });

  it('filters by id substring (case-insensitive)', () => {
    const result = filterRecords(MOCK_RECORDS, 'dt');
    expect(result.map((r) => r.id)).toEqual(['DT-001', 'DT-004']);
  });

  it('filters by status keyword', () => {
    const result = filterRecords(MOCK_RECORDS, 'đóng');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('VA-003');
  });

  it('returns empty array when no match', () => {
    expect(filterRecords(MOCK_RECORDS, 'xyz-nomatch')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCR-PF-02: PetitionGuidancePage — Validation + EC-04 (phone optional)
// ═══════════════════════════════════════════════════════════════════════════════

interface GuidanceFormData {
  guidedPerson: string;
  guidedPersonPhone: string; // EC-04: optional
  subject: string;
  guidanceContent: string;
  notes: string;
}

interface GuidanceFormErrors {
  guidedPerson?: string;
  subject?: string;
  guidanceContent?: string;
}

/** Mirrors PetitionGuidancePage.tsx handleSave validation */
function validateGuidanceForm(form: GuidanceFormData): GuidanceFormErrors {
  const errors: GuidanceFormErrors = {};
  if (!form.guidedPerson.trim()) {
    errors.guidedPerson = 'Vui lòng nhập tên người được hướng dẫn';
  }
  if (!form.subject.trim()) {
    errors.subject = 'Vui lòng nhập vấn đề cần hướng dẫn';
  }
  if (!form.guidanceContent.trim()) {
    errors.guidanceContent = 'Vui lòng nhập nội dung hướng dẫn';
  }
  return errors;
}

describe('SCR-PF-02 PetitionGuidance — validateGuidanceForm()', () => {
  it('AC-04: passes validation with all required fields, no phone', () => {
    const errors = validateGuidanceForm({
      guidedPerson: 'Nguyễn Văn A',
      guidedPersonPhone: '',  // EC-04: phone is optional
      subject: 'Khiếu nại đất đai',
      guidanceContent: 'Hướng dẫn nộp đơn lên UBND',
      notes: '',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('EC-04: phone is optional — no error when blank', () => {
    const errors = validateGuidanceForm({
      guidedPerson: 'Trần Thị B',
      guidedPersonPhone: '',
      subject: 'Vấn đề',
      guidanceContent: 'Nội dung',
      notes: '',
    });
    expect(errors).not.toHaveProperty('guidedPersonPhone');
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('fails when guidedPerson is blank', () => {
    const errors = validateGuidanceForm({
      guidedPerson: '',
      guidedPersonPhone: '0901234567',
      subject: 'Vấn đề',
      guidanceContent: 'Nội dung',
      notes: '',
    });
    expect(errors.guidedPerson).toBeDefined();
  });

  it('fails when guidedPerson is whitespace only', () => {
    const errors = validateGuidanceForm({
      guidedPerson: '   ',
      guidedPersonPhone: '',
      subject: 'Vấn đề',
      guidanceContent: 'Nội dung',
      notes: '',
    });
    expect(errors.guidedPerson).toBeDefined();
  });

  it('fails when subject is blank', () => {
    const errors = validateGuidanceForm({
      guidedPerson: 'Nguyễn Văn A',
      guidedPersonPhone: '',
      subject: '',
      guidanceContent: 'Nội dung',
      notes: '',
    });
    expect(errors.subject).toBeDefined();
  });

  it('fails when guidanceContent is blank', () => {
    const errors = validateGuidanceForm({
      guidedPerson: 'Nguyễn Văn A',
      guidedPersonPhone: '',
      subject: 'Vấn đề',
      guidanceContent: '',
      notes: '',
    });
    expect(errors.guidanceContent).toBeDefined();
  });

  it('returns all 3 errors when all required fields empty', () => {
    const errors = validateGuidanceForm({
      guidedPerson: '',
      guidedPersonPhone: '',
      subject: '',
      guidanceContent: '',
      notes: '',
    });
    expect(Object.keys(errors)).toHaveLength(3);
  });
});

// ─── Stats derivation (mirrors PetitionGuidancePage) ─────────────────────────

type GuidanceStatus = 'pending' | 'completed' | 'cancelled';
interface GuidanceRecord { id: string; status: GuidanceStatus; date: string }

function computeGuidanceStats(records: GuidanceRecord[]) {
  return {
    total: records.length,
    completed: records.filter((g) => g.status === 'completed').length,
    pending: records.filter((g) => g.status === 'pending').length,
  };
}

const MOCK_GUIDANCES: GuidanceRecord[] = [
  { id: 'G1', status: 'completed', date: '2026-02-20' },
  { id: 'G2', status: 'pending', date: '2026-02-21' },
  { id: 'G3', status: 'completed', date: '2026-02-22' },
  { id: 'G4', status: 'cancelled', date: '2026-02-23' },
];

describe('SCR-PF-02 PetitionGuidance — computeGuidanceStats()', () => {
  it('counts total correctly', () => {
    expect(computeGuidanceStats(MOCK_GUIDANCES).total).toBe(4);
  });

  it('counts completed correctly', () => {
    expect(computeGuidanceStats(MOCK_GUIDANCES).completed).toBe(2);
  });

  it('counts pending correctly', () => {
    expect(computeGuidanceStats(MOCK_GUIDANCES).pending).toBe(1);
  });

  it('returns zeros for empty list', () => {
    const stats = computeGuidanceStats([]);
    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.pending).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCR-PF-03: CaseExchangePage — EC-01 (file size > 10MB)
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Mirrors CaseExchangePage.tsx handleFileChange validation */
function validateFileAttachment(fileSizeBytes: number): { valid: boolean; error?: string } {
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File vượt quá ${MAX_FILE_SIZE_MB}MB. Vui lòng chọn file nhỏ hơn.` };
  }
  return { valid: true };
}

function validateExchangeForm(data: {
  recordCode: string;
  receiverUnit: string;
  content: string;
}): { recordCode?: string; receiverUnit?: string; content?: string } {
  const errors: { recordCode?: string; receiverUnit?: string; content?: string } = {};
  if (!data.recordCode) errors.recordCode = 'Vui lòng nhập mã hồ sơ';
  if (!data.receiverUnit) errors.receiverUnit = 'Vui lòng chọn đơn vị nhận';
  if (!data.content) errors.content = 'Vui lòng nhập nội dung trao đổi';
  return errors;
}

describe('SCR-PF-03 CaseExchange — EC-01: file size validation', () => {
  it('accepts file exactly at 10MB', () => {
    const result = validateFileAttachment(MAX_FILE_SIZE_BYTES);
    expect(result.valid).toBe(true);
  });

  it('accepts file smaller than 10MB', () => {
    const result = validateFileAttachment(5 * 1024 * 1024); // 5MB
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('EC-01: rejects file of 10MB + 1 byte', () => {
    const result = validateFileAttachment(MAX_FILE_SIZE_BYTES + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10MB');
  });

  it('EC-01: rejects large file (50MB)', () => {
    const result = validateFileAttachment(50 * 1024 * 1024);
    expect(result.valid).toBe(false);
  });

  it('accepts zero-byte file', () => {
    const result = validateFileAttachment(0);
    expect(result.valid).toBe(true);
  });
});

describe('SCR-PF-03 CaseExchange — validateExchangeForm()', () => {
  it('passes when all required fields filled', () => {
    const errors = validateExchangeForm({
      recordCode: 'DT-001',
      receiverUnit: 'Đội 1',
      content: 'Nội dung trao đổi',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('fails when recordCode missing', () => {
    const errors = validateExchangeForm({
      recordCode: '',
      receiverUnit: 'Đội 1',
      content: 'Nội dung',
    });
    expect(errors.recordCode).toBeDefined();
  });

  it('fails when receiverUnit missing', () => {
    const errors = validateExchangeForm({
      recordCode: 'DT-001',
      receiverUnit: '',
      content: 'Nội dung',
    });
    expect(errors.receiverUnit).toBeDefined();
  });

  it('fails when content missing', () => {
    const errors = validateExchangeForm({
      recordCode: 'DT-001',
      receiverUnit: 'Đội 1',
      content: '',
    });
    expect(errors.content).toBeDefined();
  });

  it('returns all 3 errors when all fields empty', () => {
    const errors = validateExchangeForm({ recordCode: '', receiverUnit: '', content: '' });
    expect(Object.keys(errors)).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCR-PF-04: InvestigationDelegationPage — EC-03 (format + duplicate check)
// ═══════════════════════════════════════════════════════════════════════════════

/** Mirrors InvestigationDelegationPage.tsx DELEGATION_NUMBER_REGEX */
const DELEGATION_NUMBER_REGEX = /^UT-\d{3}\/\d{4}$/;

const EXISTING_DELEGATION_NUMBERS = [
  'UT-001/2026',
  'UT-002/2026',
  'UT-003/2026',
];

interface DelegationFormData {
  delegationNumber: string;
  content: string;
  delegationDate: string;
  receivingUnit: string;
}

interface DelegationValidationErrors {
  delegationNumber?: string;
  content?: string;
  delegationDate?: string;
  receivingUnit?: string;
}

/** Mirrors validateForm() in InvestigationDelegationPage.tsx */
function validateDelegationForm(
  form: DelegationFormData,
  existingNumbers: string[],
  mode: 'add' | 'edit',
  editingOriginalNumber?: string,
): DelegationValidationErrors {
  const errors: DelegationValidationErrors = {};

  if (!form.delegationNumber.trim()) {
    errors.delegationNumber = 'Vui lòng nhập số ủy thác';
  } else if (!DELEGATION_NUMBER_REGEX.test(form.delegationNumber)) {
    errors.delegationNumber = 'Số ủy thác phải có định dạng UT-XXX/YYYY (VD: UT-001/2026)';
  } else {
    // EC-03: duplicate check
    const isEditingSelf = mode === 'edit' && editingOriginalNumber === form.delegationNumber;
    const isDuplicate = !isEditingSelf && existingNumbers.includes(form.delegationNumber);
    if (isDuplicate) {
      errors.delegationNumber = `Số ủy thác "${form.delegationNumber}" đã tồn tại.`;
    }
  }

  if (!form.content.trim()) {
    errors.content = 'Vui lòng nhập nội dung ủy thác';
  } else if (form.content.trim().length < 10) {
    errors.content = 'Nội dung phải có ít nhất 10 ký tự';
  }

  if (!form.delegationDate) {
    errors.delegationDate = 'Vui lòng chọn ngày ủy thác';
  }

  if (!form.receivingUnit.trim()) {
    errors.receivingUnit = 'Vui lòng chọn đơn vị nhận';
  }

  return errors;
}

describe('SCR-PF-04 InvestigationDelegation — DELEGATION_NUMBER_REGEX', () => {
  it('accepts valid format UT-001/2026', () => {
    expect(DELEGATION_NUMBER_REGEX.test('UT-001/2026')).toBe(true);
  });

  it('accepts UT-999/2099', () => {
    expect(DELEGATION_NUMBER_REGEX.test('UT-999/2099')).toBe(true);
  });

  it('rejects format without leading UT-', () => {
    expect(DELEGATION_NUMBER_REGEX.test('001/2026')).toBe(false);
  });

  it('rejects format with letters in number part', () => {
    expect(DELEGATION_NUMBER_REGEX.test('UT-ABC/2026')).toBe(false);
  });

  it('rejects format with only 2 digits', () => {
    expect(DELEGATION_NUMBER_REGEX.test('UT-01/2026')).toBe(false);
  });

  it('rejects format with 4 digit number part', () => {
    expect(DELEGATION_NUMBER_REGEX.test('UT-0001/2026')).toBe(false);
  });

  it('rejects format with 3-digit year', () => {
    expect(DELEGATION_NUMBER_REGEX.test('UT-001/202')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(DELEGATION_NUMBER_REGEX.test('')).toBe(false);
  });
});

describe('SCR-PF-04 InvestigationDelegation — validateDelegationForm()', () => {
  const validForm: DelegationFormData = {
    delegationNumber: 'UT-010/2026',
    content: 'Nội dung ủy thác hợp lệ ít nhất 10 ký tự',
    delegationDate: '2026-02-26',
    receivingUnit: 'Công an Quận 1',
  };

  it('passes with all valid fields (new number)', () => {
    const errors = validateDelegationForm(validForm, EXISTING_DELEGATION_NUMBERS, 'add');
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('EC-03: fails add when delegation number already exists', () => {
    const errors = validateDelegationForm(
      { ...validForm, delegationNumber: 'UT-001/2026' },
      EXISTING_DELEGATION_NUMBERS,
      'add',
    );
    expect(errors.delegationNumber).toContain('đã tồn tại');
  });

  it('EC-03: allows edit keeping the same delegation number', () => {
    const errors = validateDelegationForm(
      { ...validForm, delegationNumber: 'UT-001/2026' },
      EXISTING_DELEGATION_NUMBERS,
      'edit',
      'UT-001/2026',   // editingOriginalNumber — same as form value
    );
    expect(errors.delegationNumber).toBeUndefined();
  });

  it('EC-03: fails edit when changing to a number used by another record', () => {
    const errors = validateDelegationForm(
      { ...validForm, delegationNumber: 'UT-002/2026' },
      EXISTING_DELEGATION_NUMBERS,
      'edit',
      'UT-001/2026',   // original was UT-001, changing to UT-002
    );
    expect(errors.delegationNumber).toContain('đã tồn tại');
  });

  it('fails with wrong format', () => {
    const errors = validateDelegationForm(
      { ...validForm, delegationNumber: 'INVALID' },
      EXISTING_DELEGATION_NUMBERS,
      'add',
    );
    expect(errors.delegationNumber).toContain('định dạng');
  });

  it('fails when content too short (< 10 chars)', () => {
    const errors = validateDelegationForm(
      { ...validForm, content: 'Ngắn' },
      EXISTING_DELEGATION_NUMBERS,
      'add',
    );
    expect(errors.content).toContain('10 ký tự');
  });

  it('fails when content is blank', () => {
    const errors = validateDelegationForm(
      { ...validForm, content: '' },
      EXISTING_DELEGATION_NUMBERS,
      'add',
    );
    expect(errors.content).toBeDefined();
  });

  it('fails when delegationDate is missing', () => {
    const errors = validateDelegationForm(
      { ...validForm, delegationDate: '' },
      EXISTING_DELEGATION_NUMBERS,
      'add',
    );
    expect(errors.delegationDate).toBeDefined();
  });

  it('fails when receivingUnit is blank', () => {
    const errors = validateDelegationForm(
      { ...validForm, receivingUnit: '' },
      EXISTING_DELEGATION_NUMBERS,
      'add',
    );
    expect(errors.receivingUnit).toBeDefined();
  });

  it('returns all 4 errors when form is completely empty', () => {
    const errors = validateDelegationForm(
      { delegationNumber: '', content: '', delegationDate: '', receivingUnit: '' },
      EXISTING_DELEGATION_NUMBERS,
      'add',
    );
    expect(Object.keys(errors)).toHaveLength(4);
  });
});

// ─── Delegation Stats derivation ─────────────────────────────────────────────

type DelegationStatus = 'pending' | 'received' | 'completed';
interface DelegationRecord { id: string; status: DelegationStatus }

function computeDelegationStats(records: DelegationRecord[]) {
  return {
    total: records.length,
    pending: records.filter((d) => d.status === 'pending').length,
    received: records.filter((d) => d.status === 'received').length,
    completed: records.filter((d) => d.status === 'completed').length,
  };
}

const MOCK_DELEGATIONS: DelegationRecord[] = [
  { id: '1', status: 'pending' },
  { id: '2', status: 'received' },
  { id: '3', status: 'completed' },
  { id: '4', status: 'received' },
  { id: '5', status: 'completed' },
];

describe('SCR-PF-04 InvestigationDelegation — computeDelegationStats()', () => {
  it('counts total correctly', () => {
    expect(computeDelegationStats(MOCK_DELEGATIONS).total).toBe(5);
  });

  it('counts pending correctly', () => {
    expect(computeDelegationStats(MOCK_DELEGATIONS).pending).toBe(1);
  });

  it('counts received correctly', () => {
    expect(computeDelegationStats(MOCK_DELEGATIONS).received).toBe(2);
  });

  it('counts completed correctly', () => {
    expect(computeDelegationStats(MOCK_DELEGATIONS).completed).toBe(2);
  });

  it('returns zeros for empty list', () => {
    const stats = computeDelegationStats([]);
    expect(stats.total).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.received).toBe(0);
    expect(stats.completed).toBe(0);
  });
});
