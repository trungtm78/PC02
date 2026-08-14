import { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDate } from '../../lib/dates';
import {
  EVIDENCE_STATUS,
  EVIDENCE_STATUS_LABELS,
  EVIDENCE_STATUS_VALUES,
  evidenceStatusBadge,
  evidenceStatusLabel,
  type EvidenceStatus,
} from '@/shared/enums/evidence-status';

/**
 * Tab "Vật chứng" of the case detail page.
 *
 * Evidence has been written to the database since the case-creation form
 * shipped, and never read back — there was no read path at all. This is it.
 */

export type Evidence = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  storageLocation?: string | null;
  receivedDate?: string | null;
  status: string;
  evidenceType?: string | null;
  entryOrder?: string | null;
  warehouseReceipt?: string | null;
};

type FormState = {
  code: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  storageLocation: string;
  receivedDate: string;
  status: EvidenceStatus;
  evidenceType: string;
  entryOrder: string;
  warehouseReceipt: string;
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  description: '',
  quantity: '1',
  unit: 'cái',
  storageLocation: '',
  receivedDate: '',
  status: EVIDENCE_STATUS.THU_GIU,
  evidenceType: '',
  entryOrder: '',
  warehouseReceipt: '',
};

const MESSAGES = {
  loadFailed: 'Không tải được danh sách vật chứng.',
  saveFailed: 'Lưu vật chứng thất bại.',
  deleteFailed: 'Xóa vật chứng thất bại.',
  empty: 'Chưa có vật chứng nào trong vụ án này.',
  deleteConfirm: (name: string) =>
    `Xóa vật chứng "${name}"? Bản ghi được xóa mềm và quản trị viên khôi phục lại được.`,
} as const;

export function CaseEvidenceTab({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Evidence | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evidences', { params: { caseId, limit: 100 } });
      setItems((res.data?.data ?? []) as Evidence[]);
      setError('');
    } catch (err: unknown) {
      setItems([]);
      setError(extractApiError(err, MESSAGES.loadFailed).message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (item: Evidence) => {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      quantity: String(item.quantity ?? 1),
      unit: item.unit ?? 'cái',
      storageLocation: item.storageLocation ?? '',
      receivedDate: item.receivedDate ? item.receivedDate.slice(0, 10) : '',
      status: (item.status as EvidenceStatus) ?? EVIDENCE_STATUS.THU_GIU,
      evidenceType: item.evidenceType ?? '',
      entryOrder: item.entryOrder ?? '',
      warehouseReceipt: item.warehouseReceipt ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Mã và tên vật chứng không được để trống.');
      return;
    }
    setSaving(true);
    try {
      // Blanked optional fields go as null, not undefined. `undefined` is
      // dropped when the body is serialised, and the backend only writes keys
      // that are `!== undefined` — so clearing a value would silently keep the
      // old one while the UI reported success.
      const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: orNull(form.description),
        quantity: Number(form.quantity) || 1,
        unit: form.unit.trim() || 'cái',
        storageLocation: orNull(form.storageLocation),
        receivedDate: orNull(form.receivedDate),
        status: form.status,
        evidenceType: orNull(form.evidenceType),
        entryOrder: orNull(form.entryOrder),
        warehouseReceipt: orNull(form.warehouseReceipt),
      };
      if (editing) {
        await api.put(`/evidences/${editing.id}`, payload);
      } else {
        await api.post('/evidences', { ...payload, caseId });
      }
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      // Stay open so the entered values are not lost.
      setFormError(extractApiError(err, MESSAGES.saveFailed).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Evidence) => {
    if (!window.confirm(MESSAGES.deleteConfirm(item.name))) return;
    try {
      await api.delete(`/evidences/${item.id}`);
      await load();
    } catch (err: unknown) {
      setError(extractApiError(err, MESSAGES.deleteFailed).message);
    }
  };

  return (
    <div data-testid="case-evidence-tab" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Package className="w-4 h-4 text-[#003973]" />
          Vật chứng ({items.length})
        </h3>
        <button
          data-testid="add-evidence-btn"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Thêm vật chứng
        </button>
      </div>

      {error && (
        <div
          data-testid="evidence-error"
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#003973]" />
        </div>
      ) : items.length === 0 && !error ? (
        <p data-testid="evidence-empty" className="py-8 text-center text-slate-500 text-sm">
          {MESSAGES.empty}
        </p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Mã VC</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Tên</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Loại</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">SL</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Nơi lưu</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Ngày thu giữ</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Trạng thái</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  data-testid={`evidence-row-${item.id}`}
                  className="border-b border-slate-200 hover:bg-slate-50"
                >
                  <td className="py-3 px-4 font-medium text-slate-800">{item.code}</td>
                  <td className="py-3 px-4 text-slate-800">{item.name}</td>
                  <td className="py-3 px-4 text-slate-600">{item.evidenceType || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{item.storageLocation || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {item.receivedDate ? formatVNDate(item.receivedDate) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${evidenceStatusBadge(item.status)}`}
                    >
                      {evidenceStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      data-testid={`edit-evidence-${item.id}`}
                      onClick={() => openEdit(item)}
                      aria-label={`Sửa vật chứng ${item.code}`}
                      className="p-1.5 text-slate-600 hover:text-[#003973]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`delete-evidence-${item.id}`}
                      onClick={() => void handleDelete(item)}
                      aria-label={`Xóa vật chứng ${item.code}`}
                      className="p-1.5 text-slate-600 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            data-testid="evidence-form"
            className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-800">
                {editing ? 'Sửa vật chứng' : 'Thêm vật chứng'}
              </h3>

              {formError && (
                <p
                  data-testid="evidence-form-error"
                  role="alert"
                  className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800"
                >
                  {formError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Mã vật chứng *">
                  <input
                    data-testid="evidence-code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Tên vật chứng *">
                  <input
                    data-testid="evidence-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Loại vật chứng">
                  <input
                    value={form.evidenceType}
                    onChange={(e) => setForm({ ...form, evidenceType: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Trạng thái">
                  <select
                    data-testid="evidence-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as EvidenceStatus })
                    }
                    className={INPUT_CLASS}
                  >
                    {EVIDENCE_STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {EVIDENCE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Số lượng">
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Đơn vị">
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Nơi lưu trữ">
                  <input
                    value={form.storageLocation}
                    onChange={(e) => setForm({ ...form, storageLocation: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Ngày thu giữ">
                  <input
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Số thứ tự nhập kho">
                  <input
                    value={form.entryOrder}
                    onChange={(e) => setForm({ ...form, entryOrder: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Số biên bản nhập kho">
                  <input
                    value={form.warehouseReceipt}
                    onChange={(e) => setForm({ ...form, warehouseReceipt: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>

              <Field label="Mô tả chi tiết">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  data-testid="save-evidence-btn"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

export default CaseEvidenceTab;
