/** Vietnamese labels for "criteria picked from an Excel file" in the dynamic-report wizard, and the per-team checklist. */
import type { CriteriaMatrixError } from '@/features/dynamic-reports/types';

export const reportCriteria = {
  start: {
    legend: 'Cách tạo mẫu báo cáo',
    template: 'Tải file mẫu Excel',
    criteria: 'Chọn tiêu chí từ file Excel',
    criteriaHint:
      'Tải một file Excel bất kỳ, chọn cột chứa tên tiêu chí. Hệ thống tự sinh mẫu báo cáo từ danh sách đó.',
  },
  picker: {
    fileLabel: 'File Excel chứa danh sách tiêu chí (.xlsx)',
    loading: 'Đang xử lý…',
    sheetLabel: 'Sheet chứa tiêu chí',
    sheetPlaceholder: '-- Chọn một sheet --',
    hidden: 'ẩn',
    gridHeading: 'Bấm vào chữ cái đầu cột để chọn cả cột, hoặc bấm/kéo chuột để chọn một số ô trong một cột',
    legend: 'Ô viền nét đứt: ô có nội dung, chọn được. Ô tô vàng: ô đã chọn. Giữ Ctrl để chọn thêm hoặc bỏ bớt ô.',
    selected: (count: number, column: string) => `Đã chọn ${count} ô ở cột ${column}`,
    wholeColumn: 'cả cột',
    nothingSelected: 'Chưa chọn ô nào.',
    switched: (column: string) =>
      `Các ô phải nằm trong cùng một cột. Đã chuyển sang cột ${column} và bỏ các ô chọn trước đó.`,
    clear: 'Bỏ chọn',
    columnHeaderTitle: (column: string) => `Chọn cả cột ${column}`,
    noGrid: 'Không vẽ được sheet này lên màn hình. Hãy gõ chữ cái của cột và khoảng dòng chứa tiêu chí.',
    manualColumn: 'Cột chứa tiêu chí (ví dụ: B)',
    manualFrom: 'Từ dòng',
    manualTo: 'Đến dòng',
    manualHint: 'Để trống hai ô dòng nếu lấy cả cột.',
    manualInvalid: 'Cột phải là 1–3 chữ cái; dòng phải là số, "đến dòng" không nhỏ hơn "từ dòng".',
    codeColumn: 'Cột mã / STT',
    unitColumn: 'Cột đơn vị tính',
    noColumn: 'Không có',
    hierarchy: 'Cấp cha–con',
    hierarchyNone: 'Không',
    hierarchyIndent: 'Theo thụt lề',
    hierarchyNumbering: 'Theo đánh số',
    extract: 'Đọc tiêu chí',
    extracting: 'Đang đọc…',
  },
  review: {
    heading: 'Danh sách tiêu chí',
    total: (count: number, parents: number) =>
      parents > 0
        ? `${count} tiêu chí, trong đó ${parents} tiêu chí cha (không nhập, tự cộng từ tiêu chí con).`
        : `${count} tiêu chí.`,
    name: 'Tên tiêu chí',
    unit: 'Đơn vị tính',
    nameOf: (row: number) => `Tên tiêu chí thứ ${row}`,
    unitOf: (row: number) => `Đơn vị tính của tiêu chí thứ ${row}`,
    remove: 'Xoá',
    removeOf: (name: string) => `Xoá tiêu chí ${name}`,
    manualTag: 'Thêm tay',
    parentTag: 'Tự cộng',
    sourceRow: (row: number) => `dòng ${row}`,
    nameRequired: 'Chưa có tên',
    blankSkipped: (rows: string) => `Đã bỏ qua các ô trống ở dòng: ${rows}.`,
    empty: 'Danh sách đang trống. Hãy thêm ít nhất một tiêu chí.',
    addHeading: 'Thêm tiêu chí',
    addName: 'Tên tiêu chí mới',
    addUnit: 'Đơn vị tính (không bắt buộc)',
    addParent: 'Thuộc tiêu chí cha',
    addNoParent: 'Không có cha',
    add: 'Thêm tiêu chí',
    use: 'Dùng danh sách này',
    using: 'Đang tạo mẫu…',
    needCodeName: 'Hãy nhập mã và tên báo cáo ở trên trước khi dùng danh sách.',
    needNames: 'Còn tiêu chí chưa có tên.',
    rereadNote: 'Đọc lại sẽ thay danh sách bên dưới (các chỗ đã sửa tay sẽ mất).',
  },
  used: {
    summary: (count: number, fileName: string) => `Mẫu được sinh từ ${count} tiêu chí (file ${fileName}).`,
    edit: 'Sửa danh sách tiêu chí',
  },
  warnings: {
    BLANK_SKIPPED: 'Ô trống, đã bỏ qua',
    DUPLICATE_NAME: 'Trùng tên với một tiêu chí ở trên',
    NAME_TRUNCATED: 'Tên quá dài, đã cắt bớt',
  } as Record<string, string>,
  errors: {
    CRITERIA_SHEET_NOT_FOUND: 'Không tìm thấy sheet đã chọn trong file. Hãy chọn lại sheet.',
    CRITERIA_COLUMN_INVALID: 'Cột không hợp lệ. Cột phải là chữ cái, ví dụ B.',
    CRITERIA_ROWS_INVALID: 'Dòng đã chọn không hợp lệ. Hãy chọn lại các ô.',
    CRITERIA_EMPTY: 'Không có tiêu chí nào. Các ô đã chọn đều trống, hoặc danh sách rỗng.',
    CRITERIA_TOO_MANY: 'Quá nhiều tiêu chí (tối đa 2.000). Hãy chọn ít ô hơn.',
    CRITERIA_NAME_REQUIRED: 'Có tiêu chí chưa có tên. Hãy điền tên hoặc xoá dòng đó.',
    CRITERIA_KEY_INVALID: 'Mã của một tiêu chí không hợp lệ. Hãy đọc lại tiêu chí từ file.',
    CRITERIA_KEY_DUPLICATE: 'Có hai tiêu chí trùng mã. Hãy xoá một trong hai rồi thêm lại.',
    CRITERIA_PARENT_UNKNOWN: 'Có tiêu chí thuộc một tiêu chí cha không còn trong danh sách.',
    CRITERIA_PARENT_CYCLE: 'Quan hệ cha–con bị vòng lặp. Hãy xem lại tiêu chí cha.',
    TARGET_SUBSET_EMPTY: 'Có tổ chưa được giao tiêu chí nào. Hãy quay lại bước chọn tổ và tích ít nhất một tiêu chí.',
    TARGET_ITEM_KEY_UNKNOWN:
      'Có tổ được giao tiêu chí không còn trong báo cáo. Hãy quay lại bước chọn tổ và kiểm tra lại.',
  } as Record<string, string>,
  errorFallback: 'Có lỗi xảy ra. Hãy thử lại.',
  teams: {
    section: 'Tiêu chí tổ này phải báo',
    count: (team: string, ticked: number, total: number) => `${team}: ${ticked}/${total} tiêu chí`,
    search: 'Tìm tiêu chí',
    all: 'Chọn hết',
    none: 'Bỏ hết',
    invert: 'Đảo chọn',
    filteredNote: (shown: number) => `Đang lọc: ba nút trên chỉ áp cho ${shown} tiêu chí đang hiện.`,
    noMatch: 'Không có tiêu chí nào khớp.',
    ungrouped: 'Tiêu chí khác',
    groupOf: (name: string) => `Cả nhóm ${name}`,
    copyFrom: 'Chép từ tổ…',
    copyPlaceholder: '-- Chọn tổ để chép --',
    applyToAll: 'Áp cho các tổ đang chọn',
    applied: (team: string, count: number) => `Đã áp tiêu chí của ${team} cho ${count} tổ còn lại.`,
    copied: (from: string) => `Đã chép tiêu chí từ ${from}.`,
    matrixShow: 'Xem dạng ma trận',
    matrixHide: 'Ẩn ma trận',
    matrixCaption: 'Tiêu chí từng tổ phải báo',
    matrixCriterion: 'Tiêu chí',
    matrixYes: 'có',
    matrixNo: 'không',
    emptyTeams: (teams: string) => `Chưa tích tiêu chí nào cho: ${teams}. Mỗi tổ phải báo ít nhất một tiêu chí.`,
  },
  officialFile: {
    title: 'File chính thức',
    hint: 'File Excel của kỳ đã chốt, được lưu lại không thời hạn.',
    making: 'Đang tạo file…',
    none: 'Kỳ này chưa có file chính thức.',
    make: 'Tạo file',
    current: 'Bản hiện hành',
    failed: 'Chưa tạo được file',
    superseded: 'Đã thay bằng bản mới',
    voided: 'Đã vô hiệu vì kỳ được mở lại',
    createdAt: (time: string) => `Tạo lúc ${time}`,
    download: 'Tải về',
    downloading: 'Đang tải…',
    remake: 'Tạo lại',
    remaking: 'Đang tạo…',
    confirmRemake: 'Tạo lại file chính thức? Bản hiện hành vẫn tải được, nhưng sẽ ghi là đã thay bằng bản mới.',
    loadError: 'Không tải được danh sách file chính thức.',
    retry: 'Thử lại',
    errors: {
      PERIOD_NOT_FINALIZED: 'Kỳ này chưa chốt nên chưa có file chính thức. Hãy chốt kỳ trước.',
      OFFICIAL_FILE_NOT_AVAILABLE: 'File này chưa tạo được nên không tải về được. Hãy bấm "Tạo lại".',
    } as Record<string, string>,
  },
  edit: {
    criteriaHint: 'Tiêu chí từng tổ phải báo cũng áp dụng từ kỳ kế tiếp.',
  },
  period: {
    action: 'Tiêu chí',
    title: (team: string) => `Tiêu chí phải báo trong kỳ này — ${team}`,
    hint: 'Chỉ áp dụng cho kỳ này. Số liệu đã nhập cho tiêu chí bị bỏ vẫn được giữ nhưng không còn được tính; tích lại thì được tính trở lại. Muốn trả về như cũ, tích lại các tiêu chí rồi lưu.',
    loading: 'Đang tải danh sách tiêu chí…',
    loadError: 'Không tải được danh sách tiêu chí của kỳ này.',
    retry: 'Thử lại',
    noCriteria: 'Mẫu của kỳ này không có tiêu chí nào để chọn.',
    reason: 'Lý do (bắt buộc)',
    reasonPlaceholder: 'Ví dụ: Tổ không còn phụ trách mảng này từ tháng 11',
    reasonRequired: 'Hãy ghi lý do trước khi lưu.',
    emptyTicks: 'Mỗi tổ phải báo ít nhất một tiêu chí. Muốn tổ không báo gì thì dùng "Miễn nộp".',
    save: 'Lưu',
    saving: 'Đang lưu…',
    cancel: 'Huỷ',
    saved: (team: string, ticked: number, total: number) => `Đã lưu: ${team} báo ${ticked}/${total} tiêu chí trong kỳ này.`,
    unchanged: (team: string) => `Tiêu chí của ${team} không có gì thay đổi.`,
    errors: {
      SUBMISSION_MUST_BE_RETURNED:
        'Bản nộp của tổ này đang chờ duyệt hoặc đã duyệt. Hãy trả lại bản nộp trước, rồi mới đổi tiêu chí.',
      TARGET_SUBSET_EMPTY: 'Mỗi tổ phải báo ít nhất một tiêu chí. Muốn tổ không báo gì thì dùng "Miễn nộp".',
      TARGET_ITEM_KEY_UNKNOWN: 'Có tiêu chí không còn trong mẫu của kỳ này. Hãy đóng bảng này, mở lại rồi chọn lại.',
      INVALID_STATE_TRANSITION: 'Kỳ này đã chốt nên không đổi được tiêu chí của tổ. Hãy mở lại kỳ trước.',
    } as Record<string, string>,
  },
  matrix: {
    heading: 'Ma trận tiêu chí bằng file Excel',
    hint: 'Tải ma trận về, sửa dấu tích trong Excel rồi nạp lại. Hệ thống cho xem trước, chưa đổi gì cho tới khi bấm "Áp dụng".',
    download: 'Tải ma trận Excel',
    downloading: 'Đang tải…',
    upload: 'Nạp ma trận Excel',
    reading: 'Đang đọc file…',
    fileLabel: 'File ma trận tiêu chí (.xlsx)',
    fallbackFileName: (code: string) => `ma-tran-tieu-chi-${code}.xlsx`,
    previewHeading: (fileName: string) => `Xem trước thay đổi từ file ${fileName}`,
    teamChange: (added: number, removed: number) => `+${added} tiêu chí, −${removed} tiêu chí`,
    teamUnchanged: 'không thay đổi',
    summary: (changed: number, total: number) => `${changed}/${total} tổ có thay đổi.`,
    nothingToApply: 'File này giống hệt cấu hình hiện tại, không có gì để áp dụng.',
    unsavedNote: 'Áp dụng sẽ tải lại phần tổ bên dưới: thay đổi chưa lưu ở đó sẽ mất.',
    apply: 'Áp dụng',
    applying: 'Đang áp dụng…',
    cancel: 'Huỷ',
    applied: (changed: number) => `Đã áp dụng ma trận cho ${changed} tổ. Thay đổi có hiệu lực từ kỳ kế tiếp.`,
    errorHeading: 'File chưa dùng được:',
    reload: 'Tải lại cấu hình mới nhất',
    errors: {
      MATRIX_NOT_RECOGNISED: 'Không nhận ra đây là file ma trận tiêu chí. Hãy tải ma trận về rồi sửa trên chính file đó.',
      MATRIX_TOO_LARGE: 'File quá lớn so với một ma trận tiêu chí. Hãy tải ma trận về rồi sửa trên chính file đó.',
      MATRIX_CRITERION_DUPLICATE: (row: number) => `Dòng ${row}: tiêu chí này đã có ở một dòng phía trên. Đừng chép thêm dòng tiêu chí.`,
      MATRIX_TEAM_DUPLICATE: (column: string) => `Cột ${column}: tổ này đã có ở một cột phía trước. Đừng chép thêm cột tổ.`,
      MATRIX_CELL_NOT_PLAIN: (cell: string) => `Ô ${cell}: chỉ gõ dấu "x" hoặc để trống, không dùng công thức và không gộp ô.`,
      MATRIX_CRITERION_UNKNOWN: (row: number) => `Dòng ${row}: tiêu chí này không có trong báo cáo. Đừng thêm hay sửa dòng tiêu chí.`,
      MATRIX_CRITERION_MISSING: (name: string) => `Thiếu dòng của tiêu chí "${name}". Đừng xoá dòng tiêu chí.`,
      MATRIX_TEAM_UNKNOWN: (column: string) => `Cột ${column}: tổ này không thuộc báo cáo. Đừng thêm hay sửa cột tổ.`,
      MATRIX_TEAM_MISSING: (name: string) => `Thiếu cột của tổ "${name}". Đừng xoá cột tổ.`,
      MATRIX_TEAM_EMPTY: (name: string) => `Tổ "${name}" chưa được tích tiêu chí nào. Mỗi tổ phải báo ít nhất một tiêu chí.`,
    },
    conflict: 'Cấu hình báo cáo vừa được người khác thay đổi. Hãy tải lại cấu hình mới nhất rồi nạp file lần nữa.',
    fileMissing: 'Chưa chọn file. Hãy chọn file ma trận (.xlsx).',
  },
  summary: {
    source: 'Nguồn mẫu',
    sourceCriteria: 'Sinh từ danh sách tiêu chí',
    perTeam: 'Tiêu chí từng tổ phải báo',
    teamLine: (team: string, ticked: number, total: number) => `${team}: ${ticked}/${total} tiêu chí`,
  },
};

/** The message for a refused criteria request: by the server's code when known, else what the server said. */
export function criteriaErrorText(code: string | undefined, serverMessage: string): string {
  if (code && Object.prototype.hasOwnProperty.call(reportCriteria.errors, code)) return reportCriteria.errors[code];
  return serverMessage || reportCriteria.errorFallback;
}

/** The message for a refused change of a team's criteria in a running period. */
export function periodCriteriaErrorText(code: string | undefined, serverMessage: string): string {
  const known = reportCriteria.period.errors;
  if (code && Object.prototype.hasOwnProperty.call(known, code)) return known[code];
  return serverMessage || reportCriteria.errorFallback;
}

/** One reason a criteria matrix file was refused, in plain words. `criterionName` names a criterion by its key. */
export function matrixErrorText(error: CriteriaMatrixError, criterionName: (itemKey: string) => string): string {
  const t = reportCriteria.matrix.errors;
  switch (error.code) {
    case 'MATRIX_NOT_RECOGNISED':
      return t.MATRIX_NOT_RECOGNISED;
    case 'MATRIX_TOO_LARGE':
      return t.MATRIX_TOO_LARGE;
    case 'MATRIX_CRITERION_DUPLICATE':
      return t.MATRIX_CRITERION_DUPLICATE(error.row);
    case 'MATRIX_TEAM_DUPLICATE':
      return t.MATRIX_TEAM_DUPLICATE(error.column);
    case 'MATRIX_CELL_NOT_PLAIN':
      return t.MATRIX_CELL_NOT_PLAIN(error.cell);
    case 'MATRIX_CRITERION_UNKNOWN':
      return t.MATRIX_CRITERION_UNKNOWN(error.row);
    case 'MATRIX_CRITERION_MISSING':
      return t.MATRIX_CRITERION_MISSING(criterionName(error.itemKey));
    case 'MATRIX_TEAM_UNKNOWN':
      return t.MATRIX_TEAM_UNKNOWN(error.column);
    case 'MATRIX_TEAM_MISSING':
      return t.MATRIX_TEAM_MISSING(error.name);
    case 'MATRIX_TEAM_EMPTY':
      return t.MATRIX_TEAM_EMPTY(error.name);
  }
}

export function criteriaWarningText(code: string): string {
  return reportCriteria.warnings[code] ?? code;
}

/** The message for a refused official-file request: by the server's code when known, else what the server said. */
export function officialFileErrorText(code: string | undefined, serverMessage: string): string {
  const known = reportCriteria.officialFile.errors;
  if (code && Object.prototype.hasOwnProperty.call(known, code)) return known[code];
  return serverMessage || reportCriteria.errorFallback;
}
