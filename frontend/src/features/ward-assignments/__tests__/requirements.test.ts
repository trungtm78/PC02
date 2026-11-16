import { describe, expect, it } from 'vitest';
import { addLine, blankLines, moveLine, removeLine, setLine, trimLines } from '../requirements';

describe('the numbered requirements editor (pure list operations)', () => {
  it('adds an empty line at the end', () => {
    expect(addLine(['a'])).toEqual(['a', '']);
  });

  it('moves a line up and down, and leaves the list as it is at either end', () => {
    expect(moveLine(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveLine(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveLine(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveLine(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('removes and rewrites one line without touching the input', () => {
    const lines = ['a', 'b', 'c'];
    expect(removeLine(lines, 1)).toEqual(['a', 'c']);
    expect(setLine(lines, 0, 'x')).toEqual(['x', 'b', 'c']);
    expect(lines).toEqual(['a', 'b', 'c']);
  });

  it('sends the lines trimmed and keeps a blank one (the server refuses it: the numbering is the one seen)', () => {
    expect(trimLines(['  a ', '', '   ', 'b'])).toEqual(['a', '', '', 'b']);
    expect(blankLines(['  a ', '', '   ', 'b'])).toEqual([2, 3]);
  });
});
