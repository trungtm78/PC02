import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Modal } from '@/components/shared/Modal';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';

export type AssignResourceType = 'cases' | 'incidents' | 'petitions';

interface Team {
  id: string;
  name: string;
}

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  username: string;
}

interface AssignModalProps {
  open: boolean;
  onClose: () => void;
  resourceType: AssignResourceType;
  recordId: string;
  currentUpdatedAt?: string;
  currentTeamId?: string | null;
  currentInvestigatorId?: string | null;
  onSuccess: () => void;
}

export function AssignModal({
  open,
  onClose,
  resourceType,
  recordId,
  currentUpdatedAt,
  currentTeamId,
  currentInvestigatorId,
  onSuccess,
}: AssignModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(currentTeamId ?? '');
  const [selectedUserId, setSelectedUserId] = useState(currentInvestigatorId ?? '');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api.get<{ data: Team[] }>('/teams').then((r) => setTeams(r.data.data ?? [])).catch(() => setTeams([]));
  }, [open]);

  useEffect(() => {
    if (!selectedTeamId) {
      setUsers([]);
      return;
    }
    api
      .get<{ data: User[] }>('/admin/users', { params: { teamId: selectedTeamId } })
      .then((r) => setUsers(r.data.data ?? []))
      .catch(() => setUsers([]));
  }, [selectedTeamId]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTeamId(currentTeamId ?? '');
      setSelectedUserId(currentInvestigatorId ?? '');
      setDeadline('');
      setError(null);
    }
  }, [open, currentTeamId, currentInvestigatorId]);

  const handleSubmit = async () => {
    if (!selectedTeamId) {
      setError('Vui lòng chọn tổ điều tra');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        assignedTeamId: selectedTeamId,
        ...(selectedUserId && { [resourceType === 'petitions' ? 'assignedToId' : 'investigatorId']: selectedUserId }),
        ...(currentUpdatedAt && { expectedUpdatedAt: currentUpdatedAt }),
        ...(deadline && resourceType === 'petitions' && { deadline }),
      };
      await api.patch(`/${resourceType}/${recordId}/assign`, body);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Phân công thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const title = currentTeamId ? 'Phân công lại' : 'Phân công';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY} disabled={loading}>
            Hủy
          </button>
          <button onClick={handleSubmit} className={BTN_PRIMARY} disabled={loading || !selectedTeamId}>
            {loading ? 'Đang lưu...' : 'Phân công'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tổ điều tra <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedTeamId}
            onChange={(e) => { setSelectedTeamId(e.target.value); setSelectedUserId(''); }}
          >
            <option value="">-- Chọn tổ --</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {resourceType === 'petitions' ? 'Cán bộ xử lý' : 'Điều tra viên'}{' '}
            <span className="text-slate-400 text-xs">(tuỳ chọn)</span>
          </label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={!selectedTeamId}
          >
            <option value="">-- Chọn cán bộ --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.username}
              </option>
            ))}
          </select>
        </div>

        {resourceType === 'petitions' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Thời hạn <span className="text-slate-400 text-xs">(tuỳ chọn)</span>
            </label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
