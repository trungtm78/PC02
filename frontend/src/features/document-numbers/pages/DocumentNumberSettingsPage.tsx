import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extractApiError } from '@/lib/api-errors';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { Plus, RotateCcw, BarChart2, List, Edit2, Trash2 } from 'lucide-react';
import { documentNumbersApi, DOC_NUM_QUERY_KEYS } from '../api';
import { TemplateFormModal } from '../components/TemplateFormModal';
import type { DocumentNumberTemplate, CreateTemplateInput } from '../types';

const INPUT_MODE_LABELS: Record<string, string> = {
  AUTO: 'Tự động',
  MANUAL: 'Nhập tay',
  AUTO_WITH_OVERRIDE: 'Tự động + Override',
};

const INPUT_MODE_CLASSES: Record<string, string> = {
  AUTO: 'bg-green-100 text-green-700',
  MANUAL: 'bg-gray-100 text-gray-600',
  AUTO_WITH_OVERRIDE: 'bg-amber-100 text-amber-700',
};

function InputModeBadge({ id, mode }: { id: string; mode: string }) {
  return (
    <span
      data-testid={`inputmode-badge-${id}`}
      className={`text-xs px-1.5 py-0.5 rounded font-medium ${INPUT_MODE_CLASSES[mode] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {INPUT_MODE_LABELS[mode] ?? mode}
    </span>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
  onReset,
}: {
  template: DocumentNumberTemplate;
  onEdit: (t: DocumentNumberTemplate) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium">{template.name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{template.documentType}</td>
      <td className="px-4 py-3">
        <InputModeBadge id={template.id} mode={template.inputMode} />
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-xs ${template.isActive ? 'text-green-600' : 'text-gray-400'}`}>
          {template.isActive ? '✓' : '✗'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-blue-600"
            onClick={() => onEdit(template)}
            title="Sửa"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-orange-600"
            onClick={() => onReset(template.id)}
            title="Reset counter"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-red-600"
            onClick={() => onDelete(template.id)}
            title="Xóa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DocumentNumberSettingsPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'logs'>('templates');
  const [editingTemplate, setEditingTemplate] = useState<DocumentNumberTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, isError: loiTai, error: loiChiTiet } = useQuery({
    queryKey: DOC_NUM_QUERY_KEYS.templates,
    queryFn: documentNumbersApi.listTemplates,
  });

  // Truy vấn hỏng thì `templates` là mảng rỗng mặc định — màn hình nhìn hệt cơ quan chưa khai
  // chuỗi số nào. Quy về cùng tên `loadError` như các trang khác để cổng lớp soi được.
  const loadError = loiTai
    ? extractApiError(loiChiTiet, 'Không tải được cấu hình mã số chứng từ.').messages.join(', ')
    : '';

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentNumbersApi.deleteTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOC_NUM_QUERY_KEYS.templates });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => documentNumbersApi.resetCounter(id),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTemplateInput) => documentNumbersApi.createTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOC_NUM_QUERY_KEYS.templates });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateTemplateInput }) =>
      documentNumbersApi.updateTemplate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOC_NUM_QUERY_KEYS.templates });
    },
  });

  function handleDelete(id: string) {
    if (confirm('Xác nhận xóa template này?')) {
      deleteMutation.mutate(id);
    }
  }

  function handleReset(id: string) {
    if (confirm('Xác nhận reset counter về 0?')) {
      resetMutation.mutate(id);
    }
  }

  async function handleSave(data: CreateTemplateInput, id?: string) {
    if (id) {
      await updateMutation.mutateAsync({ id, input: data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setEditingTemplate(null);
    setShowCreate(false);
  }

  const modalOpen = showCreate || editingTemplate !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1
          data-testid="docnum-settings-heading"
          className="text-xl font-semibold text-gray-900"
        >
          Quản lý Mã số chứng từ
        </h1>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          Thêm mới
        </button>
      </div>

      <LoadErrorBanner error={loadError} what="cấu hình mã số chứng từ" data-testid="docnum-load-error" />

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-4">
        <button
          type="button"
          className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px ${
            activeTab === 'templates'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('templates')}
        >
          <BarChart2 className="w-4 h-4" />
          Danh sách template
        </button>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          <List className="w-4 h-4" />
          Lịch sử sinh số
        </button>
      </div>

      {activeTab === 'templates' && (
        <>
          {isLoading ? (
            <div className="text-center py-10 text-gray-400">Đang tải…</div>
          ) : loadError ? null : templates.length === 0 ? (
            <div
              data-testid="docnum-empty-state"
              className="text-center py-16 text-gray-400"
            >
              <p className="text-lg">Chưa có template nào</p>
              <p className="text-sm mt-1">Nhấn "Thêm mới" để tạo template đầu tiên</p>
            </div>
          ) : (
            <div className="bg-white rounded border overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[640px]">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Tên</th>
                    <th className="px-4 py-3">Loại chứng từ</th>
                    <th className="px-4 py-3">Chế độ nhập</th>
                    <th className="px-4 py-3 text-center">Active</th>
                    <th className="px-4 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <TemplateRow
                      key={tpl.id}
                      template={tpl}
                      onEdit={setEditingTemplate}
                      onDelete={handleDelete}
                      onReset={handleReset}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'logs' && (
        <div className="text-center py-10 text-gray-400">
          <p>Chức năng xem lịch sử đang phát triển</p>
        </div>
      )}

      {modalOpen && (
        <TemplateFormModal
          template={editingTemplate}
          onClose={() => {
            setEditingTemplate(null);
            setShowCreate(false);
          }}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
