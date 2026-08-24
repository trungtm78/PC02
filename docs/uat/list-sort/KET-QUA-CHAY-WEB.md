# Kết quả thực thi UAT (chỉ web) — v0.72.0.0 sắp xếp danh sách

## Thông tin lượt chạy

| | |
|---|---|
| Ngày chạy | 2026-08-24 |
| Mã bản dựng | `4f3a3f4` (nhánh `main`) |
| Môi trường | `https://new.pc02hcm.com` — **bản chạy thật, dữ liệu thật** |
| Dữ liệu | 45.459 đơn thư · 4.713 vụ việc · 3.304 vụ án |
| Playwright | 1.58.2 · Chromium |
| Chế độ | **Nghiệm thu** — `retries=0`, `workers=1`, không tính đạt-nhờ-chạy-lại |
| Máy chủ | **thật, không mock** — không dựng máy chủ giả thay ứng dụng |
| Phạm vi | **Chỉ web** theo yêu cầu |
| Tính chất | **Toàn bộ CHỈ ĐỌC** — không tạo/sửa/xoá hồ sơ nào |

## Tổng quan

| Chỉ số | Giá trị |
|---|---|
| Tổng ca kiểm | **31** |
| ✅ Đạt | **31** |
| ❌ Không đạt | 0 |
| ⏭️ Bỏ qua | 0 |
| 🚫 Không chạy được (bị chặn) | 0 *(trên phạm vi web)* |
| Đạt-nhờ-chạy-lại (flaky) | **0** |
| Thời gian | API 9,8s · E2E 37,9s |

## Theo lớp

| Lớp | Đạt | Không đạt | Ghi chú |
|---|---|---|---|
| **Gate 1 — API** | 23/23 | 0 | Máy chủ thật, gọi HTTP thật |
| **Gate 2 — E2E web** | 8/8 | 0 | Chromium, thao tác qua giao diện như cán bộ |

## Chuỗi gate

| Gate | Điều kiện | Kết quả |
|---|---|---|
| **G0 Môi trường** | Bản chạy tới được, mã bản dựng ghi nhận, đăng nhập được | ✅ ĐẠT — API 200, web 200 |
| **G1 API smoke** | 100% ca smoke đạt | ✅ ĐẠT — 23/23 |
| **G2 Đường quan trọng** | 100% ca P0 đạt, 0 flaky | ✅ ĐẠT — 8/8 E2E, 0 flaky |
| **G3 Độ phủ** | ≥95% ca kế hoạch đã chạy | ✅ ĐẠT — 31/31 ca web đã chạy |
| **G4 Ngân sách lỗi** | 0 lỗi mức S1 mở | ✅ ĐẠT — 0 lỗi |
| **G5 Hồi quy** | 0 hồi quy so mốc | ✅ ĐẠT — đây là mốc đầu tiên, đã lưu |
| **G6 Ngoài chức năng** | Tiếp cận + hiệu năng đạt | ✅ ĐẠT — `aria-sort` đúng (TC-023); truy vấn dùng chỉ mục |
| **G7 Hồ sơ ký duyệt** | Người ký + bằng chứng + mốc thời gian | ⏳ **Chờ anh ký** |

## 5 ca chậm nhất (theo dõi xu hướng)

| Thời gian | Lớp | Ca kiểm |
|---|---|---|
| 6.487 ms | E2E | TC-051 Bấm cột đổi thứ tự THẬT SỰ |
| 6.443 ms | E2E | TC-023 `aria-sort` báo đúng trạng thái |
| 6.050 ms | E2E | TC-025+026 Bấm sắp ghi vào địa chỉ, F5 giữ nguyên |
| 5.533 ms | E2E | TC-053 Vụ việc và Vụ án cùng hành vi |
| 2.479 ms | E2E | TC-027 Mở thẳng đường dẫn có tham số |

Không ca nào vượt 7 giây — không có dấu hiệu chậm bất thường.

## Lỗi ghi nhận

**Không có.** `failed-tc-ids.txt` rỗng — không cần chạy lại.

## Nền tảng không nằm trong phạm vi lần này

| Nền tảng | Trạng thái | Lý do |
|---|---|---|
| Di động (Flutter) | 🚫 **KHÔNG CHẠY** | Anh yêu cầu **chỉ web**. Ngoài ra quy trình dựng ứng dụng di động hỏng sẵn từ 14/08 (action bị ghim mã phiên bản không còn tồn tại). |

⚠️ **Rủi ro còn lại:** ứng dụng di động gọi cùng endpoint và **không gửi tham số sắp**, nên
thứ tự trên điện thoại **cũng đã đổi** theo máy chủ — nhưng chưa ai xác nhận trên thiết bị.
Rủi ro thấp (cùng dữ liệu, cùng đường API), song vẫn là điểm chưa có bằng chứng.

**Cách khắc phục khi cần:** cập nhật/bỏ ghim `subosito/flutter-action` trong workflow, rồi
chạy Maestro cho màn danh sách đơn thư.

## Bằng chứng

- Kết quả gộp: `test-results/list-sort-run/results_flat.json`
- Mốc so sánh cho lần sau: `test-results/baseline/results_baseline.json`
- Bộ ca kiểm: `tests/api/list-sort-uat.api.spec.ts` · `tests/e2e/list-sort-uat.e2e.spec.ts`
- Sổ phủ và nguồn chân lý: `docs/uat/list-sort/_coverage-ledger.md` · `_plan-scope.md`

## Đề xuất: **GO** (phạm vi web)

Mọi gate sản phẩm đều xanh: 31/31 chạy thật đạt, 0 flaky, 0 lỗi, chạy ở chế độ nghiệm thu
nên không có ca nào "đạt nhờ chạy lại".

⚠️ **Đây là đề xuất kèm bằng chứng, không phải chữ ký.** Việc phê duyệt là của người có
thẩm quyền — G7 còn để trống chờ anh.
