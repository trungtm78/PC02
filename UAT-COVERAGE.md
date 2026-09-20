# Đợt mới nhất — 20/09/2026: form Đơn thư nhập liệu nhanh

→ **`docs/uat/dot-2009/UAT-COVERAGE.md`** — 80 ca trên 12 nhóm (A–L), phủ 5 yêu cầu UX nhập liệu
+ 4 lỗi prod vá kèm. Trạng thái: CHƯA CHẠY (chờ merge PR #448 → deploy).

---

# Đợt mới nhất — 18/09/2026: danh sách dễ đọc + tự cập nhật + dữ liệu hệ cũ thiếu

→ **`docs/uat/dot-1809/UAT-COVERAGE.md`** — prod: API 18/18, E2E 23 PASS (2 chờ anh duyệt ghi dữ liệu); 4 lỗi UAT bắt
được đã sửa (#416, #418); gieo lỗi 15/15 bị bắt; 46/46 mệnh đề có bằng chứng.

---

# Sổ phủ UAT — In từ danh sách · STT cũ · bản in Word giống hệ cũ

Mỗi dòng là một MỆNH ĐỀ kèm **tầng của bằng chứng**. Mệnh đề có chủ ngữ là *người dùng* thì bằng
chứng phải đi qua giao diện hoặc HTTP; mệnh đề nói về một *hàm* thì ca đơn vị là đủ — và câu chữ
phải thu hẹp lại cho khớp. Ghi PASS cho mệnh đề rộng dựa trên bằng chứng hẹp là dạng trượt mà mọi
tầng đều xanh trong khi tính năng không dùng được.

Trạng thái: **PASS** · **FAIL** · **CHƯA CHẠY** (chưa có bằng chứng) · **KHÔNG SO ĐƯỢC** (không
có đối chứng).

## M1 — Nút In trên cột Thao tác

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M1-1 | Hành động `print` có trong registry của Vụ án · Vụ việc · Đơn thư | đơn vị | PASS |
| M1-2 | Bảng gộp chọn đúng thực thể theo `recordType` của dòng | đơn vị | PASS |
| M1-3 | `printModal` khai BẮT BUỘC nên shell quên nối là lỗi biên dịch | biên dịch | PASS |
| M1-4 | **Cán bộ bấm icon In trên một dòng danh sách thì mở đúng màn in chứng từ** | E2E trên máy thật | PASS |
| M1-5 | **Chọn mẫu trong popup ấy rồi tải được tệp Word** | E2E trên máy thật | PASS (`ChungTu_20260909.docx`) |

## M2 — STT cũ trong cột STT

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M2-1 | Chuỗi hiển thị đúng dạng hệ cũ `16-243 - (STT cũ: 208)` | đơn vị | PASS |
| M2-2 | Hồ sơ KHÔNG có STT cũ thì không hiện gì thêm | đơn vị | PASS |
| M2-3 | Ô lọc nhận cả `208` lẫn `2016-208` như hệ cũ | đơn vị | PASS |
| M2-4 | Máy chủ Vụ việc TRẢ VỀ `sttCu` (thiếu thì 3.323 hồ sơ trống lặng lẽ) | tích hợp | PASS |
| M2-5 | **Mở danh sách Vụ việc trên máy thật thấy số cũ ở cột STT** | E2E trên máy thật | PASS (hồ sơ `2017-259`) |

## M3 — Bản in Word giống hệ cũ

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M3-1 | Phép so THẤY được khác biệt ngắt đoạn | đơn vị (ca đỏ trước, xanh sau) | PASS |
| M3-2 | Phép so THẤY được khác biệt kiểu chữ (đậm · nghiêng · gạch chân · cỡ) | đơn vị | PASS |
| M3-3 | Bản hệ mới đem so là thứ MÁY CHỦ THẬT trả về, không phải dựng lại | tích hợp (gọi API prod) | PASS |
| M3-4 | `

` ra ĐOẠN mới, `
` đơn ra ngắt dòng mềm — như hệ cũ | đơn vị + dịch vụ | PASS |
| M3-5 | Chỉ mẫu `HE_CU_*` dùng quy ước ấy; mẫu PC01 giữ ngắt dòng mềm | dịch vụ xuất | PASS |
| M3-6 | Định dạng của nhãn KHÔNG trùm lên phần giá trị | đơn vị | PASS |
| M3-7 | **8 mẫu có bản gốc: bản in hệ mới khớp hệ cũ về chữ · đoạn · kiểu chữ** | đối chiếu hiện vật trên máy thật | PASS 10/10 cặp (vòng 4) |
| M3-8 | 3 mẫu hệ cũ chưa từng in | — | KHÔNG SO ĐƯỢC; chỉ kiểm được là dựng ra tệp hợp lệ, 0 biến sót |
| M3-9 | 17 mẫu tố tụng PC01 không có đối tác ở hệ cũ | — | KHÔNG SO ĐƯỢC |
| M3-10 | Mẫu hệ cũ được mời in ở đủ thực thể mà hồ sơ loại ấy nằm | cổng CI + đếm trên máy thật | PASS |
| M3-11 | Mẫu tự điền được ở MỌI thực thể nó được mời in | cổng CI | PASS |
| M3-12 | **Cán bộ mở một Vụ việc di trú từ hồ sơ "Trả hồ sơ" thì thấy mẫu ấy trong popup** | E2E trên máy thật | PASS (hồ sơ `2017-18`) |

## Ba chỗ CỐ Ý khác hệ cũ

| Chỗ | Hệ cũ | Hệ mới | Vì sao |
|---|---|---|---|
| Hồ sơ thiếu khoá | in ra tên biến `${de_xuat}` | in trống | lỗi hệ cũ, không chép |
| Nút In trên danh sách | không có | có | hệ cũ phải mở hồ sơ mới in được |
| Cột Thao tác | ở cuối | ở đầu | anh chốt 25/08 |

## M5 — Monkey test

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M5-1 | 44 màn hình mở được, không màn nào trắng | E2E trên máy thật | PASS |
| M5-2 | 40 lượt bấm ngẫu nhiên không làm vỡ trang | E2E trên máy thật | PASS |
| M5-3 | Không màn nào hiện "Đã xảy ra lỗi" | E2E trên máy thật | PASS |
| M5-4 | Không lỗi console nào ngoài một lỗi đã tìm ra gốc | E2E trên máy thật | PASS |

**Bắt được một lỗi thật ngoài phạm vi việc được giao:** `/api/v1/notifications/stream` trả 401
trên mọi màn hình — dòng thông báo trực tuyến chưa từng chạy. Gốc và cách vá ở PR #351.
Báo cáo đầy đủ: `docs/monkey-test-ket-qua.md`.

Chạy trên máy thật nên bộ monkey **chặn mọi lời gọi ghi ở tầng mạng** — không sửa một hồ sơ nào.


## Bốn lần bộ chạy UAT tự đỏ giả (09/09/2026)

Lượt đầu **0/5**, và không mệnh đề nào trong đó là lỗi sản phẩm:

| Chỗ trượt | Vì sao đỏ giả |
|---|---|
| Ô đăng nhập dò theo NHÃN | ô có `id` nhưng không có nhãn liên kết → không đăng nhập được → mọi mệnh đề sau đỏ |
| `getByTestId('btn-print')` | testid dựng theo từng dòng (`btn-print-<id>`), khớp chính xác là trượt |
| Tìm kiếm dùng `?q=` | khoá có TIỀN TỐ (`incidents_q`), nên trang bỏ qua và hiện danh sách mặc định — toàn bản nhập thử, không bản nào có STT cũ |
| Tìm nút In ở màn CHI TIẾT Vụ việc | nút ấy nằm ở màn sửa và ở danh sách, không ở màn chi tiết |

Ảnh chụp màn hình là thứ phân biệt được "sản phẩm hỏng" với "bộ chạy hỏng": nhìn ảnh thấy
**icon máy in nằm sẵn trong cột Thao tác**, tức sản phẩm đúng còn phép đo sai.


## M6 — Ô tìm dạng thẻ (đợt tìm kiếm, 15–16/09/2026)

Sổ phủ của đợt tìm kiếm. Quy tắc của tệp này giữ nguyên: mệnh đề có chủ ngữ là *cán bộ* chỉ được
PASS bằng bằng chứng đi qua giao diện hoặc HTTP trên máy thật — ca kiểm đơn vị KHÔNG đủ, dù xanh.

### Máy chủ (bằng chứng: ca kiểm đơn vị/tích hợp — đã có)

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M6-1 | Thẻ `khoá~giá trị` thành điều kiện nối `where.AND`, không gán đè khoá tầng trên (giữ phạm vi dữ liệu) | đơn vị | PASS |
| M6-2 | Khoá thẻ không có trong khai → 400, KHÔNG âm thầm trả dữ liệu chưa lọc | đơn vị | PASS |
| M6-3 | Thẻ chọn trên cột Boolean dùng `equals` (Prisma `BoolFilter` không có `in`) | đơn vị + cổng kiểu cột | PASS (lỗi 500 đã sửa) |
| M6-4 | Kiểu thẻ khai hợp kiểu cột `schema.prisma` ở MỌI khai | cổng CI | PASS |
| M6-5 | Nhật ký: xuất CSV áp CÙNG thẻ với danh sách | đơn vị | PASS |
| M6-6 | Trễ hạn: chỉ nhận `*` + khoá chung ba khai; khoá riêng một loại → 400 | đơn vị | PASS |
| M6-7 | Trễ hạn: lọc `priority` và `recordType` (hoa/thường) áp ở máy chủ | đơn vị | PASS (đã sửa sau codex) |
| M6-8 | Danh sách đã xoá (Khôi phục) nhận thẻ theo khai từng loại + DTO kiểm `limit`/`offset` | đơn vị | PASS |
| M6-8b | Xuất Excel đơn thư áp CÙNG thẻ với danh sách (xuất đúng thứ đang hiện) | đơn vị + giao diện | PASS (lỗi có sẵn, codex bắt) |

### Cán bộ trên máy thật (CHƯA CHẠY — phải bấm thử sau khi deploy)

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M6-9 | **Gõ không dấu ("nguyen") ra hồ sơ có dấu ("Nguyễn") ở từng màn danh sách** | E2E trên máy thật | CHƯA CHẠY |
| M6-10 | **Chọn được cột cụ thể trong gợi ý rồi lọc đúng cột ấy** | E2E trên máy thật | CHƯA CHẠY |
| M6-11 | **Thẻ nằm trên địa chỉ trang: lùi trang và dán đường dẫn giữ nguyên bộ lọc** | E2E trên máy thật | CHƯA CHẠY |
| M6-12 | **Chọn thẻ Trạng thái ở Người dùng · Danh mục · Ánh xạ địa chỉ không lỗi** (lỗi 500 đã sửa) | E2E trên máy thật | CHƯA CHẠY |
| M6-13 | **Nhật ký: gõ không dấu ra ĐÚNG tên người thực hiện** (trước đây trình duyệt lọc lại nên không bao giờ ra) | E2E trên máy thật | CHƯA CHẠY |
| M6-14 | **Ô tìm toàn cục: "Xem tất cả" mở danh sách ĐÃ lọc** (trước gửi `?search=` không màn nào đọc) | E2E trên máy thật | CHƯA CHẠY |
| M6-15 | **Ô tìm toàn cục: bấm một vụ việc mở đúng hồ sơ ấy; bấm một đối tượng mở danh sách đúng loại** | E2E trên máy thật | CHƯA CHẠY |
| M6-16 | **Cờ `TIM_KIEM_THE` tắt → ô chữ cũ vẫn tìm được như trước** | E2E trên máy thật | CHƯA CHẠY |
| M6-17 | **Bộ gõ tiếng Việt: Enter lúc đang ghép chữ không mở nhầm kết quả** | E2E Chrome thật | CHƯA CHẠY |

### Số đo phải có sau khi deploy (CHƯA CHẠY)

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M6-18 | Nạp cột bóng prod xong, chạy thử lại còn 0 dòng lệch (mọi bảng M6) | CLI trên prod | PASS (16/09: nạp users 257 · incidents 4.855 · directories 15.913 · audit_logs 13.446 · address_mappings 1.086 · documents 10 → chạy thử lại 0 lệch cả 10 bảng) |
| M6-19 | Kiểm vàng bỏ dấu (chuỗi thật) lệch 0 giữa JS và SQL | CLI trên prod | PASS (646 tổng hợp + 100.531 chuỗi thật, lệch 0, PG16.15) |
| M6-20 | Truy vấn thẻ dùng được chỉ mục GIN (bảng lớn), chỉ mục có đủ ở mọi bảng | EXPLAIN + `pg_indexes` trên prod | PASS (Danh mục 0,64 ms qua GIN; Nhật ký đếm toàn bộ 2,6 ms qua GIN; bảng nhỏ ≤13k dòng bộ tối ưu chọn Seq Scan — chỉ mục vẫn có đủ) |

### Lỗ hổng phủ — phát hiện khi rà oracle 16/09/2026

Rà toàn bộ `docs/uat/**` để tìm oracle bị ngữ nghĩa M2–M6 làm sai. Kết quả quan trọng hơn cả
danh sách sửa: **ba thay đổi hành vi không làm sai ca nào, vì KHÔNG CÓ ca nào phủ chúng.**
Đây là lỗ hổng phủ, không phải bằng chứng an toàn.

| # | Thay đổi hành vi | Ca phủ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| M6-21 | Chuỗi tìm 1–2 ký tự khớp **CHUỖI CON** ở bất kỳ đâu ("an" ra CẢ "Nguyễn Văn An" LẪN "Toàn") — **luật đổi 17/09** | **TC-CASE-131** (viết 16/09, lật 17/09) | CHƯA CHẠY | Trước đó 0 ca: cả kho chỉ có TC-064 dùng chuỗi 1 ký tự và đó là `%`. Ngày 16/09 ca viết theo luật đầu từ; 17/09 anh báo tìm kiếm chưa đúng %like% nên lật lại |
| M6-24 | Thẻ **STT gõ một phần** vẫn ra: "STT: 78" ra mọi đơn có STT chứa 78; dạng ngắn "26-11171" vẫn ra "2026-11171" | **TC-PET-124** (viết 17/09) | CHƯA CHẠY | Từ báo lỗi thật 17/09: thẻ mã so ĐÚNG NGUYÊN mã nên "STT: 78" ra "Không tìm thấy". Cùng luật áp mã thường (mã danh mục, mã cán bộ, IP, thao tác) |
| M6-22 | `/cases/admin/deleted` KHÔNG còn tìm theo `id` | **TC-CASE-132** (viết 16/09) | CHƯA CHẠY | Trước đó 0 ca: 8 ca chạm endpoint (TC-CASE-081, TC-INC-077/117, TC-PET-045/089, TC-167/168/213) đều chỉ kiểm phân quyền và phân trang, không ca nào truyền tham số tìm |
| M6-22b | `/incidents/admin/deleted` nhận thẻ tìm và lọc đúng; khoá lạ → 400 | **TC-INC-142** (viết 16/09) | CHƯA CHẠY | Trước đó 0 ca: TC-INC-077 và TC-INC-117 đều chỉ kiểm 403 |
| M6-22c | `/petitions/admin/deleted` nhận thẻ tìm và lọc đúng; khoá lạ → 400 | **TC-PET-123** (viết 16/09) | CHƯA CHẠY | Trước đó 0 ca: TC-PET-045 và TC-PET-089 đều chỉ kiểm 403 |
| M6-23 | `/incidents/linkable` tìm MỌI cột (trước chỉ khớp tiền tố mã) | **TC-INC-141** (viết 16/09) | CHƯA CHẠY | Trước đó 0 ca: 3 ca chạm linkable (TC-INC-007, TC-007 v2, TC-060) đều không có bước tìm |

**Số ca đi theo số ĐƯỜNG MÃ độc lập, không theo số màn hình.** Vì sao M6-21 chỉ một ca mà
M6-22 phải ba: quy tắc khớp chuỗi (nay là chuỗi con ở mọi độ dài) nằm ở đúng **một** chỗ dùng chung
(`common/tim-kiem/dieu-kien.ts`, hàm `mauBoDau` — mọi khai đều đi qua), nên một ca kiểm là đủ,
sửa hỏng chỗ ấy là ca đỏ ngay. Ngược lại ba danh sách đã xoá có **ba khai riêng**, nên phải ba ca.
Đếm theo màn hình thì vừa viết thừa ở chỗ dùng chung, vừa viết thiếu ở chỗ tách đường.

**Bịt lỗ hổng phải bịt cả ba cửa, không phải một.** Đợt đầu chỉ viết ca cho
`/cases/admin/deleted`, trong khi cùng thay đổi ấy áp lên cả ba danh sách đã xoá. Đo lại thấy
bộ Vụ việc và bộ Đơn thư cũng 0 ca truyền tham số tìm — nên có thêm M6-22b và M6-22c.

**Đính chính lỗi của chính đợt tài liệu trước (PR #383):** TC-PET-121 và TC-PET-122 khi ấy chỉ
được ghi vào `.batches/batch_2.json`, **bỏ sót** `petitions/uat.json` và `petitions/uat_petitions.md`,
và cũng quên nâng mục tiêu phủ. Đã bổ sung đủ ba bản ngày 16/09. Đây là lỗi bỏ sót bản song sinh —
đúng thứ tệp này vẫn cảnh báo — nên ghi ra thay vì lặng lẽ vá.

Ba ca kiểm đã được **viết** ngày 16/09/2026 và ghi vào cả ba bản song sinh của mỗi bộ
(`uat.json` · `uat_<bộ>.md` · `.batches/batch_5.json`); mục tiêu phủ nâng theo: Vụ án 130 → 132,
Vụ việc 140 → 141.

Trạng thái vẫn là **CHƯA CHẠY**: viết ca kiểm không phải là chạy ca kiểm. Ba mệnh đề này chỉ
chuyển sang PASS khi có bằng chứng chạy thật qua HTTP hoặc giao diện.

**Không** cập nhật `uat_excel_input.json` của hai bộ: tệp ấy là đầu vào sinh bảng Excel, mang
lược đồ khác (`expected_api`/`expected_ui`) và được sinh lại từ bộ chạy chuẩn hoá — sửa tay vào
đó là tạo thêm một nguồn thứ tư dễ lệch. Ghi ra đây để lần sinh sau ai đó không tưởng là bỏ sót.

### Oracle đã sửa vì ngữ nghĩa M2–M6 (16/09/2026)

| Ca | Sai ở đâu | Đã sửa thành |
|---|---|---|
| TC-078 (Vụ việc) | Kỳ vọng gõ không dấu **KHÔNG** ra hồ sơ có dấu ("cần unaccent extension") | Gõ không dấu PHẢI ra — `unaccent` + `f_bo_dau` + cột bóng đã chạy thật trên prod |
| TC-077 (Vụ việc) | Mệnh đề kể cả cột `unit` | Bỏ `unit` (đo prod: rỗng 100% vụ án nên đã loại khỏi thẻ `*`); số 2 kết quả giữ nguyên |
| TC-007 (Vụ án) | `name ILIKE %trộm%` | `tim_kiem_bd contains 'trom'`, nối vào `where.AND` cùng phạm vi |
| TC-032 (UTDT) | Dữ liệu mẫu không nói rõ cột, dễ lấy nhầm tên điều tra viên → 0 dòng, đỏ oan | Chốt dữ liệu phải nằm ở cột thuộc thẻ `*` của khai Vụ án; tìm theo điều tra viên dùng `investigatorName`/thẻ `dieuTraVien` |
| TC-009 (Đơn thư) | Mục "Kết quả mong đợi → API" **bỏ trống** — ca không chấm được | Điền oracle theo `REQ-PET-RD-03` |
| TC-CASE-047 | "MaxLength fail (bảo vệ JSONB ILIKE)" | Chặn ở `DO_DAI_GIA_TRI_TOI_DA = 200` + `@MaxLength`, trước khi chạm CSDL |
| TC-CASE-089 | "ILIKE literal" | `contains` trên cột bóng, Prisma tự thoát `%`/`_` |
| TC-INC-123 | "match (nếu citext/unaccent) — verify behavior" | Bỏ mệnh đề có điều kiện; hành vi tất định |

Mỗi ca có 2–3 bản song sinh (`.md`, `uat.json`, `uat_excel_input.json`, `.batches/batch_*.json`).
Đã sửa **đồng bộ 12 bản** và xác nhận bằng máy: 8 tệp JSON parse được, số ca giữ nguyên
(130 · 130 · 30 · 30 · 140 · 140 · 20 · 781), 11 ca mang dấu sửa. Sửa một bản là để lại hai
oracle mâu thuẫn cho cùng một mã ca.

### Đã biết, cố ý không làm trong đợt này

| Chỗ | Vì sao |
|---|---|
| Thẻ `*` không tìm `petitions.unit` (89/47.273 dòng = 0,19%) và `cases.unit` (0 dòng) | đổi khai phải sinh lại cột bóng đơn thư đã chạy prod từ M2; số đo quá nhỏ so với rủi ro |
| Đơn vị hành chính giữ ô chữ | là ô gợi ý kiểu Cmd+K, không phải màn danh sách; chỉ máy chủ bỏ dấu |

## Chốt cuối (09/09/2026)

Cả năm mốc PASS trên **máy thật**, kiểm tận nơi chứ không suy từ ca kiểm:

- **10/10 cặp bản in**: 0 lệch dữ liệu · 0 lệch bố cục · 0 lệch kiểu chữ. Bốn chỗ lệch còn lại
  đều là hệ cũ tự in ra tên biến của nó — lỗi hệ cũ, cố ý không chép.
- **5/5 mệnh đề có chủ ngữ là CÁN BỘ** chạy qua giao diện thật.
- **Monkey test**: 44 màn · 40 lượt bấm · 0 màn trắng · **0 lời gọi bị máy chủ từ chối**.

Ba lỗi tìm thêm ngoài phạm vi được giao, đã vá và đã lên máy: 5.227 hồ sơ không mời in được
chứng từ hệ cũ (#347) · dòng thông báo trực tuyến 401 (#351) · ô lọc cán bộ rỗng (#353).

Hai bộ công cụ đã đưa vào kho để chạy lại được: `tools/monkey-test/` và `tools/uat-may-that/`.
