/**
 * CurrencyDisplay + PhoneDisplay — TDD Phase 5.
 * Read-only display helpers, dùng ở List/Detail pages.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CurrencyDisplay } from '../CurrencyDisplay';
import { PhoneDisplay } from '../PhoneDisplay';

describe('CurrencyDisplay', () => {
  it('renders "1.000.000 ₫" for value 1000000', () => {
    const { container } = render(<CurrencyDisplay value={1000000} />);
    expect(container.textContent).toBe('1.000.000 ₫');
  });

  it('renders em dash for null/undefined', () => {
    const { container: c1 } = render(<CurrencyDisplay value={null} />);
    expect(c1.textContent).toBe('—');
    const { container: c2 } = render(<CurrencyDisplay value={undefined} />);
    expect(c2.textContent).toBe('—');
  });
});

describe('PhoneDisplay', () => {
  it('renders "0901 234 567" for "0901234567"', () => {
    const { container } = render(<PhoneDisplay value="0901234567" />);
    expect(container.textContent).toBe('0901 234 567');
  });

  it('hydrates legacy "+84 901 234 567" to "0901 234 567"', () => {
    const { container } = render(<PhoneDisplay value="+84 901 234 567" />);
    expect(container.textContent).toBe('0901 234 567');
  });

  it('renders em dash for null/empty', () => {
    const { container: c1 } = render(<PhoneDisplay value={null} />);
    expect(c1.textContent).toBe('—');
    const { container: c2 } = render(<PhoneDisplay value="" />);
    expect(c2.textContent).toBe('—');
  });
});
