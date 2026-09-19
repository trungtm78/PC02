/**
 * Chi tiết Vụ việc: người xem CHỈ ĐỌC được (vd điều phối viên xem vụ việc tổ khác) thì KHÔNG thấy Chỉnh sửa / Khởi tố
 * thành vụ án — máy chủ đều 403 (sửa: checkWriteScope; khởi tố: tạo vụ án FROM_INCIDENT kiểm phạm vi ghi của vụ việc).
 * Máy chủ trả `quyenGhi` (20/09/2026, cùng cách Vụ án #439). Quyền VAI TRÒ (canEdit) vẫn áp như trước.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from '@/lib/api';
import IncidentDetailPage from '../IncidentDetailPage';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ canEdit: () => true }) }));
const m = vi.mocked(api) as unknown as Record<'get', ReturnType<typeof vi.fn>>;

function dung(quyenGhi: boolean | undefined) {
  m.get.mockResolvedValue({
    data: { data: { id: 'i1', stt: '2026-1', name: 'Vụ việc 1', status: 'TIEP_NHAN', quyenGhi } },
  });
  return render(
    <MemoryRouter initialEntries={['/vu-viec/i1']}>
      <Routes>
        <Route path="/vu-viec/:id" element={<IncidentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Chi tiết Vụ việc — chỉ xem thì ẩn nút ghi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quyenGhi = false → không Chỉnh sửa, không Khởi tố; có nhãn Chỉ xem', async () => {
    dung(false);
    expect(await screen.findByTestId('nhan-chi-xem')).toBeInTheDocument();
    expect(screen.queryByText('Chỉnh sửa')).toBeNull();
    expect(screen.queryByTestId('incident-detail-prosecute-btn')).toBeNull();
  });

  it('quyenGhi = true → có Chỉnh sửa và Khởi tố', async () => {
    dung(true);
    expect(await screen.findByText('Chỉnh sửa')).toBeInTheDocument();
    expect(screen.getByTestId('incident-detail-prosecute-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('nhan-chi-xem')).toBeNull();
  });

  it('thiếu trường (máy chủ cũ) → như trước: có nút', async () => {
    dung(undefined);
    expect(await screen.findByText('Chỉnh sửa')).toBeInTheDocument();
  });
});
