/**
 * "Sửa cấu hình" — change a report after it exists: its name and description, its schedule, who manages it, which
 * teams submit and through whom. Three independent sections, each with its own Save, so fixing a typo in the name
 * never has to re-confirm the schedule.
 *
 * Design standard "created ⇒ editable and deletable" and D09: a change to the schedule, the teams or their editors
 * applies from the next period (a period already generated keeps what it was generated with; who types in an OPEN
 * period is changed on the period screen). Managers and viewers take effect at once. The screen says so.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ScheduleRule } from '@/features/dynamic-reports/engine/generated/period';
import type {
  ReportDetailView,
  ReportRoleConfig,
  ReportTargetConfig,
  UpdateReportConfigPayload,
} from '@/features/dynamic-reports/types';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import ReportScheduleStep from './ReportScheduleStep';
import ReportTeamsStep from './ReportTeamsStep';

const DETAIL_KEY = (id: string) => ['dynamic-reports', 'detail', id];
const SETUP_LIST_KEY = ['dynamic-reports', 'setup-list'];

const CHANGED_TEXT: Record<string, string> = {
  info: 'thông tin',
  schedule: 'lịch',
  roles: 'quản lý/người xem',
  targets: 'tổ và người nhập',
};

function toScheduleRule(s: NonNullable<ReportDetailView['schedule']>): ScheduleRule {
  return {
    periodType: s.periodType,
    periodStartDay: s.periodStartDay ?? undefined,
    due: s.dueRule as unknown as ScheduleRule['due'],
    open: s.openRule as unknown as ScheduleRule['open'],
    shiftNonWorking: s.shiftNonWorking,
    oneTimeDate: s.oneTimeDate ?? undefined,
  };
}

function Section({ title, hint, testId, children }: { title: string; hint?: string; testId: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4" data-testid={testId}>
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {hint && <p className="text-xs text-slate-500 mt-0.5 mb-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default function ReportEditPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  // The schedule and team sections keep their own unsaved edits. Saving one section must not reset the others, so a
  // section is remounted (re-read from the server) only when IT was saved, or when everything is reloaded.
  const [resets, setResets] = useState({ schedule: 0, teams: 0 });

  const detailQ = useQuery({
    queryKey: DETAIL_KEY(reportId ?? ''),
    queryFn: () => dynamicReportsApi.getReportDetail(reportId as string),
    enabled: !!reportId,
    // Editing: a refetch in the middle must not reset what the person has typed.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const report = detailQ.data;

  async function save(section: string, part: Omit<UpdateReportConfigPayload, 'expectedConfigVersion'>) {
    if (!report) return;
    setSaving(section);
    setError(null);
    setSaved(null);
    try {
      const result = await dynamicReportsApi.updateReportConfig(report.id, {
        expectedConfigVersion: report.configVersion,
        ...part,
      });
      setSaved(
        result.changed.length === 0
          ? 'Không có gì thay đổi.'
          : `Đã lưu: ${result.changed.map((c) => CHANGED_TEXT[c] ?? c).join(', ')}.`,
      );
      // Wait for fresh detail before remounting a section: its local state reads initial props only once.
      await queryClient.invalidateQueries({ queryKey: DETAIL_KEY(report.id) });
      if (section === 'info') {
        setName(null);
        setDescription(null);
      } else if (section === 'schedule' || section === 'teams') {
        setResets((r) => ({ ...r, [section]: r[section] + 1 }));
      }
      await queryClient.invalidateQueries({ queryKey: SETUP_LIST_KEY });
    } catch (err) {
      const e = extractApiError(err);
      setError({ message: e.message, conflict: e.code === 'REVISION_CONFLICT' || e.status === 409 });
    } finally {
      setSaving(null);
    }
  }

  async function reload() {
    await detailQ.refetch();
    setError(null);
    setName(null);
    setDescription(null);
    setResets((r) => ({ schedule: r.schedule + 1, teams: r.teams + 1 }));
  }

  const back = (
    <Link
      to={report ? `/bao-cao-dong/thiet-lap/${report.id}` : '/bao-cao-dong/thiet-lap'}
      className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {report ? 'Quay lại báo cáo' : 'Quay lại danh sách báo cáo'}
    </Link>
  );

  if (detailQ.isError) {
    return (
      <div className="max-w-4xl mx-auto p-6" data-testid="edit-error">
        {back}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được báo cáo này — có thể báo cáo đã bị xoá.</p>
        </div>
      </div>
    );
  }
  if (!report) {
    return (
      <p className="max-w-4xl mx-auto p-6 text-sm text-slate-500" data-testid="edit-loading">
        Đang tải…
      </p>
    );
  }
  if (report.status === 'ARCHIVED') {
    return (
      <div className="max-w-4xl mx-auto p-6" data-testid="edit-archived">
        {back}
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
          Báo cáo này đang được lưu trữ. Hãy khôi phục báo cáo trước khi sửa cấu hình.
        </p>
      </div>
    );
  }

  const currentName = name ?? report.name;
  const currentDescription = description ?? report.description ?? '';
  const infoChanged = currentName !== report.name || currentDescription !== (report.description ?? '');
  const teamNames = Object.fromEntries(report.targets.map((t) => [t.teamId, t.teamName]));
  const initialRoles: ReportRoleConfig[] = report.roles.map((r) => ({
    userId: r.userId,
    role: r.role,
    ...(r.teamScopeId ? { teamScopeId: r.teamScopeId } : {}),
  }));
  const initialTargets: ReportTargetConfig[] = report.targets.map((t) => ({
    teamId: t.teamId,
    editorUserIds: t.editors.map((e) => e.userId),
  }));

  return (
    <div className="max-w-4xl mx-auto p-6" data-testid="report-edit-page">
      {back}
      <h1 className="text-xl font-bold text-slate-800 mb-1">Sửa cấu hình — {report.name}</h1>
      <p className="text-sm text-slate-500 mb-4">
        Thay đổi lịch, tổ và người nhập áp dụng từ <b>kỳ kế tiếp</b>; kỳ đã sinh giữ nguyên (đổi người nhập của kỳ đang mở ở
        màn "Tổ" của kỳ đó). Quản lý và người xem có hiệu lực ngay. Muốn đổi file mẫu: <b>Cập nhật mẫu</b> ở trang báo cáo.
      </p>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-green-800" data-testid="edit-saved">
          <CheckCircle2 className="w-4 h-4" />
          {saved}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700" data-testid="edit-save-error">
          <p>{error.message}</p>
          {error.conflict && (
            <button
              type="button"
              data-testid="btn-reload"
              onClick={() => void reload()}
              className={`mt-2 px-3 py-1 border border-red-300 rounded-lg hover:bg-red-100 ${A11Y_FOCUS_RING}`}
            >
              Tải lại cấu hình mới nhất
            </button>
          )}
        </div>
      )}

      <Section title="Thông tin" testId="section-info">
        <label className="block text-sm mb-3">
          <span className="font-medium text-slate-700">
            Tên báo cáo <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            data-testid="edit-name"
            value={currentName}
            onChange={(e) => setName(e.target.value)}
            className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm mb-3">
          <span className="font-medium text-slate-700">Mô tả</span>
          <textarea
            data-testid="edit-description"
            value={currentDescription}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Mã báo cáo <span className="font-mono">{report.code}</span> không đổi được vì các file xuất và số liệu cũ dùng mã này.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            data-testid="btn-save-info"
            disabled={!infoChanged || !currentName.trim() || saving !== null}
            onClick={() => void save('info', { name: currentName.trim(), description: currentDescription })}
            className={`px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            {saving === 'info' ? 'Đang lưu…' : 'Lưu thông tin'}
          </button>
        </div>
      </Section>

      <Section title="Lịch báo cáo" hint="Áp dụng từ kỳ kế tiếp." testId="section-schedule-edit">
        {report.schedule ? (
          <ReportScheduleStep
            key={`schedule-${resets.schedule}`}
            initial={toScheduleRule(report.schedule)}
            nextLabel={saving === 'schedule' ? 'Đang lưu…' : 'Lưu lịch'}
            busy={saving !== null}
            onNext={(rule) =>
              void save('schedule', {
                schedule: {
                  periodType: rule.periodType,
                  periodStartDay: rule.periodStartDay,
                  dueRule: rule.due as unknown as Record<string, unknown>,
                  openRule: rule.open as unknown as Record<string, unknown>,
                  shiftNonWorking: rule.shiftNonWorking,
                  oneTimeDate: rule.oneTimeDate,
                },
              })
            }
          />
        ) : (
          <p className="text-sm text-slate-500">Báo cáo này chưa có lịch.</p>
        )}
      </Section>

      <Section
        title="Quản lý, tổ phải nộp và người nhập"
        hint="Quản lý và người xem có hiệu lực ngay; tổ và người nhập áp dụng từ kỳ kế tiếp."
        testId="section-teams-edit"
      >
        <ReportTeamsStep
          key={`teams-${resets.teams}`}
          initialRoles={initialRoles}
          initialTargets={initialTargets}
          teamNames={teamNames}
          nextLabel={saving === 'teams' ? 'Đang lưu…' : 'Lưu quản lý và tổ'}
          busy={saving !== null}
          onNext={(roles, targets) => void save('teams', { roles, targets })}
        />
      </Section>
    </div>
  );
}
