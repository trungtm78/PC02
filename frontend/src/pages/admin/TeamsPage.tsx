import { useState, useEffect, useCallback, useRef } from 'react';
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
  X,
  UserPlus,
  Search,
  Shield,
  Loader2,
} from 'lucide-react';
import { SingleWardPicker } from '@/components/SingleWardPicker'; // v0.34.0.0

/* ─── Types ──────────────────────────────────────────── */

interface Team {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  order: number;
  isActive: boolean;
  wardId?: string | null; // v0.33.0.0: Hybrid ward scoping
  editWindowHours?: number | null; // v0.33.0.0: per-team override
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
  wardId?: string | null;          // v0.33.0.0
  editWindowHours?: number | null; // v0.33.0.0
}

interface TeamMember {
  userId: string;
  teamId: string;
  isLeader: boolean;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
  };
}

interface TeamDetail extends Team {
  members: TeamMember[];
}

interface SearchUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Nhóm',
  1: 'Tổ',
  2: 'Phường/Xã',
};

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

  // ── Member management state ──────────────────────────
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<SearchUser[]>([]);
  const [isAddingMultiple, setIsAddingMultiple] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // ── Team detail (members) query ────────────────────────
  const {
    data: teamDetail,
    isLoading: isLoadingMembers,
  } = useQuery<TeamDetail>({
    queryKey: ['teams', selectedTeamId],
    queryFn: () => api.get(`/teams/${selectedTeamId}`).then((r) => r.data),
    enabled: !!selectedTeamId,
  });

  // ── User search for adding members ────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(userSearch);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [userSearch]);

  const { data: searchResults = [] } = useQuery<SearchUser[]>({
    queryKey: ['admin-users-search', debouncedSearch],
    queryFn: () =>
      api
        .get('/admin/users', { params: { search: debouncedSearch } })
        .then((r) => {
          const data = r.data;
          return Array.isArray(data) ? data : data.data ?? [];
        }),
    enabled: debouncedSearch.length >= 2,
  });

  // Filter out users already in the team or already staged
  const filteredSearchResults = searchResults.filter(
    (u) =>
      !teamDetail?.members.some((m) => m.userId === u.id) &&
      !pendingUsers.some((p) => p.id === u.id),
  );

  const handleAddAllPending = async () => {
    if (!selectedTeamId || pendingUsers.length === 0) return;
    setIsAddingMultiple(true);
    try {
      await Promise.all(
        pendingUsers.map((u) =>
          api.post(`/teams/${selectedTeamId}/members`, { userId: u.id }),
        ),
      );
      queryClient.invalidateQueries({ queryKey: ['teams', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setPendingUsers([]);
      setUserSearch('');
      setShowUserSearch(false);
    } finally {
      setIsAddingMultiple(false);
    }
  };

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      api.delete(`/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
    setShowUserSearch(false);
    setUserSearch('');
    setPendingUsers([]);
  };

  const handleRemoveMember = (userId: string) => {
    if (!selectedTeamId) return;
    if (confirm('Bạn chắc chắn muốn gỡ thành viên này?')) {
      removeMemberMutation.mutate({ teamId: selectedTeamId, userId });
    }
  };

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
      wardId: team.wardId ?? null,
      editWindowHours: team.editWindowHours ?? null,
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

  const renderMemberPanel = (team: Team) => {
    const isSelected = selectedTeamId === team.id;
    if (!isSelected) return null;

    return (
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-slate-700">
              Thành viên — {team.name}
            </span>
            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
              {LEVEL_LABELS[team.level] ?? `Level ${team.level}`}
            </span>
          </div>
          <button
            onClick={() => setSelectedTeamId(null)}
            className="p-1 hover:bg-slate-200 rounded text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoadingMembers ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải...
          </div>
        ) : (
          <>
            {/* Member list */}
            {teamDetail?.members && teamDetail.members.length > 0 ? (
              <div className="space-y-1 mb-3">
                {teamDetail.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {(member.user.lastName?.[0] ?? member.user.username[0]).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          {member.user.lastName} {member.user.firstName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {member.user.email ?? member.user.username}
                        </div>
                      </div>
                      {member.isLeader && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                          <Shield className="w-3 h-3" />
                          Trưởng nhóm
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={removeMemberMutation.isPending}
                      className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      Gỡ
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400 py-2 mb-3">
                Chưa có thành viên nào.
              </div>
            )}

            {/* Add member section */}
            {!showUserSearch ? (
              <button
                onClick={() => {
                  setShowUserSearch(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="flex items-center gap-2 text-sm text-primary hover:bg-primary/5 px-3 py-2 rounded-md transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Thêm thành viên
              </button>
            ) : (
              <div className="space-y-2">
                {/* Pending user chips */}
                {pendingUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {pendingUsers.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium"
                      >
                        {user.lastName} {user.firstName}
                        <button
                          type="button"
                          onClick={() =>
                            setPendingUsers((prev) => prev.filter((u) => u.id !== user.id))
                          }
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Tìm theo tên, email, username..."
                      className="flex-1 text-sm outline-none bg-transparent"
                    />
                    <button
                      onClick={() => {
                        setShowUserSearch(false);
                        setUserSearch('');
                        setPendingUsers([]);
                      }}
                      className="p-0.5 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  {/* Search results dropdown */}
                  {debouncedSearch.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredSearchResults.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400">
                          Không tìm thấy người dùng
                        </div>
                      ) : (
                        filteredSearchResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setPendingUsers((prev) => [...prev, user]);
                              setUserSearch('');
                              searchInputRef.current?.focus();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-primary/5 text-left transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {(user.lastName?.[0] ?? user.username[0]).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-700">
                                {user.lastName} {user.firstName}
                              </div>
                              <div className="text-xs text-slate-400">
                                {user.email ?? user.username}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Confirm / cancel row */}
                {pendingUsers.length > 0 && (
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs text-slate-500">
                      Đã chọn {pendingUsers.length} người
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserSearch(false);
                          setUserSearch('');
                          setPendingUsers([]);
                        }}
                        className="text-xs px-3 py-1.5 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAllPending}
                        disabled={isAddingMultiple}
                        className="text-xs px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 transition-colors"
                      >
                        {isAddingMultiple && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        Thêm {pendingUsers.length} thành viên
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderTeamRow = (team: Team, depth: number) => {
    const children = getChildren(team.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(team.id);
    const isSelected = selectedTeamId === team.id;

    return (
      <div key={team.id}>
        <div
          className={`flex items-center gap-2 px-4 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
            !team.isActive ? 'opacity-50' : ''
          } ${isSelected ? 'bg-blue-50 border-l-2 border-l-primary' : ''}`}
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
          onClick={() => handleSelectTeam(team.id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(team.id);
            }}
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
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(team);
              }}
              className="p-1.5 hover:bg-blue-50 rounded text-blue-500"
              title="Chỉnh sửa"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(team);
              }}
              className="p-1.5 hover:bg-red-50 rounded text-red-500"
              title="Xóa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {renderMemberPanel(team)}

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
            {/* v0.34.0.0: Phường công tác — SingleWardPicker 2-tier cascade */}
            <SingleWardPicker
              value={formData.wardId ?? null}
              onChange={(wardId) => setFormData({ ...formData, wardId })}
              label="Phường công tác (tùy chọn)"
              helperText="Để trống = Tổ chức năng (PC02). Chọn phường = Tổ địa lý (Công an Phường). Cán bộ thuộc Tổ này → scope theo phường."
              testIdPrefix="team-form-ward"
            />
            {/* v0.33.0.0: editWindowHours override (Phase 5-lite) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Thời hạn sửa dữ liệu (giờ, tùy chọn)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={formData.editWindowHours ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    editWindowHours: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="24 (default)"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Để trống = dùng cấu hình hệ thống (THOI_HAN_EDIT_VU_VAN). Override cho Tổ này nếu cần khác.
              </p>
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
