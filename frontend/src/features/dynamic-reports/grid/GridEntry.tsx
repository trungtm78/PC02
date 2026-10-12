import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, MouseEvent } from 'react';
import { formatAddress } from '../engine/generated/paste';
import GridTable from './GridTable';
import type { GridInteraction, GridTableProps } from './GridTable';
import { viewOf } from './gridEvaluation';
import type { GridField } from './gridEvaluation';
import { buildSheetIndex, key as cellKey } from './gridIndex';
import { colOfAddress, drawnRowsOf, inputRowSet, rowOfAddress } from './gridLayout';
import { EditHistory } from './history';
import type { CellChange } from './history';
import { resolveKey } from './keymap';
import type { GridMode } from './keymap';
import {
  blockRect,
  buildNavModel,
  firstInput,
  moveEnd,
  moveGridEnd,
  moveGridStart,
  moveHome,
  movePage,
  nextInputByCol,
  nextInputByRow,
  resolve,
} from './navigation';
import type { NavModel, Pos, Rect } from './navigation';
import { normalizeInput, nowTime, toEditText, todayIso } from './normalizeInput';
import type { EditableField } from './normalizeInput';
import { parseClipboardText, planGridPaste, toClipboardText } from './clipboard';
import { moveSelection, selectAll, selectionRect, single } from './selection';
import type { Selection } from './selection';
import { cssForStyle } from './styleToCss';

/**
 * The grid an officer types into. It is the read-only table plus a single,
 * always-focused <textarea> that sits over the active cell: every key, every
 * IME composition (Telex/VNI) and every clipboard event goes through that one
 * element, so no browser input method is ever interrupted by a change of focus.
 *
 * Three modes mirror Excel (see keymap.ts): nav (a cell is selected), enter
 * (typing over it) and edit (F2, caret inside the text). A value is validated
 * and stored when it is CONFIRMED (Enter, Tab, an arrow, a click elsewhere,
 * leaving the grid) — never per keystroke — and formulas are recomputed at
 * that moment.
 *
 * The text being typed lives in the textarea itself (it is uncontrolled), not
 * in React state: a keystroke re-renders nothing, however large the sheet,
 * and React never rewrites the field in the middle of an IME composition.
 */

export interface EntryField extends GridField, EditableField {}

export interface GridEntryProps extends Omit<GridTableProps, 'interaction' | 'children' | 'containerRef'> {
  fields: readonly EntryField[];
  /** False after the deadline, once submitted or while saving/importing: nothing can be written. */
  editable: boolean;
  /** The stored text of a field ('' when blank). */
  valueOf: (fieldKey: string) => string;
  /** One cell confirmed. Saved after a short idle delay. */
  onChange: (fieldKey: string, stored: string) => void;
  /** Several cells at once (paste, clear, undo). Saved straight away. */
  onChangeMany: (batch: Record<string, string>) => void;
  /** The grid lost the keyboard: save now. */
  onLeave: () => void;
  /**
   * A typed value the grid refused and is still holding (null once it is fixed
   * or dropped). The page must not submit while there is one: the officer is
   * looking at a number that is not in the report.
   */
  onProblem?: (message: string | null) => void;
  /** Problems the server reported, by field key. */
  serverErrors?: Readonly<Record<string, string>>;
}

const PAGE_ROWS = 15;
const MAX_COPY_CELLS = 20_000;
const NOTICE_LOCKED = 'Bản này đã khoá, không sửa được.';
const NOTICE_NOT_INPUT = 'Ô này không nhập được.';

export default function GridEntry(props: GridEntryProps) {
  const {
    grid,
    sheetName,
    evaluation,
    fields,
    editable,
    valueOf,
    onChange,
    onChangeMany,
    onLeave,
    onProblem,
    serverErrors,
    onlyInputRows = false,
    zoom = 100,
    showHeaders = true,
    maxHeight,
  } = props;

  const sheet = grid.sheets.find((s) => s.name === sheetName);

  // The model below outlives a render; it must still see today's values and today's field placement.
  const valueOfRef = useRef(valueOf);
  valueOfRef.current = valueOf;
  const fieldByOwnerRef = useRef<ReadonlyMap<string, EntryField>>(new Map());

  // ---- layout: the same rows/columns the table draws ------------------------------------
  const index = useMemo(() => (sheet ? buildSheetIndex(sheet) : null), [sheet]);
  const sheetFields = useMemo(() => fields.filter((f) => f.sheetKey === sheetName), [fields, sheetName]);
  const fieldAtPos = useMemo(() => {
    const map = new Map<string, EntryField>();
    for (const f of sheetFields) {
      const r = rowOfAddress(f.address);
      const c = colOfAddress(f.address);
      if (r !== null && c !== null) map.set(cellKey(r, c), f);
    }
    return map;
  }, [sheetFields]);

  const model: NavModel | null = useMemo(() => {
    if (!sheet || !index) return null;
    const inputRows = inputRowSet(sheet.name, sheetFields);
    return buildNavModel({
      sheet,
      rows: drawnRowsOf(index, inputRows, onlyInputRows),
      cols: index.visibleCols,
      inputs: [...fieldAtPos.keys()].map((k) => {
        const [row, col] = k.split(',').map(Number);
        return { row, col };
      }),
      isFilled: (row, col) => {
        // (row, col) is the cell that DRAWS a block; its field may have been declared at a hidden anchor.
        const f = fieldByOwnerRef.current.get(cellKey(row, col)) ?? fieldAtPos.get(cellKey(row, col));
        if (f) return valueOfRef.current(f.fieldKey) !== '';
        const cell = sheet.cells[formatAddress({ col, row: row + 1 })];
        return !!cell && cell.k !== 'empty';
      },
    });
  }, [sheet, index, sheetFields, fieldAtPos, onlyInputRows]);

  /** The input field a drawn block belongs to, whichever of its coordinates the field was declared at. */
  const fieldByOwner = useMemo(() => {
    const map = new Map<string, EntryField>();
    if (!model) return map;
    for (const [k, f] of fieldAtPos) {
      const [row, col] = k.split(',').map(Number);
      const owner = resolve(model, { row, col });
      if (!owner) continue;
      const ownerKey = cellKey(owner.row, owner.col);
      if (!map.has(ownerKey)) map.set(ownerKey, f);
    }
    return map;
  }, [model, fieldAtPos]);
  fieldByOwnerRef.current = fieldByOwner;

  /** Where each input field actually sits on screen: the block that draws it, else its own cell. */
  const placements = useMemo(() => {
    const out: Array<{ field: EntryField; rect: Rect }> = [];
    if (!model) return out;
    for (const [k, f] of fieldAtPos) {
      const [row, col] = k.split(',').map(Number);
      const owner = resolve(model, { row, col });
      out.push({ field: f, rect: owner ? blockRect(model, owner) : { top: row, left: col, bottom: row, right: col } });
    }
    return out;
  }, [model, fieldAtPos]);

  const fieldAt = useCallback(
    (p: Pos | null): EntryField | undefined => {
      if (!p || !model) return undefined;
      const owner = resolve(model, p);
      // A hidden or filtered-out cell is not part of any drawn block: use its own coordinates.
      return owner ? fieldByOwner.get(cellKey(owner.row, owner.col)) : fieldAtPos.get(cellKey(p.row, p.col));
    },
    [model, fieldByOwner, fieldAtPos],
  );

  // ---- interaction state -----------------------------------------------------------------
  const [sel, setSelState] = useState<Selection | null>(null);
  // Mirrors `sel` synchronously: a focus event fired from inside a click handler must already see
  // the cell that click selected, not the render-time value.
  const selRef = useRef<Selection | null>(null);
  const setSel = useCallback((next: Selection | null) => {
    selRef.current = next;
    setSelState(next);
  }, []);
  const [mode, setMode] = useState<GridMode>('nav');
  const [notice, setNotice] = useState<string | null>(null);
  /** Refused values still sitting in the editor, by field key → the sentence to show. */
  const [invalid, setInvalid] = useState<ReadonlyMap<string, string>>(new Map());
  const historyRef = useRef(new EditHistory());
  const draggingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const active: Pos | null = sel ? sel.anchor : null;
  const activeField = fieldAt(active);
  const addressOf = (p: Pos) => formatAddress({ col: p.col, row: p.row + 1 });

  const readDraft = () => textareaRef.current?.value ?? '';
  const writeDraft = (text: string) => {
    if (textareaRef.current) textareaRef.current.value = text;
  };

  // A different sheet or a different set of rows invalidates every position.
  useEffect(() => {
    setSel(null);
    setMode('nav');
    writeDraft('');
    setNotice(null);
    setInvalid(new Map());
    // The keyboard is still in the grid: give it a cell again rather than leave a focused editor with nowhere to type.
    if (model && document.activeElement === textareaRef.current) {
      const first = firstInput(model);
      if (first) setSel(single(first));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetName, onlyInputRows]);

  // Tell the page while a refused value is being held, and when it is gone.
  useEffect(() => {
    onProblem?.(invalid.size > 0 ? ([...invalid.values()][0] as string) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalid]);
  useEffect(() => () => onProblem?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Locked while typing (deadline, submit started): the draft is dropped, never written.
  useEffect(() => {
    if (!editable && mode !== 'nav') {
      endTyping();
      setInvalid(new Map()); // the held text is gone, so is the reason to hold up the page
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  // ---- writing values --------------------------------------------------------------------
  const write = useCallback(
    (changes: CellChange[], opts: { remember: boolean; many: boolean }) => {
      if (!editable) return; // history, paste and commit all pass through here
      const effective = changes.filter((c) => c.before !== c.after);
      if (effective.length === 0) return;
      if (opts.remember) historyRef.current.push(effective);
      if (opts.many || effective.length > 1) {
        onChangeMany(Object.fromEntries(effective.map((c) => [c.key, c.after ?? ''])));
      } else {
        onChange(effective[0].key, effective[0].after ?? '');
      }
      setInvalid((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map(prev);
        for (const c of effective) next.delete(c.key);
        return next.size === prev.size ? prev : next;
      });
    },
    [editable, onChange, onChangeMany],
  );

  /** Validates what is in the editor and stores it. False means "stay here": the text is wrong. */
  function commitDraft(): boolean {
    if (mode === 'nav') return true;
    const field = activeField;
    if (!field || !editable) {
      endTyping();
      return true;
    }
    const result = normalizeInput(field, readDraft());
    if (!result.ok) {
      const sentence = `Ô ${addressOf(active as Pos)}: ${result.message}`;
      setNotice(sentence);
      setInvalid((prev) => new Map(prev).set(field.fieldKey, sentence));
      return false;
    }
    write(
      [{ key: field.fieldKey, before: valueOf(field.fieldKey) || null, after: result.value }],
      { remember: true, many: false },
    );
    // Accepted — even when it equals what was already there (write() then has nothing to do): the refusal is over.
    clearInvalid(field.fieldKey);
    setNotice(null);
    endTyping();
    return true;
  }

  function endTyping() {
    setMode('nav');
    writeDraft('');
  }

  function clearInvalid(fieldKey: string) {
    setInvalid((prev) => {
      if (!prev.has(fieldKey)) return prev;
      const next = new Map(prev);
      next.delete(fieldKey);
      return next;
    });
  }

  function select(next: Selection | null) {
    setSel(next);
    setNotice(null);
  }

  // ---- keeping the editor over the active cell -------------------------------------------
  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!active || !container) return setBox(null);
    const td = container.querySelector<HTMLElement>(`[data-pos="${active.row},${active.col}"]`);
    const surface = container.querySelector<HTMLElement>('[data-grid-surface]');
    if (!td || !surface) return setBox(null);
    // Measured on screen, not by offset: a frozen cell stays put while the content scrolls under it.
    const a = td.getBoundingClientRect();
    const b = surface.getBoundingClientRect();
    const next = { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
    setBox((prev) =>
      prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height
        ? prev
        : next,
    );
  }, [active?.row, active?.col]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    measure();
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-pos="${active?.row},${active?.col}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [measure, zoom, onlyInputRows, sheetName, mode, evaluation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener('scroll', onScroll);
    };
  }, [measure]);

  // The editor keeps the keyboard while a cell is selected — but never takes it from another control.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!sel || !ta) return;
    const focused = document.activeElement;
    const keyboardIsHere =
      !focused || focused === document.body || focused === ta || !!containerRef.current?.contains(focused);
    if (keyboardIsHere && focused !== ta) ta.focus({ preventScroll: true });
  }, [sel, mode]);

  // A mouse drag ends wherever the button is released.
  useEffect(() => {
    const stop = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  if (!sheet || !index || !model) return null;

  // ---- commands --------------------------------------------------------------------------
  const rect = sel ? selectionRect(model, sel) : null;

  /** Every input field inside a rectangle, hidden ones included: a rectangle means what it says. */
  function fieldsInRect(r: Rect): EntryField[] {
    // A field belongs to the block that draws it, wherever it was declared; the selection already
    // takes in whole blocks, so "touches" and "is inside" mean the same thing here.
    return placements
      .filter((p) => p.rect.top <= r.bottom && p.rect.bottom >= r.top && p.rect.left <= r.right && p.rect.right >= r.left)
      .map((p) => p.field);
  }

  function clearSelection() {
    if (!sel || !rect) return;
    if (!editable) return setNotice(NOTICE_LOCKED);
    const targets = fieldsInRect(rect);
    if (targets.length === 0) return setNotice(NOTICE_NOT_INPUT);
    write(
      targets.map((f) => ({ key: f.fieldKey, before: valueOf(f.fieldKey) || null, after: null })),
      { remember: true, many: true },
    );
  }

  /** `clear: false` keeps what is already in the editor (text that arrived before we knew a cell was being typed into). */
  function beginTyping(kind: 'enter' | 'edit', opts: { clear: boolean } = { clear: true }) {
    if (!editable) {
      setNotice(NOTICE_LOCKED);
      return false;
    }
    if (!activeField) {
      setNotice(NOTICE_NOT_INPUT);
      return false;
    }
    setNotice(null);
    if (kind === 'edit' && mode === 'nav') writeDraft(toEditText(activeField, valueOf(activeField.fieldKey)));
    if (kind === 'enter' && opts.clear) writeDraft('');
    setMode(kind);
    return true;
  }

  function applyHistory(changes: CellChange[] | null) {
    if (!changes) return;
    write(changes, { remember: false, many: true });
  }

  function insertNow(kind: 'date' | 'time') {
    const f = activeField;
    if (!f || !editable) return setNotice(!editable ? NOTICE_LOCKED : NOTICE_NOT_INPUT);
    if (kind === 'date' && f.type !== 'DATE') return setNotice('Ctrl+; chỉ dùng cho ô ngày.');
    if (kind === 'time' && f.type !== 'TIME') return setNotice('Ctrl+Shift+; chỉ dùng cho ô giờ.');
    const stored = kind === 'date' ? todayIso() : nowTime();
    if (mode === 'nav') {
      write([{ key: f.fieldKey, before: valueOf(f.fieldKey) || null, after: stored }], { remember: true, many: false });
    } else {
      writeDraft(toEditText(f, stored));
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const native = e.nativeEvent;
    const command = resolveKey(
      {
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        isComposing: native.isComposing,
        keyCode: native.keyCode,
      },
      mode,
    );
    if (!command || !sel) return;
    const m = model as NavModel;

    switch (command.type) {
      case 'move': {
        if (mode !== 'nav' && !commitDraft()) return e.preventDefault();
        e.preventDefault();
        const from = mode === 'nav' ? sel : single(sel.anchor);
        select(moveSelection(m, from, command.dir, { extend: command.extend, jump: command.jump }));
        return;
      }
      case 'tab':
      case 'enter': {
        if (mode !== 'nav' && !commitDraft()) return e.preventDefault();
        const target =
          command.type === 'tab'
            ? nextInputByRow(m, sel.anchor, command.back)
            : nextInputByCol(m, sel.anchor, command.back);
        if (!target) {
          // Past the last (or before the first) input cell Tab leaves the grid like any control;
          // Enter simply stays.
          if (command.type === 'enter') e.preventDefault();
          return;
        }
        e.preventDefault();
        select(single(target));
        return;
      }
      case 'home':
        e.preventDefault();
        return select(single(moveHome(m, sel.anchor)));
      case 'end':
        e.preventDefault();
        return select(single(moveEnd(m, sel.anchor)));
      case 'gridStart': {
        e.preventDefault();
        const p = moveGridStart(m);
        return p ? select(single(p)) : undefined;
      }
      case 'gridEnd': {
        e.preventDefault();
        const p = moveGridEnd(m);
        return p ? select(single(p)) : undefined;
      }
      case 'page': {
        e.preventDefault();
        const focus = movePage(m, sel.focus, command.dir, PAGE_ROWS);
        return select(command.extend ? { anchor: sel.anchor, focus } : single(focus));
      }
      case 'selectAll': {
        e.preventDefault();
        const all = selectAll(m);
        return all ? select(all) : undefined;
      }
      case 'beginEdit':
        e.preventDefault();
        return void beginTyping('edit');
      case 'beginOverwrite': {
        if (!beginTyping('enter')) return e.preventDefault();
        // Backspace opens an empty editor; a printable key lets its character land in it.
        if (e.key === 'Backspace') e.preventDefault();
        return;
      }
      case 'cancel':
        e.preventDefault();
        setInvalid((prev) => {
          if (!activeField || !prev.has(activeField.fieldKey)) return prev;
          const next = new Map(prev);
          next.delete(activeField.fieldKey);
          return next;
        });
        setNotice(null);
        return endTyping();
      case 'clear':
        e.preventDefault();
        return clearSelection();
      case 'newline': {
        e.preventDefault();
        if (activeField?.type !== 'TEXT') return;
        const ta = e.currentTarget;
        ta.setRangeText('\n', ta.selectionStart, ta.selectionEnd, 'end');
        return;
      }
      case 'insertToday':
        e.preventDefault();
        return insertNow('date');
      case 'insertNow':
        e.preventDefault();
        return insertNow('time');
      // Refused up front: asking the history for a step it then cannot apply would lose that step.
      case 'undo':
        e.preventDefault();
        return editable ? applyHistory(historyRef.current.undo()) : setNotice(NOTICE_LOCKED);
      case 'redo':
        e.preventDefault();
        return editable ? applyHistory(historyRef.current.redo()) : setNotice(NOTICE_LOCKED);
      case 'swallow':
        return e.preventDefault();
    }
  }

  function onTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    if (mode !== 'nav') return; // the text is already where it belongs: in the editor
    // Text arrived without a key we recognise — an IME composition ending, a mobile keyboard.
    if (e.target.value === '') return;
    if (!beginTyping('enter', { clear: false })) writeDraft('');
  }

  function onCompositionStart() {
    if (mode === 'nav') beginTyping('enter');
  }

  // ---- clipboard ------------------------------------------------------------------------
  function textOf(p: Pos): string {
    const f = fieldAt(p);
    if (f) return toEditText(f, valueOf(f.fieldKey));
    const address = addressOf(p);
    const cell = (sheet as NonNullable<typeof sheet>).cells[address];
    const style = cell ? (grid.styles[cell.s] ?? {}) : {};
    return viewOf(evaluation, sheet as NonNullable<typeof sheet>, address, cell, style).text;
  }

  function copy(e: ClipboardEvent<HTMLTextAreaElement>, andClear: boolean) {
    if (mode !== 'nav' || !rect) return; // inside the editor the browser copies the selected text
    e.preventDefault();
    const cells = (rect.bottom - rect.top + 1) * (rect.right - rect.left + 1);
    if (cells > MAX_COPY_CELLS) return setNotice('Vùng chọn quá lớn để sao chép.');
    const m = model as NavModel;
    // The whole rectangle, hidden rows and columns included, exactly as paste will read it back.
    const matrix: string[][] = [];
    for (let r = rect.top; r <= rect.bottom; r++) {
      const line: string[] = [];
      for (let c = rect.left; c <= rect.right; c++) {
        // A field declared right here is this cell's value even if the cell is covered by a block
        // (a hidden anchor): never drop it from the clipboard.
        const own = fieldAtPos.get(cellKey(r, c));
        line.push(own ? toEditText(own, valueOf(own.fieldKey)) : m.layout.covered.has(cellKey(r, c)) ? '' : textOf({ row: r, col: c }));
      }
      matrix.push(line);
    }
    e.clipboardData.setData('text/plain', toClipboardText(matrix));
    if (andClear) clearSelection();
  }

  function paste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (mode !== 'nav' || !rect) return; // inside the editor the text is simply inserted
    e.preventDefault();
    if (!editable) return setNotice(NOTICE_LOCKED);
    const text = e.clipboardData.getData('text/plain');
    const plan = planGridPaste({
      text,
      topLeft: { row: rect.top, col: rect.left },
      selection: rect,
      targetAt: (p) => {
        const f = fieldAt(p);
        return f ? { fieldKey: f.fieldKey, field: f } : undefined;
      },
    });
    if (!plan.ok) return setNotice(plan.message);
    write(
      plan.changes.map((c) => ({ key: c.fieldKey, before: valueOf(c.fieldKey) || null, after: c.value })),
      { remember: true, many: true },
    );
    setNotice(null);
    // Select what was pasted (a single cell pasted over a larger selection keeps that selection).
    const dims = parseClipboardText(text);
    const last: Pos = { row: rect.top + dims.length - 1, col: rect.left + Math.max(...dims.map((r) => r.length)) - 1 };
    const end = resolve(model as NavModel, last);
    if (end && !(rect.bottom > rect.top || rect.right > rect.left)) select({ anchor: { row: rect.top, col: rect.left }, focus: end });
  }

  // ---- mouse ----------------------------------------------------------------------------
  const invalidAddresses = new Set<string>();
  for (const k of [...invalid.keys(), ...Object.keys(serverErrors ?? {})]) {
    const f = sheetFields.find((x) => x.fieldKey === k);
    if (f) invalidAddresses.add(f.address);
  }
  const interaction: GridInteraction = {
    selection: rect,
    active,
    invalid: invalidAddresses,
    required: new Set(sheetFields.filter((f) => f.required).map((f) => f.address)),
    onCellMouseDown: (pos: Pos, e: MouseEvent) => {
      if (e.button !== 0) return;
      if (mode !== 'nav' && !commitDraft()) {
        e.preventDefault();
        return;
      }
      e.preventDefault(); // keep the editor focused; no text selection while dragging
      draggingRef.current = true;
      select(e.shiftKey && sel ? { anchor: sel.anchor, focus: pos } : single(pos));
      textareaRef.current?.focus({ preventScroll: true });
    },
    onCellMouseEnter: (pos: Pos, e: MouseEvent) => {
      if (!draggingRef.current || e.buttons !== 1 || !sel) return;
      setSel({ anchor: sel.anchor, focus: pos });
    },
    onCellDoubleClick: () => {
      beginTyping('edit');
    },
  };

  const typing = mode !== 'nav';
  const cellStyle = activeField && sheet ? sheet.cells[activeField.address] : undefined;
  const editorFont = cssForStyle(grid.styles[cellStyle?.s ?? 0] ?? {}, { defaultFont: grid.defaultFont, z: zoom / 100 });
  const label = activeField ? `${addressOf(active as Pos)}${activeField.label ? ` — ${activeField.label}` : ''}` : active ? addressOf(active) : 'Chưa chọn ô';
  const announce = active
    ? `Ô ${label}${activeField ? (valueOf(activeField.fieldKey) ? `, giá trị ${valueOf(activeField.fieldKey)}` : ', đang trống') : ''}`
    : '';
  // Above its own cell and below anything that is stuck on top of the cells it scrolls under.
  const frozenRow = !!active && active.row < sheet.freeze.rows;
  const frozenCol = !!active && active.col < sheet.freeze.cols;
  const editorZ = frozenRow && frozenCol ? 3 : frozenRow || frozenCol ? 2 : 1;

  return (
    <div>
      <GridTable
        grid={grid}
        sheetName={sheetName}
        evaluation={evaluation}
        zoom={zoom}
        showHeaders={showHeaders}
        onlyInputRows={onlyInputRows}
        maxHeight={maxHeight}
        interaction={interaction}
        containerRef={containerRef}
      >
        <textarea
          ref={textareaRef}
          data-testid="grid-editor"
          data-mode={mode}
          aria-label={label}
          aria-describedby="grid-entry-notice"
          aria-invalid={activeField && invalid.has(activeField.fieldKey) ? true : undefined}
          readOnly={!editable}
          spellCheck={false}
          autoComplete="off"
          defaultValue=""
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          onCompositionStart={onCompositionStart}
          onCopy={(e) => copy(e, false)}
          onCut={(e) => copy(e, true)}
          onPaste={paste}
          onFocus={() => {
            if (!selRef.current && model) {
              const first = firstInput(model);
              if (first) select(single(first));
            }
          }}
          onBlur={() => {
            if (mode !== 'nav') commitDraft();
            onLeave();
          }}
          style={{
            position: 'absolute',
            left: box?.left ?? 0,
            top: box?.top ?? 0,
            width: box ? Math.max(box.width, typing ? 120 : 1) : 1,
            height: box ? box.height : 1,
            zIndex: editorZ,
            resize: 'none',
            boxSizing: 'border-box',
            margin: 0,
            padding: '0 3px',
            overflow: typing ? 'auto' : 'hidden',
            fontFamily: editorFont.fontFamily,
            fontSize: editorFont.fontSize,
            lineHeight: 1.25,
            border: typing ? '2px solid #2563eb' : 'none',
            outline: 'none',
            background: typing ? '#fff' : 'transparent',
            color: typing ? '#111' : 'transparent',
            caretColor: typing ? '#111' : 'transparent',
            opacity: sel ? 1 : 0,
            // While nothing is being typed the clicks belong to the cells underneath.
            pointerEvents: typing ? 'auto' : 'none',
          }}
        />
      </GridTable>
      <div
        id="grid-entry-notice"
        role={notice ? 'alert' : undefined}
        data-testid="grid-notice"
        className={`text-xs mt-1 min-h-4 ${notice ? 'text-red-700' : 'text-slate-500'}`}
      >
        {notice ?? (editable ? 'Gõ để nhập · F2 sửa · Enter/Tab sang ô kế · Esc huỷ · Ctrl+Z hoàn tác' : NOTICE_LOCKED)}
      </div>
      <div className="sr-only" aria-live="polite" data-testid="grid-announce">
        {announce}
      </div>
    </div>
  );
}
