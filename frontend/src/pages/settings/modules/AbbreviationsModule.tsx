import { useState } from 'react';
import { AlertCircle, Copy, Keyboard, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAbbreviationList,
  useAbbreviationUsers,
  useCopyAbbreviations,
  useDeleteAbbreviation,
  useUpsertAbbreviation,
} from '@/hooks/useAbbreviations';

export function AbbreviationsModule() {
  const { data: abbrevs = [], isLoading } = useAbbreviationList();
  const { data: users = [] } = useAbbreviationUsers();

  const upsertMutation = useUpsertAbbreviation();
  const deleteMutation = useDeleteAbbreviation();
  const copyMutation = useCopyAbbreviations();

  const [shortcut, setShortcut] = useState('');
  const [expansion, setExpansion] = useState('');
  const [formError, setFormError] = useState('');

  const [copyOpen, setCopyOpen] = useState(false);
  const [sourceUserId, setSourceUserId] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const [copyResult, setCopyResult] = useState<string | null>(null);

  function handleEdit(s: string, e: string) {
    setShortcut(s);
    setExpansion(e);
    setFormError('');
  }

  async function handleSave() {
    if (!shortcut.trim() || !expansion.trim()) {
      setFormError('Vui lòng nhập đầy đủ phím tắt và nội dung');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(shortcut)) {
      setFormError('Phím tắt chỉ được chứa ký tự [a-zA-Z0-9_-]');
      return;
    }
    setFormError('');
    try {
      await upsertMutation.mutateAsync({ shortcut: shortcut.trim(), expansion: expansion.trim() });
      setShortcut('');
      setExpansion('');
    } catch {
      setFormError('Lưu thất bại, vui lòng thử lại');
    }
  }

  async function handleDelete(s: string) {
    if (!window.confirm(`Xóa phím tắt "${s}"?`)) return;
    await deleteMutation.mutateAsync(s);
  }

  async function handleCopy() {
    if (!sourceUserId) return;
    setCopyResult(null);
    try {
      const res = await copyMutation.mutateAsync({ sourceUserId, replace: replaceMode });
      setCopyResult(`Đã sao chép ${res.data.copied} phím tắt`);
    } catch (err: any) {
      setCopyResult(
        err?.response?.data?.error?.message ?? 'Sao chép thất bại, vui lòng thử lại',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-[#003973]" />
            Từ viết tắt cá nhân
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {abbrevs.length} phím tắt — Gõ phím tắt + <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">F9</kbd> để mở rộng
          </p>
        </div>
      </div>

      {/* Copy from another user */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => { setCopyOpen((v) => !v); setCopyResult(null); }}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Sao chép từ người dùng khác</span>
          </div>
          <span className="text-xs text-slate-400">{copyOpen ? '▲' : '▼'}</span>
        </button>

        {copyOpen && (
          <div className="px-5 py-4 border-t border-slate-100 space-y-3">
            <select
              value={sourceUserId}
              onChange={(e) => setSourceUserId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
            >
              <option value="">— Chọn người dùng —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName || u.lastName
                    ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
                    : u.email}
                </option>
              ))}
            </select>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="copyMode"
                  checked={!replaceMode}
                  onChange={() => setReplaceMode(false)}
                  className="accent-[#003973]"
                />
                Gộp (giữ phím tắt hiện tại)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="copyMode"
                  checked={replaceMode}
                  onChange={() => setReplaceMode(true)}
                  className="accent-[#003973]"
                />
                Thay thế hoàn toàn
              </label>
            </div>

            {copyResult && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{copyResult}</p>
            )}

            <Button
              onClick={handleCopy}
              disabled={!sourceUserId || copyMutation.isPending}
              className="text-sm"
              style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
            >
              {copyMutation.isPending ? 'Đang sao chép...' : 'Sao chép'}
            </Button>
          </div>
        )}
      </div>

      {/* Add / Edit form */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Thêm / Sửa phím tắt
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            aria-label="Phím tắt"
            placeholder="Phím tắt (vd: lvs)"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            maxLength={20}
            pattern="[a-zA-Z0-9_-]+"
            className="w-36 px-3 py-2 font-mono text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
          />
          <input
            type="text"
            aria-label="Nội dung mở rộng"
            placeholder="Nội dung mở rộng (vd: Lê Văn Sỹ)"
            value={expansion}
            onChange={(e) => setExpansion(e.target.value)}
            maxLength={500}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
          />
          <Button
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
          >
            {upsertMutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
        {formError && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {formError}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Đang tải...</div>
        ) : abbrevs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Chưa có phím tắt nào. Thêm phím tắt đầu tiên bên trên.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Thao tác
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                  Phím tắt
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Nội dung mở rộng
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                  Ngày tạo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {abbrevs.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => handleEdit(a.shortcut, a.expansion)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(a.shortcut, a.expansion); } }}
                  tabIndex={0}
                  className="cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <td
                    className="px-3 py-3 sticky left-0 z-10 bg-white border-r border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(a.shortcut, a.expansion)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                        title="Sửa"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(a.shortcut)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm font-medium text-[#003973] bg-blue-50 px-2 py-0.5 rounded">
                      {a.shortcut}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-800">{a.expansion}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
