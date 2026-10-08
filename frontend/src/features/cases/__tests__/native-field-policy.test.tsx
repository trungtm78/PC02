import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CaseInformationTabs } from '../CaseInformationTabs';
import { CaseFieldPolicyProvider } from '../native-field-policy';
import { LegacyTabBody } from '@/pages/cases/CaseFormPage/LegacyTabBody';
import { INITIAL_FORM_DATA } from '@/pages/cases/CaseFormPage/types';
import { FormInput } from '@/components/form';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));

it('omits a protected native field even when a stale record contains its value', () => {
  const schema = { id: 'v1', revision: 1, status: 'PUBLISHED' as const, definition: { fields: [], fieldPolicies: [{ key: 'description', sensitivity: 'RESTRICTED', readable: false, writable: false }] }, values: {} };
  render(<CaseInformationTabs record={{ moTaChiTiet: 'protected statement' }} customSchema={schema} />);
  expect(screen.queryByText('protected statement')).not.toBeInTheDocument();
  expect(screen.queryByTestId('case-information-field-description')).not.toBeInTheDocument();
});

it('hides duplicate supplemental controls with the same protected native label', () => {
  render(<CaseFieldPolicyProvider policies={[{ key: 'description', sensitivity: 'RESTRICTED', readable: false, writable: false }]}><FormInput label="Tóm tắt nội dung" value="secret" onChange={() => {}} /></CaseFieldPolicyProvider>);
  expect(screen.queryByLabelText('Tóm tắt nội dung')).not.toBeInTheDocument();
});

it('hides native fields in the actual editable legacy renderer', () => {
  render(<QueryClientProvider client={new QueryClient()}><CaseFieldPolicyProvider policies={[{ key: 'description', sensitivity: 'RESTRICTED', readable: false, writable: false }]}><LegacyTabBody tabId="info" formData={{ ...INITIAL_FORM_DATA, description: 'secret' }} setFormData={() => {}} errors={{}} setErrors={() => {}} /></CaseFieldPolicyProvider></QueryClientProvider>);
  expect(screen.queryByTestId('legacy-field-description')).not.toBeInTheDocument();
});
