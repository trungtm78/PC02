import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import CaseExchangePage from '../CaseExchangePage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/csv', () => ({ downloadCsv: vi.fn() }));

import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
const m = vi.mocked(api) as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const CO_TAT_THE: FeatureFlag[] = [
  {
    key: 'TIM_KIEM_THE',
    label: 'Tìm kiếm dạng thẻ',
    description: null,
    enabled: false,
    domain: null,
    rolloutPct: 100,
  },
];

const TRAO_DOI = {
  id: 'e1',
  recordCode: null,
  maHoSo: '2025-586',
  recordType: null,
  senderUnit: 'Mai Thanh Tâm',
  receiverUnit: 'Đội 4',
  subject: 'Bà Mai Thanh Tâm tố cáo',
  status: 'OPEN',
  createdAt: '2026-07-23T08:45:20.000Z',
  messageCount: 0,
  lastMessage: null,
  lastMessageTime: null,
};

let rong = false;
let tongDanhSach = 1;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/exchanges')) {
      const data = rong ? [] : [TRAO_DOI];
      return Promise.resolve({
        data: { success: true, data, total: rong ? 0 : tongDanhSach, page: 1, pageSize: 20 },
      });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

const goiDanhSach = () =>
  m.get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/exchanges?'));
function thamSoCuoi(): URLSearchParams {
  const goi = goiDanhSach();
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <CaseExchangePage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * Trao đổi chuyên án tìm ở MÁY CHỦ (17/09/2026). Trước đó màn tải `limit=100` rồi lọc tại chỗ; bảng "Tìm
 * kiếm nâng cao" có ô nhập nhưng KHÔNG lọc gì; cột Mã hồ sơ rỗng 73/76 bản di trú; tạo mới luôn 400
 * (DTO không có `content`) và lỗi bị nuốt.
 */
describe('CaseExchangePage — tìm kiếm phía máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 1;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột", về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('view-thread-e1');
    fireEvent.change(o, { target: { value: 'to cao' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['*~to cao']));
    expect(thamSoCuoi().get('offset')).toBe('0');
  });

  it('thẻ trên URL (`caseExchange_tk`) → gửi xuống máy chủ', async () => {
    dung('/?caseExchange_tk=donViNhan~doi 4');
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['donViNhan~doi 4']));
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?caseExchange_tk=donViGui~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Đơn vị gửi' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'doi 4' } });
    await waitFor(() => expect(thamSoCuoi().get('search')).toBe('doi 4'));
  });

  it('tìm kiếm nâng cao THỰC SỰ lọc: ô chữ → thẻ theo cột, trạng thái → mã enum, ngày → khoảng', async () => {
    dung();
    await screen.findByTestId('view-thread-e1');
    fireEvent.click(screen.getByTestId('advanced-search-btn'));
    fireEvent.change(screen.getByTestId('filter-sender-unit'), { target: { value: 'Mai Thanh' } });
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'OPEN' } });
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2026-07-01' } });
    await waitFor(() => expect(thamSoCuoi().get('status')).toBe('OPEN'));
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toContain('donViGui~Mai Thanh'));
    expect(thamSoCuoi().get('fromDate')).toBe('2026-07-01');
  });

  it('phân trang ở máy chủ: tổng từ máy chủ, trang sau gửi offset, STT theo trang', async () => {
    tongDanhSach = 45;
    dung();
    await screen.findByTestId('view-thread-e1');
    expect(screen.getByTestId('exchange-total')).toHaveTextContent('45');
    fireEvent.click(screen.getByTestId('exchange-next-page'));
    await waitFor(() => expect(thamSoCuoi().get('offset')).toBe('20'));
    const dong = (await screen.findByTestId('view-thread-e1')).closest('tr') as HTMLElement;
    expect(within(dong).getByText('21')).toBeInTheDocument();
  });

  it('cột Mã hồ sơ hiện mã năm-stt khi mã đang lưu rỗng; trạng thái hiện nhãn, không hiện mã', async () => {
    dung();
    const dong = (await screen.findByTestId('view-thread-e1')).closest('tr') as HTMLElement;
    expect(within(dong).getByText('2025-586')).toBeInTheDocument();
    expect(within(dong).getByText('Đang trao đổi')).toBeInTheDocument();
    expect(within(dong).queryByText('open')).not.toBeInTheDocument();
  });

  it('xuất Excel tải đủ mọi trang khớp bộ lọc rồi mới ghi tệp', async () => {
    tongDanhSach = 25;
    dung('/?caseExchange_tk=donViNhan~doi 4');
    await screen.findByTestId('view-thread-e1');
    fireEvent.click(screen.getByTestId('export-excel-btn'));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
    const xuat = goiDanhSach().filter(
      (u) => new URLSearchParams(u.split('?')[1]).get('limit') === '200',
    );
    expect(xuat.length).toBeGreaterThan(0);
    expect(new URLSearchParams(xuat[0].split('?')[1]).getAll('tk')).toEqual(['donViNhan~doi 4']);
  });

  it('tạo mới lỗi → NÓI ra lý do máy chủ, modal vẫn mở', async () => {
    m.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 500,
        data: { success: false, error: { code: 'INTERNAL', message: 'Máy chủ bận', details: [] } },
      },
    });
    dung();
    await screen.findByTestId('view-thread-e1');
    fireEvent.click(screen.getByTestId('create-exchange-btn'));
    fireEvent.change(await screen.findByTestId('exchange-record-code-input'), {
      target: { value: '2026-1' },
    });
    const modal = screen.getByTestId('exchange-modal');
    fireEvent.change(within(modal).getByTestId('exchange-receiver-unit-select'), {
      target: { value: 'Công an Thành phố' },
    });
    fireEvent.change(within(modal).getByTestId('exchange-content-textarea'), {
      target: { value: 'Xin trao đổi hồ sơ' },
    });
    fireEvent.click(within(modal).getByTestId('submit-exchange-btn'));
    expect(await screen.findByTestId('exchange-save-error')).toHaveTextContent('Máy chủ bận');
    expect(screen.getByTestId('exchange-modal')).toBeInTheDocument();
  });
});
