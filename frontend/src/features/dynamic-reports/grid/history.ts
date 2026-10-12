/**
 * Undo / redo for cell edits. One user action (typing in a cell, a paste of
 * 40 cells, clearing a selection) is ONE batch, so Ctrl+Z takes back exactly
 * what the officer did, not a cell at a time.
 *
 * Values are the stored strings (or null for blank), keyed by field key.
 */

export interface CellChange {
  key: string;
  before: string | null;
  after: string | null;
}

export interface Batch {
  changes: CellChange[];
}

export class EditHistory {
  private undoStack: Batch[] = [];
  private redoStack: Batch[] = [];
  private readonly limit: number;

  constructor(limit = 200) {
    this.limit = limit;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Records an action. Changes that did not change anything are dropped, and
   * an action that changed nothing is not recorded at all (so a no-op never
   * costs the officer a real undo step). Any redo history is discarded.
   */
  push(changes: readonly CellChange[]): void {
    // If one key appears twice (a paste over overlapping targets) keep the first `before` and the last `after`.
    const merged = new Map<string, CellChange>();
    for (const c of changes) {
      const existing = merged.get(c.key);
      merged.set(c.key, existing ? { key: c.key, before: existing.before, after: c.after } : { ...c });
    }
    const effective = [...merged.values()].filter((c) => c.before !== c.after);
    if (effective.length === 0) return;
    this.undoStack.push({ changes: effective });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  /** The values to write to take the last action back, or null if there is nothing to undo. */
  undo(): CellChange[] | null {
    const batch = this.undoStack.pop();
    if (!batch) return null;
    this.redoStack.push(batch);
    return batch.changes.map((c) => ({ key: c.key, before: c.after, after: c.before })).reverse();
  }

  /** The values to write to redo the last undone action, or null. */
  redo(): CellChange[] | null {
    const batch = this.redoStack.pop();
    if (!batch) return null;
    this.undoStack.push(batch);
    return batch.changes.map((c) => ({ ...c }));
  }

  /** Forget everything (after a reload or when another session's values replace ours). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
