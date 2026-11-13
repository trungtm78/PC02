/** Vietnamese labels for the team lifecycle part of the admin screen (/to-nhom). */
export const teams = {
  tabs: {
    ACTIVE: 'Đang hoạt động',
    INACTIVE: 'Tạm ngừng',
    ARCHIVED: 'Đã lưu trữ',
  },
  emptyTab: {
    ACTIVE: 'Chưa có tổ nào đang hoạt động',
    INACTIVE: 'Không có tổ nào đang tạm ngừng',
    ARCHIVED: 'Không có tổ nào đã lưu trữ',
  },
  hint: {
    INACTIVE:
      'Tổ tạm ngừng không hiện ở ô chọn nào. Hồ sơ cũ vẫn hiện đúng tên tổ. Bấm "Hoạt động lại" để dùng tiếp.',
    ARCHIVED: 'Tổ đã lưu trữ bị ẩn khỏi mọi danh sách, dữ liệu vẫn giữ nguyên. Bấm "Khôi phục" để dùng lại.',
  },
  actions: {
    deactivate: 'Tạm ngừng',
    activate: 'Hoạt động lại',
    archive: 'Lưu trữ',
    restore: 'Khôi phục',
  },
  confirm: {
    deactivate: (name: string) =>
      `Tạm ngừng "${name}"? Tổ sẽ biến khỏi mọi ô chọn. Có thể bấm "Hoạt động lại" bất cứ lúc nào.`,
    archive: (name: string) =>
      `Lưu trữ "${name}"? Tổ được ẩn khỏi mọi danh sách, dữ liệu giữ nguyên. Có thể "Khôi phục".`,
  },
  statusFailed: 'Không đổi được trạng thái của tổ. Hãy thử lại.',
  delete: {
    action: 'Xoá',
    confirm: (name: string) => `Xoá hẳn "${name}"? Tổ chưa có dữ liệu nên xoá được, nhưng không khôi phục lại được.`,
    blockedTitle: (name: string) => `Chưa xoá được "${name}": tổ vẫn còn dữ liệu`,
    blockedHint: 'Có thể Lưu trữ để ẩn tổ khỏi mọi danh sách mà vẫn giữ dữ liệu. Muốn dồn dữ liệu sang tổ khác thì dùng Gộp.',
    close: 'Đóng',
    failed: 'Không xoá được tổ. Hãy thử lại.',
    /** What each table that refers to a team holds, in the words of the people who use the system. */
    sources: {
      calendar_events: 'lịch công tác',
      case_handoffs: 'lượt bàn giao vụ án',
      cases: 'vụ án',
      data_access_grants: 'uỷ quyền truy cập dữ liệu',
      dyn_report_assignments: 'lượt giao báo cáo',
      dyn_report_targets: 'báo cáo đang giao cho tổ',
      incident_handoffs: 'lượt bàn giao vụ việc',
      incidents: 'vụ việc',
      petitions: 'đơn thư',
      teams: 'tổ con',
      user_teams: 'thành viên',
    } as Record<string, string>,
    line: (count: number, what: string) => `${count} ${what}`,
  },
  merge: {
    action: 'Gộp…',
    title: (name: string) => `Gộp "${name}" vào tổ khác`,
    pick: 'Gộp vào tổ',
    pickPlaceholder: '— Chọn tổ nhận —',
    preview: 'Xem trước',
    confirm: 'Gộp',
    cancel: 'Huỷ',
    previewing: 'Đang đếm…',
    previewTitle: 'Khi gộp sẽ:',
    moved: (count: number, what: string) => `chuyển ${count} ${what} sang tổ nhận`,
    duplicates: (count: number, what: string) => `bỏ ${count} ${what} bị trùng (tổ nhận đã có)`,
    leaders: (count: number) => `giữ quyền trưởng nhóm cho ${count} người đã là thành viên ở cả hai tổ`,
    skippedTitle: 'Không chuyển (giữ nguyên ở tổ cũ):',
    skipped: {
      HISTORY: (count: number, what: string) => `${count} ${what}: lịch sử các kỳ đã sinh, không sửa lại`,
      TARGET_HAS_ONE: (count: number, what: string) => `${count} ${what}: tổ nhận đã có báo cáo này`,
      CLOSED: (count: number, what: string) => `${count} ${what}: đã kết thúc trước đây`,
    } as Record<string, (count: number, what: string) => string>,
    after: 'Tổ cũ sẽ được lưu trữ. Có thể Hoàn tác sau khi gộp.',
    nothing: 'Tổ cũ không có dữ liệu nào để chuyển.',
    done: (source: string, target: string) => `Đã gộp "${source}" vào "${target}".`,
    historyTitle: 'Các lần gộp gần đây',
    undo: 'Hoàn tác',
    undone: 'Đã hoàn tác',
    undoConfirm: (source: string, target: string) =>
      `Hoàn tác việc gộp "${source}" vào "${target}"? Những bản ghi đã bị sửa sau khi gộp sẽ được giữ nguyên.`,
    undoResult: (restored: number, skipped: number) =>
      skipped > 0
        ? `Đã khôi phục ${restored} bản ghi; ${skipped} bản ghi đã bị sửa sau khi gộp nên được giữ nguyên.`
        : `Đã khôi phục ${restored} bản ghi.`,
    failed: 'Không gộp được. Hãy thử lại.',
    undoFailed: 'Không hoàn tác được. Hãy thử lại.',
  },
  /** Server error codes the screen translates. */
  errors: {
    TEAM_INVALID_TRANSITION: 'Tổ đang ở trạng thái không cho phép thao tác này. Hãy tải lại danh sách.',
    TEAM_STATUS_UNKNOWN: 'Trạng thái yêu cầu không tồn tại.',
    TEAM_HAS_DATA: 'Tổ vẫn còn dữ liệu nên chưa xoá được.',
    TEAM_MERGE_SAME_TEAM: 'Không thể gộp một tổ vào chính nó.',
    TEAM_MERGE_TARGET_NOT_ACTIVE: 'Tổ nhận phải đang hoạt động.',
    TEAM_MERGE_CYCLE: 'Không thể gộp một tổ vào tổ con của nó.',
    TEAM_MERGE_NOT_UNDOABLE: 'Lần gộp này đã được hoàn tác hoặc không còn hoàn tác được.',
    TEAM_MERGE_UNSUPPORTED_REFERENCE: 'Hệ thống có dữ liệu mới liên quan tới tổ mà việc gộp chưa xử lý. Hãy báo quản trị kỹ thuật.',
  } as Record<string, string>,
};
