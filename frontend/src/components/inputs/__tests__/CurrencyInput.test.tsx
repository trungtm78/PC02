/**
 * CurrencyInput — TDD per plan Phase 2 (v0.39 input mask refactor).
 * Pattern: NumericFormat with thousand separator + " ₫" suffix.
 *
 * AD-1: form state lưu raw string ("1000000"), không phải number.
 * AD-3: decimalScale=0, allowNegative=false (VND integer).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CurrencyInput } from '../CurrencyInput';

function Harness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <CurrencyInput value={value} onValueChange={setValue} data-testid="currency-input" />
  );
}

describe('CurrencyInput', () => {
  it('renders empty input when value is empty', () => {
    render(<Harness initialValue="" />);
    const input = screen.getByTestId('currency-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('displays formatted "1.000.000 ₫" when value is "1000000"', () => {
    render(<Harness initialValue="1000000" />);
    const input = screen.getByTestId('currency-input') as HTMLInputElement;
    expect(input.value).toBe('1.000.000 ₫');
  });

  it('calls onValueChange with raw "1000000" when user types digits', async () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onValueChange={onChange} data-testid="ci" />);
    const input = screen.getByTestId('ci') as HTMLInputElement;
    await userEvent.type(input, '1000000');
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toBe('1000000');
  });

  it('blocks alpha characters from being typed', async () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onValueChange={onChange} data-testid="ci" />);
    const input = screen.getByTestId('ci') as HTMLInputElement;
    await userEvent.type(input, 'abc123');
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toBe('123');
  });

  it('does not accept negative input (allowNegative=false)', async () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onValueChange={onChange} data-testid="ci" />);
    const input = screen.getByTestId('ci') as HTMLInputElement;
    await userEvent.type(input, '-500');
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toBe('500');
  });

  it('does not accept decimal input (decimalScale=0)', async () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onValueChange={onChange} data-testid="ci" />);
    const input = screen.getByTestId('ci') as HTMLInputElement;
    await userEvent.type(input, '100.50');
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toBe('10050');
  });

  it('applies className and id props', () => {
    render(
      <CurrencyInput
        value=""
        onValueChange={() => {}}
        className="custom-cls"
        id="my-input"
        data-testid="ci"
      />,
    );
    const input = screen.getByTestId('ci');
    expect(input.className).toContain('custom-cls');
    expect(input.id).toBe('my-input');
  });

  it('respects disabled prop', () => {
    render(
      <CurrencyInput
        value="1000"
        onValueChange={() => {}}
        disabled
        data-testid="ci"
      />,
    );
    const input = screen.getByTestId('ci') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
