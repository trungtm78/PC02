import { ArrowRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Shown instead of the local-state editors when the case already exists.
 *
 * Those editors only ever fed `POST /cases`. In edit mode the rows went into
 * component state, got sent to `PUT /cases/:id`, and were dropped on the floor
 * — the officer saw "Cập nhật hồ sơ thành công" and the entry was gone. The
 * form no longer sends them, so leaving the editors visible would move the same
 * silent loss from the server to the browser.
 *
 * The detail page tabs write through the real endpoints, so that is where this
 * points.
 */
export function EditModeSubEntityNotice({
  caseId,
  kind,
}: {
  caseId: string;
  kind: 'subjects' | 'evidence';
}) {
  const label = kind === 'subjects' ? 'bị can' : 'vật chứng';
  const tabLabel = kind === 'subjects' ? 'Bị can' : 'Vật chứng';

  return (
    <div
      data-testid={`edit-mode-notice-${kind}`}
      className="rounded-lg border border-blue-200 bg-blue-50 p-6"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="space-y-3">
          <p className="font-medium text-blue-900">
            Danh sách {label} của hồ sơ đã tạo được quản lý ở trang chi tiết.
          </p>
          <p className="text-sm text-blue-800">
            Màn hình này chỉ dùng để nhập {label} khi <em>tạo mới</em> hồ sơ.
            Với hồ sơ đã có, hãy thêm hoặc sửa ở tab &ldquo;{tabLabel}&rdquo;
            &mdash; nội dung sẽ được lưu ngay, không phải chờ bấm Lưu ở đây.
          </p>
          <Link
            to={`/cases/${caseId}`}
            state={{ activeTab: kind === 'subjects' ? 'defendants' : 'evidence' }}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Mở tab &ldquo;{tabLabel}&rdquo;
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
