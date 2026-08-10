import { ArrowRight, Info, Paperclip } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Create mode has no case id yet, so there is nothing to attach a document to.
 *
 * The old media tab papered over that by accepting files, building local
 * metadata and reporting success — `documentIds` was never even sent. Saying so
 * is better than collecting files that go nowhere.
 */
export function CreateModeMediaNotice() {
  return (
    <div
      data-testid="create-mode-media-notice"
      className="rounded-lg border border-amber-200 bg-amber-50 p-6"
    >
      <div className="flex gap-3">
        <Paperclip className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="space-y-2">
          <p className="font-medium text-amber-900">
            Tài liệu được đính kèm sau khi lưu hồ sơ.
          </p>
          <p className="text-sm text-amber-800">
            Hồ sơ chưa tồn tại nên chưa có nơi để gắn tệp. Hãy lưu hồ sơ trước,
            rồi quay lại tab này để tải tài liệu lên &mdash; tệp sẽ được lưu
            ngay khi tải, không phải chờ bấm Lưu.
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const label = kind === 'subjects' ? 'đối tượng' : 'vật chứng';

  // The old editor covered four types; the detail page covers two of them.
  // Bị can lands on the defendants tab (which posts type SUSPECT) and Luật sư
  // on the lawyers tab. Bị hại and Nhân chứng of an existing case have no
  // screen at all — saying so beats sending somebody to a tab that cannot
  // create what they came for. Tracked as ND-16.
  const destinations =
    kind === 'subjects'
      ? [
          { tab: 'defendants', label: 'Bị can' },
          { tab: 'lawyers', label: 'Luật sư' },
        ]
      : [{ tab: 'evidence', label: 'Vật chứng' }];

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
            Màn hình này chỉ dùng khi <em>tạo mới</em> hồ sơ. Với hồ sơ đã có,
            hãy thêm hoặc sửa ở trang chi tiết &mdash; nội dung được lưu ngay,
            không phải chờ bấm Lưu ở đây.
          </p>
          <div className="flex flex-wrap gap-2">
            {destinations.map((d) => (
              <Link
                key={d.tab}
                to={`/cases/${caseId}`}
                state={{ activeTab: d.tab }}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Mở tab &ldquo;{d.label}&rdquo;
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
          {kind === 'subjects' && (
            <p className="text-sm text-blue-700">
              <strong>Lưu ý:</strong> hiện chưa có màn hình thêm{' '}
              <em>bị hại</em> và <em>nhân chứng</em> cho hồ sơ đã tạo &mdash;
              chỉ nhập được lúc tạo mới. Đang chờ bổ sung.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
