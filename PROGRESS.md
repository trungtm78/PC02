# PROGRESS

Cập nhật: 2026-08-26T21:10+07:00 | STATUS: ALL_MILESTONES_DONE | Milestone: 7/7

> Epic trước (**Vụ án**, deploy máy thật 26/08/2026) lưu ở
> [docs/progress/2026-08-25-danh-sach-giong-he-cu.md](docs/progress/2026-08-25-danh-sach-giong-he-cu.md).
> Năm PR của epic ấy đã lên máy thật: #243 #244 #246 #247 #248.

Epic hiện tại: **Đồng bộ form Đơn thư với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`
Nhánh: `main` — 11 PR đã gộp và deploy (#249–#259). Đã bấm thử trên máy thật.

## Đã hoàn thành và ĐÃ LÊN MÁY THẬT

| PR | Nội dung | Bằng chứng |
|---|---|---|
| #249 | 43 ô Đơn thư xoá trắng không được — vá 3 tầng | **bấm thử trên máy thật**: xoá 3 ô, lưu, mở lại trống hẳn |
| #250 | Rút hạ tầng bố cục ra tầng chung | 401 ca kiểm Vụ án xanh **không sửa dòng nào** |
| #251 | 9 cột cho ô hệ cũ còn kẹt + `"0"` thôi thành số không | 9 cột có trên máy thật |
| #252 · #253 | Công cụ dọn số 0 + vá con trỏ trượt | **0 ô còn bằng 0** |
| #254 | Tách `PetitionFormPage` thành thư mục | 1.287 → 1.123 dòng |
| #255 | Bảng buộc bố cục hệ cũ vào dữ liệu Đơn thư | cổng `moiOCoChoLuu` phủ 132 ô |
| #256 | `renderOverride` — giữ widget mạnh của hệ mới | 654 ca kiểm Vụ án xanh |

### Dữ liệu đã chuyển (đo trên máy thật)

**Bù 51.386 ô** cho 35.502 đơn thư: `baoCaoBanGiamDocText` 35.261 · `tinhTrang` 15.039 ·
`soQDPhanCongNguonTin` 411 · `ngayQDPhanCongNguonTin` 407 · `soQDTamDinhChiNguonTin` 58 ·
`ngayQDTamDinhChiNguonTin` 61 · `canCuTamDinhChiNguonTin` 54 · `soPhucHoiNguonTin` 48 ·
`ngayPhucHoiNguonTin` 47.

**Dọn 61.045 ô số bịa** về trống. Còn lại 1.477 và 609 số thật — khớp số đo ban đầu.

Sao lưu riêng trước khi đổi dữ liệu:
`/var/backups/pc02/truoc-bu-donthu-20260826_151540.sql.gz` (118 MB).

## Đã bấm thử trên máy thật — XONG

Bản `a8604bbc` chạy ở `171.244.40.245`, health `ok`. Bấm tay bằng trình duyệt thật, tài khoản
quản trị, ngày 26/08/2026:

| Bước | Kết quả đo được |
|---|---|
| Mở `/petitions/new` | Đúng **10 tab**, đúng tên và đúng thứ tự hệ cũ: Thông tin · Vụ việc · Vụ án · ĐTBS · Vụ việc TĐC · Vụ án TĐC · Vật chứng · HS nghiệp vụ · TK 48 trường · Ghi âm, ghi hình |
| Tab Thông tin | **32 ô** theo đúng thứ tự `/doi-1/Them`, mở đầu "Ngày/Tháng/Năm đề xuất", "Phân loại ban đầu", "Nguồn đơn/Đơn vị giao" |
| Hai ô máy chủ bắt buộc | `Ngày tiếp nhận *` và `Loại đơn thư *` nằm NGOÀI khối gập — không lặp lỗi #248 |
| Tạo đơn `KIEMTHU` | `POST /api/v1/petitions` → **201**. Xác nhận bản vá `sttCu` (#259) đã thông đường tạo đơn |
| Mở lại chế độ Sửa | Sáu ô kiểm nạp đúng giá trị qua bố cục hệ cũ: `senderName`, `senderPhone`, `nguonDon`, `loaiThongTin`, `noiXayRa`, `detailContent` |
| Xoá trắng `nguonDon` + `loaiThongTin` + `noiXayRa`, Lưu | `PUT /api/v1/petitions/{id}` → **200** |
| Mở lại lần hai | Ba ô ấy **trống hẳn**; `senderName` và `detailContent` **giữ nguyên** — xoá đúng ô cần xoá, không đụng ô khác |
| Xoá đơn thử | `DELETE` → **200** |
| Đếm lại toàn bảng | `46.660` đơn thư, `0` bản ghi còn tiền tố `KIEMTHU` — bằng đúng số trước khi thử |

Đây là bằng chứng cho ba thứ ca kiểm không tự chứng được: bố cục thật khớp hệ cũ, đường lưu
thông, và **xoá trắng thật sự xoá** (lớp lỗi `|| undefined` đã tắt hẳn ở Đơn thư).

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do |
|---|---|---|
| 26/08 | Ô "Phân loại ban đầu" chọn được nhưng mở `ConvertPetitionModal` | Anh chốt. Hệ mới tách ba bảng nên ô chọn không tự chuyển hồ sơ được |
| 26/08 | 30.089 + 30.956 ô `= 0` là "chưa có số liệu" → dọn | Anh chốt. Hệ cũ chỉ 1.447/599 hồ sơ có số thật |
| 26/08 | Gộp PR3 vào bảng buộc, không tách riêng | Tách riêng phải dựng lại khoá hệ cũ cho 182 mục từ trí nhớ — dễ sai, không kiểm chứng được |
| 26/08 | Bảng buộc dùng chung đặc tả của Vụ án, chỉ khai CHỖ LƯU | Hệ cũ dùng CHUNG một form `/doi-1/Them`; chép nội dung sang tệp thứ hai là mở đường cho hai màn trôi khỏi nhau |
| 26/08 | `renderOverride` thay vì bỏ widget mạnh | Giống hệ cũ ở nhãn/thứ tự/chỗ đứng, không giống ở chỗ làm yếu đi |
| 26/08 | Chặn `null` ở lớp ghi, không ở lớp DTO | `@IsOptional()` của `PartialType` chạy trước và nuốt mọi kiểm tra khác khi giá trị là `null` |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Anh viết "màn hình Danh sách vụ án" nhưng bối cảnh là Đơn thư | Đối tượng là **Đơn thư**; màn danh sách đã khớp nên việc nằm ở **form** | Đo trên máy thật: `/petitions` đã có đúng 9 cột hệ cũ + Trạng thái |
| Chú thích tiếng Anh hay tiếng Việt | **Tiếng Việt**, theo convention kho mã | §4: "Convention hiện có của repo thắng sở thích cá nhân" |
| Ba ô `assignedTeamId`, `summary`, `stt` có gửi `null` không | **Không** | Không có chỗ nhập trên màn hình; đổi chỉ thêm đường xoá nhầm |
| Ma trận tài liệu vs số đo trên máy thật | **Bám số đo** | Ma trận đếm theo sự CÓ MẶT của khoá: `ngay_thong_ke` báo 126, thật 1 |

## Trạng thái test

Full suite: **PASS** — 1917/1917 giao diện, 3230/3230 máy chủ.
`tsc -b` + `tsc --noEmit`: sạch. Test fail: không.

## Nợ kỹ thuật / rủi ro

- ~~Ma trận `docs/legacy/field-parity-matrix.md` phân loại SAI hai chỗ cho petition~~ — **đã
  trả** (PR #261). Sửa gốc thay vì khai tay: bộ sinh mù ba chỗ, vá xong nó tự đo được cả hai
  khoá nên `PARITY_BANG_CHUNG_DO_TAY` bị gỡ hẳn. Lộ thêm ba lỗ dữ liệu thật.
- ~~`backfill-parity.ts` bỏ qua 95 hồ sơ giữ `legacyRaw` ở thực thể anh em~~ — **đã trả**
  (PR #261). `banGocTuAnhEm` tách thành primitive dùng chung cho cả bộ bù lẫn bộ dọn số 0.
- Vụ việc còn hai khoá chưa có cột typed (`phan_loai_nguon_tin_ban_dau` 4.568 hồ sơ,
  `toi_danh_chinh_blhs2015` 1.114). Khai ở `PARITY_HOAN_THEO_THUC_THE` kèm số đo — hoãn theo
  ĐÚNG thực thể, không miễn toàn cục. Việc của epic Vụ việc.
- Em đẩy thẳng một commit tài liệu lên `main` (bỏ qua PR), sai quy ước kho mã. Không lặp lại.

## Sau PR #261 — việc phải làm trên máy chạy

Bù ba cột vừa nối dây, sau khi bản mới lên máy thật (đã dry-run):

| Lệnh | Kết quả dry-run |
|---|---|
| `backfill-parity.ts --entity petition` | 93.644 ô / 46.660 hồ sơ |
| `backfill-parity.ts --entity case` | chờ migration `cases.donViGiaiQuyet` |
| `backfill-parity.ts --entity incident` | 0 ô (đã đủ) |

Sao lưu riêng trước khi chạy, như lần bù trước.
