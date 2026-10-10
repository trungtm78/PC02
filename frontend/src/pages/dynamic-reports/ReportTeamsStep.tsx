/**
 * S09 — Chọn quản lý/người xem + tổ phải nộp/người nhập (spec §6.1 PR4
 * bước 4/4, D10/D06). Reuses this repo's existing officer/team picker
 * stack (`useOfficerOptions`, `gomCanBoTheoTo`, `FKSelect`) instead of
 * inventing a parallel one — the same "add one at a time + list + remove"
 * UX `PetitionAssignmentSection.tsx` already uses for a structurally
 * identical problem (assigning people to something, not a native HTML
 * multi-select).
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { gomCanBoTheoTo } from '@/hooks/gomCanBoTheoTo';
import { FKSelect } from '@/components/FKSelect';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import type { ReportRoleConfig, ReportTargetConfig } from '@/features/dynamic-reports/types';

interface TeamOption {
  id: string;
  name: string;
}

interface Props {
  onBack: () => void;
  onNext: (roles: ReportRoleConfig[], targets: ReportTargetConfig[]) => void;
}

export default function ReportTeamsStep({ onBack, onNext }: Props) {
  const { data: officers = [], isLoading: loadingOfficers } = useOfficerOptions();
  const nhomCanBo = gomCanBoTheoTo(officers);
  const labelFor = (userId: string) => officers.find((o) => o.value === userId)?.label ?? userId;

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/teams', { signal: controller.signal })
      .then((res) => {
        const items = (Array.isArray(res.data) ? res.data : res.data?.data ?? []) as Array<{
          id: string;
          name: string;
          isActive?: boolean;
          wardId?: string | null;
        }>;
        setTeams(
          items
            .filter((t) => t.isActive !== false && t.wardId == null)
            .map((t) => ({ id: t.id, name: t.name })),
        );
      })
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
    return () => controller.abort();
  }, []);
  const teamGroups = [{ key: 'teams', label: 'Tổ', options: teams.map((t) => ({ value: t.id, label: t.name })) }];

  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [addManagerId, setAddManagerId] = useState('');
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [addViewerId, setAddViewerId] = useState('');

  const [targets, setTargets] = useState<Array<{ teamId: string; editorUserIds: string[] }>>([]);
  const [addTeamId, setAddTeamId] = useState('');
  const [addEditorByTeam, setAddEditorByTeam] = useState<Record<string, string>>({});

  function addManager() {
    if (!addManagerId || managerIds.includes(addManagerId)) return;
    setManagerIds((prev) => [...prev, addManagerId]);
    setAddManagerId('');
  }
  function addViewer() {
    if (!addViewerId || viewerIds.includes(addViewerId)) return;
    setViewerIds((prev) => [...prev, addViewerId]);
    setAddViewerId('');
  }
  function addTeam() {
    if (!addTeamId || targets.some((t) => t.teamId === addTeamId)) return;
    setTargets((prev) => [...prev, { teamId: addTeamId, editorUserIds: [] }]);
    setAddTeamId('');
  }
  function removeTeam(teamId: string) {
    setTargets((prev) => prev.filter((t) => t.teamId !== teamId));
  }
  function addEditor(teamId: string) {
    const userId = addEditorByTeam[teamId];
    if (!userId) return;
    setTargets((prev) =>
      prev.map((t) =>
        t.teamId === teamId && !t.editorUserIds.includes(userId)
          ? { ...t, editorUserIds: [...t.editorUserIds, userId] }
          : t,
      ),
    );
    setAddEditorByTeam((prev) => ({ ...prev, [teamId]: '' }));
  }
  function removeEditor(teamId: string, userId: string) {
    setTargets((prev) =>
      prev.map((t) =>
        t.teamId === teamId
          ? { ...t, editorUserIds: t.editorUserIds.filter((id) => id !== userId) }
          : t,
      ),
    );
  }

  const canSubmit = managerIds.length > 0 && targets.length > 0 && targets.every((t) => t.editorUserIds.length > 0);

  function handleNext() {
    const roles: ReportRoleConfig[] = [
      ...managerIds.map((userId) => ({ userId, role: 'MANAGER' as const })),
      ...viewerIds.map((userId) => ({ userId, role: 'VIEWER' as const })),
    ];
    const targetConfigs: ReportTargetConfig[] = targets.map((t) => ({
      teamId: t.teamId,
      editorUserIds: t.editorUserIds,
    }));
    onNext(roles, targetConfigs);
  }

  return (
    <div data-testid="teams-step">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Quản lý và tổ phải nộp</h2>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">Quản lý (bắt buộc ≥1)</h3>
        <ul className="space-y-1 mb-2" data-testid="manager-list">
          {managerIds.map((id) => (
            <li key={id} className="flex items-center justify-between bg-slate-50 rounded px-3 py-1.5 text-sm">
              {labelFor(id)}
              <button
                type="button"
                data-testid={`btn-remove-manager-${id}`}
                onClick={() => setManagerIds((prev) => prev.filter((m) => m !== id))}
                className={`text-slate-400 hover:text-red-600 ${A11Y_FOCUS_RING}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FKSelect
              label=""
              value={addManagerId}
              onChange={setAddManagerId}
              groups={nhomCanBo}
              loading={loadingOfficers}
              placeholder="-- Chọn cán bộ làm quản lý --"
              testId="select-add-manager"
            />
          </div>
          <button
            type="button"
            data-testid="btn-add-manager"
            disabled={!addManagerId}
            onClick={addManager}
            className={`flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">Người chỉ xem (tuỳ chọn)</h3>
        <ul className="space-y-1 mb-2" data-testid="viewer-list">
          {viewerIds.map((id) => (
            <li key={id} className="flex items-center justify-between bg-slate-50 rounded px-3 py-1.5 text-sm">
              {labelFor(id)}
              <button
                type="button"
                data-testid={`btn-remove-viewer-${id}`}
                onClick={() => setViewerIds((prev) => prev.filter((v) => v !== id))}
                className={`text-slate-400 hover:text-red-600 ${A11Y_FOCUS_RING}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FKSelect
              label=""
              value={addViewerId}
              onChange={setAddViewerId}
              groups={nhomCanBo}
              loading={loadingOfficers}
              placeholder="-- Chọn cán bộ chỉ xem --"
              testId="select-add-viewer"
            />
          </div>
          <button
            type="button"
            data-testid="btn-add-viewer"
            disabled={!addViewerId}
            onClick={addViewer}
            className={`flex items-center gap-1 px-3 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">
          Tổ phải nộp (bắt buộc ≥1 tổ, mỗi tổ ≥1 người nhập)
        </h3>
        <div className="space-y-3 mb-3" data-testid="target-list">
          {targets.map((t) => {
            const team = teams.find((x) => x.id === t.teamId);
            return (
              <div key={t.teamId} className="border border-slate-200 rounded-lg p-3" data-testid={`target-${t.teamId}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-slate-800">{team?.name ?? t.teamId}</span>
                  <button
                    type="button"
                    data-testid={`btn-remove-target-${t.teamId}`}
                    onClick={() => removeTeam(t.teamId)}
                    className={`text-slate-400 hover:text-red-600 ${A11Y_FOCUS_RING}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <ul className="space-y-1 mb-2 text-sm">
                  {t.editorUserIds.map((userId) => (
                    <li key={userId} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
                      {labelFor(userId)}
                      <button
                        type="button"
                        data-testid={`btn-remove-editor-${t.teamId}-${userId}`}
                        onClick={() => removeEditor(t.teamId, userId)}
                        className={`text-slate-400 hover:text-red-600 ${A11Y_FOCUS_RING}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {t.editorUserIds.length === 0 && (
                    <li className="text-amber-600 text-xs">Chưa có người nhập — tổ này không thể xuất bản.</li>
                  )}
                </ul>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FKSelect
                      label=""
                      value={addEditorByTeam[t.teamId] ?? ''}
                      onChange={(v) => setAddEditorByTeam((prev) => ({ ...prev, [t.teamId]: v }))}
                      groups={nhomCanBo}
                      loading={loadingOfficers}
                      placeholder="-- Chọn người nhập --"
                      testId={`select-add-editor-${t.teamId}`}
                    />
                  </div>
                  <button
                    type="button"
                    data-testid={`btn-add-editor-${t.teamId}`}
                    disabled={!addEditorByTeam[t.teamId]}
                    onClick={() => addEditor(t.teamId)}
                    className={`flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                  >
                    <Plus className="w-4 h-4" />
                    Thêm
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FKSelect
              label=""
              value={addTeamId}
              onChange={setAddTeamId}
              groups={teamGroups}
              loading={loadingTeams}
              placeholder="-- Chọn tổ --"
              testId="select-add-team"
            />
          </div>
          <button
            type="button"
            data-testid="btn-add-team"
            disabled={!addTeamId}
            onClick={addTeam}
            className={`flex items-center gap-1 px-3 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Plus className="w-4 h-4" />
            Thêm tổ
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg ${A11Y_FOCUS_RING}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <button
          type="button"
          data-testid="btn-teams-next"
          disabled={!canSubmit}
          onClick={handleNext}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${A11Y_FOCUS_RING}`}
        >
          Tiếp theo
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
