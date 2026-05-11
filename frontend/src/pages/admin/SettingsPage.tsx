import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Settings, Edit, Save, X, Loader2, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';

interface SettingItem {
  key: string;
  label: string;
  value: string;
  unit: string | null;
  legalBasis: string | null;
}

/**
 * SettingsPage — manages NON-DEADLINE ops settings only.
 *
 * Post 20260511_deadline_rule_versioning migration, the 12 deadline keys
 * (THOI_HAN_*, SO_LAN_GIA_HAN_TOI_DA) moved to /admin/deadline-rules with a
 * proper versioning workflow. This page now handles ops keys: TWO_FA_ENABLED,
 * CANH_BAO_SAP_HAN, THOI_HAN_XOA_VU_VIEC. The redirect banner points users to
 * the new feature.
 */
export function SettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get<{ success: boolean; data: SettingItem[] }>('/settings');
      setSettings(res.data.data ?? []);
    } catch {
      setError('Không thể tải cấu hình');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const startEdit = (item: SettingItem) => {
    setEditingKey(item.key);
    setEditValue(item.value);
  };
  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };
  const saveEdit = async (key: string) => {
    setIsSaving(true);
    try {
      await api.put(`/settings/${key}`, { value: editValue });
      setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value: editValue } : s)));
      setEditingKey(null);
      setEditValue('');
    } catch {
      setError('Không thể lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cấu hình hệ thống</h1>
          <p className="text-slate-600 text-sm mt-1">Tham số vận hành — 2FA, ngưỡng cảnh báo, chính sách xóa</p>
        </div>
      </div>

      {/* Migration banner — points users to the new deadline-rules workflow */}
      <Link
        to="/admin/deadline-rules"
        className="block bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition"
        data-testid="redirect-banner"
      >
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-blue-900">
              Cấu hình thời hạn xử lý đã chuyển sang quy trình mới
            </div>
            <p className="text-xs text-blue-700 mt-1">
              12 quy tắc theo BLTTHS / Luật Tố cáo / Luật Khiếu nại nay dùng workflow đề xuất → duyệt → hiệu lực,
              kèm audit trail VKS-defensible. Trang này chỉ giữ các tham số vận hành nội bộ (2FA, cảnh báo, v.v.)
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-blue-600" />
        </div>
      </Link>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setError('')} className="ml-auto p-1 hover:bg-red-100 rounded">
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="settings-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Giá trị</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Đơn vị</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Cơ sở pháp lý</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
                    <p className="text-slate-500 font-medium">Đang tải cấu hình...</p>
                  </td>
                </tr>
              ) : settings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Chưa có cấu hình nào</p>
                  </td>
                </tr>
              ) : (
                settings.map((item) => (
                  <tr key={item.key} className="hover:bg-slate-50" data-testid={`setting-row-${item.key}`}>
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{item.label}</td>
                    <td className="px-6 py-4 text-sm">
                      {editingKey === item.key ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-32"
                          autoFocus
                          data-testid={`edit-input-${item.key}`}
                        />
                      ) : (
                        <span className="text-slate-700 font-mono">{item.value}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.unit ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-[300px]">{item.legalBasis ?? '—'}</td>
                    <td className="px-6 py-4">
                      {editingKey === item.key ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void saveEdit(item.key)}
                            disabled={isSaving}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="Lưu"
                            data-testid={`btn-save-${item.key}`}
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            title="Hủy"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          data-testid={`btn-edit-${item.key}`}
                        >
                          <Edit className="w-3.5 h-3.5" />Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
