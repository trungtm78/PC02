import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StopEnterSubmit } from '../RecordTabs';

/** The tabs live inside the record's own <form>: Enter in one of their text boxes must never save the record. */
describe('the tabs inside the record form', () => {
  it('Enter in a text box of a tab does not submit the surrounding form', () => {
    const submitted = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={submitted}>
        <StopEnterSubmit>
          <input data-testid="inside" />
        </StopEnterSubmit>
        <input data-testid="outside" />
        <button type="submit">Save the record</button>
      </form>,
    );
    // jsdom does not run implicit submission, so the rule is read from the event itself: a keydown Enter on an input
    // inside the tab is defaultPrevented (which is what stops the browser's implicit submission).
    const inside = fireEvent.keyDown(screen.getByTestId('inside'), { key: 'Enter' });
    expect(inside).toBe(false);
    // Outside the tab nothing changes: the record's own boxes keep their behaviour.
    const outside = fireEvent.keyDown(screen.getByTestId('outside'), { key: 'Enter' });
    expect(outside).toBe(true);
  });
});
