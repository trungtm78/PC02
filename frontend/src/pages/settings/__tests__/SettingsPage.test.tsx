import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// react-router-dom, not react-router: the app imports from the former
// everywhere (93 files), and mixing the two gives the tree two router
// instances, so <Link> finds a null context and every test here fails.
import { MemoryRouter } from 'react-router-dom';
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
        return Promise.resolve({ data: mockDirectoriesStats });
      }
      if (url.includes('/notification-preferences')) {
        return Promise.resolve({ data: { success: true, data: [] } });
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

    const menuItems = ['Danh mục', 'Thông báo', 'Bảo mật'];
    menuItems.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  // Three tabs here were mockups: a button that navigated away, four invented
  // roles that are not the real ROLE_NAMES and saved nowhere, and five
  // hardcoded parameter values with no endpoint behind them. They are gone,
  // and the sidebar points at the screens that actually do the job.
  it('no longer offers the mock Phân quyền and Tham số tabs', () => {
    renderWithRouter(<SettingsPage />);

    expect(screen.queryByTestId('settings-menu-permissions')).toBeNull();
    expect(screen.queryByTestId('settings-menu-parameters')).toBeNull();
    expect(screen.queryByTestId('settings-menu-users')).toBeNull();
  });

  it('links to the real user and system-parameter screens instead', () => {
    renderWithRouter(<SettingsPage />);

    expect(screen.getByTestId('settings-link-users')).toHaveAttribute(
      'href',
      '/nguoi-dung',
    );
    expect(screen.getByTestId('settings-link-admin')).toHaveAttribute(
      'href',
      '/admin/settings',
    );
  });

  it('has no mojibake left in the sidebar', () => {
    // The removed tabs carried "NgườI dùng" / "ThờI gian" — a broken
    // lower-case i that also made the strings unsearchable.
    renderWithRouter(<SettingsPage />);
    expect(document.body.textContent).not.toMatch(/ườI|ờI |ốI |ạI /);
  });

  it('should switch to directories module when clicking menu', async () => {
    renderWithRouter(<SettingsPage />);
    
    fireEvent.click(screen.getByTestId('settings-menu-directories'));
    
    await waitFor(() => {
      expect(screen.getByText('Danh mục hệ thống')).toBeInTheDocument();
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

  it('should render notification preferences module', async () => {
    renderWithRouter(<SettingsPage />);

    fireEvent.click(screen.getByTestId('settings-menu-notifications'));

    await waitFor(() => {
      expect(screen.getByText('Cấu hình thông báo')).toBeInTheDocument();
      expect(screen.getByText('Đặt lại mặc định')).toBeInTheDocument();
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
