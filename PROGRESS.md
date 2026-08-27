# PROGRESS

Cập nhật: 2026-08-27T10:55+07:00 | STATUS: ALL_MILESTONES_DONE | Milestone: 7/7

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

## 27/08 — bấm thử hồ sơ DI TRÚ (không phải đơn tự tạo) lộ ba lỗi chặn

Lần bấm thử 26/08 dùng đơn `KIEMTHU` tự tạo nên mọi thứ xanh. Mở một đơn **di trú** ra thì bấm
Lưu bị chặn ba chỗ — tức 46.499 hồ sơ cũ không sửa và lưu lại được.

| # | Lỗi | Quy mô | Đã xử |
|---|---|---|---|
| 1 | ô "Phân loại ban đầu" trống | 46.445 | PR #261 — cột có sẵn, builder chưa bao giờ đọc |
| 2 | ô nội dung TRẮNG | 46.499 | PR #262 — di trú đổ vào `summary`, form đọc `detailContent` |
| 3 | số điện thoại "không đúng định dạng" | 4.691 | PR #263 — không phải số sai, là ký hiệu `...`/`0000`/`Không` của hệ cũ |

Đã bù trên máy chạy, sao lưu riêng từng lần:

| Việc | Kết quả |
|---|---|
| `backfill-parity` đơn thư | 93.644 ô / 46.660 hồ sơ |
| `backfill-parity` vụ án | 3.361 ô |
| `bu-noi-dung-donthu` | 46.658 hồ sơ (2 hồ sơ hệ cũ vốn không có chữ) |
| `don-so-dien-thoai-donthu` | xoá 4.691 · chuẩn hoá 83 · giữ lại 114 vì không đoán được |

Bấm lại sau khi bù: ô nội dung hiện chữ thật, "Phân loại ban đầu" hiện "Đơn, Công văn", đơn vị
giải quyết hiện "PC01 Công an TP. HCM". Còn đúng **một** thứ chặn Lưu.

## Ô "Loại đơn thư" — đã gỡ chặn, KHÔNG bịa dữ liệu (PR #265)

Ô này bắt buộc trên form hệ mới, còn hệ cũ **không có khái niệm ấy** — cả 46.499 hồ sơ di trú
đều để trống. Bắt buộc nó nghĩa là cán bộ mở bất kỳ hồ sơ cũ nào ra cũng phải phân loại lại
trước khi sửa nổi một dấu phẩy, đi ngược đúng nguyên tắc "không phải học lại" của epic.

Đã gỡ chặn cho **hồ sơ di trú**, giữ bắt buộc cho đơn tạo mới. Miễn đúng nhóm, đúng một ô:

- chỉ hồ sơ có `legacySourceId` — kể cả 161 hồ sơ vỏ liên kết không giữ `legacyRaw` riêng;
- chỉ khi ô đang **trống**; cán bộ đã chọn một loại thì loại ấy vẫn phải hợp lệ;
- đơn tạo mới vẫn bắt buộc; các ô bắt buộc khác không đụng tới.

**Không bịa dữ liệu.** `petitionType` vẫn để trống. Quy `loai_thong_tin` của hệ cũ sang
`LoaiDon` là phán đoán pháp lý, không phải phép ánh xạ — *tố giác tội phạm* (BLTTHS) và *tố
cáo* (Luật Tố cáo 2018) là hai khái niệm khác nhau, nên ngay cả dòng đông nhất ("Tố giác",
~21.662 hồ sơ) cũng không có câu trả lời hiển nhiên. Anh chốt bảng quy đổi lúc nào thì bù một
lần lúc ấy; trong lúc chưa có, cán bộ vẫn chọn được và lưu bình thường.

| Giá trị hệ cũ | Hồ sơ |
|---|---|
| Tố giác (gộp viết hoa/thường) | ~21.662 |
| Đề nghị | ~9.056 |
| Trình báo | ~5.742 |
| Khiếu nại | 1.206 |
| Xin nhận lại tài sản | 863 |
| Xin bảo lãnh | 578 |
| Kiến nghị | 452 |

## Bấm thử cuối trên máy thật — hồ sơ di trú LƯU ĐƯỢC

Bản `32d43b32`, health `ok`. Mở đúng hồ sơ di trú đã chặn ba lần trước, bấm Lưu:

- `PUT /api/v1/petitions/{id}` → **200**, không còn thông báo lỗi nào, quay về danh sách.
- Mở lại: nội dung, phân loại ban đầu, đơn vị giải quyết, tên người gửi đều **giữ nguyên**;
  ô số điện thoại trống đúng như sau khi dọn ký hiệu `...` của hệ cũ.

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

## 27/08 — bấm thử hồ sơ DI TRÚ (không phải đơn tự tạo) lộ ba lỗi chặn

Lần bấm thử 26/08 dùng đơn `KIEMTHU` tự tạo nên mọi thứ xanh. Mở một đơn **di trú** ra thì bấm
Lưu bị chặn ba chỗ — tức 46.499 hồ sơ cũ không sửa và lưu lại được.

| # | Lỗi | Quy mô | Đã xử |
|---|---|---|---|
| 1 | ô "Phân loại ban đầu" trống | 46.445 | PR #261 — cột có sẵn, builder chưa bao giờ đọc |
| 2 | ô nội dung TRẮNG | 46.499 | PR #262 — di trú đổ vào `summary`, form đọc `detailContent` |
| 3 | số điện thoại "không đúng định dạng" | 4.691 | PR #263 — không phải số sai, là ký hiệu `...`/`0000`/`Không` của hệ cũ |

Đã bù trên máy chạy, sao lưu riêng từng lần:

| Việc | Kết quả |
|---|---|
| `backfill-parity` đơn thư | 93.644 ô / 46.660 hồ sơ |
| `backfill-parity` vụ án | 3.361 ô |
| `bu-noi-dung-donthu` | 46.658 hồ sơ (2 hồ sơ hệ cũ vốn không có chữ) |
| `don-so-dien-thoai-donthu` | xoá 4.691 · chuẩn hoá 83 · giữ lại 114 vì không đoán được |

Bấm lại sau khi bù: ô nội dung hiện chữ thật, "Phân loại ban đầu" hiện "Đơn, Công văn", đơn vị
giải quyết hiện "PC01 Công an TP. HCM". Còn đúng **một** thứ chặn Lưu.

## CHỜ ANH QUYẾT — `petitionType` trống ở cả 46.499 hồ sơ

Ô "Loại đơn thư" là bắt buộc trên form hệ mới, hệ cũ **không có khái niệm này**.

`LoaiDon` chỉ có 4 giá trị: `TO_CAO` · `KHIEU_NAI` · `KIEN_NGHI` · `PHAN_ANH`.
`loai_thong_tin` của hệ cũ là chữ tự do, đuôi rất dài:

| Giá trị hệ cũ | Hồ sơ |
|---|---|
| Tố giác (gộp cả viết hoa/thường) | ~21.662 |
| Đề nghị | ~9.056 |
| Trình báo | ~5.742 |
| Khiếu nại | 1.206 |
| Xin nhận lại tài sản | 863 |
| Xin bảo lãnh | 578 |
| Kiến nghị | 452 |

Em **không tự đặt** vì đây là phán đoán pháp lý, không phải phép ánh xạ: *tố giác tội phạm*
(BLTTHS) và *tố cáo* (Luật Tố cáo 2018) là hai khái niệm khác nhau, nên ngay cả dòng đông nhất
cũng không hiển nhiên.

Ba hướng, anh chọn:

1. **Anh cho bảng quy đổi** — em áp và bù một lần, hồ sơ cũ lưu được ngay.
2. **Bỏ bắt buộc khi sửa hồ sơ di trú**, giữ bắt buộc cho đơn tạo mới — cán bộ tự phân loại
   dần khi đụng tới từng hồ sơ.
3. **Giữ nguyên** — mỗi lần sửa một hồ sơ cũ, cán bộ phải chọn loại đơn trước khi lưu được.

