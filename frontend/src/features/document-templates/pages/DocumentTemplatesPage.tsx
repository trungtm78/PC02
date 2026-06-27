import { useCallback, useEffect, useState } from 'react';
import { listTemplates, deleteTemplate } from '../api';
import type { DocumentTemplate } from '../types';
import { TemplateFormModal } from '../components/TemplateFormModal';

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
  const [showModal, setShowModal] = useState(false);

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

  return (
    <div data-testid="doc-templates-page" className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quản lý mẫu chứng từ</h1>
        <button
          data-testid="btn-add-template"
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => setShowModal(true)}
        >
          + Thêm mẫu
        </button>
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

      <table className="w-full border text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="border px-3 py-2 text-left">Mã</th>
            <th className="border px-3 py-2 text-left">Tên mẫu</th>
            <th className="border px-3 py-2 text-left">Loại</th>
            <th className="border px-3 py-2 text-left">Danh mục</th>
            <th className="border px-3 py-2 text-left">Cấp số</th>
            <th className="border px-3 py-2 text-left">Biến</th>
            <th className="border px-3 py-2 text-left">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td className="border px-3 py-2">{t.code}</td>
              <td className="border px-3 py-2">{t.name}</td>
              <td className="border px-3 py-2">{ENTITY_LABEL[t.entityType] ?? t.entityType}</td>
              <td className="border px-3 py-2">{t.category}</td>
              <td className="border px-3 py-2">{t.needsNumber ? 'Có' : '—'}</td>
              <td className="border px-3 py-2">{t.variables.map((v) => v.name).join(', ')}</td>
              <td className="border px-3 py-2">
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() => void handleDelete(t.id)}
                >
                  Xoá
                </button>
              </td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7} className="border px-3 py-6 text-center text-slate-400">
                Chưa có mẫu chứng từ
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <TemplateFormModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
