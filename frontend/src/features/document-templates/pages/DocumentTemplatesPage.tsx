import { useCallback, useEffect, useState } from 'react';
import { Download, Pencil, Trash2, MoreVertical, Plus } from 'lucide-react';
import { listTemplates, downloadTemplateFile, updateTemplate } from '../api';
import type { DocumentTemplate } from '../types';
import { TemplateFormModal } from '../components/TemplateFormModal';
import { DropdownMenu, DropdownItem } from '@/components/shared/DropdownMenu';
import { Button } from '@/components/ui/button';
import { BTN_ICON_BLUE, BTN_ICON_SLATE } from '@/constants/styles';
import { useDeleteResourceModal } from '@/features/_shared/modals/DeleteResourceModalProvider';

const ENTITY_LABEL: Record<string, string> = {
  VU_AN: 'Vụ án',
  VU_VIEC: 'Vụ việc',
  DON_THU: 'Đơn thư',
};

/** Trang admin quản lý mẫu chứng từ động (upload .docx, gán entity/category/cấp số). */
export default function DocumentTemplatesPage() {
  const [items, setItems] = useState<DocumentTemplate[]>([]);
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editFor, setEditFor] = useState<DocumentTemplate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const deleteModal = useDeleteResourceModal();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listTemplates({ entityType: entityFilter || undefined, status: 'active' }));
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Bật/tắt "tích sẵn khi in" ngay trên danh sách.
   *
   * Chỉnh 28 mẫu qua form sửa là 28 lần mở/lưu; công tắc tại chỗ cắt xuống còn 28 cú bấm.
   * Cập nhật `items` tại chỗ thay vì nạp lại cả bảng — nạp lại làm bảng nháy và cuộn về đầu.
   */
  async function toggleTichSan(t: DocumentTemplate) {
    // Chỉ chặn ĐÚNG dòng đang gửi. Chặn cả bảng thì cú bấm ở dòng khác rơi mất im lặng, mà admin
    // đang bật lần lượt 28 mẫu — mỗi cú rơi là một mẫu tưởng đã bật mà chưa.
    if (busyId === t.id) return;
    const giaTriMoi = !t.selectedByDefault;
    setBusyId(t.id);
    try {
      await updateTemplate(t.id, { selectedByDefault: giaTriMoi });
      setItems((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, selectedByDefault: giaTriMoi } : x)),
      );
    } finally {
      // Chỉ nhả khoá nếu chính dòng này đang giữ — dòng khác gửi sau thì để nó tự nhả.
      setBusyId((dang) => (dang === t.id ? null : dang));
    }
  }

  /** Mở modal xác nhận xóa chuẩn của app (confirm trước khi DELETE). */
  function confirmDelete(t: DocumentTemplate) {
    deleteModal.open({
      resourceType: 'document-templates',
      recordId: t.id,
      recordLabel: `${t.name} (${t.code})`,
      onSuccess: () => void load(),
    });
  }

  /** Tải file .docx mẫu về để sửa. */
  async function handleDownload(t: DocumentTemplate) {
    setBusyId(t.id);
    try {
      const blob = await downloadTemplateFile(t.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = t.fileName || `${t.code}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div data-testid="doc-templates-page" className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quản lý mẫu chứng từ</h1>
        <Button data-testid="btn-add-template" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm mẫu
        </Button>
      </div>

      <div className="mb-3">
        <select
          data-testid="filter-entity"
          className="rounded border px-3 py-2"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        >
          <option value="">Tất cả loại hồ sơ</option>
          <option value="VU_AN">Vụ án</option>
          <option value="VU_VIEC">Vụ việc</option>
          <option value="DON_THU">Đơn thư</option>
        </select>
      </div>

      {/* KHÔNG overflow-hidden: để menu kebab (Xoá) hàng cuối không bị bảng cắt (codex P2). */}
      <div className="rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-slate-200 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Mã</th>
              <th className="px-3 py-2.5 text-left font-medium">Tên mẫu</th>
              <th className="px-3 py-2.5 text-left font-medium">Loại</th>
              <th className="px-3 py-2.5 text-left font-medium">Danh mục</th>
              <th className="px-3 py-2.5 text-left font-medium">Cấp số</th>
              <th className="px-3 py-2.5 text-left font-medium">Tích sẵn khi in</th>
              <th className="px-3 py-2.5 text-left font-medium">Biến</th>
              <th className="px-3 py-2.5 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((t) => (
              <tr key={t.id} className="bg-white even:bg-slate-50 hover:bg-blue-50/60">
                <td className="px-3 py-2.5 font-mono text-xs">{t.code}</td>
                <td className="px-3 py-2.5">{t.name}</td>
                <td className="px-3 py-2.5">{ENTITY_LABEL[t.entityType] ?? t.entityType}</td>
                <td className="px-3 py-2.5">{t.category}</td>
                <td className="px-3 py-2.5">{t.needsNumber ? 'Có' : '—'}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.selectedByDefault}
                    aria-label={`Tích sẵn khi in: ${t.name}`}
                    data-testid={`btn-tich-san-${t.id}`}
                    disabled={busyId === t.id}
                    onClick={() => void toggleTichSan(t)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                      t.selectedByDefault ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        t.selectedByDefault ? 'translate-x-[1.15rem]' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex flex-wrap gap-1">
                    {t.variables.map((v) => (
                      <span
                        key={v.name}
                        className={`rounded px-1.5 py-0.5 text-xs ${v.required ? 'bg-amber-100 font-medium text-amber-800' : 'bg-slate-100 text-slate-600'}`}
                        title={v.required ? 'Bắt buộc khi in' : ''}
                      >
                        {v.name}
                        {v.required && ' *'}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      data-testid={`btn-download-${t.id}`}
                      className={BTN_ICON_BLUE}
                      title="Tải file .docx về sửa"
                      disabled={busyId === t.id}
                      onClick={() => void handleDownload(t)}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      data-testid={`btn-edit-${t.id}`}
                      className={BTN_ICON_SLATE}
                      title="Sửa (thông tin, ánh xạ biến, thay file)"
                      onClick={() => setEditFor(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <DropdownMenu
                      testId={`btn-more-${t.id}`}
                      triggerLabel="Thao tác khác"
                      triggerClassName={BTN_ICON_SLATE}
                      trigger={<MoreVertical className="h-4 w-4" />}
                    >
                      {(close) => (
                        <DropdownItem
                          testId={`btn-delete-${t.id}`}
                          danger
                          onClick={() => {
                            close();
                            confirmDelete(t);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Xoá mẫu
                        </DropdownItem>
                      )}
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  Chưa có mẫu chứng từ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <TemplateFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {editFor && (
        <TemplateFormModal
          template={editFor}
          onClose={() => setEditFor(null)}
          onSaved={() => {
            setEditFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
