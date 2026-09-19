/**
 * Tên sự kiện `window` mà authStore phát khi token/hồ sơ đổi (đăng nhập, đăng xuất, làm mới, hồ sơ nạp xong).
 *
 * Tách khỏi auth.store.ts để hook nghe được sự kiện mà không phụ thuộc đối tượng store — nhiều ca kiểm giả trọn
 * module store, thêm hàm mới vào store thì các ca ấy nhận `undefined`.
 */
export const TEN_SU_KIEN_DOI_TOKEN = 'pc02:auth-token-changed';
