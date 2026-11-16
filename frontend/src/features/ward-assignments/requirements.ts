/** The numbered requirements of a review ("Yêu cầu"): list operations of the editor. Each returns a new list. */

export function addLine(lines: readonly string[]): string[] {
  return [...lines, ''];
}

export function setLine(lines: readonly string[], index: number, text: string): string[] {
  return lines.map((l, i) => (i === index ? text : l));
}

export function removeLine(lines: readonly string[], index: number): string[] {
  return lines.filter((_, i) => i !== index);
}

/** Moves a line by `delta` (-1 up, +1 down); at either end the list stays as it is. */
export function moveLine(lines: readonly string[], index: number, delta: -1 | 1): string[] {
  const to = index + delta;
  if (index < 0 || index >= lines.length || to < 0 || to >= lines.length) return [...lines];
  const next = [...lines];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * What is sent: each line trimmed, the blank ones KEPT. The server refuses a blank requirement
 * (`WARD_REQUIREMENT_EMPTY`) rather than dropping it, so that the numbering on the slip is the one the reviewer saw;
 * dropping it here would renumber behind their back.
 */
export function trimLines(lines: readonly string[]): string[] {
  return lines.map((l) => l.trim());
}

/** The 1-based positions of the blank lines, to point at before sending. */
export function blankLines(lines: readonly string[]): number[] {
  return lines.flatMap((l, i) => (l.trim() === '' ? [i + 1] : []));
}
