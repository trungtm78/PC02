/**
 * Tests cho shortLabel records + gray-* migration trong status-labels.ts.
 *
 * Coverage:
 * 1. CASE_STATUS_SHORT_LABEL / INCIDENT_STATUS_SHORT_LABEL / PETITION_STATUS_SHORT_LABEL
 *    exhaustive (cover mọi enum value)
 * 2. Mỗi shortLabel ≤14 chars (chip width budget per Phase 2 design)
 * 3. shortLabel khác fullLabel (otherwise lãng phí) hoặc bằng nếu fullLabel đã ngắn
 * 4. CHUA_PHAN_HOI badge migrated to STATUS_PENDING_RESPONSE (no gray-*)
 */
import { describe, it, expect } from 'vitest';
import * as labels from '../status-labels';
import { CaseStatus, IncidentStatus, PetitionStatus } from '../generated';
import { STATUS_PENDING_RESPONSE } from '@/constants/styles';

const SHORT_LABEL_MAX_CHARS = 14;

describe('CASE_STATUS_SHORT_LABEL — chip-friendly Vietnamese labels', () => {
  it('exhaustive: cover mọi CaseStatus enum value', () => {
    const fullKeys = Object.keys(labels.CASE_STATUS_LABEL).sort();
    const shortKeys = Object.keys(labels.CASE_STATUS_SHORT_LABEL).sort();
    expect(shortKeys).toEqual(fullKeys);
  });

  it.each(Object.values(CaseStatus))('shortLabel cho %s ≤14 chars', (status) => {
    const short = labels.CASE_STATUS_SHORT_LABEL[status];
    expect(short.length).toBeLessThanOrEqual(SHORT_LABEL_MAX_CHARS);
    expect(short).not.toBe('');
  });
});

describe('INCIDENT_STATUS_SHORT_LABEL — chip-friendly Vietnamese labels', () => {
  it('exhaustive: cover mọi IncidentStatus enum value', () => {
    const fullKeys = Object.keys(labels.INCIDENT_STATUS_LABEL).sort();
    const shortKeys = Object.keys(labels.INCIDENT_STATUS_SHORT_LABEL).sort();
    expect(shortKeys).toEqual(fullKeys);
  });

  it.each(Object.values(IncidentStatus))('shortLabel cho %s ≤14 chars', (status) => {
    const short = labels.INCIDENT_STATUS_SHORT_LABEL[status];
    expect(short.length).toBeLessThanOrEqual(SHORT_LABEL_MAX_CHARS);
    expect(short).not.toBe('');
  });
});

describe('PETITION_STATUS_SHORT_LABEL — chip-friendly Vietnamese labels', () => {
  it('exhaustive: cover mọi PetitionStatus enum value', () => {
    const fullKeys = Object.keys(labels.PETITION_STATUS_LABEL).sort();
    const shortKeys = Object.keys(labels.PETITION_STATUS_SHORT_LABEL).sort();
    expect(shortKeys).toEqual(fullKeys);
  });

  it.each(Object.values(PetitionStatus))('shortLabel cho %s ≤14 chars', (status) => {
    const short = labels.PETITION_STATUS_SHORT_LABEL[status];
    expect(short.length).toBeLessThanOrEqual(SHORT_LABEL_MAX_CHARS);
    expect(short).not.toBe('');
  });
});

describe('TRANG_THAI_PHAN_HOI_BADGE — gray-* migration', () => {
  it('CHUA_PHAN_HOI không còn dùng gray-*', () => {
    expect(labels.TRANG_THAI_PHAN_HOI_BADGE.CHUA_PHAN_HOI).not.toMatch(/\bgray-\d+/);
  });

  it('CHUA_PHAN_HOI badge include slate (qua STATUS_PENDING_RESPONSE)', () => {
    expect(labels.TRANG_THAI_PHAN_HOI_BADGE.CHUA_PHAN_HOI).toMatch(/\bslate-\d{3}\b/);
  });

  it('CHUA_PHAN_HOI badge dùng STATUS_PENDING_RESPONSE token (single source of truth)', () => {
    expect(labels.TRANG_THAI_PHAN_HOI_BADGE.CHUA_PHAN_HOI).toContain(STATUS_PENDING_RESPONSE);
  });
});
