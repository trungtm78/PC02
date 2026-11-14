/** Vietnamese labels for "criteria picked from an Excel file" in the dynamic-report wizard, and the per-team checklist. */
import type { CriteriaMatrixError, SummaryMode } from '@/features/dynamic-reports/types';
import type { CellMark, CustomNote } from '@/features/dynamic-reports/views/types';

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
      MATRIX_VERSION_MISSING:
        'File này không ghi nó được tải về ở lần cấu hình nào (file tải từ bản cũ của hệ thống). Hãy tải ma trận về lại rồi sửa trên file mới.',
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
    fileStale:
      'File ma trận này được tải về trước lần thay đổi cấu hình gần nhất nên không dùng được nữa. Hãy tải ma trận về lại rồi sửa trên file mới.',
    fileMissing: 'Chưa chọn file. Hãy chọn file ma trận (.xlsx).',
  },
  customReport: {
    heading: 'Báo cáo tuỳ chọn',
    help: 'Chọn tiêu chí và tổ cần đưa vào báo cáo gửi cấp trên, xem trước trên màn hình rồi xuất Excel. Có thể lưu lại để dùng cho các kỳ sau.',
    create: 'Tạo báo cáo tuỳ chọn',
    loadError: 'Không tải được danh sách báo cáo tuỳ chọn.',
    retry: 'Thử lại',
    empty: 'Chưa có báo cáo tuỳ chọn nào được lưu. Bấm "Tạo báo cáo tuỳ chọn" để bắt đầu.',
    savedHeading: 'Báo cáo đã lưu',
    savedNote: 'Dùng chung cho những người quản lý báo cáo này.',
    changedBy: (name: string | null, time: string) => (name ? `Sửa lần cuối: ${name}, ${time}` : `Sửa lần cuối: ${time}`),
    viewSummary: (criteria: number | null, teams: number | null) =>
      `${criteria === null ? 'Tất cả tiêu chí' : `${criteria} tiêu chí`} · ${teams === null ? 'Tất cả tổ' : `${teams} tổ`}`,
    open: 'Mở',
    openTitle: 'Xem trước, sửa lựa chọn hoặc xuất báo cáo này',
    export: 'Xuất Excel',
    exporting: 'Đang xuất…',
    rename: 'Đổi tên',
    renameLabel: (name: string) => `Tên mới của báo cáo "${name}"`,
    renameSave: 'Lưu tên',
    archive: 'Lưu trữ',
    restore: 'Khôi phục',
    remove: 'Xoá',
    cancel: 'Huỷ',
    showArchived: (count: number) => `Xem ${count} báo cáo đã lưu trữ`,
    hideArchived: 'Ẩn báo cáo đã lưu trữ',
    archivedHeading: 'Đã lưu trữ',
    archivedTag: 'Đã lưu trữ',
    confirmDelete: (name: string) => `Xoá hẳn báo cáo tuỳ chọn "${name}"? Việc này không hoàn tác được. Nếu chỉ muốn cất đi, hãy dùng "Lưu trữ".`,
    confirmDeleteYes: 'Xoá hẳn',
    builder: {
      newHeading: 'Báo cáo tuỳ chọn mới',
      editHeading: (name: string) => `Báo cáo tuỳ chọn: ${name}`,
      name: 'Tên báo cáo',
      nameHint: 'Chỉ cần khi muốn lưu lại để dùng lần sau.',
      namePlaceholder: 'Ví dụ: Báo cáo gửi Ban Giám đốc',
      title: 'Tiêu đề',
      titleHint: 'Để trống thì hệ thống tự đặt tiêu đề.',
      autoTitleFallback: 'Hệ thống tự đặt theo tên báo cáo và kỳ',
      showFilterLine: 'Thêm dòng mô tả điều kiện lọc',
      teamColumns: 'Mỗi tổ một cột',
      loading: 'Đang tải danh sách tiêu chí và tổ…',
      listsError: 'Không tải được danh sách tiêu chí hoặc danh sách tổ của kỳ này.',
      criteriaSection: 'Tiêu chí đưa vào báo cáo',
      criteriaCount: (ticked: number, total: number) => `Đã chọn ${ticked}/${total}`,
      teamsSection: 'Tổ đưa vào báo cáo',
      teamsCount: (ticked: number, total: number) => `Đã chọn ${ticked}/${total} tổ`,
      teamSearch: 'Tìm tổ',
      teamAll: 'Chọn hết',
      teamNone: 'Bỏ hết',
      teamNoMatch: 'Không có tổ nào khớp.',
      teamFilteredNote: (shown: number) => `Đang lọc: hai nút trên chỉ áp cho ${shown} tổ đang hiện.`,
      teamGroupOf: (name: string) => `${name} và các tổ trực thuộc`,
      noCriteriaTicked: 'Chưa chọn tiêu chí nào. Hãy tích ít nhất một tiêu chí để xem trước, xuất hoặc lưu.',
      noTeamsTicked: 'Chưa chọn tổ nào. Hãy tích ít nhất một tổ để xem trước, xuất hoặc lưu.',
      nameNeeded: 'Hãy đặt tên báo cáo trước khi lưu.',
      archivedReason: 'Báo cáo này đang được lưu trữ. Hãy khôi phục trước khi sửa.',
      save: 'Lưu',
      saving: 'Đang lưu…',
      saveAsNew: 'Lưu thành bản mới',
      saveAsNewName: 'Tên của bản mới',
      saveAsNewConfirm: 'Lưu bản mới',
      copyName: (name: string) => `${name} (bản sao)`,
      close: 'Đóng',
      unsaved: 'Có thay đổi chưa lưu.',
    },
    preview: {
      heading: 'Xem trước',
      auto: 'Tự cập nhật sau mỗi lần đổi lựa chọn. File Excel xuất ra có đúng các số này.',
      loading: 'Đang tính số liệu…',
      error: 'Chưa xem trước được.',
      columns: { code: 'Mã', label: 'Tiêu chí', unit: 'ĐVT', total: 'Tổng' },
      partialTag: 'gồm cả tiêu chí không liệt kê',
      notesHeading: 'Ghi chú (sẽ in trong file):',
      filterLine: (input: {
        teamNames: readonly string[];
        teamsTotal: number;
        criteriaSelected: number;
        criteriaTotal: number;
        mode: string;
      }) => {
        const shown = input.teamNames.slice(0, 6).join(', ');
        const more = input.teamNames.length - 6;
        const units =
          input.teamNames.length === input.teamsTotal
            ? `tất cả ${input.teamsTotal} tổ`
            : `${shown}${more > 0 ? ` và ${more} tổ khác` : ''} (${input.teamNames.length}/${input.teamsTotal} tổ)`;
        return `Đơn vị: ${units} · Tiêu chí: ${input.criteriaSelected}/${input.criteriaTotal} · Số liệu: ${input.mode}`;
      },
      ignoredTeams: (names: string) => `Các tổ sau đã được chọn nhưng không được giao báo cáo trong kỳ này nên không có trong báo cáo: ${names}.`,
      ignoredCriteria: (count: number) => `${count} tiêu chí đã chọn không còn trong mẫu của kỳ này nên không có trong báo cáo.`,
      unknownTeam: 'tổ không còn trong hệ thống',
      newCriteria: (count: number) => `Có ${count} tiêu chí mới chưa được chọn. Muốn đưa vào báo cáo, hãy tích thêm ở danh sách tiêu chí rồi lưu.`,
    },
    modes: {
      SUBMITTED: 'đã nộp + đã duyệt',
      APPROVED: 'đã duyệt',
      ALL_SAVED: 'mọi số đã lưu (kể cả chưa nộp)',
    } as Record<SummaryMode, string>,
    /** What a cell without a figure shows; the same words as the Excel file. */
    marks: {
      NOT_ASSIGNED: () => '—',
      EXEMPT: () => 'miễn nộp',
      NOT_COUNTED: (mode: SummaryMode) => (mode === 'APPROVED' ? 'chưa duyệt' : 'chưa nộp'),
      BLANK: () => '',
      NOT_AGGREGATED: () => '',
    } as Record<CellMark, (mode: SummaryMode) => string>,
    notes: {
      PERIOD_OPEN: (p: { mode: string }) => `Kỳ báo cáo chưa khoá sổ: số liệu là số tạm tính (${p.mode}) và còn có thể thay đổi.`,
      GROUP_INCLUDES_UNLISTED: (p: { name: string; listed: number; total: number }) =>
        `Mục "${p.name}" là tổng của cả ${p.total} tiêu chí con, trong đó ${p.total - p.listed} tiêu chí không được liệt kê trong báo cáo này.`,
      ITEM_KEYS_IGNORED: (p: { count: number }) => `${p.count} tiêu chí đã chọn không còn trong mẫu của kỳ này nên không có trong báo cáo.`,
      TEAMS_IGNORED: (p: { count: number }) => `${p.count} tổ đã chọn không được giao báo cáo trong kỳ này nên không có trong báo cáo.`,
    },
    done: {
      created: (name: string) => `Đã lưu báo cáo tuỳ chọn "${name}".`,
      updated: (name: string) => `Đã lưu thay đổi của "${name}".`,
      renamed: (name: string) => `Đã đổi tên thành "${name}".`,
      archived: (name: string) => `Đã lưu trữ "${name}". Có thể khôi phục bất cứ lúc nào.`,
      restored: (name: string) => `Đã khôi phục "${name}".`,
      deleted: (name: string) => `Đã xoá "${name}".`,
      exported: (fileName: string) => `Đã xuất file ${fileName}.`,
    },
    conflictReloaded:
      'Người khác vừa sửa báo cáo này. Đã tải bản mới nhất; các lựa chọn trên màn hình vẫn được giữ nguyên. Kiểm tra lại rồi bấm "Lưu" lần nữa nếu vẫn muốn ghi.',
    conflictGone: 'Báo cáo này vừa bị người khác xoá. Các lựa chọn trên màn hình vẫn còn: bấm "Lưu" để lưu thành báo cáo mới.',
    errors: {
      VIEW_NAME_REQUIRED: 'Hãy đặt tên báo cáo trước khi lưu.',
      VIEW_NAME_TOO_LONG: 'Tên báo cáo quá dài (tối đa 120 ký tự).',
      VIEW_TITLE_TOO_LONG: 'Tiêu đề quá dài (tối đa 300 ký tự).',
      VIEW_SELECTION_EMPTY: 'Chưa chọn tiêu chí nào. Hãy tích ít nhất một tiêu chí.',
      VIEW_TEAMS_EMPTY: 'Chưa chọn tổ nào, hoặc không tổ nào đã chọn có trong kỳ này. Hãy tích ít nhất một tổ.',
      VIEW_ITEM_KEY_UNKNOWN: 'Có tiêu chí đã chọn không còn trong báo cáo. Hãy đóng bảng này, mở lại rồi chọn lại.',
      VIEW_TEAM_UNKNOWN: 'Có tổ đã chọn không còn trong hệ thống. Hãy đóng bảng này, mở lại rồi chọn lại.',
      CUSTOM_REPORT_TOO_LARGE: 'Báo cáo quá lớn để xuất ra một file Excel. Hãy bỏ bớt tiêu chí hoặc tổ, hoặc tắt "Mỗi tổ một cột".',
      REPORT_NOT_FOUND: 'Không tìm thấy báo cáo này, hoặc bạn không quản lý báo cáo này.',
      VIEW_NOT_FOUND: 'Báo cáo tuỳ chọn này không còn nữa (có thể người khác vừa xoá). Hãy tải lại trang.',
      PERIOD_NOT_FOUND: 'Không tìm thấy kỳ báo cáo này, hoặc bạn không quản lý báo cáo này.',
      VIEW_NAME_TAKEN: 'Đã có một báo cáo tuỳ chọn mang tên này. Hãy đặt tên khác.',
      REVISION_CONFLICT: 'Người khác vừa sửa báo cáo này. Danh sách đã được tải lại, hãy thử lại.',
      VIEW_ARCHIVED: 'Báo cáo này đang được lưu trữ. Hãy khôi phục trước khi sửa.',
      VIEW_ALREADY_ARCHIVED: 'Báo cáo này đã được lưu trữ từ trước.',
      VIEW_NOT_ARCHIVED: 'Báo cáo này đang được dùng, không cần khôi phục.',
      PERIOD_TEAMS_CHANGED: 'Danh sách tổ của kỳ vừa thay đổi trong lúc xuất. Hãy bấm "Xuất Excel" lần nữa.',
    } as Record<string, string>,
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
    case 'MATRIX_VERSION_MISSING':
      return t.MATRIX_VERSION_MISSING;
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

/** The message for a refused custom-report request: by the server's code when known, else what the server said. */
export function customReportErrorText(code: string | undefined, serverMessage: string): string {
  const known = reportCriteria.customReport.errors;
  if (code && Object.prototype.hasOwnProperty.call(known, code)) return known[code];
  // The server sends codes, not sentences: a code this screen does not know is never shown raw.
  return serverMessage && serverMessage !== code ? serverMessage : reportCriteria.errorFallback;
}

/** What a cell of a custom report shows when it has no figure (the words of the Excel file). */
export function customReportMarkText(mark: CellMark, mode: SummaryMode): string {
  return reportCriteria.customReport.marks[mark](mode);
}

/** One footnote of a custom report, in plain words. */
export function customReportNoteText(note: CustomNote): string {
  const t = reportCriteria.customReport;
  switch (note.code) {
    case 'PERIOD_OPEN':
      return t.notes.PERIOD_OPEN({ mode: t.modes[note.params.mode] });
    case 'GROUP_INCLUDES_UNLISTED':
      return t.notes.GROUP_INCLUDES_UNLISTED({
        name: [note.params.code, note.params.label].filter(Boolean).join(' '),
        listed: note.params.listed,
        total: note.params.total,
      });
    case 'ITEM_KEYS_IGNORED':
      return t.notes.ITEM_KEYS_IGNORED(note.params);
    case 'TEAMS_IGNORED':
      return t.notes.TEAMS_IGNORED(note.params);
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
