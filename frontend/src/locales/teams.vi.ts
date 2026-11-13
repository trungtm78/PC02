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
  /** Server error codes the screen translates. */
  errors: {
    TEAM_INVALID_TRANSITION: 'Tổ đang ở trạng thái không cho phép thao tác này. Hãy tải lại danh sách.',
    TEAM_STATUS_UNKNOWN: 'Trạng thái yêu cầu không tồn tại.',
  } as Record<string, string>,
};
