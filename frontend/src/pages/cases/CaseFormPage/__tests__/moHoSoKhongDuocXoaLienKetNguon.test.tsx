import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { CaseProvenancePicker } from '../CaseProvenancePicker';
import { CaseProvenance } from '@/shared/enums/generated';

/**
 * Mở một vụ án đã có nguồn gốc thì KHÔNG được xoá liên kết ấy.
 *
 * Ô "Đơn thư gốc"/"Vụ việc gốc" được dọn khi cán bộ ĐỔI nguồn — đúng và cần. Nhưng ở màn Sửa,
 * `provenance` nạp từ máy chủ SAU lần dựng đầu, nên hiệu ứng dọn chạy với `lastProvenance`
 * rỗng và rơi vào nhánh "đổi nguồn": nó ghi đè ô liên kết bằng bộ nhớ RỖNG, tức xoá trắng
 * ngay khi mở hồ sơ.
 *
 * Đo trên máy chạy 27/08/2026: 169 vụ án có nguồn gốc (166 từ đơn thư, 3 từ vụ việc). Cán bộ
 * mở ra là form chặn Lưu bằng "Vui lòng chọn Đơn thư gốc" — một ô vừa bị chính nó xoá. Và nếu
 * cán bộ chọn lại rồi lưu, liên kết cũ đã mất khỏi màn hình từ trước đó.
 */
function Host({ nguonBanDau }: { nguonBanDau: string }) {
  const [form, setForm] = useState({
    provenance: '',
    linkedPetitionId: 'petition-cu',
    linkedIncidentId: 'incident-cu',
    expectedPetitionUpdatedAt: 'v1',
    expectedIncidentUpdatedAt: 'v1',
  });

  // Nạp từ máy chủ SAU lần dựng đầu — đúng cách trang Sửa hoạt động.
  useState(() => {
    queueMicrotask(() => setForm((p) => ({ ...p, provenance: nguonBanDau })));
  });

  return (
    <>
      <span data-testid="don-thu-goc">{form.linkedPetitionId}</span>
      <span data-testid="vu-viec-goc">{form.linkedIncidentId}</span>
      <CaseProvenancePicker
        provenance={form.provenance}
        linkedPetitionId={form.linkedPetitionId}
        linkedIncidentId={form.linkedIncidentId}
        expectedPetitionUpdatedAt={form.expectedPetitionUpdatedAt}
        expectedIncidentUpdatedAt={form.expectedIncidentUpdatedAt}
        sourceDocumentNote=""
        errors={{}}
        update={(k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }))}
      />
    </>
  );
}

const doi = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe('Mở vụ án có nguồn gốc: liên kết không được xoá', () => {
  it('nguồn từ ĐƠN THƯ: mở ra vẫn giữ đơn thư gốc', async () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <Host nguonBanDau={CaseProvenance.FROM_PETITION} />
      </MemoryRouter>,
    );
    await doi();
    expect(getByTestId('don-thu-goc').textContent).toBe('petition-cu');
  });

  it('nguồn từ VỤ VIỆC: mở ra vẫn giữ vụ việc gốc', async () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <Host nguonBanDau={CaseProvenance.FROM_INCIDENT} />
      </MemoryRouter>,
    );
    await doi();
    expect(getByTestId('vu-viec-goc').textContent).toBe('incident-cu');
  });

  /**
   * Dọn ô khi cán bộ ĐỔI nguồn vẫn phải giữ nguyên — bản vá không được làm hỏng đường đang
   * chạy đúng, nếu không thì đổi nguồn xong hồ sơ mang hai liên kết mâu thuẫn.
   */
  it('cán bộ đổi nguồn thì ô của nguồn cũ vẫn được dọn', async () => {
    function HostDoi() {
      const [form, setForm] = useState({
        provenance: CaseProvenance.FROM_PETITION as string,
        linkedPetitionId: 'petition-cu',
        linkedIncidentId: '',
        expectedPetitionUpdatedAt: 'v1',
        expectedIncidentUpdatedAt: '',
      });
      return (
        <>
          <span data-testid="don-thu-goc">{form.linkedPetitionId}</span>
          <button
            type="button"
            data-testid="doi-nguon"
            onClick={() => setForm((p) => ({ ...p, provenance: CaseProvenance.FROM_INCIDENT }))}
          />
          <CaseProvenancePicker
            provenance={form.provenance}
            linkedPetitionId={form.linkedPetitionId}
            linkedIncidentId={form.linkedIncidentId}
            expectedPetitionUpdatedAt={form.expectedPetitionUpdatedAt}
            expectedIncidentUpdatedAt={form.expectedIncidentUpdatedAt}
            sourceDocumentNote=""
        errors={{}}
            update={(k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }))}
          />
        </>
      );
    }
    const { getByTestId } = render(
      <MemoryRouter>
        <HostDoi />
      </MemoryRouter>,
    );
    await doi();
    expect(getByTestId('don-thu-goc').textContent).toBe('petition-cu');

    getByTestId('doi-nguon').click();
    await doi();
    expect(getByTestId('don-thu-goc').textContent).toBe('');
  });
});

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })) },
}));
