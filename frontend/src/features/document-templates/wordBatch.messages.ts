export const wordBatchMessages = {
  fallbackFilename: 'ChungTu_batch.zip',
  failed: 'Xuất Word đồng loạt thất bại. Vui lòng thử lại.',
  success: (ok: number, total: number, filename: string) =>
    `Đã xuất ${ok}/${total} file — ${filename}`,
  partial: (ok: number, total: number, filename: string) =>
    `Đã xuất ${ok}/${total} file — ${filename}. Xem manifest.json trong ZIP để biết chi tiết lỗi.`,
} as const;
