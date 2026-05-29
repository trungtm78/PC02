import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal — Mobile responsive', () => {
  it('container has full-screen mobile (h-screen) + bounded desktop (sm:max-h-[90vh])', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test modal">
        <p>Content</p>
      </Modal>,
    );
    const container = screen.getByTestId('modal-container');
    expect(container.className).toContain('h-screen');
    expect(container.className).toContain('sm:h-auto');
    expect(container.className).toContain('sm:max-h-[90vh]');
  });

  it('container uses dvh fallback (sm:max-h-[90dvh])', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test modal">
        <p>Content</p>
      </Modal>,
    );
    const container = screen.getByTestId('modal-container');
    expect(container.className).toContain('sm:max-h-[90dvh]');
  });

  it('container has rounded corners on desktop only (sm:rounded-lg, none on mobile)', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test modal">
        <p>Content</p>
      </Modal>,
    );
    const container = screen.getByTestId('modal-container');
    expect(container.className).toContain('sm:rounded-lg');
    expect(container.className).not.toMatch(/(?<!sm:)rounded-lg/);
  });

  it('container uses flex-col for sticky header/footer', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test modal">
        <p>Content</p>
      </Modal>,
    );
    const container = screen.getByTestId('modal-container');
    expect(container.className).toContain('flex');
    expect(container.className).toContain('flex-col');
  });

  it('overlay uses z-40 (below sidebar drawer z-50)', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test modal">
        <p>Content</p>
      </Modal>,
    );
    const overlay = screen.getByTestId('modal-overlay');
    expect(overlay.className).toContain('z-40');
    expect(overlay.className).not.toContain('z-50');
  });

  it('overlay has no padding on mobile, padding on sm+ (sm:p-4)', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test modal">
        <p>Content</p>
      </Modal>,
    );
    const overlay = screen.getByTestId('modal-overlay');
    expect(overlay.className).toContain('sm:p-4');
  });

  it('maxWidth prop applies for desktop sizing', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test modal" maxWidth="max-w-md">
        <p>Content</p>
      </Modal>,
    );
    const container = screen.getByTestId('modal-container');
    expect(container.className).toContain('max-w-md');
  });
});
