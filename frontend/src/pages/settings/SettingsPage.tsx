import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Users,
  Shield,
  List,
  Settings2,
  Bell,
  Lock,
  Smartphone,
  Mail,
  Save,
  ChevronRight,
  KeyRound,
  Keyboard,
  MapPin,
} from 'lucide-react';
import { AbbreviationsModule } from './modules/AbbreviationsModule';
import { AddressMappingModule } from './modules/AddressMappingModule';
import { Button } from '@/components/ui/button';
import { TwoFaSetupModal } from '@/components/TwoFaSetupModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';

// Settings menu items
const menuItems = [
  {
    id: 'users',
    label: 'NgườI dùng',
    icon: Users,
    description: 'Quản lý tài khoản ngườI dùng hệ thống',
  },
  {
    id: 'permissions',
    label: 'Phân quyền',
    icon: Shield,
    description: 'Cấu hình vai trò và quyền hạn',
  },
  {
    id: 'directories',
    label: 'Danh mục',
    icon: List,
    description: 'Quản lý danh mục dữ liệu',
  },
  {
    id: 'parameters',
    label: 'Tham số',
    icon: Settings2,
    description: 'Cấu hình tham số hệ thống',
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
];

// User Management Module — redirects to real admin page at /nguoi-dung
function UserManagementModule() {
  const goToUserAdmin = () => { window.location.href = '/nguoi-dung'; };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-900">Quản lý ngườI dùng</h2>
        <Button onClick={goToUserAdmin}>
          <Users className="w-4 h-4 mr-2" />
          Đến trang Quản lý người dùng
        </Button>
      </div>
      
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tên</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vai trò</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {[
              { name: 'Nguyễn Văn A', email: 'nguyenvana@pc02.gov.vn', role: 'Admin', status: 'Hoạt động' },
              { name: 'Trần Thị B', email: 'tranthib@pc02.gov.vn', role: 'Điều tra viên', status: 'Hoạt động' },
              { name: 'Lê Văn C', email: 'levanc@pc02.gov.vn', role: 'Thư ký', status: 'Tạm khóa' },
            ].map((user, index) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.status === 'Hoạt động' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  <button onClick={goToUserAdmin} className="text-blue-600 hover:text-blue-900 mr-3">Sửa</button>
                  <button onClick={goToUserAdmin} className="text-red-600 hover:text-red-900">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Permissions Module
function PermissionsModule() {
  const [selectedRole, setSelectedRole] = useState('admin');
  
  const roles = [
    { id: 'admin', name: 'Quản trị viên' },
    { id: 'investigator', name: 'Điều tra viên' },
    { id: 'secretary', name: 'Thư ký' },
    { id: 'viewer', name: 'NgườI xem' },
  ];

  const permissions = [
    { module: 'Vụ án', view: true, create: true, edit: true, delete: true },
    { module: 'Đơn thư', view: true, create: true, edit: true, delete: false },
    { module: 'Đối tượng', view: true, create: true, edit: true, delete: false },
    { module: 'Báo cáo', view: true, create: true, edit: false, delete: false },
    { module: 'Cài đặt', view: true, create: false, edit: false, delete: false },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Phân quyền hệ thống</h2>
      
      <div className="flex gap-4 mb-6">
        <select 
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <Button variant="outline">Thêm vai trò mới</Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Module</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Xem</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Thêm</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Sửa</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {permissions.map((perm, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-slate-900">{perm.module}</td>
                {['view', 'create', 'edit', 'delete'].map((action) => (
                  <td key={action} className="px-6 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={perm[action as keyof typeof perm] as boolean}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-end">
        <Button>
          <Save className="w-4 h-4 mr-2" />
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}

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

// Parameters Module
function ParametersModule() {
  const parameters = [
    { key: 'max_file_size', label: 'Kích thước file tối đa', value: '10MB', type: 'text' },
    { key: 'session_timeout', label: 'ThờI gian hết phiên (phút)', value: '30', type: 'number' },
    { key: 'items_per_page', label: 'Số mục mỗi trang', value: '20', type: 'number' },
    { key: 'enable_notifications', label: 'Bật thông báo', value: 'true', type: 'boolean' },
    { key: 'maintenance_mode', label: 'Chế độ bảo trì', value: 'false', type: 'boolean' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Tham số hệ thống</h2>
      
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-200">
        {parameters.map((param) => (
          <div key={param.key} className="p-4 flex items-center justify-between">
            <div>
              <label className="font-medium text-slate-900">{param.label}</label>
              <p className="text-sm text-slate-500">{param.key}</p>
            </div>
            <div>
              {param.type === 'boolean' ? (
                <input 
                  type="checkbox" 
                  checked={param.value === 'true'}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              ) : (
                <input
                  type={param.type}
                  value={param.value}
                  className="px-3 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end">
        <Button>
          <Save className="w-4 h-4 mr-2" />
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}

// Notifications Module
function NotificationsModule() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Cấu hình thông báo</h2>
      
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-400" />
            <div>
              <p className="font-medium text-slate-900">Thông báo qua email</p>
              <p className="text-sm text-slate-500">Nhận thông báo qua email khi có cập nhật</p>
            </div>
          </div>
          <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-slate-400" />
            <div>
              <p className="font-medium text-slate-900">Thông báo qua SMS</p>
              <p className="text-sm text-slate-500">Nhận thông báo khẩn qua SMS</p>
            </div>
          </div>
          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-slate-400" />
            <div>
              <p className="font-medium text-slate-900">Thông báo trình duyệt</p>
              <p className="text-sm text-slate-500">Hiển thị thông báo trên trình duyệt</p>
            </div>
          </div>
          <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
        </div>
      </div>
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
  const [activeModule, setActiveModule] = useState('users');

  const renderModule = () => {
    switch (activeModule) {
      case 'users':
        return <UserManagementModule />;
      case 'permissions':
        return <PermissionsModule />;
      case 'directories':
        return <DirectoriesModule />;
      case 'parameters':
        return <ParametersModule />;
      case 'notifications':
        return <NotificationsModule />;
      case 'security':
        return <SecurityModule />;
      case 'abbreviations':
        return <AbbreviationsModule />;
      case 'address-mapping':
        return <AddressMappingModule />;
      default:
        return <UserManagementModule />;
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
