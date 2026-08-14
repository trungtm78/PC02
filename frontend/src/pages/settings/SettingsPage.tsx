import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Users,
  Shield,
  List,
  Settings2,
  Bell,
  Lock,
  ChevronRight,
  KeyRound,
  Keyboard,
  MapPin,
  Tag,
} from 'lucide-react';
import { AbbreviationsModule } from './modules/AbbreviationsModule';
import { AddressMappingModule } from './modules/AddressMappingModule';
import { EventCategoriesModule } from './modules/EventCategoriesModule';
import { ShortcutsModule } from './modules/ShortcutsModule';
import { NotificationsModule } from './modules/NotificationsModule';
import { Button } from '@/components/ui/button';
import { TwoFaSetupModal } from '@/components/TwoFaSetupModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { Link } from 'react-router-dom';

// Settings menu items
const menuItems = [
  {
    id: 'directories',
    label: 'Danh mục',
    icon: List,
    description: 'Quản lý danh mục dữ liệu',
  },
  {
    id: 'notifications',
    label: 'Thông báo',
    icon: Bell,
    description: 'Cấu hình thông báo và email',
  },
  {
    id: 'security',
    label: 'Bảo mật',
    icon: Lock,
    description: 'Cấu hình bảo mật và 2FA',
  },
  {
    id: 'abbreviations',
    label: 'Từ viết tắt',
    icon: Keyboard,
    description: 'Thư viện phím tắt cá nhân (F9)',
  },
  {
    id: 'address-mapping',
    label: 'Cải cách địa chỉ',
    icon: MapPin,
    description: 'Mapping địa chỉ cũ → mới (F10)',
  },
  {
    id: 'shortcuts',
    label: 'Phím tắt',
    icon: KeyRound,
    description: 'Tùy chỉnh phím tắt thao tác',
  },
  {
    id: 'event-categories',
    label: 'Danh mục sự kiện',
    icon: Tag,
    description: 'Phân loại sự kiện calendar với màu tùy chỉnh',
  },
];



// Directories Module
const DIRECTORY_TYPE_CONFIG: Record<string, { label: string; legacy?: boolean }> = {
  WARD:               { label: 'Phường/Xã' },
  PROVINCE:           { label: 'Tỉnh/Thành phố' },
  DISTRICT:           { label: 'Quận/Huyện', legacy: true },
  UNIT:               { label: 'Đơn vị công an' },
  INCIDENT_TYPE:      { label: 'Loại vụ việc' },
  INCIDENT_LEVEL:     { label: 'Mức độ nghiêm trọng' },
  CASE_CLASSIFICATION:{ label: 'Phân loại vụ án' },
  CRIME:              { label: 'Loại tội phạm (BLHS)' },
  TDC_SOURCE:         { label: 'Nguồn tin TĐC' },
  TDC_CASE_TYPE:      { label: 'Loại vụ TĐC' },
  PROSECUTION_OFFICE: { label: 'Viện kiểm sát' },
  PRIORITY:           { label: 'Mức độ ưu tiên' },
  PETITION_TYPE:      { label: 'Loại đơn thư' },
  DOCUMENT_TYPE:      { label: 'Loại tài liệu' },
  EVIDENCE_TYPE:      { label: 'Loại vật chứng' },
  OCCUPATION:         { label: 'Ngành nghề' },
  NATIONALITY:        { label: 'Quốc tịch' },
  GENDER:             { label: 'Giới tính' },
  AGE_GROUP:          { label: 'Nhóm tuổi' },
  EDUCATION_LEVEL:    { label: 'Trình độ học vấn' },
  ORG:                { label: 'Tổ chức/Đơn vị' },
};

const DIRECTORY_TYPE_PRIORITY = ['WARD', 'PROVINCE', 'CRIME', 'INCIDENT_TYPE', 'PETITION_TYPE', 'UNIT'];

function DirectoriesModule() {
  const [stats, setStats] = useState<{ type: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = () => {
    setLoading(true);
    setError(false);
    api.get('/directories/stats')
      .then((res) => setStats(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStats(); }, []);

  const displayed = stats
    .filter((s) => DIRECTORY_TYPE_CONFIG[s.type])
    .sort((a, b) => {
      if (a.type === 'DISTRICT') return 1;
      if (b.type === 'DISTRICT') return -1;
      const ai = DIRECTORY_TYPE_PRIORITY.indexOf(a.type);
      const bi = DIRECTORY_TYPE_PRIORITY.indexOf(b.type);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.type.localeCompare(b.type);
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900">Danh mục hệ thống</h2>
        <div className="flex items-center justify-center h-32 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
          Đang tải danh mục...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900">Danh mục hệ thống</h2>
        <div className="flex flex-col items-center justify-center h-32 gap-3 text-slate-500">
          <p>Không thể tải danh mục. Vui lòng thử lại.</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Danh mục hệ thống</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayed.map((dir) => {
          const cfg = DIRECTORY_TYPE_CONFIG[dir.type];
          return (
            <div
              key={dir.type}
              className={`bg-white rounded-lg border p-4 transition-shadow ${
                cfg.legacy
                  ? 'border-dashed border-slate-300 opacity-60'
                  : 'border-slate-200 hover:shadow-md cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    {cfg.label}
                    {cfg.legacy && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-normal">
                        Di sản · trước 01/07/2025
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {dir.count.toLocaleString('vi-VN')} mục
                  </p>
                  {cfg.legacy && (
                    <p className="text-xs text-slate-400 mt-1">
                      Chỉ hiển thị ở hồ sơ cũ — không dùng cho nhập liệu mới
                    </p>
                  )}
                </div>
                {!cfg.legacy && <ChevronRight className="w-5 h-5 text-slate-400" />}
              </div>
            </div>
          );
        })}
      </div>

      {displayed.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          Chưa có dữ liệu danh mục. Chạy <code>npm run db:seed</code> để tạo.
        </div>
      )}
    </div>
  );
}


// Security Module
function SecurityModule() {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [twoFaSetupOpen, setTwoFaSetupOpen] = useState(false);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Cài đặt bảo mật</h2>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        {/* Password Change */}
        <div>
          <h3 className="font-medium text-slate-900 mb-1">Đổi mật khẩu</h3>
          <p className="text-sm text-slate-500 mb-4">Thay đổi mật khẩu đăng nhập của bạn.</p>
          <Button variant="outline" onClick={() => setChangePasswordOpen(true)}>
            <KeyRound className="w-4 h-4 mr-2" />
            Đổi mật khẩu
          </Button>
        </div>

        <hr className="border-slate-200" />

        {/* 2FA */}
        <div>
          <h3 className="font-medium text-slate-900 mb-1">Xác thực hai yếu tố (2FA)</h3>
          <p className="text-sm text-slate-500 mb-4">
            Tăng cường bảo mật tài khoản bằng ứng dụng xác thực (Google Authenticator, Authy...).
          </p>
          <Button variant="outline" onClick={() => setTwoFaSetupOpen(true)}>
            <Shield className="w-4 h-4 mr-2" />
            Cài đặt 2FA
          </Button>
        </div>
      </div>

      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      <TwoFaSetupModal open={twoFaSetupOpen} onClose={() => setTwoFaSetupOpen(false)} />
    </div>
  );
}

// Main Settings Page
export default function SettingsPage() {
  const [activeModule, setActiveModule] = useState('directories');

  const renderModule = () => {
    switch (activeModule) {
      case 'directories':
        return <DirectoriesModule />;
      case 'notifications':
        return <NotificationsModule />;
      case 'security':
        return <SecurityModule />;
      case 'abbreviations':
        return <AbbreviationsModule />;
      case 'address-mapping':
        return <AddressMappingModule />;
      case 'shortcuts':
        return <ShortcutsModule />;
      case 'event-categories':
        return <EventCategoriesModule />;
      default:
        return <DirectoriesModule />;
    }
  };

  return (
    <div className="h-full bg-slate-50">
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h1 className="text-lg font-semibold text-slate-900">Cài đặt hệ thống</h1>
            <p className="text-sm text-slate-500">Quản lý cấu hình</p>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveModule(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                        ${isActive 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'text-slate-700 hover:bg-slate-50'
                        }
                      `}
                      data-testid={`settings-menu-${item.id}`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Three tabs used to live here — Người dùng, Phân quyền and
                Tham số — and all three were mockups. The first was a button
                that navigated away; the second listed four invented roles
                (admin/investigator/secretary/viewer) that are not the real
                ROLE_NAMES and saved nowhere; the third showed five hardcoded
                parameter values with no endpoint behind them. Pointing at the
                screens that do the job is honest; a tab that pretends is not. */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Quản trị (trang riêng)
              </p>
              <ul className="space-y-1">
                <li>
                  <Link
                    to="/nguoi-dung"
                    data-testid="settings-link-users"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 hover:bg-slate-50"
                  >
                    <Users className="h-5 w-5 text-slate-400" />
                    <span className="font-medium">Người dùng &amp; phân quyền</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/settings"
                    data-testid="settings-link-admin"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 hover:bg-slate-50"
                  >
                    <Settings2 className="h-5 w-5 text-slate-400" />
                    <span className="font-medium">Tham số hệ thống</span>
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  );
}
