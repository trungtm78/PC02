/** Vietnamese labels for the scan-reading quality and cost screen (/admin/chat-luong-ocr). */
export const ocrQuality = {
  title: 'Chất lượng và chi phí đọc ảnh scan',
  subtitle:
    'Cán bộ giữ, sửa hay xoá các ô được điền từ ảnh, và chi phí các lượt gọi nhà cung cấp. Chỉ có số đếm: không lưu và không hiện nội dung đọc từ ảnh.',
  loading: 'Đang tải…',
  failed: 'Không tải được thống kê. Hãy thử lại.',
  forbidden: 'Tài khoản không có quyền xem thống kê này.',
  noData: 'Chưa có dữ liệu trong kỳ này.',
  budget: (used: string, cap: string, percent: number, level: string) =>
    level === 'EXHAUSTED'
      ? `Ngân sách tháng đã hết (${used} / ${cap}, ${percent}%): việc đọc ảnh đã dừng cho tới tháng sau hoặc khi quản trị viên nâng trần.`
      : level === 'WARN'
        ? `Ngân sách tháng sắp hết: đã dùng ${used} / ${cap} (${percent}%).`
        : `Ngân sách tháng: đã dùng ${used} / ${cap} (${percent}%).`,
  unpriced: (n: number) =>
    `${n} lượt đọc trong tháng chưa tính được chi phí vì nhà cung cấp chưa khai đơn giá, nên số đã dùng ở trên thấp hơn thực tế. Hãy nhập đơn giá ở màn Cấu hình LLM để trần ngân sách có tác dụng.`,
  modelsHeading: 'Theo model: tỉ lệ ô được giữ nguyên',
  worstHeading: 'Các ô bị sửa hoặc xoá nhiều nhất',
  costHeading: 'Chi phí và lỗi theo model',
  model: 'Model',
  field: 'Ô',
  fieldsSeen: 'Số ô',
  kept: 'Giữ nguyên',
  edited: 'Đã sửa',
  cleared: 'Đã xoá',
  corrected: 'Bị sửa hoặc xoá',
  calls: 'Lượt gọi',
  failedCalls: 'Lỗi',
  images: 'Ảnh gửi đi',
  tokens: 'Token vào / ra',
  cost: 'Chi phí ước tính',
  costNote: 'Chi phí tính theo đơn giá quản trị viên đã nhập; model chưa nhập đơn giá được tính 0.',
};
