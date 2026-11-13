/** Vietnamese labels for "criteria picked from an Excel file" in the dynamic-report wizard, and the per-team checklist. */
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

export function criteriaWarningText(code: string): string {
  return reportCriteria.warnings[code] ?? code;
}
