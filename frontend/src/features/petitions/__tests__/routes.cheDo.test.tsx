import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
vi.mock('@/pages/petitions/PetitionFormPage', () => ({
  default: ({ cheDo }: { cheDo?: string }) => <div data-testid="form" data-che-do={cheDo ?? 'khong'} />,
}));
vi.mock('@/pages/petitions/PetitionListPageShell', () => ({ default: () => <div data-testid="ds" /> }));
vi.mock('@/pages/petitions/WardPetitionsPage', () => ({ default: () => <div data-testid="ward" /> }));
// Bỏ lớp bọc quyền/tính năng: ca kiểm này chỉ quan tâm `cheDo` truyền xuống.
vi.mock('@/lib/features/wrapRoute', () => ({ wrapRoute: (el: React.ReactNode) => el }));

async function doiRoute(duong: string) {
  const { renderPetitionsRoutes } = await import('../routes');
  const router = createMemoryRouter(createRoutesFromElements(<>{renderPetitionsRoutes()}</>), {
    initialEntries: [duong],
  });
  render(<RouterProvider router={router} />);
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
});
