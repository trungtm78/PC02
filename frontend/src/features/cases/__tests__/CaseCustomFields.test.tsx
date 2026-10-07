import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaseCustomFields, type PublishedCaseFieldSchema } from '../CaseCustomFields';

const schema: PublishedCaseFieldSchema = { id: 'v1', revision: 3, status: 'PUBLISHED', definition: { fields: [
  { key: 'summary', label: 'Résumé complémentaire', type: 'textarea', required: true },
  { key: 'amount', label: 'Nombre', type: 'number', required: false },
  { key: 'confirmed', label: 'Confirmé', type: 'boolean', required: false },
  { key: 'date', label: 'Date civile', type: 'date', required: false },
  { key: 'choice', label: 'Choix', type: 'select', required: false, options: ['yes', 'no'] },
] }, values: { summary: 'original', amount: 7, confirmed: true, date: '2026-10-05', choice: 'yes' } };

function Edit() {
  const [values, setValues] = useState(schema.values);
  return <><CaseCustomFields schema={schema} values={values} onChange={setValues} /><output data-testid="saved-values">{JSON.stringify(values)}</output></>;
}
describe('CG06 pinned published custom case fields', () => {
  it('renders the real published string-option transport with selectable captions and values', () => {
    const real = { ...schema, definition: { fields: [{ key: 'custom_choice', label: 'Published choice', type: 'select', required: false, options: ['yes', 'no'] }] }, values: { custom_choice: 'yes' } };
    const onChange = vi.fn();
    render(<CaseCustomFields schema={real as unknown as PublishedCaseFieldSchema} values={real.values} onChange={onChange} />);
    expect(screen.getByRole('option', { name: 'yes' })).toHaveValue('yes');
    expect(screen.getByRole('option', { name: 'no' })).toHaveValue('no');
    fireEvent.change(screen.getByLabelText('Published choice'), { target: { value: 'no' } });
    expect(onChange).toHaveBeenCalledWith({ custom_choice: 'no' });
  });
  it('edits the published typed fields and retains false, zero, exact civil date and explicit clears', () => {
    render(<Edit />);
    expect(screen.getByText(/3/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '0' } });
    fireEvent.click(screen.getByLabelText('Confirmé'));
    fireEvent.change(screen.getByLabelText('Date civile'), { target: { value: '2026-10-06' } });
    fireEvent.change(screen.getByLabelText(/Résumé complémentaire/), { target: { value: '' } });
    expect(JSON.parse(screen.getByTestId('saved-values').textContent ?? '{}')).toMatchObject({ summary: null, amount: 0, confirmed: false, date: '2026-10-06', choice: 'yes' });
  });
  it('reads the same published values without editable controls and hides unknown unauthorized values', () => {
    const { container } = render(<CaseCustomFields schema={schema} values={{ ...schema.values, secret: 'hidden' }} readOnly />);
    expect(screen.getByText('original')).toBeVisible();
    expect(screen.getByText('yes')).toBeVisible();
    expect(screen.queryByText('hidden')).toBeNull();
    expect(container.querySelectorAll('input,select,textarea')).toHaveLength(0);
  });
  it('does not render unpublished or unsafe definitions that overwrite canonical fields', () => {
    const bad = { ...schema, definition: { fields: [
      { key: '__proto__', label: 'Unsafe', type: 'text' as const, required: false },
      { key: 'moTaChiTiet', label: 'Canonical overwrite', type: 'text' as const, required: false },
    ] } };
    const { container } = render(<CaseCustomFields schema={bad} values={{ moTaChiTiet: 'hidden' }} />);
    expect(container.querySelectorAll('input,select,textarea')).toHaveLength(0);
    expect(screen.queryByText('Canonical overwrite')).toBeNull();
  });
  it('clears optional number/date/select fields without changing their original stored types', () => {
    render(<Edit />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Date civile'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Choix'), { target: { value: '' } });
    expect(JSON.parse(screen.getByTestId('saved-values').textContent ?? '{}')).toMatchObject({ amount: null, date: null, choice: null });
  });
  it('renders read-only false and zero, keeps empty values honest and respects field tabs', () => {
    render(<CaseCustomFields schema={schema} values={{ summary: null, amount: 0, confirmed: false }} readOnly />);
    expect(screen.getByText('0')).toBeVisible();
    expect(screen.getByText('Không')).toBeVisible();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
  it('keeps optional published Boolean unknown until an explicit choice and permits reset to null', () => {
    const nullable = { ...schema, definition: { fields: [{ key: 'custom_flag', label: 'Optional flag', type: 'boolean' as const, required: false }] }, values: { custom_flag: null } };
    function Host() {
      const [values, setValues] = useState<Record<string, unknown>>(nullable.values);
      return <><CaseCustomFields schema={nullable} values={values} onChange={setValues} /><output data-testid="custom-values">{JSON.stringify(values)}</output></>;
    }
    render(<Host />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    expect(JSON.parse(screen.getByTestId('custom-values').textContent ?? '{}')).toEqual({ custom_flag: null });
    fireEvent.click(screen.getByRole('button', { name: 'Không' }));
    expect(JSON.parse(screen.getByTestId('custom-values').textContent ?? '{}')).toEqual({ custom_flag: false });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(JSON.parse(screen.getByTestId('custom-values').textContent ?? '{}')).toEqual({ custom_flag: true });
    fireEvent.click(screen.getByRole('button', { name: 'Chưa xác minh' }));
    expect(JSON.parse(screen.getByTestId('custom-values').textContent ?? '{}')).toEqual({ custom_flag: null });
  });
  it('treats false as a supplied required Boolean and null as missing', () => {
    const required = { ...schema, definition: { fields: [{ key: 'custom_required', label: 'Required flag', type: 'boolean' as const, required: true }] }, values: { custom_required: false } };
    const { rerender } = render(<CaseCustomFields schema={required} values={required.values} onChange={() => {}} />);
    const control = screen.getByLabelText(/Required flag/) as HTMLInputElement;
    expect(control.checkValidity()).toBe(true);
    rerender(<CaseCustomFields schema={required} values={{ custom_required: null }} onChange={() => {}} />);
    expect((screen.getByLabelText(/Required flag/) as HTMLInputElement).checkValidity()).toBe(false);
  });
});
