# UAT-COVERAGE — Danh sách theo bố cục hệ cũ (v0.73.0.0)

Spec gốc: `~/.claude/plans/gleaming-pondering-thacker.md` · PR #230 · nhánh `feat/danh-sach-giong-he-cu`

Ma trận này liệt kê **mọi màn hình và mọi chức năng** trong phạm vi thay đổi. Chỉ được kết
thúc khi **100% dòng = PASS**.

## Phạm vi — vì sao đúng những dòng này

Thay đổi chạm ba trang danh sách và một thẻ lọc dùng chung. Mỗi năng lực trong ma trận
tương ứng một điều anh đã chốt hoặc một cột/ô lọc bổ sung; không dòng nào là tự nghĩ ra.

| ID | Màn hình / Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| **U-01** | Đơn thư — hiện đủ 9 cột đúng thứ tự hệ cũ | ☐ | ☐ | ⏳ |
| **U-02** | Đơn thư — cột Tóm tắt nội dung có chữ, "Xem thêm" mở rộng được | ☐ | ☐ | ⏳ |
| **U-03** | Đơn thư — Thao tác là cột CUỐI | ☐ | ☐ | ⏳ |
| **U-04** | Đơn thư — mã hiện `26-…`, dữ liệu vẫn `2026-…` | ☐ | ☐ | ⏳ |
| **U-05** | Đơn thư — lọc STT bằng **cả hai** dạng ra cùng hồ sơ | ☐ | ☐ | ⏳ |
| **U-06** | Đơn thư — lọc STT cũ | ☐ | ☐ | ⏳ |
| **U-07** | Đơn thư — lọc Cán bộ nhập (dropdown có người) | ☐ | ☐ | ⏳ |
| **U-08** | Đơn thư — Từ ngày / Đến ngày | ☐ | ☐ | ⏳ |
| **U-09** | Đơn thư — Chọn khoảng thời gian (5 mốc) | ☐ | ☐ | ⏳ |
| **U-10** | Đơn thư — Xóa bộ lọc trả về danh sách đầy đủ | ☐ | ☐ | ⏳ |
| **U-11** | Đơn thư — **GIỮ** chip trạng thái và thẻ thống kê | ☐ | ☐ | ⏳ |
| **U-12** | Đơn thư — **GIỮ** bấm tiêu đề cột để sắp | ☐ | ☐ | ⏳ |
| **U-13** | Vụ việc — đủ cột, Thao tác cuối, Tóm tắt nội dung có chữ | ☐ | ☐ | ⏳ |
| **U-14** | Vụ việc — mã hiện dạng ngắn | ☐ | ☐ | ⏳ |
| **U-15** | Vụ việc — lọc STT / STT cũ / Cán bộ nhập | ☐ | ☐ | ⏳ |
| **U-16** | Vụ việc — GIỮ chip trạng thái, thẻ thống kê, sắp xếp | ☐ | ☐ | ⏳ |
| **U-17** | Vụ án — đủ cột, Thao tác cuối, Tóm tắt nội dung có chữ | ☐ | ☐ | ⏳ |
| **U-18** | Vụ án — mã hiện dạng ngắn | ☐ | ☐ | ⏳ |
| **U-19** | Vụ án — lọc STT / STT cũ / Cán bộ nhập | ☐ | ☐ | ⏳ |
| **U-20** | Vụ án — GIỮ chip trạng thái, thẻ thống kê, sắp xếp | ☐ | ☐ | ⏳ |
| **U-21** | Cả ba — bộ lọc lưu trong địa chỉ trang, tải lại giữ nguyên | ☐ | ☐ | ⏳ |
| **U-22** | Cả ba — đổi bộ lọc thì về trang 1 | ☐ | ☐ | ⏳ |
| **U-23** | Cả ba — Xuất Excel vẫn chạy | ☐ | ☐ | ⏳ |
| **U-24** | Máy chủ — lọc `stt` hai dạng trả cùng hồ sơ (API thật) | ☐ | ☐ | ⏳ |

## Ngoài phạm vi — có lý do

| Không kiểm | Lý do |
|---|---|
| Ô "Đã chuyển đội khác", "Tìm trường bỏ trống" | **Không dựng** — hệ mới chưa có khái niệm tương đương (anh đã chốt) |
| Ô "Từ khóa" trong thẻ lọc | **Không dựng** — thanh công cụ ngay trên đã có ô tìm kiếm |
| Trang Tổng hợp, UTĐT | Ngoài phạm vi đợt này (spec §Cố ý KHÔNG làm) |
| Ứng dụng di động | Quy trình dựng hỏng sẵn từ 14/08 (action bị ghim SHA không còn tồn tại) |

## Trạng thái

Chưa chạy. Cập nhật sau mỗi lượt `/uat-test-runner`.
