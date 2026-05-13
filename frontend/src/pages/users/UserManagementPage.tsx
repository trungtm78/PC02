import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Download,
  Save,
  AlertTriangle,
  Lock,
  KeyRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { usePermission } from '@/hooks/usePermission';
import { TempPasswordHandoverModal } from '@/components/TempPasswordHandoverModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string;
  workId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName?: string; // derived: firstName + lastName
  email: string;
  phone: string;
  role: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  isActive: boolean;
  canDispatch?: boolean;
  lastLoginAt: string | null;
  totpEnabled?: boolean;
};

type Role = {
  id: string;
  name: string;
  description: string;
  _count?: { users: number };
};

type PermRow = {
  subject: string;
  action: string;
};

type FormData = {
  workId: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  // F1 (D1): admin no longer chooses the password. Backend generates it on
  // create and on explicit reset, returns plaintext ONCE via TempPasswordHandoverModal.
  departmentId: string;
  roleId: string;
  isActive: boolean;
  canDispatch: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIONS = ['read', 'write', 'delete', 'export', 'approve'];
const ACTION_LABELS: Record<string, string> = {
  read: 'Xem',
  write: 'Thêm/Sửa',
  delete: 'Xóa',
  export: 'Xuất',
  approve: 'Duyệt',
};

const SUBJECTS = ['User', 'Role', 'Directory', 'Case', 'Petition', 'Incident', 'Report', 'AuditLog'];
const SUBJECT_LABELS: Record<string, string> = {
  User: 'Người dùng',
  Role: 'Vai trò',
  Directory: 'Danh mục',
  Case: 'Vụ án',
  Petition: 'Đơn thư',
  Incident: 'Vụ việc',
  Report: 'Báo cáo',
  AuditLog: 'Nhật ký',
};

const EMPTY_FORM: FormData = {
  workId: '',
  fullName: '',
  email: '',
  phone: '',
  username: '',
  departmentId: '',
  roleId: '',
  isActive: true,
  canDispatch: false,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const { canEdit } = usePermission();
  const canEditRow = canEdit('users');
  const [activeTab, setActiveTab] = useState<'users-list' | 'roles-permissions'>('users-list');

  // --- Users state ---
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // --- User modal ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // --- Delete confirm ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // F1: temp password handover modal state. Set after admin create or reset
  // returns the system-generated temp password — admin sees it ONCE here.
  const [tempPasswordHandover, setTempPasswordHandover] = useState<{
    tempPassword: string;
    userDisplayName: string;
    userEmail: string;
  } | null>(null);

  // --- Roles state ---
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permMatrix, setPermMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [permSaving, setPermSaving] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterRole !== 'all') params.roleId = filterRole;
      if (filterStatus !== 'all') params.isActive = filterStatus === 'active' ? 'true' : 'false';
      const res = await api.get('/admin/users', { params });
      // Normalize: merge firstName/lastName into fullName for display
      const rawUsers: User[] = (res.data.data ?? []).map((u: User) => ({
        ...u,
        fullName: (u.fullName ?? [u.firstName, u.lastName].filter(Boolean).join(' ')) || u.username,
      }));
      setUsers(rawUsers);
      setUsersTotal(res.data.total ?? 0);
    } catch {
      // silently fail — show empty table
    } finally {
      setUsersLoading(false);
    }
  }, [searchQuery, filterRole, filterStatus]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await api.get('/admin/roles');
      setRoles(res.data ?? []);
    } catch {
      // silently fail
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const loadPermissions = useCallback(async (roleId: string) => {
    try {
      const res = await api.get(`/admin/roles/${roleId}/permissions`);
      const raw: PermRow[] = res.data ?? [];
      const matrix: Record<string, Record<string, boolean>> = {};
      SUBJECTS.forEach((s) => {
        matrix[s] = {};
        ACTIONS.forEach((a) => { matrix[s][a] = false; });
      });
      raw.forEach(({ subject, action }) => {
        if (matrix[subject]) matrix[subject][action] = true;
      });
      setPermMatrix(matrix);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Load roles on mount (needed for user creation form dropdown)
  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (activeTab === 'roles-permissions') void loadRoles();
  }, [activeTab, loadRoles]);

  useEffect(() => {
    if (selectedRole) void loadPermissions(selectedRole.id);
  }, [selectedRole, loadPermissions]);

  // ─── User handlers ─────────────────────────────────────────────────────────

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowUserModal(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      workId: user.workId ?? '',
      fullName: user.fullName ?? '',
      email: user.email,
      phone: user.phone ?? '',
      username: user.username,
      departmentId: user.department?.id ?? '',
      roleId: user.role?.id ?? '',
      isActive: user.isActive,
      canDispatch: user.canDispatch ?? false,
    });
    setFormError('');
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!formData.fullName || !formData.email || !formData.username) {
      setFormError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      // Split fullName into firstName / lastName for the API
      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
      const lastName  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const payload: Record<string, unknown> = {
        workId: formData.workId || undefined,
        firstName,
        lastName: lastName || undefined,
        email: formData.email,
        phone: formData.phone || undefined,
        username: formData.username,
        departmentId: formData.departmentId || undefined,
        roleId: formData.roleId || undefined,
        status: formData.isActive ? 'active' : 'inactive',
        canDispatch: formData.canDispatch,
      };

      if (editingUser) {
        // Edit doesn't touch password — that goes through "Đặt lại mật khẩu" button.
        await api.patch(`/admin/users/${editingUser.id}`, payload);
        setShowUserModal(false);
      } else {
        // F1: backend generates temp password and returns it ONCE in the
        // response. Show TempPasswordHandoverModal before closing this modal.
        const res = await api.post<{ tempPassword: string; username: string; email: string }>(
          '/admin/users',
          payload,
        );
        setShowUserModal(false);
        if (res.data.tempPassword) {
          setTempPasswordHandover({
            tempPassword: res.data.tempPassword,
            userDisplayName: formData.fullName,
            userEmail: res.data.email ?? formData.email,
          });
        }
      }
      void loadUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Có lỗi xảy ra. Vui lòng thử lại.';
      setFormError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  // F1: admin reset password. Calls PATCH with {resetPassword:true} →
  // backend generates new temp pw, returns plaintext once → show modal.
  const handleResetPassword = async (user: User) => {
    if (
      !window.confirm(
        `Đặt lại mật khẩu cho ${user.fullName ?? user.username}?\n\n` +
          'Hệ thống sẽ tạo mật khẩu tạm mới và buộc cán bộ đổi mật khẩu khi đăng nhập lần tới.',
      )
    ) {
      return;
    }
    try {
      const res = await api.patch<{ tempPassword?: string }>(
        `/admin/users/${user.id}`,
        { resetPassword: true },
      );
      if (res.data.tempPassword) {
        setTempPasswordHandover({
          tempPassword: res.data.tempPassword,
          userDisplayName: user.fullName ?? user.username,
          userEmail: user.email,
        });
      }
    } catch {
      alert('Không thể đặt lại mật khẩu. Vui lòng thử lại.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    try {
      await api.delete(`/admin/users/${deletingUser.id}`);
      setShowDeleteConfirm(false);
      setDeletingUser(null);
      void loadUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không thể xóa người dùng.';
      alert(msg);
    }
  };

  // ─── Permission handlers ───────────────────────────────────────────────────

  const handleReset2Fa = async (user: User) => {
    if (!window.confirm(`Đặt lại 2FA cho ${user.fullName ?? user.username}? Người dùng sẽ cần cài đặt lại 2FA.`)) return;
    try {
      await api.post(`/admin/users/${user.id}/reset-2fa`);
      void loadUsers();
    } catch {
      alert('Không thể đặt lại 2FA. Vui lòng thử lại.');
    }
  };

  const handleTogglePerm = (subject: string, action: string) => {
    setPermMatrix((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], [action]: !prev[subject]?.[action] },
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setPermSaving(true);
    try {
      const permissions: { action: string; subject: string }[] = [];
      SUBJECTS.forEach((s) => {
        ACTIONS.forEach((a) => {
          if (permMatrix[s]?.[a]) permissions.push({ action: a, subject: s });
        });
      });
      await api.patch(`/admin/roles/${selectedRole.id}/permissions`, { permissions });
      setShowSaveConfirm(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Lỗi khi lưu phân quyền.';
      alert(msg);
    } finally {
      setPermSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div data-testid="user-management-page">
      {/* Page Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#003973]" />
            Người dùng &amp; Phân quyền
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const headers = ['STT', 'Username', 'Họ tên', 'Email', 'SĐT', 'Vai trò', 'Phòng ban', 'Trạng thái'];
                const rows = users.map((u, i) => [
                  i + 1, u.username, u.fullName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
                  u.email, (u as any).phone ?? '', u.role?.name ?? '', u.department?.name ?? '',
                  u.isActive ? 'Hoạt động' : 'Tạm khóa',
                ]);
                downloadCsv(rows, headers, `NguoiDung_${new Date().toISOString().slice(0, 10)}.csv`);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
            <button
              onClick={handleOpenAddModal}
              data-testid="btn-add-user"
              className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Thêm người dùng
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200 -mb-6">
          {(['users-list', 'roles-permissions'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 font-medium transition-colors text-sm ${
                activeTab === tab
                  ? 'border-[#003973] text-[#003973]'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab === 'users-list'
                ? `Người dùng (${usersTotal})`
                : `Vai trò & Phân quyền (${roles.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Users List ── */}
      {activeTab === 'users-list' && (
        <div>
          {/* Search & Filter */}
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo mã cán bộ, họ tên, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                />
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
              >
                <option value="all">Tất cả vai trò</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm khóa</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 text-sm w-32 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                  {['Mã cán bộ', 'Họ tên', 'Email', 'Vai trò', 'Trạng thái', '2FA', 'Đăng nhập cuối'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left py-3 px-6 font-semibold text-slate-700 text-sm"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#003973] mx-auto mb-2" />
                      <p className="text-slate-600">Đang tải dữ liệu...</p>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-600 font-medium mb-1">Chưa có người dùng nào</p>
                      <p className="text-sm text-slate-500">
                        Nhấn "Thêm người dùng" để tạo tài khoản mới
                      </p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      onClick={canEditRow ? () => handleOpenEditModal(user) : undefined}
                      onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenEditModal(user); } } : undefined}
                      tabIndex={canEditRow ? 0 : undefined}
                      className={`border-b border-slate-200 transition-colors ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      {/* Thao tác — FIRST, sticky */}
                      <td
                        className="py-3 px-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </button>
                          {user.totpEnabled && (
                            <button
                              onClick={() => handleReset2Fa(user)}
                              className="p-1.5 hover:bg-amber-50 rounded transition-colors"
                              title="Đặt lại 2FA"
                            >
                              <Lock className="w-4 h-4 text-amber-600" />
                            </button>
                          )}
                          {/* F1: admin reset password — generates new temp pw, shown ONCE */}
                          <button
                            onClick={() => void handleResetPassword(user)}
                            className="p-1.5 hover:bg-amber-50 rounded transition-colors"
                            title="Đặt lại mật khẩu (tạo mật khẩu tạm mới)"
                          >
                            <KeyRound className="w-4 h-4 text-amber-700" />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingUser(user);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            title="Xóa người dùng"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-slate-800 text-sm">{user.workId ?? '—'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-slate-800">{user.fullName}</div>
                        <div className="text-xs text-slate-500">@{user.username}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-slate-600">{user.email}</div>
                        <div className="text-xs text-slate-500">{user.phone ?? ''}</div>
                      </td>
                      <td className="py-4 px-6">
                        {user.role ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            {user.role.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                            <XCircle className="w-3 h-3" />
                            Tạm khóa
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {user.totpEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            Bật
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-sm">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Roles & Permissions ── */}
      {activeTab === 'roles-permissions' && (
        <div className="p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Role list */}
            <div className="col-span-1">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#003973]" />
                Danh sách vai trò
              </h3>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#003973]" />
                </div>
              ) : (
                <div className="space-y-2">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedRole?.id === role.id
                          ? 'border-[#003973] bg-[#003973]/5'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-semibold text-slate-800 text-sm">{role.name}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {role._count?.users ?? 0} người
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{role.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Permission matrix */}
            <div className="col-span-2">
              {selectedRole ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#003973]" />
                      Ma trận phân quyền: {selectedRole.name}
                    </h3>
                    <button
                      onClick={() => setShowSaveConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] transition-colors text-sm"
                    >
                      <Save className="w-4 h-4" />
                      Lưu thay đổi
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">
                            Module
                          </th>
                          {ACTIONS.map((a) => (
                            <th key={a} className="text-center py-3 px-2 font-semibold text-slate-700 text-sm">
                              {ACTION_LABELS[a]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SUBJECTS.map((subject) => (
                          <tr key={subject} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-800 text-sm">
                              {SUBJECT_LABELS[subject] ?? subject}
                            </td>
                            {ACTIONS.map((action) => (
                              <td key={action} className="py-3 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={permMatrix[subject]?.[action] ?? false}
                                  onChange={() => handleTogglePerm(subject, action)}
                                  className="w-4 h-4 rounded border-slate-300 text-[#003973] focus:ring-2 focus:ring-[#003973] cursor-pointer"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900 mb-1 text-sm">Lưu ý quan trọng</p>
                      <p className="text-sm text-amber-800">
                        Thay đổi phân quyền sẽ ảnh hưởng đến{' '}
                        <strong>{selectedRole._count?.users ?? 0}</strong> người dùng đang sử dụng
                        vai trò này.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-slate-500">
                  <div className="text-center">
                    <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="font-medium mb-1">Chọn một vai trò</p>
                    <p className="text-sm">Chọn vai trò bên trái để xem và chỉnh sửa phân quyền</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit User Modal ── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="field-workId" className="block text-sm font-medium text-slate-700 mb-1">
                    Mã cán bộ
                  </label>
                  <input
                    id="field-workId"
                    type="text"
                    value={formData.workId}
                    onChange={(e) => setFormData({ ...formData, workId: e.target.value })}
                    placeholder="VD: PC02-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="field-username" className="block text-sm font-medium text-slate-700 mb-1">
                    Tên đăng nhập <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="field-username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="VD: nguyenvana"
                    disabled={!!editingUser}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="field-fullName" className="block text-sm font-medium text-slate-700 mb-1">
                  Họ và tên <span className="text-red-600">*</span>
                </label>
                <input
                  id="field-fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="field-email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="field-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="VD: nguyenvana@pc02.gov.vn"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="field-phone" className="block text-sm font-medium text-slate-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    id="field-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="VD: 0901234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  />
                </div>
              </div>

              {/* F1: password field removed. Backend generates temp password on
                  create — admin sees it ONCE via TempPasswordHandoverModal.
                  For existing users, use the "Đặt lại mật khẩu" row action. */}
              {!editingUser && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  Hệ thống sẽ tự động tạo mật khẩu tạm cho cán bộ. Mật khẩu sẽ
                  hiển thị MỘT LẦN ngay sau khi lưu — vui lòng copy và bàn giao.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="field-roleId" className="block text-sm font-medium text-slate-700 mb-1">
                    Gán vai trò
                  </label>
                  <select
                    id="field-roleId"
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  >
                    <option value="">-- Chọn vai trò --</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="field-status" className="block text-sm font-medium text-slate-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    id="field-status"
                    value={formData.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm khóa</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="field-can-dispatch"
                    checked={formData.canDispatch}
                    onChange={(e) => setFormData({ ...formData, canDispatch: e.target.checked })}
                    className="w-4 h-4 text-[#003973] border-slate-300 rounded focus:ring-[#003973]"
                  />
                  <span className="text-sm font-medium text-slate-700">Quyền phân công công việc</span>
                  <span className="text-xs text-slate-400">(Tổ trưởng / Trực ban)</span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-7">
                  Cho phép xem và phân công tất cả Vụ án, Vụ việc, Đơn thư kể cả thuộc tổ khác.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowUserModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingUser ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Temp Password Handover Modal (F1) ── */}
      {tempPasswordHandover && (
        <TempPasswordHandoverModal
          tempPassword={tempPasswordHandover.tempPassword}
          userDisplayName={tempPasswordHandover.userDisplayName}
          userEmail={tempPasswordHandover.userEmail}
          onAcknowledged={() => setTempPasswordHandover(null)}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm && deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                Xác nhận xóa người dùng
              </h3>
              <p className="text-slate-600 text-center mb-6">
                Bạn có chắc chắn muốn xóa người dùng{' '}
                <strong>{deletingUser.fullName}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingUser(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Save Permissions Confirm Modal ── */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                Xác nhận lưu thay đổi
              </h3>
              <p className="text-slate-600 text-center mb-6">
                Bạn có chắc chắn muốn lưu thay đổi phân quyền cho vai trò{' '}
                <strong>{selectedRole?.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveConfirm(false)}
                  disabled={permSaving}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSavePermissions}
                  disabled={permSaving}
                  className="flex-1 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {permSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
