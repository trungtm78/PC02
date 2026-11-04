/**
 * Vietnamese labels for entering a record from scanned images (the drawer on the Petition / Incident / Case form).
 *
 * The server sends stable codes, never display text; every code a request or a reading can fail with is translated
 * here. Re-exported from `vi.ts` so call sites keep using the single `@/locales/vi` entry.
 */
export const ocrImport = {
  open: 'Nhập từ ảnh scan',
  openHint: 'Chọn ảnh scan của đơn, hệ thống đọc rồi điền vào form để anh/chị kiểm tra',
  title: 'Nhập từ ảnh scan',
  intro:
    'Chọn các trang của MỘT bộ hồ sơ. Hệ thống đọc, phân tích rồi điền vào form; anh/chị kiểm tra từng ô rồi tự bấm Lưu. Hệ thống không bao giờ tự lưu.',
  pickFiles: 'Chọn ảnh (JPEG, PNG, WebP) hoặc tệp PDF',
  dropHint: 'hoặc kéo thả ảnh vào đây',
  pagesHeading: 'Các trang',
  pageLabel: (n: number) => `Trang ${n}`,
  moveUp: 'Chuyển lên',
  moveDown: 'Chuyển xuống',
  removePage: 'Bỏ trang này',
  uploading: 'Đang tải ảnh lên…',
  read: 'Đọc và điền vào form',
  reread: 'Đọc lại từ ảnh',
  reanalyse: 'Phân tích lại từ bản chép',
  reading: 'Đang đọc và phân tích, có thể mất vài chục giây…',
  cancel: 'Huỷ và xoá ảnh đã tải',
  close: 'Đóng',
  done: 'Đã điền vào form. Hãy kiểm tra các ô, ô màu cam cần bấm Xác nhận.',
  noPages: 'Chưa có trang nào.',
  reviewHeading: 'Đối chiếu ảnh và bản chép',
  transcript: 'Bản chép',
  editedByOfficer: 'Đã sửa bởi cán bộ',
  saveCorrection: 'Lưu bản sửa',
  imageFailed: 'Không tải được ảnh trang này.',
  openReview: 'Đối chiếu ảnh và sửa bản chép',
  draftScansUnavailable:
    'Bản nháp này có ảnh scan đã hết hạn hoặc nội dung đã đổi nên không điền lại được. Các ô anh/chị tự nhập vẫn còn; hãy chọn ảnh và đọc lại nếu cần.',
  rereadOpen: 'Đọc lại từ ảnh scan',
  rereadClose: 'Đóng so sánh',
  rereadReading: 'Đang đọc lại các ảnh đính kèm, có thể mất vài chục giây…',
  rereadHint:
    'Các ô dưới đây khác với hồ sơ hiện tại. Chọn "Dùng giá trị từ ảnh" để đưa vào form (chưa lưu), rồi bấm Lưu như thường.',
  rereadNothingDiffers: 'Mọi ô đọc được đều khớp với hồ sơ.',
  rereadSame: (n: number) => `${n} ô khớp với ảnh`,
  rereadCurrent: 'Hiện có trong hồ sơ',
  rereadFromImage: 'Đọc được từ ảnh',
  rereadEmpty: '(trống)',
  rereadUse: 'Dùng giá trị từ ảnh',
  rereadKeep: 'Giữ giá trị hiện tại',
  summaryHeading: 'Tóm tắt nội dung',
  issuesHeading: 'Điểm cần xem lại',
  issuesCount: (n: number) => `${n} điểm hệ thống nghi ngờ`,
  autoCheckNote: 'Kiểm tra tự động, không thay việc đọc.',
  filledBar: (filled: number, toConfirm: number) =>
    `Đã điền ${filled} ô · ${toConfirm} ô cần xác nhận`,
  undo: 'Hoàn tác phần điền từ ảnh',
  undoConflicts: (fields: string) =>
    `Giữ nguyên các ô anh/chị đã sửa sau khi điền: ${fields}`,
  fromImage: 'Từ ảnh',
  fromPage: (p: string) => `trang ${p}`,
  inferred: 'Hệ thống suy ra, không có trong đơn',
  confirm: 'Xác nhận',
  confirmed: 'Đã xác nhận',
  needsConfirm: 'Cần xác nhận',
  skippedHeading: 'Ô đã có nội dung, giữ nguyên',
  skippedUse: 'Dùng giá trị từ ảnh',
  saveBlocked: (n: number) =>
    `Còn ${n} ô lấy từ ảnh chưa xác nhận. Hãy kiểm tra các ô màu cam trước khi lưu.`,
  errors: {
    NETWORK: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    HTTP_413: 'Ảnh quá lớn (tối đa 20 MB mỗi ảnh).',
    OCR_IMAGE_UNSUPPORTED: 'Định dạng ảnh chưa hỗ trợ. Dùng JPEG, PNG hoặc WebP (ảnh HEIC cần đổi sang JPEG).',
    OCR_IMAGE_TOO_LARGE: 'Ảnh quá lớn hoặc có quá nhiều điểm ảnh.',
    OCR_PDF_ENCRYPTED: 'Tệp PDF có mật khẩu. Hãy bỏ mật khẩu hoặc tải ảnh chụp từng trang.',
    OCR_PDF_UNREADABLE: 'Không mở được tệp PDF này, có thể tệp bị hỏng.',
    OCR_PDF_TOO_MANY_PAGES: 'Tệp PDF có quá nhiều trang (tối đa 20 trang mỗi bộ hồ sơ).',
    OCR_PDF_TOO_COMPLEX: 'Tệp PDF quá phức tạp hoặc quá nặng để xử lý. Hãy tải ảnh chụp từng trang.',
    UNSUPPORTED_INPUT: 'Nhà cung cấp nội bộ chưa đọc được PDF. Hãy tải ảnh (JPEG, PNG) hoặc dùng nhà cung cấp khác.',
    OCR_IMAGE_UNREADABLE: 'Không mở được tệp ảnh này, có thể tệp bị hỏng.',
    OCR_PAGE_DUPLICATE: 'Ảnh này đã có trong bộ hồ sơ.',
    OCR_TOO_MANY_PAGES: 'Bộ hồ sơ đã đủ số trang tối đa.',
    OCR_SESSION_NOT_FOUND: 'Phiên đọc ảnh không còn. Hãy chọn ảnh lại.',
    OCR_SESSION_CLOSED: 'Phiên đọc ảnh đã đóng. Hãy chọn ảnh lại.',
    OCR_NO_PAGES: 'Chưa có trang nào để đọc.',
    OCR_INPUT_CHANGED:
      'Trang hoặc bản chép đã thay đổi trong lúc đọc, kết quả không còn đúng. Hãy bấm đọc lại.',
    OCR_TRANSCRIPT_MISSING: 'Có trang chưa được đọc. Hãy bấm đọc lại từ ảnh.',
    OCR_FORBIDDEN: 'Tài khoản chưa được phép gửi ảnh tới nhà cung cấp đọc ảnh. Liên hệ quản trị viên.',
    LLM_NO_PROVIDER:
      'Chưa có nhà cung cấp đọc ảnh nào sẵn sàng. Quản trị viên cần cấu hình và kiểm thử khoá API (Cấu hình LLM).',
    LLM_QUOTA_EXCEEDED: 'Đã hết số trang được đọc trong ngày của tài khoản này.',
    LLM_BUDGET_EXHAUSTED: 'Ngân sách đọc ảnh của tháng đã hết. Liên hệ quản trị viên.',
    AUTH: 'Khoá API của nhà cung cấp bị từ chối. Liên hệ quản trị viên.',
    RATE_LIMIT: 'Nhà cung cấp đang quá tải. Hệ thống sẽ tự thử lại; nếu vẫn lỗi hãy bấm đọc lại sau ít phút.',
    TIMEOUT: 'Nhà cung cấp trả lời quá chậm. Hãy bấm đọc lại.',
    SERVER: 'Nhà cung cấp đang gặp sự cố. Hãy bấm đọc lại sau ít phút.',
    BAD_JSON: 'Kết quả đọc không đúng định dạng. Hãy bấm đọc lại.',
    OUTPUT_LIMIT:
      'Model đọc ảnh không trả được bản phân tích dài như thế này. Hãy chia bộ hồ sơ thành ít trang hơn hoặc nhờ quản trị viên chọn model khác (Cấu hình LLM).',
    REFUSED: 'Nhà cung cấp từ chối đọc nội dung này.',
    MODEL_UNAVAILABLE: 'Model đọc ảnh không còn dùng được. Liên hệ quản trị viên.',
    BLOCKED: 'Địa chỉ máy chủ đọc ảnh nội bộ không được phép. Liên hệ quản trị viên.',
    INTERNAL: 'Có lỗi khi đọc ảnh. Hãy bấm đọc lại.',
  } as Readonly<Record<string, string>>,
  errorFallback: (code: string) => `Không đọc được ảnh (mã lỗi ${code}). Hãy bấm đọc lại.`,
};

export const ocrErrorText = (code: string): string =>
  ocrImport.errors[code] ?? ocrImport.errorFallback(code);
