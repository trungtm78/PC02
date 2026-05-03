import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '../SettingsPage';
import { api } from '@/lib/api';

const renderWithRouter = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

// Mock api — SettingsPage DirectoriesModule calls api.get('/directories/stats')
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  authApi: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    sendEmailOtp: vi.fn().mockResolvedValue({ data: {} }),
    verifyTwoFa: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock usePermission hook (not used in SettingsPage but may be in future)
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    canCreate: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canView: () => true,
  }),
}));

const mockDirectoriesStats = [
  { type: 'CRIME', count: 12 },
  { type: 'INCIDENT_TYPE', count: 6 },
  { type: 'UNIT', count: 8 },
  { type: 'CASE_CLASSIFICATION', count: 4 },
  { type: 'PROSECUTION_OFFICE', count: 5 },
];

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup api.get after clearAllMocks (clearAllMocks resets mockImplementation)
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/directories/stats')) {
        // Component reads res.data, so wrap in axios-style response
        return Promise.resolve({ data: mockDirectoriesStats });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('should render settings page with sidebar', () => {
    renderWithRouter(<SettingsPage />);
    
    expect(screen.getByText('Cài đặt hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Quản lý cấu hình')).toBeInTheDocument();
  });

  it('should render all menu items in sidebar', () => {
    renderWithRouter(<SettingsPage />);
    
    const menuItems = ['NgườI dùng', 'Phân quyền', 'Danh mục', 'Tham số', 'Thông báo', 'Bảo mật'];
    menuItems.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it('should display user management module by default', () => {
    renderWithRouter(<SettingsPage />);
    
    expect(screen.getByText('Quản lý ngườI dùng')).toBeInTheDocument();
  });

  it('should switch to permissions module when clicking menu', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-permissions'));
    
    await waitFor(() => {
      expect(screen.getByText('Phân quyền hệ thống')).toBeInTheDocument();
    });
  });

  it('should switch to directories module when clicking menu', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-directories'));
    
    await waitFor(() => {
      expect(screen.getByText('Danh mục hệ thống')).toBeInTheDocument();
    });
  });

  it('should switch to parameters module when clicking menu', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-parameters'));
    
    await waitFor(() => {
      expect(screen.getByText('Tham số hệ thống')).toBeInTheDocument();
    });
  });

  it('should switch to notifications module when clicking menu', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-notifications'));
    
    await waitFor(() => {
      expect(screen.getByText('Cấu hình thông báo')).toBeInTheDocument();
    });
  });

  it('should switch to security module when clicking menu', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-security'));
    
    await waitFor(() => {
      expect(screen.getByText('Cài đặt bảo mật')).toBeInTheDocument();
    });
  });

  it('should render user management table with correct headers', () => {
    renderWithRouter(<SettingsPage />);
    
    const headers = ['Tên', 'Email', 'Vai trò', 'Trạng thái', 'Thao tác'];
    headers.forEach(header => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });
  });

  it('should render navigate-to-users button in user management', () => {
    renderWithRouter(<SettingsPage />);
    expect(screen.getByText('Đến trang Quản lý người dùng')).toBeInTheDocument();
  });

  it('should render role selector in permissions module', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-permissions'));
    
    await waitFor(() => {
      // Check for role options in select
      expect(screen.getByText('Quản trị viên')).toBeInTheDocument();
      expect(screen.getByText('Điều tra viên')).toBeInTheDocument();
      expect(screen.getByText('Thư ký')).toBeInTheDocument();
    });
  });

  it('should render directories with counts', async () => {
    renderWithRouter(<SettingsPage />);

    fireEvent.click(screen.getByTestId('settings-menu-directories'));

    await waitFor(() => {
      // Page title is always shown when directories module loads
      expect(screen.getByText('Danh mục hệ thống')).toBeInTheDocument();
    });
    // After the API resolves, expect the count to appear
    await waitFor(() => {
      // CRIME type: count=12 → "12 mục"; INCIDENT_TYPE → "Loại vụ việc"
      expect(screen.getByText('12 mục')).toBeInTheDocument();
      expect(screen.getByText('Loại vụ việc')).toBeInTheDocument();
    });
  });

  it('should render parameters with input fields', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-parameters'));
    
    await waitFor(() => {
      expect(screen.getByText('Kích thước file tối đa')).toBeInTheDocument();
      expect(screen.getByText('ThờI gian hết phiên (phút)')).toBeInTheDocument();
      expect(screen.getByText('Số mục mỗi trang')).toBeInTheDocument();
    });
  });

  it('should render notification toggles', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-notifications'));
    
    await waitFor(() => {
      expect(screen.getByText('Thông báo qua email')).toBeInTheDocument();
      expect(screen.getByText('Thông báo qua SMS')).toBeInTheDocument();
      expect(screen.getByText('Thông báo trình duyệt')).toBeInTheDocument();
    });
  });

  it('should render security settings with password change', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-security'));
    
    await waitFor(() => {
      expect(screen.getAllByText('Đổi mật khẩu').length).toBeGreaterThan(0);
      expect(screen.getByText('Xác thực hai yếu tố (2FA)')).toBeInTheDocument();
    });
  });
});
