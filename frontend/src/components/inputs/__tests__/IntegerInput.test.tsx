/**
 * IntegerInput — TDD per plan Phase 2.
 * Số nguyên dương, hỗ trợ min/max. Dùng cho count fields (số bị hại, số đối tượng, v.v.).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntegerInput } from '../IntegerInput';

describe('IntegerInput', () => {
  it('accepts positive integers only', async () => {
    const onChange = vi.fn();
    render(<IntegerInput value="" onValueChange={onChange} data-testid="ii" />);
    const input = screen.getByTestId('ii') as HTMLInputElement;
    await userEvent.type(input, '123');
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('123');
  });

  it('blocks negative values', async () => {
    const onChange = vi.fn();
    render(<IntegerInput value="" onValueChange={onChange} data-testid="ii" />);
    const input = screen.getByTestId('ii') as HTMLInputElement;
    await userEvent.type(input, '-500');
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('500');
  });

  it('does not accept decimal input', async () => {
    const onChange = vi.fn();
    render(<IntegerInput value="" onValueChange={onChange} data-testid="ii" />);
    const input = screen.getByTestId('ii') as HTMLInputElement;
    await userEvent.type(input, '10.5');
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('105');
  });

  it('blocks alpha characters', async () => {
    const onChange = vi.fn();
    render(<IntegerInput value="" onValueChange={onChange} data-testid="ii" />);
    const input = screen.getByTestId('ii') as HTMLInputElement;
    await userEvent.type(input, 'abc42');
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('42');
  });
});
