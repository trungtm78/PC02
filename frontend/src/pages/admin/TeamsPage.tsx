import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import {
  Plus,
  Edit2,
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
import { teams as L, permissions as PL } from '@/locales/vi';
import { usePermission } from '@/hooks/usePermission';
import { PAGE_PATH, PAGE_TAB, SCREEN_PERMISSION } from '@/features/permissions/types';

/* ─── Types ──────────────────────────────────────────── */

type TeamStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
const TAB_ORDER: TeamStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];

interface Team {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  order: number;
  isActive: boolean;
  status: TeamStatus;
  wardId?: string | null; // v0.33.0.0: Hybrid ward scoping
  editWindowHours?: number | null; // v0.33.0.0: per-team override
  createdAt: string;
  updatedAt: string;
  parent?: Team | null;
  children?: Team[];
  _count?: { members: number };
}

interface Blocker {
  table: string;
  column: string;
  count: number;
}

/** The server sends blockers as the `details` of the error envelope; the shared helper hands each back as JSON text. */
function blockersFromError(messages: string[]): Blocker[] {
  return messages.flatMap((m) => {
    try {
      const parsed = JSON.parse(m) as Partial<Blocker>;
      return typeof parsed.table === 'string' && typeof parsed.count === 'number'
        ? [{ table: parsed.table, column: String(parsed.column ?? ''), count: parsed.count }]
        : [];
    } catch {
      return [];
    }
  });
}

interface MergeSummary {
  moved: { table: string; column: string; count: number }[];
  duplicatesRemoved: { table: string; count: number }[];
  leadersRaised: number;
  skipped: { table: string; column: string; count: number; reason: string }[];
}

interface MergeOperation {
  id: string;
  sourceName: string;
  targetName: string;
  status: 'APPLIED' | 'UNDONE';
  mergedAt: string;
}

const sourceLabel = (table: string) => L.delete.sources[table] ?? table;

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
  // The link to "permissions by team" is for those who may open that screen; unknown yet = shown.
  const { permissions: heldPermissions } = usePermission();
  const canOpenPermissions = heldPermissions == null || heldPermissions.includes(SCREEN_PERMISSION.READ);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<TeamStatus>('ACTIVE');
  const [statusError, setStatusError] = useState('');
  const [deleteBlocked, setDeleteBlocked] = useState<{ team: Team; blockers: Blocker[] } | null>(null);
  const [mergeSource, setMergeSource] = useState<Team | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  // A preview counts for ONE target; it is shown, and unlocks the merge, only while that target is still selected.
  const [mergePreview, setMergePreview] = useState<{ target: string; summary: MergeSummary } | null>(null);
  const mergeSummary = mergePreview && mergePreview.target === mergeTarget ? mergePreview.summary : null;
  const [mergeError, setMergeError] = useState('');
  const [mergeDone, setMergeDone] = useState('');
  const [undoResult, setUndoResult] = useState('');
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

  // One request for every state: the tabs are a filter over it and their counts come for free.
  const { data: allTeams = [], isLoading, isError: loiTaiTo, error: loiTo } = useQuery<Team[]>({
    queryKey: ['teams', 'admin'],
    queryFn: () => api.get('/teams', { params: { status: 'ALL' } }).then((r) => r.data),
  });
  const teams = allTeams.filter((t) => t.status === tab);
  const activeTeams = allTeams.filter((t) => t.status === 'ACTIVE');
  const countOf = (status: TeamStatus) => allTeams.filter((t) => t.status === status).length;

  // Truy vấn hỏng thì `teams` là mảng rỗng mặc định — màn hình nói "{loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Chưa có dữ liệu tổ/nhóm'}",
  // một khẳng định về thứ chưa hề hỏi được. Quy về cùng một tên `loadError` như các trang khác
  // để cổng lớp soi được.
  const loadError = loiTaiTo
    ? extractApiError(loiTo, "Không tải được danh sách tổ/nhóm.").messages.join(", ")
    : "";

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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TeamStatus }) =>
      api.patch(`/teams/${id}/status`, { status }),
    onSuccess: () => {
      setStatusError('');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => {
      const { code } = extractApiError(err, L.statusFailed);
      setStatusError((code && L.errors[code]) || L.statusFailed);
    },
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

  /** Pausing and archiving hide the team from every list, so they ask first; the way back needs no question. */
  const changeStatus = (team: Team, status: TeamStatus) => {
    const question =
      status === 'INACTIVE' ? L.confirm.deactivate(team.name) : status === 'ARCHIVED' ? L.confirm.archive(team.name) : null;
    if (question && !confirm(question)) return;
    statusMutation.mutate({ id: team.id, status });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => {
      setStatusError('');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err, id) => {
      const { code, messages } = extractApiError(err, L.delete.failed);
      const team = allTeams.find((t) => t.id === id);
      if (code === 'TEAM_HAS_DATA' && team) {
        setDeleteBlocked({ team, blockers: blockersFromError(messages) });
        return;
      }
      setStatusError((code && L.errors[code]) || L.delete.failed);
    },
  });

  /**
   * Delete is only for a team nothing refers to. The server says what still does BEFORE anything is asked of the
   * person, so they are never told "are you sure?" about something that cannot happen; and it decides again at delete
   * time, so a change in between still gets the same explanation.
   */
  const startDelete = async (team: Team) => {
    setStatusError('');
    setDeleteBlocked(null);
    try {
      const { data } = await api.get<{ deletable: boolean; blockers: Blocker[] }>(`/teams/${team.id}/deletion-check`);
      if (!data.deletable) {
        setDeleteBlocked({ team, blockers: data.blockers });
        return;
      }
    } catch (err) {
      setStatusError(extractApiError(err, L.delete.failed).message);
      return;
    }
    if (confirm(L.delete.confirm(team.name))) deleteMutation.mutate(team.id);
  };

  const { data: merges = [] } = useQuery<MergeOperation[]>({
    queryKey: ['teams', 'merges'],
    queryFn: () => api.get('/teams/merges').then((r) => r.data),
  });

  const closeMerge = () => {
    setMergeSource(null);
    setMergeTarget('');
    setMergePreview(null);
    setMergeError('');
  };
  const mergeFailure = (err: unknown, fallback: string) => {
    const { code } = extractApiError(err, fallback);
    return (code && L.errors[code]) || fallback;
  };

  const previewMutation = useMutation({
    mutationFn: (target: string) => api.post(`/teams/${mergeSource!.id}/merge-preview`, { targetTeamId: target }),
    onSuccess: (r, target) => {
      setMergeError('');
      setMergePreview({ target, summary: r.data.summary });
    },
    onError: (err) => {
      setMergePreview(null);
      setMergeError(mergeFailure(err, L.merge.failed));
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () => api.post(`/teams/${mergeSource!.id}/merge`, { targetTeamId: mergeTarget }),
    onSuccess: () => {
      const target = allTeams.find((t) => t.id === mergeTarget);
      setMergeDone(L.merge.done(mergeSource!.name, target?.name ?? ''));
      setUndoResult('');
      closeMerge();
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => setMergeError(mergeFailure(err, L.merge.failed)),
  });

  const undoMutation = useMutation({
    mutationFn: (id: string) => api.post(`/teams/merges/${id}/undo`),
    onSuccess: (r) => {
      setMergeDone('');
      setUndoResult(L.merge.undoResult(r.data.restored, r.data.skipped));
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => setStatusError(mergeFailure(err, L.merge.undoFailed)),
  });

  const startUndo = (op: MergeOperation) => {
    if (confirm(L.merge.undoConfirm(op.sourceName, op.targetName))) undoMutation.mutate(op.id);
  };

  /** What can be done from each state; every action has its way back. */
  const ACTIONS: Record<TeamStatus, { key: string; label: string; to: TeamStatus }[]> = {
    ACTIVE: [
      { key: 'deactivate', label: L.actions.deactivate, to: 'INACTIVE' },
      { key: 'archive', label: L.actions.archive, to: 'ARCHIVED' },
    ],
    INACTIVE: [
      { key: 'activate', label: L.actions.activate, to: 'ACTIVE' },
      { key: 'archive', label: L.actions.archive, to: 'ARCHIVED' },
    ],
    ARCHIVED: [{ key: 'restore', label: L.actions.restore, to: 'ACTIVE' }],
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // The active tab is a tree; the other tabs are flat lists (a paused child of an active parent has no parent in its
  // own tab, so a tree would hide it). A team whose parent is not in the same tab is shown as a root.
  const inTab = new Set(teams.map((t) => t.id));
  const flat = tab !== 'ACTIVE';
  const rootTeams = teams.filter((t) => flat || !t.parentId || !inTab.has(t.parentId));

  const getChildren = (parentId: string) =>
    flat ? [] : teams.filter((t) => t.parentId === parentId);

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
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
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
            team.status !== 'ACTIVE' ? 'opacity-50' : ''
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
            {team.status !== 'ACTIVE' && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                {L.tabs[team.status]}
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
            {canOpenPermissions && (
              <Link
                to={`${PAGE_PATH}?tab=${PAGE_TAB.TEAMS}&team=${encodeURIComponent(team.id)}`}
                data-testid={`team-action-permissions-${team.id}`}
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
              >
                {PL.links.teamPermissions}
              </Link>
            )}
            <button
              data-testid={`team-action-delete-${team.id}`}
              onClick={(e) => {
                e.stopPropagation();
                void startDelete(team);
              }}
              disabled={deleteMutation.isPending}
              className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
            >
              {L.delete.action}
            </button>
            {team.status !== 'ARCHIVED' && (
              <button
                data-testid={`team-action-merge-${team.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMergeDone('');
                  setUndoResult('');
                  setMergeSource(team);
                }}
                className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
              >
                {L.merge.action}
              </button>
            )}
            {ACTIONS[team.status].map((a) => (
              <button
                key={a.key}
                data-testid={`team-action-${a.key}-${team.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  changeStatus(team, a.to);
                }}
                disabled={statusMutation.isPending}
                className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
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

      <LoadErrorBanner error={loadError} what="danh sách tổ/nhóm" data-testid="teams-load-error" />

      {statusError && (
        <div role="alert" data-testid="team-status-error" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {statusError}
        </div>
      )}

      {mergeDone && (
        <div role="status" data-testid="team-merge-done" className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {mergeDone} {L.merge.after}
        </div>
      )}
      {undoResult && (
        <div role="status" data-testid="team-merge-undo-result" className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {undoResult}
        </div>
      )}

      {mergeSource && (
        <div data-testid="team-merge-dialog" className="mb-4 rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-3">{L.merge.title(mergeSource.name)}</h2>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="team-merge-target">
            {L.merge.pick}
          </label>
          <select
            id="team-merge-target"
            data-testid="team-merge-target"
            value={mergeTarget}
            onChange={(e) => {
              setMergeTarget(e.target.value);
              setMergeError('');
            }}
            className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">{L.merge.pickPlaceholder}</option>
            {activeTeams
              .filter((t) => t.id !== mergeSource.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} - {t.name}
                </option>
              ))}
          </select>

          {mergeError && (
            <p role="alert" data-testid="team-merge-error" className="mt-3 text-sm text-red-700">
              {mergeError}
            </p>
          )}

          {previewMutation.isPending && <p className="mt-3 text-sm text-slate-500">{L.merge.previewing}</p>}

          {mergeSummary && (
            <div data-testid="team-merge-summary" className="mt-3 text-sm text-slate-700">
              {mergeSummary.moved.length === 0 && mergeSummary.duplicatesRemoved.length === 0 ? (
                <p>{L.merge.nothing}</p>
              ) : (
                <>
                  <p className="font-semibold">{L.merge.previewTitle}</p>
                  <ul className="list-disc pl-5">
                    {mergeSummary.moved.map((m) => (
                      <li key={`${m.table}.${m.column}`}>{L.merge.moved(m.count, sourceLabel(m.table))}</li>
                    ))}
                    {mergeSummary.duplicatesRemoved.map((d) => (
                      <li key={`dup-${d.table}`}>{L.merge.duplicates(d.count, sourceLabel(d.table))}</li>
                    ))}
                    {mergeSummary.leadersRaised > 0 && <li>{L.merge.leaders(mergeSummary.leadersRaised)}</li>}
                  </ul>
                </>
              )}
              {mergeSummary.skipped.length > 0 && (
                <>
                  <p className="mt-2 font-semibold">{L.merge.skippedTitle}</p>
                  <ul className="list-disc pl-5">
                    {mergeSummary.skipped.map((s) => (
                      <li key={`${s.table}.${s.reason}`}>
                        {(L.merge.skipped[s.reason] ?? ((c: number, w: string) => `${c} ${w}`))(s.count, sourceLabel(s.table))}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-2 text-slate-500">{L.merge.after}</p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              data-testid="team-merge-preview"
              onClick={() => previewMutation.mutate(mergeTarget)}
              disabled={!mergeTarget || previewMutation.isPending}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              {L.merge.preview}
            </button>
            <button
              data-testid="team-merge-confirm"
              onClick={() => mergeMutation.mutate()}
              disabled={!mergeSummary || mergeMutation.isPending}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {L.merge.confirm}
            </button>
            <button
              onClick={closeMerge}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
            >
              {L.merge.cancel}
            </button>
          </div>
        </div>
      )}

      {deleteBlocked && (
        <div role="alert" data-testid="team-delete-blocked" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">{L.delete.blockedTitle(deleteBlocked.team.name)}</p>
          <ul className="mt-1 list-disc pl-5">
            {deleteBlocked.blockers.map((b) => (
              <li key={`${b.table}.${b.column}`}>{L.delete.line(b.count, L.delete.sources[b.table] ?? b.table)}</li>
            ))}
          </ul>
          <p className="mt-2">{L.delete.blockedHint}</p>
          <button
            data-testid="team-delete-blocked-close"
            onClick={() => setDeleteBlocked(null)}
            className="mt-2 px-3 py-1 text-xs border border-amber-300 rounded hover:bg-amber-100"
          >
            {L.delete.close}
          </button>
        </div>
      )}

      <div className="flex gap-1 mb-3" role="tablist">
        {TAB_ORDER.map((status) => (
          <button
            key={status}
            role="tab"
            aria-selected={tab === status}
            data-testid={`team-tab-${status}`}
            onClick={() => setTab(status)}
            className={`px-3 py-1.5 text-sm rounded-md border ${
              tab === status ? 'bg-blue-50 border-primary text-primary font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {L.tabs[status]} ({countOf(status)})
          </button>
        ))}
      </div>
      {tab !== 'ACTIVE' && <p className="text-xs text-slate-500 mb-3">{L.hint[tab]}</p>}

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
                {activeTeams.map((t) => (
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
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider rounded-t-lg">
          <span className="w-5" />
          <span className="flex-1">Tổ / Nhóm</span>
          <span className="w-20 text-right">Thao tác</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Đang tải...</div>
        ) : rootTeams.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : L.emptyTab[tab]}
          </div>
        ) : (
          rootTeams
            .sort((a, b) => a.order - b.order)
            .map((team) => renderTeamRow(team, 0))
        )}
      </div>

      {merges.length > 0 && (
        <div className="mt-6 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider rounded-t-lg">
            {L.merge.historyTitle}
          </div>
          <ul>
            {merges.map((op) => (
              <li key={op.id} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-100 text-sm">
                <span>
                  {op.sourceName} → {op.targetName}
                  <span className="ml-2 text-xs text-slate-400">{new Date(op.mergedAt).toLocaleString('vi-VN')}</span>
                </span>
                {op.status === 'APPLIED' ? (
                  <button
                    data-testid={`team-merge-undo-${op.id}`}
                    onClick={() => startUndo(op)}
                    disabled={undoMutation.isPending}
                    className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    {L.merge.undo}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">{L.merge.undone}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
