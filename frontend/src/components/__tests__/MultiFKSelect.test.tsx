import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiFKSelect, type MultiFKOption } from '../MultiFKSelect';

const OPTIONS: MultiFKOption[] = [
  { value: 'w1', label: 'Công an phường Vườn Lài' },
  { value: 'w2', label: 'Công an phường Bàn Cờ' },
  { value: 'w3', label: 'Công an xã Trừ Văn Thố', hint: 'Đang do Tổ công tác Số 8 phụ trách', taken: true },
  { value: 'w4', label: 'Công an phường Tân Định' },
];

function Harness({ initial = [] as string[], onChange = vi.fn() }) {
  const [values, setValues] = useState<string[]>(initial);
  return (
    <MultiFKSelect
      label="Công an phường/xã"
      values={values}
      onChange={(next) => {
        setValues(next);
        onChange(next);
      }}
      options={OPTIONS}
      testId="ms"
    />
  );
}

const open = () => fireEvent.click(screen.getByTestId('ms-trigger'));
const type = (text: string) => fireEvent.change(screen.getByTestId('ms-search'), { target: { value: text } });
const key = (k: string) => fireEvent.keyDown(screen.getByTestId('ms-search'), { key: k });

describe('MultiFKSelect', () => {
  it('finds options without accents and by initials, like FKSelect', () => {
    render(<Harness />);
    open();
    type('vuon lai');
    expect(screen.getByTestId('ms-option-w1')).toBeInTheDocument();
    expect(screen.queryByTestId('ms-option-w2')).toBeNull();
    type('capbc'); // initials of "Công an phường Bàn Cờ"
    expect(screen.getByTestId('ms-option-w2')).toBeInTheDocument();
    type('khong co dau');
    expect(screen.getByTestId('ms-no-result')).toBeInTheDocument();
  });

  it('chooses several, shows each as a chip, and keeps the list open', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    open();
    fireEvent.click(screen.getByTestId('ms-option-w1'));
    fireEvent.click(screen.getByTestId('ms-option-w2'));
    expect(onChange).toHaveBeenLastCalledWith(['w1', 'w2']);
    expect(screen.getByTestId('ms-chip-w1')).toHaveTextContent('Công an phường Vườn Lài');
    expect(screen.getByTestId('ms-chip-w2')).toBeInTheDocument();
    expect(screen.getByTestId('ms-search')).toBeInTheDocument();
    // Clicking a chosen option again un-chooses it.
    fireEvent.click(screen.getByTestId('ms-option-w1'));
    expect(onChange).toHaveBeenLastCalledWith(['w2']);
  });

  it('removes a chip with its ×, and the last one with Backspace in an empty search', () => {
    const onChange = vi.fn();
    render(<Harness initial={['w1', 'w2', 'w4']} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('ms-chip-remove-w2'));
    expect(onChange).toHaveBeenLastCalledWith(['w1', 'w4']);
    open();
    key('Backspace');
    expect(onChange).toHaveBeenLastCalledWith(['w1']);
  });

  it('a taken option shows who holds it and cannot be chosen', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    open();
    const taken = screen.getByTestId('ms-option-w3');
    expect(taken).toHaveTextContent('Đang do Tổ công tác Số 8 phụ trách');
    expect(taken).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(taken);
    expect(onChange).not.toHaveBeenCalled();
    // The hint is searched too: typing the holder finds the ward.
    type('to cong tac so 8');
    expect(screen.getByTestId('ms-option-w3')).toBeInTheDocument();
  });

  it('works from the keyboard: open with Enter, arrows move, Enter toggles the highlighted option, Escape closes', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId('ms-trigger'), { key: 'Enter' });
    expect(screen.getByTestId('ms-search')).toBeInTheDocument();
    // Enter with nothing highlighted chooses nothing.
    key('Enter');
    expect(onChange).not.toHaveBeenCalled();
    key('ArrowDown');
    key('ArrowDown');
    key('Enter');
    expect(onChange).toHaveBeenLastCalledWith(['w2']);
    key('ArrowUp');
    key('Enter');
    expect(onChange).toHaveBeenLastCalledWith(['w2', 'w1']);
    key('Escape');
    expect(screen.queryByTestId('ms-search')).toBeNull();
  });
});
