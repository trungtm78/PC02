import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { createMemoryRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';

/**
 * ĐỊNH TUYẾN CHẾ ĐỘ XEM / SỬA của Đơn thư (yêu cầu 08/10/2026).
 *
 * Trước đây `/petitions/:id` và `/petitions/:id/edit` cùng dựng MỘT form sửa được, nên bấm vào dòng danh sách hay nút
 * "Xem" đều rơi vào form sửa. Nay `:id` là chế độ XEM (ô chỉ-đọc, có nút "Sửa") và chỉ `:id/edit` sửa được.
 *
 * Ca kiểm dựng ĐÚNG bảng route thật (`renderPetitionsRoutes`) nên một route bị đổi `cheDo` hoặc bị thêm mới mà quên
 * khai là đỏ ngay.
 */
let soLanDung = 0;
vi.mock('@/pages/petitions/PetitionFormPage', () => ({
  default: function Form({ cheDo }: { cheDo?: string }) {
    useEffect(() => {
      soLanDung += 1;
    }, []);
    return <div data-testid="form" data-che-do={cheDo ?? 'khong'} />;
  },
}));
vi.mock('@/pages/petitions/PetitionListPageShell', () => ({ default: () => <div data-testid="ds" /> }));
vi.mock('@/pages/petitions/WardPetitionsPage', () => ({ default: () => <div data-testid="ward" /> }));
// Bỏ lớp bọc quyền/tính năng: ca kiểm này chỉ quan tâm `cheDo` truyền xuống.
vi.mock('@/lib/features/wrapRoute', () => ({ wrapRoute: (el: React.ReactNode) => el }));

async function dungRouter(duong: string) {
  const { renderPetitionsRoutes } = await import('../routes');
  const router = createMemoryRouter(createRoutesFromElements(<>{renderPetitionsRoutes()}</>), {
    initialEntries: [duong],
  });
  render(<RouterProvider router={router} />);
  return router;
}

async function doiRoute(duong: string) {
  await dungRouter(duong);
  return screen.findByTestId('form');
}

describe('routes Đơn thư — cheDo', () => {
  it('/petitions/:id → chế độ XEM', async () => {
    expect((await doiRoute('/petitions/abc')).getAttribute('data-che-do')).toBe('xem');
  });

  it('/petitions/:id/edit → chế độ SỬA', async () => {
    expect((await doiRoute('/petitions/abc/edit')).getAttribute('data-che-do')).toBe('sua');
  });

  it('/petitions/new → không có cheDo (tạo mới, sửa được)', async () => {
    expect((await doiRoute('/petitions/new')).getAttribute('data-che-do')).toBe('khong');
  });

  /**
   * Codex bắt: `/petitions/A` và `/petitions/A/edit` cùng dựng MỘT loại component với cùng `:id`, nên React giữ nguyên
   * state khi đi giữa hai route. Mở form tải tệp ở màn sửa rồi bấm Back về màn xem thì form tải tệp còn nguyên và gửi
   * được. Mỗi chế độ phải là một lần dựng RIÊNG.
   */
  it('đi từ chế độ SỬA về chế độ XEM (Back) dựng lại trang, không giữ state của trình soạn thảo đang mở', async () => {
    soLanDung = 0;
    const router = await dungRouter('/petitions/abc/edit');
    await screen.findByTestId('form');
    expect(soLanDung).toBe(1);
    await act(() => router.navigate('/petitions/abc'));
    expect((await screen.findByTestId('form')).getAttribute('data-che-do')).toBe('xem');
    expect(soLanDung).toBe(2);
  });

  it('đi từ chế độ XEM sang SỬA (bấm "Sửa") cũng dựng lại', async () => {
    soLanDung = 0;
    const router = await dungRouter('/petitions/abc');
    await screen.findByTestId('form');
    await act(() => router.navigate('/petitions/abc/edit'));
    expect((await screen.findByTestId('form')).getAttribute('data-che-do')).toBe('sua');
    expect(soLanDung).toBe(2);
  });
});
