import { describe, it, expect } from 'vitest';
import { boundLabels, copyName, countByKind, versionText, visibleFlows } from '../list';
import type { FlowSummaryDto } from '../types';

const flow = (over: Partial<FlowSummaryDto> = {}): FlowSummaryDto => ({
  id: 'f1',
  recordKind: 'PETITION',
  name: 'Khiếu nại',
  description: null,
  isDefault: false,
  status: 'ACTIVE',
  revision: 1,
  archivedAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  createdById: 'u1',
  updatedById: 'u1',
  boundTypes: [],
  boundGroups: [],
  stepCount: 3,
  publishedVersionNo: 2,
  draftVersionNo: null,
  ...over,
});

const type = (name: string) => ({ directoryId: name, name, code: name, isActive: true, typeKey: name, currentTypeKey: name, renamed: false });

describe('the version summary of a flow', () => {
  it('a published version alone reads "N · đang dùng"', () => {
    expect(versionText(flow({ publishedVersionNo: 2, draftVersionNo: null }))).toBe('2 · đang dùng');
  });

  it('a draft alone reads "N (nháp)"', () => {
    expect(versionText(flow({ publishedVersionNo: null, draftVersionNo: 3 }))).toBe('3 (nháp)');
  });

  it('both: the published one in use and the draft that follows', () => {
    expect(versionText(flow({ publishedVersionNo: 2, draftVersionNo: 3 }))).toBe('2 · đang dùng, 3 (nháp)');
  });

  it('neither says so', () => {
    expect(versionText(flow({ publishedVersionNo: null, draftVersionNo: null }))).toBe('Chưa có');
  });
});

describe('what a flow is applied to', () => {
  it('lists bound information types then deadline groups, in words', () => {
    const labels = boundLabels(flow({ boundTypes: [type('Khiếu nại')], boundGroups: ['TO_CAO'] }));
    expect(labels).toEqual(['Khiếu nại', 'Nhóm hạn: Tố cáo']);
  });

  it('nothing bound is an empty list', () => {
    expect(boundLabels(flow())).toEqual([]);
  });
});

describe('the tabs and what they hold', () => {
  const list = [
    flow({ id: 'a', recordKind: 'PETITION' }),
    flow({ id: 'b', recordKind: 'PETITION', status: 'ARCHIVED' }),
    flow({ id: 'c', recordKind: 'INCIDENT' }),
  ];

  it('counts the flows of each record kind', () => {
    expect(countByKind(list)).toEqual({ PETITION: 2, INCIDENT: 1, CASE: 0 });
  });

  it('shows one kind at a time, in the order the server gave', () => {
    expect(visibleFlows(list, 'PETITION').map((f) => f.id)).toEqual(['a', 'b']);
    expect(visibleFlows(list, 'CASE')).toEqual([]);
  });
});

describe('the name of a copy', () => {
  it('adds " (bản chép)"', () => {
    expect(copyName('Tố cáo', ['Tố cáo'])).toBe('Tố cáo (bản chép)');
  });

  it('counts up when that name is taken', () => {
    expect(copyName('Tố cáo', ['Tố cáo', 'Tố cáo (bản chép)'])).toBe('Tố cáo (bản chép 2)');
    expect(copyName('Tố cáo', ['Tố cáo (bản chép)', 'Tố cáo (bản chép 2)'])).toBe('Tố cáo (bản chép 3)');
  });

  it('compares names without regard to case or surrounding spaces (the server does)', () => {
    expect(copyName('Tố cáo', [' tố cáo (BẢN CHÉP) '])).toBe('Tố cáo (bản chép 2)');
  });
});
