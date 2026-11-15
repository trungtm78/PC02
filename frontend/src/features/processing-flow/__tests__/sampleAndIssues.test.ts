import { describe, it, expect } from 'vitest';
import { DEFAULT_SAMPLE_ANCHORS, anchorsBody, sampleAnchorKeys } from '../sampleAnchors';
import { boundConflictLines, inactiveTeamLine, issueLine } from '../issueText';
import { processingFlow as L } from '@/locales/processingFlow.vi';

describe('the dates of the imagined record', () => {
  it('a petition and an incident have four dates, a case has the two more only a case carries', () => {
    expect(sampleAnchorKeys('PETITION')).toEqual(['RECEIVED', 'PROPOSED', 'ASSIGNED_TO_UNIT', 'ACCEPTED']);
    expect(sampleAnchorKeys('INCIDENT')).toHaveLength(4);
    expect(sampleAnchorKeys('CASE')).toEqual(expect.arrayContaining(['PROSECUTED', 'MINUTES_RECEIVED']));
    expect(sampleAnchorKeys('CASE')).toHaveLength(6);
  });

  it('the defaults are fixed illustrative days (no clock): the same on every run', () => {
    expect(DEFAULT_SAMPLE_ANCHORS.RECEIVED).toBe('2026-12-01');
    expect(Object.values(DEFAULT_SAMPLE_ANCHORS).every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
  });

  it('only the dates of the kind that hold a whole day go into the request', () => {
    const body = anchorsBody({ ...DEFAULT_SAMPLE_ANCHORS, ACCEPTED: '' }, 'PETITION');
    expect(Object.keys(body).sort()).toEqual(['ASSIGNED_TO_UNIT', 'PROPOSED', 'RECEIVED']);
    expect(anchorsBody(DEFAULT_SAMPLE_ANCHORS, 'CASE')).toHaveProperty('PROSECUTED', '2026-12-15');
    expect(anchorsBody({ RECEIVED: '2026-1-5' }, 'CASE')).toEqual({});
  });
});

describe('the lines under a refused publish', () => {
  it('names the step by position and name, and the flow as a whole when no step is given', () => {
    expect(issueLine({ code: 'STEP_NAME_REQUIRED', stepIndex: 1 }, ['A', 'Xác minh'])).toBe(`Bước 2 (Xác minh): ${L.errors.STEP_NAME_REQUIRED}`);
    expect(issueLine({ code: 'FLOW_HAS_NO_STEPS' }, [])).toBe(`Quy trình: ${L.errors.FLOW_HAS_NO_STEPS}`);
  });

  it('a step with no name yet is named by its position only', () => {
    expect(issueLine({ code: 'STEP_NAME_REQUIRED', stepIndex: 0 }, [''])).toBe(`Bước 1: ${L.errors.STEP_NAME_REQUIRED}`);
  });

  it('names the unit that stopped, or says it is unknown', () => {
    const line = (id: string) => inactiveTeamLine({ stepIndex: 0, stepKey: 's', teamId: id }, ['Tiếp nhận'], (t) => (t === 't9' ? 'Tổ 9' : null));
    expect(line('t9')).toBe('Bước 1 (Tiếp nhận): Tổ 9');
    expect(line('zz')).toBe(`Bước 1 (Tiếp nhận): ${L.publish.unknownTeam}`);
  });

  it('says which flow already holds each type', () => {
    expect(boundConflictLines([{ directoryId: 'd1', flowName: 'Tố cáo' }, { directoryId: 'd2' }], (c) => c.directoryId ?? '')).toEqual([
      'd1 đang áp cho quy trình "Tố cáo"',
      `d2 đang áp cho quy trình "${L.bound.unknownFlow}"`,
    ]);
  });
});
