# UAT-COVERAGE — popup In chứng từ nhớ lựa chọn của từng cán bộ

Chạy trên **máy thật** `http://171.244.40.245` ngày 29/08/2026, bản dựng `e862b6a6`.

| ID | Màn hình / Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| **API — lựa chọn đi trọn đường xuống CSDL** ||||
| A-01 | Chưa lưu gì thì trả bản đồ rỗng, không lỗi | ✔ | ✔ | **PASS** |
| A-02 | Ghi rồi đọc lại đúng tập mẫu và định dạng | ✔ | ✔ | **PASS** |
| A-03 | Ghi lại thì ĐÈ, không cộng dồn | ✔ | ✔ | **PASS** |
| A-04 | Lưu được lựa chọn KHÔNG mẫu nào | ✔ | ✔ | **PASS** |
| A-05 | Xoá thì bản ghi biến MẤT hẳn, không thành khối rỗng | ✔ | ✔ | **PASS** |
| A-06 | Payload méo được chuẩn hoá, không hỏng bản ghi | ✔ | ✔ | **PASS** |
| A-07 | Loại hồ sơ lạ bị từ chối (400) | ✔ | ✔ | **PASS** |
| A-08 | Ba loại hồ sơ tách bạch, không lẫn sang nhau | ✔ | ✔ | **PASS** |
| A-09 | **KHÔNG rò sang tài khoản khác** | ✔ | ✔ | **PASS** |
| A-10 | Không có token thì bị từ chối (401) | ✔ | ✔ | **PASS** |
| **Giao diện — bấm đúng thứ cán bộ bấm** ||||
| E-01 | Tích → Xuất → mở lại: đúng tập mẫu và đúng định dạng | ✔ | ✔ | **PASS** |
| E-02 | Lựa chọn xuống tới máy chủ (không chỉ nhớ trong màn hình) | ✔ | ✔ | **PASS** |
| E-03 | "Dùng lại mặc định" quay về cờ admin | ✔ | ✔ | **PASS** |
| E-04 | "Dùng lại mặc định" xoá hẳn bản ghi trên máy chủ | ✔ | ✔ | **PASS** |
| **Thành phần — nhánh khó dựng trên máy thật** ||||
| C-01 | Chưa từng đặt → theo cờ admin | ✔ | ✔ | **PASS** |
| C-02 | Đã lưu → lựa chọn cá nhân THẮNG cờ admin | ✔ | ✔ | **PASS** |
| C-03 | Nhớ cả định dạng xuất | ✔ | ✔ | **PASS** |
| C-04 | Bỏ mã mẫu không còn tồn tại | ✔ | ✔ | **PASS** |
| C-05 | Không tích mẫu đã lưu nhưng nay thiếu thông tin | ✔ | ✔ | **PASS** |
| C-06 | Bản ghi rỗng KHÁC chưa từng đặt | ✔ | ✔ | **PASS** |
| C-07 | Lựa chọn loại hồ sơ khác không lẫn sang | ✔ | ✔ | **PASS** |
| C-08 | Đã có lựa chọn riêng thì không tự tích sau "Lưu bổ sung" | ✔ | ✔ | **PASS** |
| C-09 | Đang Đặt lại thì nút Xuất bị khoá | ✔ | ✔ | **PASS** |
| C-10 | Lưu XONG rồi mới xuất, không bắn-rồi-quên | ✔ | ✔ | **PASS** |
| C-11 | Lưu hỏng thì vẫn xuất bình thường | ✔ | ✔ | **PASS** |
| C-12 | Chỉ tích mà chưa Xuất thì KHÔNG lưu | ✔ | ✔ | **PASS** |
| C-13 | Máy chủ lỗi thì rơi về cờ admin, không chặn popup | ✔ | ✔ | **PASS** |
| **Kho đệm — rò dữ liệu giữa hai tài khoản** ||||
| K-01 | Token biến mất → xoá sạch kho đệm | ✔ | ✔ | **PASS** |
| K-02 | Vẫn còn token → KHÔNG xoá (không tải lại vô cớ) | ✔ | ✔ | **PASS** |
| K-03 | Gỡ khỏi màn hình thì thôi nghe, không rò trình nghe | ✔ | ✔ | **PASS** |
| **Backend — chuẩn hoá và cách ly** ||||
| B-01…B-25 | `chuanHoaLuaChon`: kiểu sai bỏ, quá tay cắt, khử trùng, chặn khoá nguyên mẫu, bình ổn | ✔ | ✔ | **PASS** (25) |
| B-26…B-37 | Service: cách ly theo `userId`, chuẩn hoá KHI ĐỌC, allowlist, xoá đúng hàng | ✔ | ✔ | **PASS** (12) |

**37 + 27 = 64 dòng, tất cả PASS.**

## Tệp

| Loại | Tệp | Số ca |
|---|---|---:|
| API (máy thật) | `tests/api/nho-lua-chon-in-uat.api.spec.ts` | 10 |
| Giao diện (máy thật) | `tests/e2e/nho-lua-chon-in-uat.e2e.spec.ts` | 2 |
| Thành phần | `features/document-templates/components/__tests__/nhoLuaChonInChungTu.test.tsx` | 15 |
| Kho đệm | `hooks/__tests__/useXoaKhoDemKhiDoiTaiKhoan.test.tsx` | 3 |
| Backend | `user-export-preferences/chuan-hoa-lua-chon.util.spec.ts` · `.service.spec.ts` | 37 |

Bài API và E2E đều **trả máy thật về nguyên trạng** ở cuối; kiểm lại sau khi chạy: **0 bản ghi**.

## ĐÍNH CHÍNH — một kết luận em nói vội

PR #311 ghi rằng UAT trên máy thật chứng minh `mutate` (bắn-rồi-quên) **không** gửi được lệnh
ghi. **Điều đó chưa được chứng minh.**

Lần chạy E2E hỏng ấy được giải thích TRỌN VẸN bằng một lỗi của chính bài kiểm: endpoint này trả
thân **trần** (`{DON_THU: {...}}`) chứ không bọc `{success, data}` như danh sách hồ sơ, mà bài
kiểm lại bóc `?.data ?? {}` — nên luôn ra rỗng. Soi CSDL máy thật lúc ấy cho thấy bản ghi **đã
được ghi đúng**.

Đổi sang `mutateAsync` + `await` vẫn là thay đổi **đúng** — nó bảo đảm thứ tự và bảo đảm lệnh ghi
đi xong trước khi popup bị gỡ — nhưng lý do em nêu trong PR ấy là **nói quá**. Ghi lại đây để bản
ghi đúng sự thật.

Đây là lần thứ HAI trong hai ngày em dẫm đúng bẫy "bóc thân phản hồi hai kiểu", dù đã ghi nó vào
bộ nhớ chiều hôm trước.

## Đối chiếu ngược với yêu cầu gốc

| Anh yêu cầu | Dòng phủ |
|---|---|
| "lưu trữ các setting để lần tới dùng lại, không cần phải setup lại" | E-01 · E-02 · C-01…C-03 · A-01…A-05 |
| "tất cả việc select chọn đến việc Định dạng xuất" | C-02 (chọn mẫu) · C-03 (định dạng) · E-01 (cả hai) |
| Cá nhân hoá, không phải thiết lập chung | A-09 · K-01…K-03 · C-02 |
| Chưa đặt thì dùng mặc định ở màn Mẫu chứng từ | C-01 · E-03 · E-04 |
| Lưu ở máy chủ theo tài khoản | A-01…A-10 · E-02 |

Không sót màn hình hay chức năng nào trong phạm vi.
