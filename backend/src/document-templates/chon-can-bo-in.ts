/**
 * Những cột của cán bộ mà bộ in CẦN — khai MỘT chỗ, dùng ở mọi bộ nạp phục vụ xuất chứng từ.
 *
 * ── Vì sao phải gom về một chỗ ──
 *
 * Bộ tra giá trị đọc `enteredBy.shortName` để in dòng "Lưu:". Nhưng bộ nạp lại tự khai danh
 * sách cột riêng ở từng service, và cả ba đều quên `shortName` — nên bản vá tên viết tắt xanh
 * hết ca kiểm mà lên máy thật KHÔNG có tác dụng: Prisma không trả cột ấy về, bộ in thấy
 * `undefined` rồi lặng lẽ rơi về họ tên đầy đủ.
 *
 * Hỏng kiểu này im lặng tuyệt đối — không lỗi, không cảnh báo, văn bản vẫn có chữ. Ba danh sách
 * cột chép tay ở ba nơi là ba chỗ để quên; một hằng số là một chỗ để sửa.
 *
 * Thêm cột mới mà bộ in cần thì thêm vào ĐÂY, và cổng `chon-can-bo-in.gate.spec.ts` bắt mọi bộ
 * nạp xuất chứng từ phải dùng hằng số này chứ không tự khai lại.
 */
export const CHON_CAN_BO_IN = {
  id: true,
  firstName: true,
  lastName: true,
  /**
   * Giao diện dùng làm TÊN DỰ PHÒNG khi cán bộ chưa có họ tên — `CaseDetailPage` hiện
   * `investigator.username` ở đúng chỗ tên điều tra viên. Hằng số này thay thế vài danh sách
   * cột đang có, nên nó phải là TẬP BAO của chúng; bỏ bớt một cột là ô tên trên màn hình đó
   * thành trống.
   */
  username: true,
  email: true,
  /** Quân hàm — dòng ký của cán bộ (`rankName`). */
  rank: true,
  /**
   * Chữ viết tắt cán bộ tự đặt — dòng "Lưu:" cuối MỌI chứng từ hệ cũ.
   *
   * Không suy ra được từ họ tên: đo 28/08/2026 trên 238 cán bộ, quy tắc suy ra chỉ đúng 11
   * người. Thiếu cột này là 16.713/55.207 hồ sơ (30,3%) in sai dòng "Lưu:".
   */
  shortName: true,
} as const;
