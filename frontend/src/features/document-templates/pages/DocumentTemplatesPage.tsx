import { useCallback, useEffect, useState } from 'react';
import { Download, Pencil, Trash2, MoreVertical, Plus } from 'lucide-react';
import { listTemplates, deleteTemplate, downloadTemplateFile } from '../api';
import type { DocumentTemplate } from '../types';
import { TemplateFormModal } from '../components/TemplateFormModal';
import { DropdownMenu, DropdownItem } from '@/components/shared/DropdownMenu';
import { Button } from '@/components/ui/button';
import { BTN_ICON_BLUE, BTN_ICON_SLATE } from '@/constants/styles';

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

  async function handleDelete(id: string) {
    await deleteTemplate(id);
    await load();
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

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Mã</th>
              <th className="px-3 py-2.5 text-left font-medium">Tên mẫu</th>
              <th className="px-3 py-2.5 text-left font-medium">Loại</th>
              <th className="px-3 py-2.5 text-left font-medium">Danh mục</th>
              <th className="px-3 py-2.5 text-left font-medium">Cấp số</th>
              <th className="px-3 py-2.5 text-left font-medium">Biến</th>
              <th className="px-3 py-2.5 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2.5 font-mono text-xs">{t.code}</td>
                <td className="px-3 py-2.5">{t.name}</td>
                <td className="px-3 py-2.5">{ENTITY_LABEL[t.entityType] ?? t.entityType}</td>
                <td className="px-3 py-2.5">{t.category}</td>
                <td className="px-3 py-2.5">{t.needsNumber ? 'Có' : '—'}</td>
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
                            void handleDelete(t.id);
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
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
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
