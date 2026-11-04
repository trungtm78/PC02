/**
 * Vietnamese labels for the LLM provider administration screen (/admin/cau-hinh-llm).
 *
 * The server sends stable codes, never display text; every code a request can fail with is translated here.
 * Re-exported from `vi.ts` so call sites keep using the single `@/locales/vi` entry.
 */
export const llmConfig = {
  title: 'Cấu hình LLM đọc ảnh scan',
  subtitle:
    'Nhà cung cấp mô hình ngôn ngữ dùng để đọc ảnh scan đơn thư, vụ việc, vụ án. Khoá API được mã hoá và không bao giờ hiện lại sau khi lưu.',
  loading: 'Đang tải cấu hình…',
  loadFailed: 'Không thể tải cấu hình LLM. Danh sách bên dưới chưa đáng tin cho tới khi tải lại thành công.',
  retry: 'Thử lại',
  featureOff:
    'Tính năng “Nhập từ ảnh scan” đang tắt. Bật cờ tính năng ocr_import trong Quản trị → Tính năng để cấu hình và dùng.',
  forbidden: 'Bạn không có quyền xem cấu hình LLM.',
  keyNotConfigured:
    'Máy chủ chưa có khoá mã hoá LLM_KEY_ENCRYPTION_KEY nên chưa thể lưu khoá API. Xem docs/KEY-ROTATION.md, mục 6.',
  genericFailure: 'Thao tác không thành công. Vui lòng thử lại.',
  dismiss: 'Đóng thông báo',

  defaultLabels: {
    ANTHROPIC: 'Claude',
    GEMINI: 'Gemini',
    OPENAI: 'OpenAI',
    SELF_HOSTED: 'Máy chủ nội bộ',
  } as Record<string, string>,

  setup: {
    title: 'Các bước cài đặt',
    intro: 'Làm lần lượt từ trên xuống. Bước đang chờ được tô đậm, bấm nút bên cạnh để làm ngay.',
    allDone: 'Đã cài đặt xong. Mở màn tạo Đơn thư, Vụ việc hoặc Vụ án để thử “Nhập từ ảnh scan”.',
    next: 'Việc tiếp theo',
    steps: {
      KEY: 'Máy chủ có khoá mã hoá khoá API',
      PROVIDER: 'Thêm một nhà cung cấp (khoá API và model)',
      TEST: 'Kiểm thử khoá đạt',
      ACTIVE: 'Đặt một nhà cung cấp là “Đang dùng”',
    } as Record<string, string>,
    keyHelp: 'Cần quản trị hệ thống đặt LLM_KEY_ENCRYPTION_KEY trên máy chủ (docs/KEY-ROTATION.md, mục 6), rồi tải lại trang.',
    actions: {
      PROVIDER: 'Thêm nhà cung cấp đầu tiên',
      TEST: 'Kiểm thử ngay',
      ACTIVE: 'Dùng nhà cung cấp này',
    } as Record<string, string>,
  },

  smallModel:
    'Model nhỏ (Haiku) đọc chữ viết tay kém: thử trên giấy tờ thật cho kết quả sai cấu trúc ở phần lớn các bộ. Nên chọn Sonnet trở lên hoặc Gemini Flash.',

  providers: {
    title: 'Nhà cung cấp',
    add: 'Thêm nhà cung cấp',
    empty: 'Chưa có nhà cung cấp nào. Thêm một nhà cung cấp, kiểm thử khoá, rồi đặt “Đang dùng”.',
    showArchived: 'Hiện cả nhà cung cấp đã lưu trữ',
    columns: {
      label: 'Tên',
      kind: 'Loại',
      model: 'Model',
      key: 'Khoá',
      test: 'Kiểm thử',
      role: 'Vai trò',
      actions: 'Thao tác',
    },
    archivedTag: 'Đã lưu trữ',
    cloudTag: 'Đám mây',
    ownTag: 'Nội bộ',
  },

  kinds: {
    ANTHROPIC: 'Anthropic (Claude)',
    GEMINI: 'Google Gemini',
    OPENAI: 'OpenAI',
    SELF_HOSTED: 'Máy chủ nội bộ (tương thích OpenAI)',
  } as Record<string, string>,

  roles: {
    PRIMARY: 'Đang dùng',
    FALLBACK: 'Dự phòng',
    OFF: 'Tắt',
  } as Record<string, string>,

  testBadge: {
    NEVER: 'Chưa kiểm thử',
    PASSED: 'Đạt',
    OUTDATED: 'Đạt, nhưng cấu hình đã đổi',
    FAILED: 'Không đạt',
  } as Record<string, string>,

  actions: {
    test: 'Kiểm thử',
    testing: 'Đang kiểm thử…',
    edit: 'Sửa',
    archive: 'Lưu trữ',
    restore: 'Khôi phục',
    remove: 'Xoá',
    removeConfirm: 'Xoá hẳn nhà cung cấp này? Nhật ký các lần đã gọi vẫn được giữ.',
    archiveConfirm: 'Lưu trữ nhà cung cấp này? Vai trò sẽ về “Tắt”.',
    roleNeedsTest: 'Cần kiểm thử đạt với đúng khoá, model và địa chỉ đang lưu trước khi gán vai trò.',
    use: 'Dùng nhà cung cấp này',
    using: 'Đang xử lý…',
    nowInUse: (label: string) => `Đã đặt “${label}” là nhà cung cấp đang dùng. Có thể thử “Nhập từ ảnh scan” ngay.`,
  },

  form: {
    createTitle: 'Thêm nhà cung cấp',
    editTitle: 'Sửa nhà cung cấp',
    kind: 'Loại nhà cung cấp',
    kindLocked: 'Không đổi được loại sau khi tạo.',
    kindNotSupported: 'Loại này chưa được hỗ trợ ở phiên bản hiện tại: có thể lưu cấu hình nhưng chưa kiểm thử hay dùng được.',
    label: 'Tên hiển thị',
    apiKey: 'Khoá API',
    apiKeyKeep: 'Để trống để giữ khoá hiện tại',
    apiKeySaved: (last4: string) => `Khoá hiện tại kết thúc bằng ${last4}`,
    baseUrl: 'Địa chỉ máy chủ',
    baseUrlHint: 'Ví dụ http://10.0.0.5:8000/v1',
    model: 'Model',
    modelPlaceholder: 'Nhập tên model hoặc tải danh sách',
    loadModels: 'Tải danh sách model',
    loadingModels: 'Đang tải…',
    modelsLoaded: (count: number) => `Đã tải ${count} model từ nhà cung cấp.`,
    dataRegion: 'Vùng xử lý dữ liệu',
    zeroRetention: 'Nhà cung cấp cam kết không lưu dữ liệu',
    inputPrice: 'Giá vào (USD / 1 triệu token)',
    outputPrice: 'Giá ra (USD / 1 triệu token)',
    priceHint: 'Dùng để tính chi phí và trần chi tiêu tháng. Để trống nghĩa là “chưa biết”, không phải miễn phí.',
    cloudNotice:
      'Nhà cung cấp này ở nước ngoài: dữ liệu ảnh sẽ rời máy chủ PC02.',
    testDraft: 'Kiểm thử khoá',
    save: 'Lưu',
    saving: 'Đang lưu…',
    cancel: 'Huỷ',
  },

  testSteps: {
    NETWORK: 'Kết nối mạng',
    KEY: 'Khoá API',
    MODEL: 'Model',
    READ_IMAGE: 'Đọc ảnh tiếng Việt',
    SCHEMA: 'Trả JSON đúng cấu trúc',
  } as Record<string, string>,

  testResult: {
    passed: 'Kiểm thử đạt cả năm bước.',
    failed: 'Kiểm thử không đạt.',
    summary: (ms: number, input: number, output: number) =>
      `${ms} ms · ${input} token vào · ${output} token ra`,
  },

  testCodes: {
    NETWORK:
      'Không kết nối được tới nhà cung cấp. Nếu máy chủ PC02 chặn đường ra Internet, cần mở đường tới host của nhà cung cấp.',
    TIMEOUT: 'Nhà cung cấp trả lời quá chậm.',
    AUTH: 'Khoá bị từ chối: sai, đã thu hồi hoặc không có quyền.',
    RATE_LIMIT: 'Nhà cung cấp đang giới hạn số lần gọi. Thử lại sau ít phút.',
    SERVER: 'Nhà cung cấp đang lỗi hoặc quá tải. Thử lại sau.',
    BAD_REQUEST: 'Nhà cung cấp từ chối yêu cầu thử (model hoặc cấu hình không hợp lệ).',
    BAD_JSON: 'Nhà cung cấp trả về kết quả không đọc được.',
    REFUSED: 'Mô hình từ chối trả lời.',
    BLOCKED:
      'Địa chỉ máy chủ không được phép (địa chỉ nội bộ đặc biệt như 169.254.x.x, hoặc tên miền không phân giải được). Kiểm tra lại địa chỉ.',
    MODEL_NOT_FOUND: 'Model này không có trong danh sách của nhà cung cấp.',
    MODEL_UNAVAILABLE: 'Model này không còn hoặc không truy cập được. Chọn model khác cho nhà cung cấp.',
    READ_MISMATCH:
      'Mô hình gọi được nhưng đọc sai ảnh thử tiếng Việt: không nên dùng model này để đọc giấy tờ.',
    SCHEMA_MISMATCH: 'Mô hình không trả đúng cấu trúc dữ liệu yêu cầu.',
    SKIPPED: 'Bỏ qua vì bước trước không đạt.',
    LLM_PROVIDER_KIND_UNSUPPORTED: 'Loại nhà cung cấp này chưa được hỗ trợ.',
  } as Record<string, string>,

  violations: {
    LABEL_REQUIRED: 'Tên hiển thị không được để trống.',
    MODEL_REQUIRED: 'Chưa chọn model.',
    API_KEY_INVALID: 'Khoá API không hợp lệ (quá ngắn hoặc có khoảng trắng).',
    BASE_URL_NOT_ALLOWED: 'Loại này có địa chỉ cố định, không nhập địa chỉ máy chủ.',
    BASE_URL_REQUIRED: 'Máy chủ nội bộ cần địa chỉ máy chủ.',
    BASE_URL_INVALID: 'Địa chỉ máy chủ phải là http(s), không kèm tài khoản, tham số hay đoạn #.',
  } as Record<string, string>,

  roleBlocked: {
    ARCHIVED: 'Nhà cung cấp đã lưu trữ.',
    NOT_TESTED: 'Cần kiểm thử đạt với đúng khoá, model và địa chỉ đang lưu.',
  } as Record<string, string>,

  errors: {
    LLM_KEY_NOT_CONFIGURED: 'Máy chủ chưa cấu hình khoá mã hoá LLM.',
    LLM_PROVIDER_INVALID: 'Thông tin nhà cung cấp chưa hợp lệ.',
    LLM_PROVIDER_NOT_FOUND: 'Không tìm thấy nhà cung cấp.',
    LLM_PROVIDER_ARCHIVED: 'Nhà cung cấp đã lưu trữ. Hãy khôi phục trước khi sửa.',
    LLM_PROVIDER_KIND_UNSUPPORTED: 'Loại nhà cung cấp này chưa được hỗ trợ ở phiên bản hiện tại.',
    LLM_PROVIDER_IN_USE: 'Nhà cung cấp đang giữ vai trò. Chuyển về “Tắt” hoặc lưu trữ trước khi xoá.',
    LLM_ROLE_BLOCKED: 'Chưa thể gán vai trò.',
    LLM_PROVIDER_CALL_FAILED: 'Nhà cung cấp trả lỗi khi lấy danh sách model.',
  } as Record<string, string>,
} as const;
