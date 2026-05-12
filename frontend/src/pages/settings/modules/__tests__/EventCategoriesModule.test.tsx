import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventCategoriesModule } from '../EventCategoriesModule';
import { eventCategoriesApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  eventCategoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    canCreate: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canView: () => true,
  }),
}));

const fakeCategories = [
  {
    id: '1',
    slug: 'national',
    name: 'Quốc gia',
    color: '#dc2626',
    icon: 'flag',
    isSystem: true,
    sortOrder: 10,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    slug: 'training',
    name: 'Tập huấn',
    color: '#f97316',
    icon: null,
    isSystem: false,
    sortOrder: 100,
    createdAt: '',
    updatedAt: '',
  },
];

describe('EventCategoriesModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eventCategoriesApi.list).mockResolvedValue({ data: fakeCategories } as any);
  });

  it('renders category list with name + slug + system badge', async () => {
    render(<EventCategoriesModule />);
    await waitFor(() => {
      expect(screen.getByText('Quốc gia')).toBeInTheDocument();
      expect(screen.getByText('national')).toBeInTheDocument();
      expect(screen.getByText('Hệ thống')).toBeInTheDocument(); // badge for isSystem=true
      expect(screen.getByText('Tập huấn')).toBeInTheDocument();
    });
  });

  it('disables delete button for isSystem=true categories', async () => {
    render(<EventCategoriesModule />);
    await waitFor(() => screen.getByText('Quốc gia'));

    // Quốc gia row has only Sửa button, no Xóa.
    // Tập huấn row has both Sửa and Xóa.
    const deleteButtons = screen.getAllByLabelText('Xóa');
    expect(deleteButtons).toHaveLength(1); // only Tập huấn
  });

  it('opens add modal when clicking "Thêm danh mục"', async () => {
    render(<EventCategoriesModule />);
    await waitFor(() => screen.getByText('Quốc gia'));

    fireEvent.click(screen.getByText('Thêm danh mục'));
    expect(screen.getByText('Thêm danh mục mới')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('vd: training, unit-internal')).toBeInTheDocument();
  });

  it('POSTs new category with slug + name + color + sortOrder on save', async () => {
    vi.mocked(eventCategoriesApi.create).mockResolvedValue({ data: { id: 'new' } } as any);
    render(<EventCategoriesModule />);
    await waitFor(() => screen.getByText('Quốc gia'));

    fireEvent.click(screen.getByText('Thêm danh mục'));
    fireEvent.change(screen.getByPlaceholderText('vd: training, unit-internal'), { target: { value: 'tap-huan' } });
    fireEvent.change(screen.getByPlaceholderText('vd: Tập huấn nội bộ'), { target: { value: 'Tập huấn nội bộ' } });
    fireEvent.click(screen.getByText('Lưu'));

    await waitFor(() => {
      expect(eventCategoriesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'tap-huan', name: 'Tập huấn nội bộ', color: '#003973' }),
      );
    });
  });

  it('PATCHes when editing — does NOT send slug field', async () => {
    vi.mocked(eventCategoriesApi.update).mockResolvedValue({ data: {} } as any);
    render(<EventCategoriesModule />);
    await waitFor(() => screen.getByText('Tập huấn'));

    const editButtons = screen.getAllByLabelText('Sửa');
    fireEvent.click(editButtons[1]); // Tập huấn (non-system)
    fireEvent.change(screen.getByPlaceholderText('vd: Tập huấn nội bộ'), { target: { value: 'Tập huấn mới' } });
    fireEvent.click(screen.getByText('Lưu'));

    await waitFor(() => {
      expect(eventCategoriesApi.update).toHaveBeenCalledWith('2', expect.objectContaining({ name: 'Tập huấn mới' }));
    });
    // Ensure slug is NOT in the patch payload (whitelist guard)
    const callArgs = vi.mocked(eventCategoriesApi.update).mock.calls[0][1];
    expect((callArgs as any).slug).toBeUndefined();
  });
});
