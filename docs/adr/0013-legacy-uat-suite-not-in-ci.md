# ADR-0013: Bộ UAT cũ không được đưa vào CI; spec mới sống ở `tests/e2e-new`

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-B0b, `tests/e2e-new/README.md`, `playwright.config.ts`

## Bối cảnh

Repo có 182 spec Playwright. Nhìn con số thì đây là một tài sản test lớn đang nằm không. Kiểm tra thực tế cho ra bức tranh khác:

- `tests/uat-auto` (113 file, ~781 case) khẳng định `expect([200,201,401,403,404]).toContain(res.status())`. Một phản hồi 401 hay 404 vẫn PASS. Bộ này chứng minh gần như không gì.
- `tests/api/cases-uat.api.spec.ts:70` gọi `test.skip()` từ trong `catch` của lỗi mạng — **backend chết thì test xanh**.
- `tests/e2e/objects-routing.e2e.spec.ts` đã mục: port 5173 (config là 5179), `input[type="email"]` (trường đăng nhập là `type="text"`), testid không còn tồn tại.
- Thiếu dependency `jszip` khiến **toàn bộ** khâu collect của Playwright chết — mọi project báo "0 tests in 0 files".
- `tests/uat-auto/_helpers.ts` mặc định trỏ IP production, và `tests/global-setup.ts` nhúng sẵn năm mật khẩu.

## Quyết định

Không bật bộ cũ. Spec mới đi vào `tests/e2e-new/`, có project Playwright riêng, và đó là project duy nhất CI sẽ gate.

Trong cùng PR, sửa những thứ khiến bộ cũ không thể **collect** được (thêm `jszip`, bỏ mặc định trỏ production, bỏ mật khẩu nhúng sẵn) — vì đó là điều kiện cần cho bất kỳ đợt triage nào về sau. Sau khi sửa: 3849 test / 182 file collect được.

## Hệ quả

- CI chỉ gate trên thứ có ý nghĩa. Không ai bị chặn merge vì noise.
- 182 spec vẫn ở đó, collect được, chạy tay được — sẵn sàng cho một PR triage.
- `tests/e2e-new` hiện chưa có spec nào, mà Playwright exit non-zero với project rỗng. Nên nó **chưa** vào CI; nó vào cùng spec đầu tiên. Chạy tay cần `--pass-with-no-tests`.
- Bộ cũ vẫn nằm ngoài type-check chặn ([ADR-0011](0011-partial-index-drift-is-accepted.md)) với 9 lỗi trong 6 file.

## Phương án đã cân nhắc và loại bỏ

**Bật cả 182 spec.** Loại — 62% trong số đó xanh kể cả khi hệ thống hỏng, nên nó tạo cảm giác an toàn sai và một cổng CI chậm mà không ai tin.

**Sửa hết bộ cũ trước rồi mới bật.** Đáng làm, nhưng là công việc riêng của nó. Gộp vào PR governance sẽ chôn cổng CI dưới hàng trăm sửa đổi spec.

**Xoá bộ cũ.** Loại — trong đó có kiến thức nghiệp vụ thật (kịch bản, dữ liệu mẫu, page object) đáng cứu.

## Điều kiện xem lại

Sau PR triage suite UAT. Khi một nhóm spec đã có assertion thật, chuyển chúng sang `e2e-new` hoặc mở rộng project được gate.
