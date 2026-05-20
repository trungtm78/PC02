import { describe, it, expect } from 'vitest';
import { AUDIT_FIELD_LABELS, getFieldLabel } from '../audit-field-labels';

describe('audit-field-labels — Vietnamese field label map', () => {
  describe('User fields', () => {
    it('translates firstName → "Họ"', () => {
      expect(getFieldLabel('firstName')).toBe('Họ');
    });
    it('translates lastName → "Tên"', () => {
      expect(getFieldLabel('lastName')).toBe('Tên');
    });
    it('translates email → "Email"', () => {
      expect(getFieldLabel('email')).toBe('Email');
    });
    it('translates workId → "Mã cán bộ"', () => {
      expect(getFieldLabel('workId')).toBe('Mã cán bộ');
    });
    it('translates phone → "Số điện thoại"', () => {
      expect(getFieldLabel('phone')).toBe('Số điện thoại');
    });
    it('translates isActive → "Trạng thái hoạt động"', () => {
      expect(getFieldLabel('isActive')).toBe('Trạng thái hoạt động');
    });
    it('translates roleId → "Vai trò"', () => {
      expect(getFieldLabel('roleId')).toBe('Vai trò');
    });
    it('translates canDispatch → "Quyền phân công"', () => {
      expect(getFieldLabel('canDispatch')).toBe('Quyền phân công');
    });
  });

  describe('Case fields', () => {
    it('translates status → "Trạng thái"', () => {
      expect(getFieldLabel('status')).toBe('Trạng thái');
    });
    it('translates crime → "Tội danh"', () => {
      expect(getFieldLabel('crime')).toBe('Tội danh');
    });
    it('translates investigatorId → "Điều tra viên"', () => {
      expect(getFieldLabel('investigatorId')).toBe('Điều tra viên');
    });
    it('translates deadline → "Hạn xử lý"', () => {
      expect(getFieldLabel('deadline')).toBe('Hạn xử lý');
    });
    it('translates assignedTeamId → "Tổ phụ trách"', () => {
      expect(getFieldLabel('assignedTeamId')).toBe('Tổ phụ trách');
    });
  });

  describe('Incident fields', () => {
    it('translates incidentType → "Loại vụ việc"', () => {
      expect(getFieldLabel('incidentType')).toBe('Loại vụ việc');
    });
    it('translates fromDate → "Từ ngày"', () => {
      expect(getFieldLabel('fromDate')).toBe('Từ ngày');
    });
    it('translates toDate → "Đến ngày"', () => {
      expect(getFieldLabel('toDate')).toBe('Đến ngày');
    });
  });

  describe('Petition fields', () => {
    it('translates senderName → "Tên người gửi"', () => {
      expect(getFieldLabel('senderName')).toBe('Tên người gửi');
    });
    it('translates senderPhone → "SĐT người gửi"', () => {
      expect(getFieldLabel('senderPhone')).toBe('SĐT người gửi');
    });
    it('translates petitionType → "Loại đơn"', () => {
      expect(getFieldLabel('petitionType')).toBe('Loại đơn');
    });
    it('translates summary → "Tóm tắt"', () => {
      expect(getFieldLabel('summary')).toBe('Tóm tắt');
    });
  });

  describe('fallback behavior', () => {
    it('returns raw field name when not mapped', () => {
      expect(getFieldLabel('unknownField')).toBe('unknownField');
    });
    it('returns raw camelCase for new/unmapped fields', () => {
      expect(getFieldLabel('brandNewField')).toBe('brandNewField');
    });
  });

  describe('coverage check', () => {
    it('has at least 60 mapped labels (target ~80 fields across 4 resources)', () => {
      expect(Object.keys(AUDIT_FIELD_LABELS).length).toBeGreaterThanOrEqual(60);
    });
  });
});
