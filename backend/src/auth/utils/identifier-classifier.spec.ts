import { classifyIdentifier } from './identifier-classifier';

describe('classifyIdentifier (multi-field login disambiguator)', () => {
  it('classify email shape', () => {
    expect(classifyIdentifier('admin@pc02.local')).toEqual({
      field: 'email',
      value: 'admin@pc02.local',
    });
  });

  it('lowercase email value', () => {
    expect(classifyIdentifier('Admin@PC02.LOCAL').value).toBe('admin@pc02.local');
  });

  it('classify phone — 10 digit Vietnamese mobile (canonicalize to +84)', () => {
    expect(classifyIdentifier('0934314279')).toEqual({
      field: 'phone',
      value: '+84934314279',
    });
  });

  it('classify phone — normalize whitespace + canonicalize', () => {
    expect(classifyIdentifier('0934 314 279').value).toBe('+84934314279');
  });

  it('classify phone — normalize dot separator + canonicalize', () => {
    expect(classifyIdentifier('0934.314.279').value).toBe('+84934314279');
  });

  it('classify phone — normalize dash separator + canonicalize', () => {
    expect(classifyIdentifier('0934-314-279').value).toBe('+84934314279');
  });

  it('classify phone with +84 prefix (already canonical)', () => {
    expect(classifyIdentifier('+84934314279')).toEqual({
      field: 'phone',
      value: '+84934314279',
    });
  });

  it('classify workId — XXX-XXX format', () => {
    expect(classifyIdentifier('277-794')).toEqual({
      field: 'workId',
      value: '277-794',
    });
  });

  // v0.27: legacy seed users dùng prefix PC02-DTV-NNN, classifier phải accept cả 2 shapes.
  it('classify workId — legacy PC02-DTV-NNN format', () => {
    expect(classifyIdentifier('PC02-DTV-001')).toEqual({
      field: 'workId',
      value: 'PC02-DTV-001',
    });
  });

  it('classify workId — legacy PC02-DTV-005', () => {
    expect(classifyIdentifier('PC02-DTV-005').field).toBe('workId');
  });

  it('classify workId — không match khi chỉ có 1 dash hoặc thiếu digits', () => {
    expect(classifyIdentifier('PC02-DTV').field).toBe('username');
  });

  // v0.27: Vietnam phone canonicalization — mọi format đều canonicalize về +84
  it('phone canonicalize — local 0934 → +84934', () => {
    expect(classifyIdentifier('0934314279').value).toBe('+84934314279');
  });

  it('phone canonicalize — 84 prefix → +84', () => {
    expect(classifyIdentifier('84934314279').value).toBe('+84934314279');
  });

  it('phone canonicalize — +84 already canonical (no-op)', () => {
    expect(classifyIdentifier('+84934314279').value).toBe('+84934314279');
  });

  it('phone canonicalize — separators stripped then canonicalized', () => {
    expect(classifyIdentifier('0934.314.279').value).toBe('+84934314279');
    expect(classifyIdentifier('+84 934 314 279').value).toBe('+84934314279');
  });

  it('classify username — fallback (any other shape)', () => {
    expect(classifyIdentifier('admin')).toEqual({
      field: 'username',
      value: 'admin',
    });
  });

  it('classify username — alphanumeric mix', () => {
    expect(classifyIdentifier('cb.tungh')).toEqual({
      field: 'username',
      value: 'cb.tungh',
    });
  });

  it('trim whitespace input', () => {
    expect(classifyIdentifier('  admin@pc02.local  ').value).toBe('admin@pc02.local');
  });

  // Collision resolution: User A workId='0934314279' (digits only, 10 chars — but workId
  // shape requires XXX-XXX format with dash) vs User B phone='0934314279'. Since workId
  // regex requires literal dash, '0934314279' classifies as PHONE → query phone field
  // → no collision. User A's workId '277-794' would only match workId regex.
  it('collision-safe: phone-shape string never matches workId field', () => {
    // 10 digits without dash — phone shape only
    const result = classifyIdentifier('0934314279');
    expect(result.field).toBe('phone');
    expect(result.field).not.toBe('workId');
  });

  it('collision-safe: workId-shape string never matches phone field', () => {
    // XXX-XXX format — workId shape only
    const result = classifyIdentifier('277-794');
    expect(result.field).toBe('workId');
    expect(result.field).not.toBe('phone');
  });
});
