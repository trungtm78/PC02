/**
 * PhoneInput — TDD per plan Phase 2 (v0.39 input mask refactor).
 * AD-2: dùng PatternFormat ("#### ### ####") để preserve leading 0.
 * NumericFormat sẽ strip leading 0 — CẤM dùng cho phone VN.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PhoneInput } from '../PhoneInput';

function Harness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <PhoneInput value={value} onValueChange={setValue} data-testid="phone-input" />;
}

describe('PhoneInput', () => {
  it('renders empty input when value is empty', () => {
    render(<Harness />);
    const input = screen.getByTestId('phone-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('displays "0901 234 567" when value is "0901234567"', () => {
    render(<Harness initialValue="0901234567" />);
    const input = screen.getByTestId('phone-input') as HTMLInputElement;
    expect(input.value).toBe('0901 234 567');
  });

  it('preserves leading 0 (PatternFormat not NumericFormat)', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onValueChange={onChange} data-testid="pi" />);
    const input = screen.getByTestId('pi') as HTMLInputElement;
    await userEvent.type(input, '0901234567');
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toBe('0901234567');
  });

  it('calls onValueChange with stripped digits (no spaces)', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onValueChange={onChange} data-testid="pi" />);
    const input = screen.getByTestId('pi') as HTMLInputElement;
    await userEvent.type(input, '0901234567');
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toContain(' ');
  });

  it('hydrates legacy "+84 901 234 567" to display "0901 234 567"', () => {
    render(<Harness initialValue="+84 901 234 567" />);
    const input = screen.getByTestId('phone-input') as HTMLInputElement;
    expect(input.value).toBe('0901 234 567');
  });

  it('blocks alpha characters', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onValueChange={onChange} data-testid="pi" />);
    const input = screen.getByTestId('pi') as HTMLInputElement;
    await userEvent.type(input, 'abc0901');
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toBe('0901');
  });
});
