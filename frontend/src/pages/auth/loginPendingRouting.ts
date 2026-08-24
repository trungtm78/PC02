/**
 * Quyết định điều hướng sau khi máy chủ trả phản hồi đăng nhập.
 *
 * Tách khỏi LoginPage để kiểm được trực tiếp. Lý do tồn tại: bản cũ nhúng chuỗi
 * `if` ngay trong `onSuccess`, thiếu nhánh `TWO_FA_SETUP_REQUIRED` và KHÔNG có
 * nhánh mặc định — phản hồi lạ thì hàm chạy hết rồi thoát, không điều hướng,
 * không báo lỗi. Người dùng thấy nút Đăng nhập "không ăn".
 *
 * Nguyên tắc ở đây: MỌI đường đi đều phải trả về một kết quả. Không có lối thoát
 * im lặng. Phản hồi không nhận ra được thì báo lỗi rõ ràng để người dùng biết
 * phải gọi hỗ trợ, thay vì tưởng mình gõ sai mật khẩu.
 */

export type LoginResponseLike = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  pending?: boolean;
  reason?: string;
  changePasswordToken?: string;
  twoFaToken?: string;
  twoFaSetupToken?: string;
};

export type LoginRoute =
  | { kind: 'authenticated'; accessToken: string; refreshToken: string }
  | { kind: 'navigate'; path: string; state: Record<string, string> }
  | { kind: 'error'; message: string };

const UNSUPPORTED_MESSAGE =
  'Máy chủ trả về một bước đăng nhập mà phiên bản giao diện này không hỗ trợ. ' +
  'Vui lòng tải lại trang để cập nhật, hoặc liên hệ quản trị hệ thống.';

export function resolveLoginRoute(response: LoginResponseLike): LoginRoute {
  if (!response || typeof response !== 'object') {
    return { kind: 'error', message: UNSUPPORTED_MESSAGE };
  }

  if (response.pending) {
    // Nhận diện theo TRƯỜNG token chứ không theo `reason`: token là thứ bước sau
    // thực sự cần, còn `reason` chỉ để hiển thị. Máy chủ đổi/bỏ `reason` cũng
    // không làm luồng chết.
    if (response.changePasswordToken) {
      return {
        kind: 'navigate',
        path: '/auth/first-login-change-password',
        state: { changePasswordToken: response.changePasswordToken },
      };
    }
    if (response.twoFaSetupToken) {
      return {
        kind: 'navigate',
        path: '/auth/2fa-setup',
        state: { twoFaSetupToken: response.twoFaSetupToken },
      };
    }
    if (response.twoFaToken) {
      return {
        kind: 'navigate',
        path: '/auth/2fa',
        state: { twoFaToken: response.twoFaToken },
      };
    }
    return { kind: 'error', message: UNSUPPORTED_MESSAGE };
  }

  if (response.accessToken && response.refreshToken) {
    return {
      kind: 'authenticated',
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };
  }

  return { kind: 'error', message: UNSUPPORTED_MESSAGE };
}
