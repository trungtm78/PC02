import { processingFlow as L } from '@/locales/processingFlow.vi';
import { formatVNDate } from '@/lib/dates';
import type { VersionSummaryDto } from '../types';

const V = L.versions;

/** "Lịch sử phiên bản": newest first, with who published each and when. */
export function VersionHistoryPanel({ versions, userName }: { versions: VersionSummaryDto[]; userName: (id: string | null) => string | null }) {
  return (
    <section data-testid="editor-history" className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-slate-50 p-3">
      <h2 className="text-sm font-semibold text-slate-800">{V.title}</h2>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
              <th className="px-2.5 py-2">{V.columns.version}</th>
              <th className="px-2.5 py-2">{V.columns.status}</th>
              <th className="px-2.5 py-2">{V.columns.publishedBy}</th>
              <th className="px-2.5 py-2">{V.columns.date}</th>
              <th className="px-2.5 py-2 text-right">{V.columns.steps}</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} data-testid={`history-row-${v.versionNo}`} className="border-t border-slate-100">
                <td className="px-2.5 py-1.5 tabular-nums">{v.versionNo}</td>
                <td className="px-2.5 py-1.5">{L.editor.versionStatus[v.status] ?? v.status}</td>
                <td className="px-2.5 py-1.5">{v.publishedAt ? (userName(v.publishedById) ?? V.unknownUser) : V.notPublished}</td>
                <td className="px-2.5 py-1.5">{formatVNDate(v.publishedAt ?? v.createdAt)}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">{v.stepCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{V.footnote}</p>
    </section>
  );
}
