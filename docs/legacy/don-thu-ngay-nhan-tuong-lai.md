# 12 đơn thư có ngày nhận trong tương lai — cần đối chiếu hồ sơ giấy

Rà ngày 25/08/2026. Đây là **lỗi nhập liệu mang từ hệ cũ sang**, không phải lỗi di trú:
chính hệ mới có luật *"Ngày tiếp nhận không được là ngày tương lai"* nên các hồ sơ này
không thể tạo mới được nữa — chúng chỉ tồn tại vì đã có sẵn ở hệ cũ.

**Không tự sửa** vì đoán ngày là bịa dữ liệu hồ sơ vụ việc. Cần cán bộ mở hồ sơ giấy.

## Nhóm A — sai rõ rệt, đã tự chìm xuống cuối danh sách (5)

Ngoài khoảng 1900–2100 nên bộ sắp xếp đã đẩy xuống cuối, không chiếm màn hình đầu.

| Mã hồ sơ | Ngày nhận đang lưu | Người gửi | Khoá hệ cũ |
|---|---|---|---|
| 2023-5325 | 30/11/**3023** | Mai Phi | `ho_so_doi_1:60283` |
| 2025-7057 | 17/09/**2925** | Trịnh Hoàng Duy Phong | `ho_so_doi_1:71403` |
| 2025-10964 | 11/12/**2205** | Nguyễn Thanh Tùng | `ho_so_doi_1:75310` |
| 2025-10450 | 05/12/**2205** | Đinh Thị Lan | `ho_so_doi_1:74796` |
| 2023-2728 | 22/06/**2203** | Công ty Cổ phần Kinh doanh | `ho_so_doi_1:57686` |

## Nhóm B — ƯU TIÊN: vẫn nổi lên đầu danh sách (7)

Các năm này nằm **trong** khoảng 1900–2100 nên bộ lọc ngày phi lý không bắt được. Đây
chính là những hồ sơ cán bộ nhìn thấy đầu tiên khi mở màn hình Đơn thư.

| Mã hồ sơ | Ngày nhận đang lưu | Người gửi | Khoá hệ cũ |
|---|---|---|---|
| 2026-3696 | 19/03/**2029** | Nguyễn Hồng Lĩnh | `ho_so_doi_1:79489` |
| 2026-10141 | 28/07/**2027** | Đoàn Khắc Tiến | `ho_so_doi_1:85950` |
| 2026-10045 | 27/07/**2027** | Tống Ngọc Toàn, Mã Ánh Tuyết | `ho_so_doi_1:85854` |
| 2026-10206 | **30/09**/2026 | Phạm Thị Nhung | `ho_so_doi_1:86015` |
| 2026-10207 | **29/09**/2026 | Nguyễn Thị Hoa | `ho_so_doi_1:86016` |
| 2026-8810 | **29/09**/2026 | Công ty luật TNHH XTVN | `ho_so_doi_1:84619` |
| 2026-10224 | **27/09**/2026 | Lý Cẩm Tuyền | `ho_so_doi_1:86033` |

## Cách xử

1. Cán bộ mở từng hồ sơ, đối chiếu ngày trên văn bản giấy.
2. Sửa trực tiếp trên màn hình Đơn thư — hệ mới sẽ chặn nếu lại nhập ngày tương lai.
3. Sửa xong nhóm B là danh sách hết bị chiếm đầu.

## Vì sao bộ lọc hiện tại không bắt được nhóm B

Cột sắp xếp là **cột sinh tự động** của PostgreSQL, mà cột sinh **bắt buộc dùng biểu thức
bất biến** — không được gọi `now()`. Nên khoảng hợp lệ phải là hằng số `1900–2100`, không
thể là "không quá hôm nay". Đổi sang so với ngày hiện tại sẽ mất chỉ mục và làm chậm truy
vấn trên 46.631 hồ sơ. Sửa dữ liệu là cách đúng, không phải nới bộ lọc.
