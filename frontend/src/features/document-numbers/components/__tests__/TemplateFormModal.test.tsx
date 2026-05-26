import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateFormModal } from '../TemplateFormModal';

const noop = vi.fn().mockResolvedValue(undefined);

describe('TemplateFormModal', () => {
  it('does not offer a custom documentType option', () => {
    render(
      <TemplateFormModal
        template={null}
        onClose={noop}
        onSave={noop}
        isSaving={false}
      />,
    );

    // The __custom__ sentinel option must not exist — backend rejects unknown documentTypes
    const customOption = screen.queryByRole('option', { name: /tùy chỉnh/i });
    expect(customOption).toBeNull();
  });

  it('shows all valid document type options', () => {
    render(
      <TemplateFormModal
        template={null}
        onClose={noop}
        onSave={noop}
        isSaving={false}
      />,
    );

    for (const type of ['INCIDENT', 'CASE', 'PETITION', 'PROPOSAL', 'DELEGATION', 'EVIDENCE']) {
      expect(screen.getByRole('option', { name: type })).toBeInTheDocument();
    }
  });
});
