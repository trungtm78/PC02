import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Users,
  Building2,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────── */

interface Team {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: Team | null;
  children?: Team[];
  _count?: { members: number };
}

interface TeamFormData {
  name: string;
  code: string;
  level: number;
  parentId?: string;
  order?: number;
  isActive?: boolean;
}

/* ─── Component ──────────────────────────────────────── */

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    code: '',
    level: 0,
  });

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: TeamFormData) => api.post('/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TeamFormData> }) =>
      api.put(`/teams/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingTeam(null);
    setFormData({ name: '', code: '', level: 0 });
  }, []);

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      code: team.code,
      level: team.level,
      parentId: team.parentId ?? undefined,
      order: team.order,
      isActive: team.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (team: Team) => {
    if (confirm(`Bạn chắc chắn muốn xóa "${team.name}"?`)) {
      deleteMutation.mutate(team.id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build tree from flat list
  const rootTeams = teams.filter((t) => !t.parentId);

  const getChildren = (parentId: string) =>
    teams.filter((t) => t.parentId === parentId);

  const renderTeamRow = (team: Team, depth: number) => {
    const children = getChildren(team.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(team.id);

    return (
      <div key={team.id}>
        <div
          className={`flex items-center gap-2 px-4 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
            !team.isActive ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(team.id)}
            className="w-5 h-5 flex items-center justify-center"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )
            ) : (
              <span className="w-4" />
            )}
          </button>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">
              {team.code}
            </span>
            <span className="font-medium text-sm text-slate-800">{team.name}</span>
            {team._count && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {team._count.members}
              </span>
            )}
            {!team.isActive && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                Ngừng hoạt động
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleEdit(team)}
              className="p-1.5 hover:bg-blue-50 rounded text-blue-500"
              title="Chỉnh sửa"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(team)}
              className="p-1.5 hover:bg-red-50 rounded text-red-500"
              title="Xóa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded &&
          children
            .sort((a, b) => a.order - b.order)
            .map((child) => renderTeamRow(child, depth + 1))}
      </div>
    );
  };

  // Auto-expand root teams on first load
  useEffect(() => {
    if (rootTeams.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(rootTeams.map((t) => t.id)));
    }
  }, [rootTeams.length]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-slate-800">
            Quản lý Tổ / Nhóm
          </h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Thêm mới
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-4">
            {editingTeam ? 'Chỉnh sửa' : 'Thêm mới'} Tổ / Nhóm
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tên
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mã
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cấp
              </label>
              <select
                value={formData.level}
                onChange={(e) =>
                  setFormData({ ...formData, level: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value={0}>Nhóm (Level 0)</option>
                <option value={1}>Tổ (Level 1)</option>
                <option value={2}>Phường/Xã (Level 2)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Đơn vị cha
              </label>
              <select
                value={formData.parentId ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parentId: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="">-- Không --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} - {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
              >
                {editingTeam ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tree Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span className="w-5" />
          <span className="flex-1">Tổ / Nhóm</span>
          <span className="w-20 text-right">Thao tác</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Đang tải...</div>
        ) : rootTeams.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Chưa có dữ liệu tổ/nhóm
          </div>
        ) : (
          rootTeams
            .sort((a, b) => a.order - b.order)
            .map((team) => renderTeamRow(team, 0))
        )}
      </div>
    </div>
  );
}
