import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import CaseExchangePage from '../workflow/CaseExchangePage';
import TransferAndReturnPage from '../workflow/TransferAndReturnPage';
import DuplicatePetitionsPage from '../classification/DuplicatePetitionsPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({ primaryTeamName: 'Đội 1', userId: 'A' }),
}));
vi.mock('@/stores/auth.store', async (goc) => {
  const that = (await goc()) as Record<string, unknown>;
  const NGUOI = { id: 'u1', role: 'ADMIN', username: 'admin', teams: [] };
  return {
    ...that,
    authStore: {
      ...(that.authStore as object),
      getUser: () => NGUOI,
      getProfile: () => NGUOI,
      getToken: () => 't',
      isAuthenticated: () => true,
    },
  };
});

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const NGAY = '2026-09-01T02:00:00.000Z';

/** 25 dòng: dòng đầu khớp "trom cap", 24 dòng sau không — đủ hai trang (20/trang). */
const TRAO_DOI = Array.from({ length: 25 }, (_, i) => ({
  id: `e${i + 1}`,
  recordCode: `VA-2026-${String(i + 1).padStart(3, '0')}`,
  recordType: 'Vụ án',
  senderUnit: i === 0 ? 'Đội Trộm cắp' : `Đội Kinh tế ${i}`,
  receiverUnit: 'Công an Quận 1',
  status: 'OPEN',
  lastMessage: 'Đã gửi hồ sơ',
  createdAt: NGAY,
}));

const VU_AN = Array.from({ length: 25 }, (_, i) => ({
  id: `case-${String(i + 1).padStart(5, '0')}`,
  name: i === 0 ? 'Trộm cắp tài sản' : `Vụ khác ${i}`,
  unit: 'Đội 1',
  status: 'TIEP_NHAN',
  createdAt: NGAY,
}));

const KIEN_NGHI = [
  { id: 'k1', proposalNumber: 'KN-001', content: 'Kiến nghị vụ trộm cắp', unit: 'VKS Quận 1', status: 'CHO_GUI', createdAt: NGAY },
  { id: 'k2', proposalNumber: 'KN-002', content: 'Kiến nghị đất đai', unit: 'VKS Quận 3', status: 'DA_GUI', createdAt: NGAY },
];

const DON_THU = [
  { id: 'p1', stt: 'DT-001', summary: 'Tố cáo trộm cắp', senderName: 'Nguyễn Văn An', status: 'MOI_TIEP_NHAN', receivedDate: NGAY },
  { id: 'p2', stt: 'DT-002', summary: 'Khiếu nại đất đai', senderName: 'Lê Thị Hoa', status: 'DANG_XU_LY', receivedDate: NGAY },
];

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    const data = url.startsWith('/exchanges')
      ? TRAO_DOI
      : url.startsWith('/cases')
        ? VU_AN
        : url.startsWith('/proposals')
          ? KIEN_NGHI
          : url.startsWith('/petitions')
            ? DON_THU
            : [];
    return Promise.resolve({ data: { data, total: data.length } });
  });
}

function dung(Man: React.ComponentType, url = '/') {
  const router = createMemoryRouter([{ path: '/', element: <Man /> }], { initialEntries: [url] });
  return render(<RouterProvider router={router} />);
}

async function themTheTatCa(giaTri: string) {
  const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
  fireEvent.change(o, { target: { value: giaTri } });
  fireEvent.keyDown(o, { key: 'Enter' });
}

beforeEach(() => {
  vi.clearAllMocks();
  traDuLieu();
});

/**
 * Sửa theo /review + Codex (M5). Trang lưu số trang và lựa chọn trong state riêng: thẻ đổi mà hai
 * thứ ấy giữ nguyên thì bảng nói "không tìm thấy" dù có kết quả, và nút Chuyển đội gửi cả hồ sơ
 * đang bị thẻ ẩn.
 */
describe('Trao đổi chuyên án — thẻ đổi thì về trang 1; Làm mới xoá thẻ', () => {
  it('đang ở trang 2, thêm thẻ khớp dòng trang 1 → thấy dòng ấy', async () => {
    dung(CaseExchangePage);
    await screen.findByTestId('view-thread-e1');
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByTestId('view-thread-e25');
    await themTheTatCa('trom cap');
    expect(await screen.findByTestId('view-thread-e1')).toBeInTheDocument();
  });

  it('nút làm mới xoá thẻ', async () => {
    dung(CaseExchangePage, '/?caseExchange_tk=donViGui~trom cap');
    expect(await screen.findByTestId('the-tim-kiem')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('refresh-btn'));
    await waitFor(() => expect(screen.queryByTestId('the-tim-kiem')).not.toBeInTheDocument());
  });
});

describe('Chuyển đội / Trả hồ sơ — trang, lựa chọn, làm mới theo thẻ', () => {
  it('đang ở trang 2, thêm thẻ khớp dòng trang 1 → thấy dòng ấy', async () => {
    dung(TransferAndReturnPage);
    await screen.findByTestId('view-record-case-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByTestId('view-record-case-00025');
    await themTheTatCa('trom cap');
    expect(await screen.findByTestId('view-record-case-00001')).toBeInTheDocument();
  });

  it('dòng đã chọn bị thẻ ẩn → bỏ khỏi lựa chọn, nút Chuyển đội không gửi nó', async () => {
    dung(TransferAndReturnPage);
    fireEvent.click(await screen.findByTestId('record-checkbox-case-00002'));
    expect(screen.getByTestId('transfer-btn')).toHaveTextContent('Chuyển đội (1)');
    await themTheTatCa('trom cap');
    await waitFor(() =>
      expect(screen.queryByTestId('view-record-case-00002')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('transfer-btn')).toHaveTextContent('Chuyển đội (0)');
    expect(screen.getByTestId('transfer-btn')).toBeDisabled();
  });

  it('nút làm mới xoá thẻ', async () => {
    dung(TransferAndReturnPage, '/?transferReturn_tk=tenHoSo~trom cap');
    expect(await screen.findByTestId('the-tim-kiem')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('refresh-btn'));
    await waitFor(() => expect(screen.queryByTestId('the-tim-kiem')).not.toBeInTheDocument());
    expect(await screen.findByTestId('view-record-case-00002')).toBeInTheDocument();
  });
});

describe('Đơn trùng — thẻ thống kê theo thẻ', () => {
  it('thẻ thu hẹp bảng → thẻ Tổng số đơn trùng đếm đúng số dòng đang áp thẻ', async () => {
    dung(DuplicatePetitionsPage, '/?duplicatePetitions_tk=tieuDe~trom cap');
    await screen.findByTestId('view-btn-p1');
    const nhan = screen.getByText('Tổng số đơn trùng');
    await waitFor(() => expect(nhan.nextElementSibling).toHaveTextContent('1'));
  });
});

