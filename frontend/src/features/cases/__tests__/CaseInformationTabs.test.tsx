import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CASE_LEGACY_SPEC } from '../legacy-form-layout.def';
import { CaseInformationTabs } from '../CaseInformationTabs';

describe('CG01 shared read-only case information', () => {
  it('shows canonical description and proposal, labels legacy fallback, and keeps clears absent', () => {
    render(<CaseInformationTabs record={{ moTaChiTiet: 'current description', deXuat: 'current proposal', nguonDon: null, nhanXet: null,
      metadata: { description: 'stale description', deXuatXuLy: 'stale proposal', nguonDon: 'old source', nhanXet: 'resurrected', _canonicalClears: { nhanXet: true } } }} />);
    expect(screen.getByText('current description')).toBeVisible();
    expect(screen.getByText('current proposal')).toBeVisible();
    expect(screen.queryByText('stale description')).not.toBeInTheDocument();
    expect(screen.queryByText('resurrected')).not.toBeInTheDocument();
    expect(screen.getByText('old source')).toBeVisible();
    expect(screen.getAllByText('Dữ liệu hệ cũ chưa xác minh').length).toBeGreaterThan(0);
  });
  it('renders all ten actual layouts without introducing editable controls or losing mirrored fields', () => {
    const record: Record<string, unknown> = {};
    for (const fields of Object.values(CASE_LEGACY_SPEC.layout)) for (const field of fields) {
      const column = CASE_LEGACY_SPEC.fieldToColumn[field.field] ?? field.field;
      if (column.startsWith('statistic.')) record.statistic = { ...(record.statistic as object ?? {}), [column.slice(10)]: field.kind === 'toggle' ? false : field.kind === 'number' ? 0 : `value:${column}` };
      else record[column] = field.kind === 'toggle' ? false : field.kind === 'multiselect' ? ['choice'] : `value:${column}`;
    }
    render(<CaseInformationTabs record={record} />);
    expect(screen.getAllByRole('tab')).toHaveLength(10);
    for (const [tab, fields] of Object.entries(CASE_LEGACY_SPEC.layout)) {
      fireEvent.click(screen.getByTestId(`case-information-tab-${tab}`));
      const panel = screen.getByRole('tabpanel');
      for (const field of fields) expect(within(panel).getAllByTestId(`case-information-field-${field.field}`).length).toBeGreaterThan(0);
      expect(panel.querySelectorAll('input,select,textarea')).toHaveLength(0);
    }
  });
  it('shows unknown nullable flags distinctly from a verified false value', () => {
    render(<CaseInformationTabs record={{ vuViecTamDungTruoc2015: null, statistic: { ghiAmGhiHinhDaDuocXetXu: null, coSuDungKQGhiAmTrongXetXu: false, khongGAGHNhungToaYeuCau: null } }} />);
    fireEvent.click(screen.getByTestId('case-information-tab-media'));
    expect(within(screen.getByTestId('case-information-field-statistic.ghiAmGhiHinhDaDuocXetXu')).getByText('Chưa xác minh')).toBeVisible();
    expect(within(screen.getByTestId('case-information-field-statistic.coSuDungKQGhiAmTrongXetXu')).getByText('Không')).toBeVisible();
  });
});
