/**
 * "Sao chép cấu hình" — loads an existing report, then runs the creation wizard as a copy of it: the template file,
 * the input cells, the rules, the schedule and the teams are carried over, so a new report that is "the same, for
 * another month/unit" is a new code and name rather than a whole wizard from scratch.
 */
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import ReportTemplateUploadPage from './ReportTemplateUploadPage';

export default function ReportCopyPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const detailQ = useQuery({
    queryKey: ['dynamic-reports', 'detail', reportId ?? ''],
    queryFn: () => dynamicReportsApi.getReportDetail(reportId as string),
    enabled: !!reportId,
    // The wizard is long; a refetch in the middle of it must not reset what the person has typed.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (detailQ.isError) {
    return (
      <div className="max-w-3xl mx-auto p-6" data-testid="copy-error">
        <Link
          to="/bao-cao-dong/thiet-lap"
          className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách báo cáo
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được báo cáo gốc — có thể báo cáo đã bị xoá.</p>
        </div>
      </div>
    );
  }
  if (!detailQ.data) {
    return (
      <p className="max-w-3xl mx-auto p-6 text-sm text-slate-500" data-testid="copy-loading">
        Đang tải…
      </p>
    );
  }
  return <ReportTemplateUploadPage copyFrom={detailQ.data} />;
}
