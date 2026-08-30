# PROGRESS

STATUS: ALL_MILESTONES_DONE

Cập nhật: 2026-08-28T12:00+07:00 | Milestone: 5/5 + UAT + in chứng từ như hệ cũ | Task: xong

<!-- Dấu STATUS phải nằm ĐẦU DÒNG: `.claude/hooks/stop-guard.bat` neo bằng `^STATUS:`.
     Kẹp nó giữa một dòng có nội dung khác thì hook không khớp và chặn mãi. -->

Epic hiện tại: **Đồng bộ form Vụ việc với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`

> Hai epic trước đã xong và lên máy thật, ghi ở
> [docs/progress/](docs/progress/): **Vụ án** (26/08) và **Đơn thư** (27/08, PR #249–#267).

## Đợt 29/08 (sáng) — mở khoá tài khoản + vòng đời mẫu chứng từ

Anh báo hai việc, đào ra hai lỗ hổng quản trị khác nhau.

### 1. Không đăng nhập được (PR #313)

Tài khoản `admin` bị khoá 15 phút do 5 lần sai liên tiếp. Hệ thống **cố ý** báo
"Invalid credentials" thay vì "đang bị khoá" — chống dò tên đăng nhập, quyết định đúng từ v0.27.
Cái giá: người bị khoá không tự biết.

**Lỗ hổng thật:** cả hệ thống KHÔNG có đường mở khoá nào. Chờ đủ 15 phút, hoặc chạy SQL trên máy
thật. Với 238 cán bộ, đó là việc lặp hằng tuần.

Đã thêm `POST /admin/users/:id/unlock` + dấu đỏ trên màn quản lý người dùng. KHÔNG đụng thông báo
đăng nhập — lời giải là cho quản trị thấy và mở được, không phải gỡ lớp phòng thủ.

Một chi tiết đánh lừa chính em lúc chẩn đoán: so `lockedUntil` bằng đồng hồ CSDL cho ra "hết
khoá", trong khi ứng dụng vẫn thấy đang khoá — cột lưu không kèm múi giờ.

### 2. "Mẫu chứng từ lạ" ở Vụ việc (PR #314)

Ba mẫu `TPL_MALICIOUS` / `TPL_XXE_baseline` / `TPL_NORMAL_baseline` do đợt kiểm bảo mật 28/08 để
lại, ở `active` nên hiện thẳng trong popup In chứng từ của MỌI cán bộ.

**Gốc rễ không phải ba hàng rác**, mà là mẫu vừa tải lên đã thành `active` NGAY — không có bước
nào giữa "một người tải tệp lên" và "toàn bộ cơ quan nhìn thấy nó".

Đã dựng vòng đời `draft` → `active` → `archived`. Mẫu tải tay vào `draft`; phải Ban hành tường
minh mới tới cán bộ; Thu hồi thay vì xoá để lịch sử in vẫn tra được. Popup in VỐN đã lọc
`status:'active'` nên không phải sửa dòng nào ở đường in. Hai bộ seed khai `active` tường minh
nên 31 mẫu chính thức không ảnh hưởng.

Đã dọn 3 mẫu rác trên máy thật (xoá mềm, giữ hàng để 1 bản ghi lịch sử in không mồ côi). Còn lại
đúng: Đơn thư 14 · Vụ án 8 · Vụ việc 6.

### Đã kiểm trên máy thật, KHÔNG phải lỗi

Anh nghi "Vụ việc và Đơn thư chưa lưu setting" và "không thấy chức năng tích sẵn". Chạy chẩn
đoán thẳng trên máy thật: màn quản lý có đủ **31 công tắc "Tích sẵn khi in"**, và Đơn thư lưu
được (`DON_THU ... mode: zip`). Cả hai chức năng đều đang chạy đúng.

## Đợt 29/08 — popup In chứng từ NHỚ lựa chọn của từng cán bộ

Anh yêu cầu: "lưu trữ các setting để lần tới dùng lại, không cần phải setup lại", phạm vi "tất
cả việc select chọn đến việc Định dạng xuất".

**Đo trước khi làm:** popup không nhớ gì — cả thư mục `features/document-templates` không có một
dòng `localStorage` nào, không biến sống ngoài component, và popup bị GỠ khỏi màn hình khi đóng
nên mọi lựa chọn tan hết. Đơn thư 14 mẫu → tích lại từ đầu mỗi lần in.

### Anh chốt

- Cá nhân hoá, **không** phải thiết lập chung. Hiện lên thì ưu tiên lựa chọn của chính người ấy;
  ai chưa từng đặt thì dùng cờ "Tích sẵn khi in" admin bật ở màn Quản lý mẫu chứng từ.
- Lưu ở **máy chủ theo tài khoản** — đổi máy vẫn nhớ.

### Đã làm

Bảng `user_export_preferences` (userId, entityType) → `templateIds[]` + `mode`, theo đúng khuôn
ba bảng thiết lập-theo-người-dùng đã có. Module backend sao khuôn `user-table-layouts`. Popup
gieo lựa chọn theo thứ tự cá-nhân-trước-admin-sau, thêm nút "Dùng lại mặc định".

**CỐ Ý không nhớ** `fillValues` (bổ sung thông tin thiếu): nó gắn chặt vào MỘT hồ sơ — dùng lại
cho hồ sơ khác là in sai dữ liệu.

### Ba bẫy đã dẫm, ghi lại

1. **Vòng lặp render vô tận** — đưa cả đối tượng hook vào mảng phụ thuộc `useEffect` mà nó được
   dựng mới mỗi lượt render. React báo "Maximum update depth exceeded" ngay ca kiểm đầu. Nay hook
   gói `useMemo` và popup bám vào đúng hàm ổn định.
2. **17 ca kiểm cũ vỡ** vì popup nay dùng react-query mà chúng chưa bọc `QueryClientProvider`.
3. **Lấy lựa chọn qua `useQuery` là sai** — dữ liệu về ở lượt render sau nên có khoảnh khắc danh
   sách đã hiện mà chưa ô nào tích. Đổi sang `fetchQuery` trong `Promise.all`.

### Codex bắt 3 lỗi — nặng nhất là RÒ DỮ LIỆU GIỮA HAI TÀI KHOẢN

`queryClient` là một thể duy nhất, `clearTokens()` không đụng kho đệm, khoá truy vấn không kẹp
danh tính → hai cán bộ chung máy, người sau đọc trúng dữ liệu người trước trong khoảng
`staleTime`. **Lỗi CÓ SẴN**: `useBoCucCot` dựng hôm trước dính y hệt. Sửa ở gốc bằng
`useXoaKhoDemKhiDoiTaiKhoan` — xoá kho đệm khi token biến mất, chặn cả lớp lỗi kể cả cho tính
năng chưa viết.

Hai lỗi còn lại: nhánh sau "Lưu bổ sung" tự tích theo cờ admin kể cả khi đã có lựa chọn riêng;
và Đặt lại đua với Xuất (lệnh GHI đua lệnh XOÁ).

### UAT 64/64 PASS + một đính chính

Ma trận ở [UAT-COVERAGE.md](UAT-COVERAGE.md): API 10 · giao diện 4 · thành phần 13 · kho đệm 3 ·
backend 37. Bài kiểm trả máy thật về nguyên trạng (kiểm lại: 0 bản ghi).

**ĐÍNH CHÍNH:** PR #311 ghi rằng UAT chứng minh `mutate` bắn-rồi-quên không gửi được lệnh ghi.
Điều đó CHƯA được chứng minh — lần chạy hỏng ấy giải thích trọn vẹn bằng lỗi của chính bài kiểm
(endpoint trả thân TRẦN, bài kiểm lại bóc `?.data`), và soi CSDL lúc ấy thấy bản ghi ĐÃ ghi đúng.
Đổi sang `mutateAsync` + `await` vẫn đúng về mặt thiết kế, nhưng lý do nêu trong PR là nói quá.

Đây là lần THỨ HAI trong hai ngày dẫm đúng bẫy "bóc thân phản hồi hai kiểu", dù đã ghi vào bộ nhớ
từ hôm trước.

## Đợt 28/08 (tối) — mẫu tự đặt tích sẵn hay không + chọn hàng loạt khi in

Anh báo: popup In chứng từ tích sẵn hết, muốn đặt được từng mẫu có tích sẵn không, và muốn có
Chọn tất cả / Bỏ chọn tất cả.

**Đo trước khi làm** (máy thật): Đơn thư **14 mẫu** đang bật, Vụ án 8, Vụ việc 6. Nên mỗi lần
cán bộ Đơn thư bấm xuất là ra 14 tệp Word — trong đó có `Sổ đăng ký bào chữa (mẫu hệ cũ)` vốn
in ra tờ TRẮNG (đợt đối chiếu bản in đã đo: cả 12 chỗ điền của nó đều là ô không hồ sơ nào có
dữ liệu). Muốn lấy đúng một phiếu thì phải bỏ tích 13 lần.

### Đã làm

Cột `document_templates.selectedByDefault` (`DEFAULT false` — anh chốt tắt hết, popup mở ra
trống). Chỉnh được ở **cả hai chỗ**: công tắc bật nhanh trên danh sách mẫu và ô tích trong form
sửa. Popup thêm **Chọn tất cả / Bỏ chọn tất cả**, chỉ chọn mẫu đủ điều kiện.

### Ba chỗ đáng nói

1. **`select` của bộ nạp popup là danh sách viết tay.** Quên khai cột ở đó thì popup KHÔNG BAO
   GIỜ thấy cờ — admin bật công tắc mà chẳng có gì đổi, và mọi ca kiểm khác vẫn xanh. Đúng lớp
   lỗi đã trả giá sáng cùng ngày. Có cổng canh riêng; **gieo lỗi** xác minh cổng đỏ thật.
2. **Gieo lựa chọn đặt trong `.then` của `Promise.all`, không dùng `useEffect`.** Effect chạy
   sau một nhịp render → có khoảnh khắc danh sách đã hiện mà chưa ô nào tích; ca kiểm bấm Xuất
   ngay lúc ấy thấy nút khoá, người dùng nhanh tay cũng gặp. Chạy 3 lần liên tiếp đều xanh.
3. **Hai nút chọn hàng loạt đặt trong `ExportReadinessChecklist`, không ở modal** — `effReady()`
   nằm ở đó; đặt ở modal là chép nó lần thứ hai và hai bản sẽ lệch nhau ngay lần sửa đầu.

Giữ nguyên có chủ ý: mẫu vừa đủ điều kiện sau "Lưu bổ sung" vẫn tự tích; modal xuất Word hàng
loạt không đụng tới (nó vốn mở ra trống).

### Codex bắt 5 lỗi sau khi ca kiểm đã xanh — vá 4, giữ 1 có lý do

1. Nhánh sau "Lưu bổ sung" tự tích MỌI mẫu vừa mở khoá, không xét cờ. Một ô nhập mở khoá được
   nhiều mẫu (chúng dùng chung field thiếu) → mẫu admin cố ý tắt vẫn nhảy vào bản xuất.
2. `fetchReadiness` không chặn kết quả lượt cũ về muộn — đổi hồ sơ giữa chừng thì lựa chọn gieo
   theo hồ sơ đã rời màn hình. Thêm bộ đếm lượt nạp.
3. Công tắc chặn CẢ BẢNG trong lúc gửi, mà giao diện chỉ khoá đúng dòng ấy → cú bấm ở dòng khác
   rơi mất im lặng. Nay chỉ chặn đúng dòng đang gửi.
4. Thêm cột thứ 8 mà dòng "chưa có mẫu" vẫn `colSpan={7}`.
5. **KHÔNG sửa**: `effReady` coi "không có mục readiness" là đủ điều kiện, nên "Chọn tất cả" sẽ
   chọn cả chúng. Lúc ấy ô tích vẫn ĐANG bật và bấm tay chọn được từng cái — "Chọn tất cả" phải
   chọn đúng thứ bấm tay chọn được. Lệch khỏi ô tích là dựng hai định nghĩa "đủ điều kiện". Đã
   ghi lý do ngay trong mã.

### Đã lên máy thật + UAT 28/28 PASS

Bản dựng `f9ac8c67`, cột đã tạo, 28 mẫu đều TẮT đúng như anh chốt. Ma trận phủ ở
[UAT-COVERAGE.md](UAT-COVERAGE.md): API 7/7 · giao diện 2/2 · thành phần 17 · backend 10 — tổng
**28/28 dòng PASS**. Bài kiểm trả cấu hình về nguyên trạng (kiểm lại: 0/28 bật).

Bài kiểm tự dẫm hai bẫy, ghi lại vì cả hai đều là **xanh giả**:
- bóc thân phản hồi hai kiểu ở hai chỗ trong cùng tệp → 3 ca báo đỏ giả;
- đặt tên tệp E2E không khớp mẫu bộ chạy (`*-uat.e2e.spec.ts`) → "No tests found", báo cáo sạch
  vì **không có gì được kiểm**.

**Cảnh báo khi lên máy thật:** 28 mẫu sẽ TẮT hết, cán bộ mở popup thấy trống cho tới khi anh bật
mẫu hay dùng. Đây là hành vi anh đã chốt.

## Đợt 28/08 (chiều) — in chứng từ: hệ cũ in được, hệ mới thì không

Anh báo dữ liệu chuyển sang không in được. Đo bằng API sẵn sàng-in: **Đơn thư 3/7 · Vụ việc
0/5 · Vụ án 0/5**.

### Nguyên nhân

Đọc mã in hệ cũ (`_PC02/Modules/doi_1/act/xuatfile.php` — có sẵn trong kho mã): nó tra `loai`
ra **một trong 11 mẫu Word**, rồi đổ **toàn bộ trường hồ sơ** vào chỗ trống. Không đòi trường
nào; ô chưa nhập thì in ra trống. Nên bấm hồ sơ nào cũng ra file.

13 mẫu của hệ mới là **quyết định tố tụng**, đòi trường mà **cả hai hệ đều chưa từng có**:
`so_ket_luan_dieu_tra` 0 · `nguoi_quyet_dinh` 0 · `don_vi_xu_ly` 0 · `de_xuat` 1/8.000.

### Năm PR

- [x] **#289** — mang nguyên 11 mẫu hệ cũ sang, không sửa file .docx
- [x] **#290** — bộ seed tìm được file .docx khi chạy từ bản biên dịch
- [x] **#291** — 13 mẫu tố tụng in được: bổ sung khoá tự điền, bỏ đòi trường không hệ nào có
- [x] **#292** — seed cập nhật lại NGUỒN của biến theo danh mục
- [x] **#293** — đường kéo cờ bắt buộc về đúng bảng khai (`SEED_TEMPLATES_SYNC_REQUIRED=1`)

### Kết quả trên máy thật

| | |
|---|---|
| Sẵn sàng in | **84/84 mẫu** trên 9 hồ sơ (3 mỗi màn) |
| In thật ra file | 24/28 lượt xanh, 4 lượt vướng giới hạn tốc độ máy chủ (5 lần/phút) — không phải lỗi mẫu |
| Nội dung | không sót chỗ trống nào; số hồ sơ, người gửi, nguồn đơn, đơn vị, nội dung đều đúng |

### Codex bắt 12 lỗi qua 6 vòng — trong đó 1 lỗi CÓ SẴN

Đáng nhớ nhất:

- mẫu hệ cũ dùng cặp `${…}` (PhpWord), khai mặc định `{…}` sẽ để dấu `$` trước **mọi** giá trị;
- `<w:t[^>]*>` khớp cả `<w:tab/>` — **lỗi có sẵn**, âm thầm nuốt tab của mọi mẫu lúc nạp;
- `{hoTenBiCan}` in cả bị hại và nhân chứng → quyết định khởi tố có thể ghi tên **người bị hại** vào chỗ bị can;
- căn cứ tạm đình chỉ in ra **mã enum** (`CHUA_XAC_DINH_BI_CAN`) trên văn bản chính thức;
- mốc thời gian lấy từ bản thô in **sớm một ngày** (hệ cũ trừ offset +7 hai lần);
- seed bỏ qua mẫu "đã có cấu hình" → bản vá **không bao giờ tới được máy thật**.

### Cổng em tự viết mà vô dụng — ghi lại để không lặp

Cổng "seed phải đồng bộ nguồn" ban đầu chỉ **dò chuỗi trong mã**. Kiểm ngược bằng cách **đổi
tên hàm** vẫn xanh. Đã thay bằng ca kiểm hành vi thật trên chính hàm ấy.

## Đợt 28/08 — chuyển dữ liệu mới nhất của hệ cũ sang hệ mới

Anh yêu cầu chuyển dữ liệu mới nhất đến hôm nay, và cấp repo hệ cũ
(`github.com/phuongdeptrai2512/pc02hcm.com`) — trong đó có chuỗi kết nối MongoDB live. Đã lưu
vào bộ nhớ riêng để khỏi lấy lại.

- [x] **PR #286** — bộ cập nhật đọc THẲNG MongoDB hệ cũ, không cần dump.
      Dump trong kho là 22/07/2026, cũ hơn hôm nay hơn một tháng. Bộ mới dùng lại nguyên
      đường nạp cũ (bảng chờ · bảng tra cứu · `commit`), chỉ đụng hồ sơ CHƯA CÓ hoặc ĐÃ SỬA
      — chạy lại toàn bộ là ghi đè lên thứ cán bộ vừa sửa trên hệ mới.
- [x] **PR #287** — đường nạp tự bù mã. Chạy thật xong mới lộ: 83 hồ sơ mới mang mã
      `DT-LEGACY-…` thay vì `2026-11253`, và bộ đếm tụt lại nên hồ sơ tạo mới sau đó sẽ
      TRÙNG mã. Cổng mới chốt cả hai đường nạp phải gọi bù mã.

### Kết quả trên máy thật

| | |
|---|---|
| Hệ cũ (còn sống) | 55.173 hồ sơ |
| Hệ mới đã có | 55.300 khoá |
| **Còn thiếu** | **0** |
| Đã nạp đợt này | 83 hồ sơ mới + 10 hồ sơ đã sửa |
| Mã mới nhất | `2026-11253` — 27/08/2026 |
| Bộ đếm đã nâng | đơn thư 11172→11253 · vụ việc 10966→11219 · vụ án 11140→11185 |

Sao lưu trước khi chạy: `/home/pc02/backups/pre-capnhat-hecu-20260828-011032.sql.gz` (131 MB,
toàn bộ CSDL). Chạy lại lần hai: "không có gì phải cập nhật" — đúng tính bình ổn.

### Đã đo, KHÔNG phải lỗi

**121 vụ việc còn mã tạm** `VV-LEGACY-…`: 118 đến từ bảng `TamDinhChi_vu_viec_21` của hệ cũ —
bảng ấy không có trường `nam`/`stt`, nên chính hệ cũ cũng không cấp mã cho chúng; 3 hồ sơ còn
lại từ `ho_so_doi_1` cũng thiếu cả hai trường. Không suy được mã, và bịa một mã là sai.

**5 hồ sơ hệ cũ đánh dấu đã xoá**: không xoá theo ở hệ mới. Hệ cũ xoá mềm, hồ sơ đã sang đây
có thể đang được xử lý, và xoá dữ liệu vụ án theo một cờ ở hệ khác là việc không hoàn lại được.

## Đợt 27/08 tối — rà soát TỪNG CỘT ba màn so hệ cũ

Anh yêu cầu kiểm từng cột của ba danh sách so với hệ cũ, và thêm: mặc định sắp theo STT
giảm dần, bấm tiêu đề đổi chiều.

- [x] **PR #283** — bốn cột đang hiện dữ liệu của cột khác, và sắp xếp theo STT.
      Em so từng ô, từng hồ sơ, trên 54.736 hồ sơ di trú (bản gốc hệ cũ nằm trong
      `legacyRaw`). Không cột nào HỤT, nhưng bốn cột lấy dữ liệu sai chỗ:

      | Màn | Cột | Đang hiện | Phải hiện | Sai |
      |---|---|---|---|---|
      | Đơn thư | Ngày đề xuất | ngày tiếp nhận | ngày đề xuất | 29.026 hồ sơ |
      | Đơn thư | Tóm tắt nội dung | bản rút gọn | nội dung thật | 58 hồ sơ |
      | Vụ việc | Tên cá nhân… | đối tượng bị tố | người cung cấp | khớp gốc 0% |
      | Vụ án | Tên cá nhân… | tên vụ án | người cung cấp | khớp gốc 0% |

      Codex bắt 5 lỗi ca kiểm không thấy, nặng nhất: `BigInt` làm `JSON.stringify` ném lỗi
      → mở BẤT KỲ hồ sơ nào là 500, cả ba màn. Đã vá, mỗi lỗi một nhánh cổng.

- [x] **PR #284** — đăng nhập hệ cũ (CHỈ ĐỌC) đọc thẳng mã nguồn ba màn anh chỉ
      (`/doi-1/don-thu`, `/doi-1/vu-viec-da-phan-loai`, `/doi-1/vu-an-da-phan-loai`).
      Xác nhận trực tiếp cả bốn bản vá trên, và bắt thêm một lệch: Vụ án ẩn nhầm cột
      "Nguồn đơn/Đơn vị giao" vì bản trước đo màn `/VuAn` — một màn KHÁC.

### Bấm thử trên máy thật sau deploy #283

| Việc | Kết quả |
|---|---|
| Thứ tự mặc định STT giảm dần | đúng ở cả ba màn |
| Bấm tiêu đề đổi chiều | đúng ở cả ba màn |
| Sắp theo SỐ, không theo chuỗi | `2026-10000 → 2026-9999` đúng; 1.500 mã liên tiếp không sai chỗ nào |
| Bốn cột đã vá | hiện đúng dữ liệu |
| Mở chi tiết (chỗ BigInt từng gây 500) | mở được cả ba màn |
| Bù ngày đề xuất | 426 hồ sơ, nay không còn hồ sơ nào thiếu |

### Khác hệ cũ CÓ CHỦ Ý

Sắp mặc định của hệ cũ là `stt` **tăng dần**; anh yêu cầu **giảm dần** nên hệ mới để giảm dần.

### Đã đo, KHÔNG dựng được

| Cột | Lý do |
|---|---|
| "Đơn vị" (`don_vi_ten`) | hệ cũ suy tên lúc chạy; bản gốc 0 bản ghi, mã đơn vị ánh xạ ra nhiều tên |
| "Đối tượng bị can" của Vụ việc | `bi_can_info` rỗng ở cả 5.000 hồ sơ mẫu, hệ mới không có quan hệ ấy |

Dựng cột rỗng cho khớp danh sách là bịa dữ liệu.

## Đợt 27/08 chiều — cột "Đơn vị giải quyết" rỗng toàn bộ

Anh chỉ ra trên ảnh chụp hệ cũ. Đo lại: hỏng thật, và hỏng hoàn toàn.

- [x] **PR #280** — quy Đơn thư · Vụ việc · Vụ án về một cột `donViGiaiQuyet`.
      `unit` có **0** bản ghi, `donViGiaiQuyet` có 46.642 đơn thư + 3.286 vụ án. Ba lớp (ô
      form · cột danh sách · bộ lọc) nhất quán với NHAU ở cột sai nên mọi ca kiểm khứ hồi
      đều xanh. Kèm ba cổng mới, và dedup **31 ô trùng** của Vụ án mà cổng thứ ba bắt được.
      Codex hai vòng bắt 5 lỗi em đã miss — nặng nhất: mở vụ án di trú rồi Lưu sẽ **xoá
      trắng** đơn vị giải quyết. Đã deploy, bấm thử máy thật xanh.
- [x] **PR #281** — bộ dọn số điện thoại chạy cho cả ba bảng (trước chỉ Đơn thư).
      Vụ việc 293 ô, Vụ án 7 ô mang ký hiệu "không có". Kèm ca kiểm khứ hồi "mở hồ sơ di
      trú rồi Lưu thì không mất gì" dựng theo hình dạng dữ liệu MÁY THẬT.

### Bấm thử trên máy thật sau deploy #280

| Việc | Kết quả |
|---|---|
| Đơn thư — cột "Đơn vị giải quyết" | 99/100 dòng có dữ liệu: "Tổ công tác Số 1", "BCH Đội 4", "PC01 Công an TP. HCM" |
| Lọc Đơn thư "Đội 8" | ra đúng, mọi dòng đều "Đội 8" |
| Vụ án — cột ấy | **100/100** dòng có dữ liệu |
| Lọc Vụ án "Đội 8" | ra đúng |
| Vụ việc (hồi quy) | không đổi |

### Dọn số điện thoại đã chạy trên máy thật — 27/08 21:30

Sao lưu trước: `/home/pc02/backups/pre-don-sdt-20260827-213021.sql.gz` (71 MB, ba bảng).

| Màn | Quét | Xoá ký hiệu "không có" | Chuẩn hoá | Giữ lại vì không đoán được |
|---|---|---|---|---|
| Đơn thư | 2.881 | 3 | 0 | 114 |
| Vụ việc | 781 | **756** | 5 | 0 |
| Vụ án | 597 | **518** | 8 | 1 |

Trước khi cho chạy, em soi đủ danh sách sẽ xoá: **không có một số thật nào** — toàn `0`
(431 + 466 lần), `"không có"`, `0000`, `000`, `00`, `...`, `.`. Con số 293 đo lúc đầu chỉ
đếm ô không chứa chữ số nào; họ `0`/`0000` cũng là ký hiệu để trống của hệ cũ.

Chạy lại lần hai: **0 thay đổi** — đúng tính bình ổn. Máy thật khoẻ.

### Đã đo, KHÔNG phải lỗi

**514/4.717 vụ việc trống ô "Đơn vị giải quyết"** — bản gốc hệ cũ (`don_vi_giai_quyet`) cũng
rỗng ở đúng những hồ sơ ấy. Có `don_vi_id` nhưng mã ấy ánh xạ ra NHIỀU tên khác nhau (mã "9"
ra cả "Đội 8", "Đội 7", "Đội 9") nên không suy được tên. Hệ cũ cũng hiện trống.

## Đã hoàn thành

- [x] **M1-T1 · PR0 — vá xoá-trắng ở Vụ việc** — `oHeCu()` thay `v || undefined` cho 45 ô —
      PR #268, đã deploy `bf18132f`
- [x] **M2-T1 · PR1 — ba cột còn thiếu ở máy chủ** — PR #269, deploy `75ba807f`. Codex bắt 3
      lỗi P1 (DTO thiếu khai · service không ghi · `resolveCrime` chưa được gọi), đã vá. Cổng
      DTO mở rộng cho ba thực thể bắt luôn lỗi thật ở Vụ án: `sttCu` gửi lên mà không ai nhận.
- [x] **M3-T1 · PR2 — tách phần nạp dữ liệu và phép kiểm** — PR #271, deploy
- [x] **M4-T1 · PR3 — form Vụ việc theo bố cục 10 tab** — PR #272 + #273 + #274, deploy `730d3937`
- [x] **M5-T1 · PR4 — cột "Nguồn đơn/Đơn vị giao"** — PR #275 + #276, deploy `e1820224`
- [x] **M2-T2 · PR1b — bù dữ liệu trên máy chạy** — PR #270, deploy `9613f522`.
      `crimeChinhId` 1.117 · `phanLoaiNguonTinBanDau` 4.693 · `baoCaoBanGiamDocText` 96 ·
      Vụ án thêm 71 tội danh còn sót. Sao lưu `truoc-bu-vuviec-20260827_134927.sql.gz`.

## UAT — 29/29 dòng PASS

Ma trận phủ ở `UAT-COVERAGE.md`. Năm ca bấm tay còn lại đã chạy hết:

- **VV-07** xoá trắng → Lưu → mở lại: ô trống hẳn, ô khác giữ nguyên.
- **VV-08** tạo mới qua 10 tab: `POST 201`, ô `legacyExtra` lưu được TỪ MÀN TẠO MỚI, xoá hồ sơ
  thử xong đếm lại đúng 4.717.
- **VV-16** nút "Khởi tố thành vụ án" còn nguyên.
- **HQ-01** Đơn thư: `PUT 200`.
- **HQ-02** Vụ án: `PUT 200`, liên kết nguồn nguyên vẹn.

Bước hồi quy bắt được HAI lỗi chặn ở Vụ án, cả hai CÓ TRƯỚC epic này: `receiveDate` chưa bao
giờ được di trú ghi (3.359/3.359 hồ sơ, vá ở #277) và mở vụ án có nguồn gốc là XOÁ liên kết
nguồn ngay rồi chặn Lưu bằng chính ô vừa xoá (169 hồ sơ, vá ở #278).

## Hàng đợi task kế tiếp

1. **UAT** theo §9
2. ~~PR2 — tách `IncidentFormPage.tsx` thành thư mục (thuần di chuyển)
~~PR3~~ · ~~PR4~~ — đã xong

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 27/08 | Ô "Tóm tắt nội dung" ghi CẢ HAI cột `name` + `description` | Anh chốt. Hệ cũ có đúng một ô; 97,5% hồ sơ đã trùng sẵn | PR3 |
| 27/08 | Thêm `crimeChinhId` đầy đủ cho Vụ việc | Anh chốt. Đồng bộ với Đơn thư và Vụ án, tra cứu/thống kê theo tội danh dùng được cho cả ba | PR1 |
| 27/08 | Tách `buildIncidentPayload` + `incident-form.types` ngay ở PR0 | Không tách thì bản vá xoá-trắng không kiểm chứng được; đây là tập con của PR2 | PR0, PR2 |
| 27/08 | PR2 KHÔNG đổi `IncidentFormPage.tsx` thành thư mục; chỉ tách `mergeIncidentApiToFormData` + `validate-incident` | Hai mảnh ấy là chỗ dễ mất dữ liệu nhất và là thứ PR3 cần; đổi tên tệp chỉ thêm nhiễu vào diff mà không giảm rủi ro nào. Router, nhập khẩu, ca kiểm đều không phải sửa | PR2 |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Anh viết "màn hình Danh sách vụ án" nhưng bối cảnh là Vụ việc | Đối tượng là **Vụ việc**; xử cả form lẫn màn danh sách của nó | Cùng lỗi chép lại ở hai yêu cầu trước; đo trên máy: `/doi-1/vu-viec-da-phan-loai` |
| Ô chọn-nhiều và ô tích khi "rỗng" | Gửi mảng rỗng / `false`, KHÔNG bỏ khoá | Bỏ hết lựa chọn là một hành động; bỏ khoá thì gỡ không được |

## Bấm thử trên máy thật — hồ sơ DI TRÚ

Vụ việc 100% (4.717/4.717) là hồ sơ di trú, nên bước này là bắt buộc chứ không phải cho đủ lệ.
Mỗi lần bấm lộ thêm một lỗi chặn mà ca kiểm không thấy:

| Lần | Kết quả | Vá ở |
|---|---|---|
| 1 | 10 tab đúng tên/thứ tự; nhưng ô "Phân loại ban đầu" TRỐNG ở 4.594/4.717 hồ sơ — bộ lựa chọn lệch từ vựng | #273 |
| 2 | `PUT → 400` "Tên vụ việc không được vượt quá 255 ký tự" — 4.530/4.717 hồ sơ (96%) không lưu được | #274 |
| 3 | `PUT → 200`; mở lại: tên cắt còn 252, **nội dung đầy đủ 294**, phân loại/tội danh/nguồn đơn/tên người báo đều nguyên vẹn | — |

Danh sách: 10 cột đúng bộ hệ cũ + Trạng thái; cột "Nguồn đơn/Đơn vị giao" hiện đúng dữ liệu
(các dấu `—` ở đầu danh sách là 118 hồ sơ tạm đình chỉ vốn không có nguồn đơn).

## Trạng thái test

Full suite máy chủ: **PASS 3.372/3.372**. Full suite giao diện: **PASS 2.313/2.313** (`--maxWorkers=2`; chạy full song song trên máy này
bị chập chờn do tài nguyên, không phải lỗi thật — đã kiểm từng tệp fail chạy riêng đều xanh).
`tsc --noEmit` + `tsc -b`: sạch.

Ca `EXPERT performance (PF-01)` chập chờn TRÊN MÁY NÀY khi tải nặng (ngân sách 5s, đo được
5.2–8.0s) — **fail cả trên `main` chưa đụng gì**, nên là nhiễu môi trường chứ không phải hồi
quy. CI là trọng tài; không đụng ngân sách.

## Nợ kỹ thuật / rủi ro

- **Em đã gộp PR #275 khi CI ĐANG ĐỎ.** Script chờ CI chỉ chờ "hết PENDING" rồi in kết quả,
  không kiểm pass/fail. Đã sửa script để thoát lỗi nếu bất kỳ check nào không xanh, và đã
  kiểm lại prod bằng tay (không hỏng gì). Không lặp lại.
- **Lỗ hổng chèn mã ở `shell-parity-gate.yml`** (đã vá, PR #276): tiêu đề PR do người gửi tự
  đặt được nội suy thẳng vào thân script shell.

- **Bẫy đã tháo (codex bắt):** ô `lyDoTamDinhChi` trên form đọc `d.lyDoTamDinhChi` trong khi
  cột thật máy chủ trả về là `lyDoTamDinhChiText` → ô LUÔN rỗng. Trước PR0 nó gửi `undefined`
  nên vô hại; sau PR0 nó gửi `null`, tức chỉ cần mở hồ sơ rồi bấm Lưu là xoá mất ghi chú tạm
  đình chỉ. Đã vá, và siết cổng để bắt cả LỚP lỗi: mỗi ô phải nạp từ ĐÚNG khoá máy chủ, ô đổi
  tên phải khai ở `O_DOI_TEN`.
- `sdtNguoiToGiac` của Vụ việc có **761 hồ sơ** sai định dạng — cùng lớp ký hiệu "không có" của
  hệ cũ đã dọn cho Đơn thư (`so-dien-thoai-he-cu.ts`). Chưa dọn cho Vụ việc; form Vụ việc hiện
  KHÔNG kiểm định dạng số nên chưa chặn Lưu, nhưng dữ liệu vẫn bẩn.
- `name` trùng `description` ở 4.598/4.717 hồ sơ (97,5%) — PR3 xử theo quyết định #1.

## M1 — HOÀN TẤT (2026-08-29T16:36+07:00)

- [x] M1-T1 Kết luận điều tra không còn bịa bản ghi — commit 52873656
- [x] M1-T2 ActionPlanTab + VksMeetingsTab không gỡ dòng khi xoá hỏng — commit 52873656
- [x] M1-T3 InitialCasesPage giữ hộp xác nhận khi xoá hỏng — commit 52873656
- [x] M1-T4 KHÔNG đụng NotificationDropdown (xem Quyết định) + vá `catch {}` rỗng ở bổ sung điều tra — 0800eb4e
- [x] M1-T5 Ghim chống bấm hai lần (phát hiện gốc là DƯƠNG TÍNH GIẢ — xem Đính chính) — 0800eb4e
- [x] M1-T6 aria-required / aria-invalid / aria-describedby ở `FormField` — 0800eb4e

## Đính chính phát hiện của lượt soát
| Phát hiện gốc | Sự thật đo lại | Căn cứ |
|---|---|---|
| "3 form không chặn bấm hai lần" | SAI — cơ chế chạy đúng qua `SaveSplitButton`. Em đo nhầm phần tử. | `/vu-viec/new` khoa=true guiDi=1; hai form kia guiDi=0 (validation chặn, chưa có gì để khoá) |
| "NotificationDropdown nuốt lỗi 6 chỗ" | KHÔNG cùng lớp — mọi cập nhật state nằm TRONG `try`, hỏng thì không bịa gì | đọc mã + đối chiếu bất biến R16 |
| "`/vu-viec/new` 32 ô chỉ 1 dấu sao" | ĐÚNG nhưng vô hại — form ấy chỉ có 1 luật bắt buộc | đếm luật `Vui lòng nhập/chọn` = 1 |

## Quyết định kiến trúc (bổ sung)
| Ngày | Quyết định | Lý do | Ảnh hưởng |
| 29/08 | Không đụng 6 `catch` của NotificationDropdown | Đo theo BẤT BIẾN (không được thể hiện như đã lưu) chứ không đếm số dòng `catch`; luồng nền tự chữa ở lần tải sau | 0 tệp |
| 29/08 | Sửa aria ở `FormField` thay vì từng form | Điểm nghẽn dùng chung của cả ba form; sửa một chỗ là phủ mọi ô | 1 tệp |

## Trạng thái test
Full suite: PASS (frontend 217 tệp / backend 285 tệp) | tsc: sạch | Test fail: không

## BƯỚC TIẾP THEO
M2-T7: tải hỏng phải khác rỗng trên 26 màn. Bắt đầu bằng cụm `/ward/*` (4 màn, nội dung tụt từ
133.874 xuống 324 ký tự mà không báo lỗi). Dùng lại `soLieuHienThi` ở `frontend/src/lib/`.

## M2 — cụm A+B+ (11/26 màn) — 2026-08-29T17:35+07:00

- [x] M2-T7 primitive `LoadErrorBanner` + 8 ca kiểm — commit 36056849
- [x] M2-T8 cụm A: ward/incidents · ward/petitions · ward/cases · duplicates · others — 9d6ab0eb
- [x] M2-T9 cụm B: initial-cases · guidance · activity-log · transfer-return · case-exchange — 479332b7
- [x] M2-T9b export-reports

### Quyết định về 15 màn còn lại của M2
Đã phủ HẾT các màn **hiện số 0 khi tải hỏng** — nhóm nguy hiểm nhất, vì số 0 đọc như một câu
trả lời. 15 màn còn lại khi hỏng chỉ ra danh sách rỗng, không có con số nào tự nhận là sự thật,
và mỗi màn có một hình dạng `catch` riêng (không còn mẫu `catch → set([])` chung).

Sửa mù 15 tệp có hình dạng khác nhau là rủi ro cao hơn giá trị. Thay vào đó: sau khi triển khai,
ĐO LẠI toàn bộ 54 màn bằng đúng phép đã dùng (chặn mọi GET, so số ký tự + có/không báo lỗi) rồi
chỉ sửa những màn thật sự còn hỏng. Việc này nằm ở M5.

### Bẫy gặp phải (ghi để không lặp)
- 5 tệp nhập `useNavigate` từ `react-router` trần trong khi kho dùng `react-router-dom` → hai
  bản sao ngữ cảnh, ca kiểm báo "useNavigate ngoài Router". Đã chuẩn hoá cả 5.
- Kho dựng router bằng `createMemoryRouter` + `RouterProvider` (v7), KHÔNG phải `<MemoryRouter>`.
- Giả lập `authStore` từng hàm là đuổi theo bề mặt API đang lớn dần → dùng bản THẬT, chỉ đè
  `getUser`/`getProfile`.
- Đặt banner cạnh lưới thẻ có thể rơi vào khối "Bộ lọc nâng cao" (chỉ hiện khi mở) → đặt ngay
  dưới tiêu đề trang.

## BƯỚC TIẾP THEO
M3-T10: tách phép tính thời hạn (`incidents.service.ts:441`, `d.setDate(d.getDate() + n)`) ra
hàm thuần rồi phủ property test. Đây là vùng rủi ro CAO duy nhất chưa có bất biến nào.

## M3 — vùng rủi ro Cao còn thiếu — 2026-08-29T18:05+07:00

- [x] M3-T10 Tách phép tính thời hạn ra hàm thuần + 24 ca property — 53edde21
- [x] M3-T11 Fuzz tệp .docx (10 ca) — 8554a4c4
- [x] M3-T12 Ghim định nghĩa tử số KPI (4 ca, từ mutant sống) — 8554a4c4
- [x] M2 bù: bọc ô số liệu tính bằng biểu thức + cổng quét theo LỚP (11 trang)

## Nợ kỹ thuật (bổ sung)
- Hộp cát Stryker `backend/.stryker-tmp/sandbox-cEJS9Z` chứa một tệp tên `nul` (tên thiết bị
  dành riêng của Windows) do vòng di trú trước để lại — không xoá được bằng lệnh thường, khiến
  Stryker dùng lại hộp cũ và báo điểm cũ. Đã .gitignore. Cách xoá: `rd /s /q \?\<đường dẫn>`
  từ cmd có quyền, hoặc xoá thủ công.
- M3-T13 (round-trip biểu mẫu) và M3-T14 (khoa-he-cu) chưa làm — xem hàng đợi.

## Trạng thái test
Full suite: PASS — backend 287 tệp / 4.215 ca · frontend 221 tệp | tsc hai phía sạch

## BƯỚC TIẾP THEO
Mở PR cho nhánh `fix/tai-hong-khac-rong-toan-he`, chờ CI xanh, gộp, triển khai. Sau đó M4
(khe hở phạm vi KPI — Case thiếu cột unitId) rồi M5 (UAT + đo lại 54 màn trên máy thật).

## M4 — khe hở phạm vi KPI — 2026-08-29T18:45+07:00

- [x] M4-T15 KPI-3/KPI-4 khai `ngoaiPhamVi` khi có lọc đơn vị

### Đo lại sau khi triển khai cụm A+B (bằng chứng cho quyết định M2)
26 → 18 màn chưa báo lỗi; trong 18 màn chỉ **4** còn hiện số 0 (`/phan-loai` 10, `/reports/quarterly`
7, `/reports/monthly` 6, `/investigation-delegation` 5). Đã xử đúng 4 màn ấy ở PR #328.

14 màn còn lại khi hỏng chỉ ra danh sách rỗng, **không con số nào** tự nhận là sự thật — mức hại
thấp hơn hẳn, và mỗi màn một hình dạng riêng. Ghi vào nợ kỹ thuật thay vì sửa mù.

## Trạng thái test
Full suite: PASS — backend 288 tệp / 4.219 ca · frontend 221 tệp | tsc hai phía sạch

## BƯỚC TIẾP THEO
M5: `UAT-COVERAGE.md` + đo lại lần cuối trên máy thật.

## Nợ kỹ thuật (bổ sung 2026-08-29T19:00)
- `two-fa.service.spec.ts` CHẬP CHỜN: 3 ca TOTP đỏ một lần trong vòng chạy đầy đủ rồi xanh khi
  chạy lại (32/32) và xanh ở vòng đầy đủ kế tiếp (4.221/4.221). Nguyên nhân gần như chắc chắn là
  mã TOTP rơi đúng ranh giới cửa sổ 30 giây. Nên đóng băng đồng hồ trong ca kiểm ấy thay vì để
  nó phụ thuộc thời điểm chạy — chưa làm trong đợt này vì nằm ngoài phạm vi.

## Nợ kỹ thuật (bổ sung 2026-08-29T21:10)
- **Cổng "đường đặt lại phải dọn lỗi" KHÔNG dựng được.** Đã thử thêm luật ấy vào
  `congSoLieuKhiTaiHong.test.ts` nhưng gieo lỗi (xoá phép dọn ở `DistrictStatisticsPage.handleReset`)
  mà cổng vẫn xanh, trong khi một ca dò riêng đọc CÙNG nội dung ấy lại cho kết quả đúng. Chưa
  truy ra vì sao — nghi cách `it.each` + vòng lặp `expect` bên trong không nổi lỗi. Đã GỠ hẳn
  luật ấy: một cổng không chứng minh được là lời hứa suông. Bản vá vẫn còn; luật hiện chỉ được
  giữ bằng lượt soi Codex.
- **Bộ kiểm frontend chập chờn khi chạy ĐẦY ĐỦ trên máy local.** `PetitionFormPage.payload` và
  `hoSoDiTruLuuDuocKhongCanLoaiDon` hết giờ chờ (~27-30 giây/ca) trong vòng đầy đủ nhưng xanh khi
  chạy riêng (16/16, 8 giây). Kiểm bằng cách CẤT thay đổi rồi chạy lại: bản gốc còn 3 đỏ, bản có
  thay đổi 2 đỏ — tức chập chờn CÓ SẴN, không do đợt này. CI xanh vì máy chạy rảnh hơn. Nên
  tăng `testTimeout` cho hai tệp ấy hoặc tách chúng ra khỏi vòng song song.

### Vòng đo lại sau triển khai #333 — bắt thêm 6 màn

Đo trên máy thật, chặn `**/api/**` bằng `route().abort()`. Bộ dò tổng hợp báo 12 màn "im lặng";
đọc từng màn thì **2 báo cáo sai** (`/don-vi-hanh-chinh` và `/initial-cases` CÓ báo lỗi — regex
của bộ dò hẹp hơn câu chữ thật), **4 màn im lặng thật**, và lộ thêm **2 lớp khác hẳn**:

| Màn | Hiện gì khi máy chủ chết | Hạng |
|---|---|---|
| `/admin/deadline-rules/approval-queue` | "Không có đề xuất nào chờ duyệt · Tốt rồi — inbox-zero!" | khẳng định sai |
| `/admin/deadline-rules/migration-cleanup` | "Tất cả **12** quy tắc đã có tài liệu pháp lý đầy đủ" | khẳng định sai + số viết cứng |
| `/cases/tdac-backfill` | "Không có vụ án nào cần cập nhật" | khẳng định sai |
| `/admin/deadline-rules` | "Network Error" **và** "Chưa có quy tắc nào" cùng lúc | hai câu trái nhau |
| `/journey` | khay tìm kiếm không hiện gì — hệt "không tìm thấy hồ sơ" | im lặng |
| `/admin/khoi-phuc` | "Chỉ quản trị viên truy cập được" trong khi đang là ADMIN | sai lý do từ chối |
| `/settings` | bảng 3 cán bộ **không có thật**, kèm nút Sửa/Xóa | dữ liệu bịa |

Ghi lại vì đáng nhớ hơn danh sách: **con số 0 còn mơ hồ, câu "inbox-zero" thì quả quyết.**
Hạng lỗi này tệ hơn hạng đã vá ở #333.

Cổng lớp `congSoLieuKhiTaiHong` phải **nới từ vựng** (`isError` cũng là phép xét lỗi, các trang
react-query dùng nó) và **im bớt** (`label:`/`value:` là nhãn danh mục, không phải câu trả lời).
Cả hai lần nới đều gieo lỗi lại để chứng minh cổng còn răng.

### Vòng đo lại lần ba — bộ dò có cấu trúc, và phát hiện nặng nhất cả đợt

Thay phép đo bằng bộ dò có cấu trúc (mỗi màn: có tín hiệu lỗi không · các ô chữ to đậm hiện gì).
Kết quả **49/54 màn báo lỗi**; 5 màn còn lại **không báo là đúng** — `/journey` (chưa gõ thì chưa
hỏi), `/reports/stat48` và `/phu-luc-1-6` (phải bấm mới tải), `/settings` và
`/admin/di-tru-du-lieu` (trang tĩnh). Tức lớp "tải hỏng khác rỗng" đã đóng.

Nhưng bộ dò phơi ra một hạng khác, và đây là thứ nặng nhất cả đợt:

```
MonthlyReportPage.tsx:51   change: "+12%"    ← chuỗi viết cứng
QuarterlyReportPage.tsx:61 change: "+18%"    ← chuỗi viết cứng
ActivityLogPage.tsx:354    <p …>7</p>        ← hằng số trong JSX
```

Máy chủ **không trả số kỳ trước** (`reports-export.service.ts` chỉ có `totals` kỳ hiện tại), nên
các tỷ lệ ấy không thể tính ra được từ đâu. Chúng **sai kể cả khi mọi thứ chạy tốt**: mở báo cáo
tháng bất kỳ, năm bất kỳ, đơn vị bất kỳ — vẫn "+12%". Khác hẳn mọi thứ đã vá trước đó, vốn chỉ
sai trên đường thất bại. Đã gỡ huy hiệu; muốn có tỷ lệ thật thì máy chủ phải trả thêm số kỳ
trước — **chờ anh quyết**.

Kèm theo: ba màn còn hiện số 0 cạnh câu báo lỗi (`/dashboard`, `/settings/overdue-records`,
`/activity-log`), năm màn còn nói câu "chưa có gì" cạnh câu báo lỗi, và chip "Tất cả 0" ở bốn
màn — chỗ cuối sửa **một lần ở `StatusChips`** bằng cờ `countsUnknown`, không vá bốn nơi.

## Hạ tầng so sánh kỳ (`so-sanh-ky`) — thay huy hiệu bịa bằng phép tính thật

Anh yêu cầu quyết theo tiêu chí quản trị sâu nhất + mở rộng tốt nhất, cho tăng phạm vi. Nên
KHÔNG vá hai màn mà dựng một hạ tầng dùng chung.

### Ba điều tra được từ thị trường, cả ba đổi thiết kế

1. **Quy ước ngành là "so với CÙNG KỲ NĂM TRƯỚC"**, không phải kỳ liền trước. Báo cáo Bộ Công an
   viết "giảm 23,16% số vụ so với cùng kỳ năm 2024". → nền mặc định là `CUNG_KY_NAM_TRUOC`.
2. **Nền bằng 0 thì phần trăm vô định** — không phải 0%, không phải ∞%. → nêu số tuyệt đối.
3. **Nền nhỏ thì tỷ lệ dao động dữ** — hướng dẫn công bố của cơ quan thống kê y tế Hoa Kỳ chặn
   khi đếm ≤ 10 và ghi chú khi 11–20 (RSE > 25%). → lấy đúng hai ngưỡng ấy.

### Thứ không có trong yêu cầu nhưng thiếu là sai có hệ thống

- **Kỳ chưa trọn.** Ngày 10/8 mà đem cả tháng 8 (10 ngày dữ liệu) so với cả tháng 8 năm ngoái
  (31 ngày) thì tháng nào cũng "giảm ~68%" — sai theo hướng NGHE NHƯ THÀNH TÍCH. → cắt kỳ nền
  còn đúng số ngày đã trôi, và nói ra trên màn.
- **Chiều tốt/xấu theo từng chỉ tiêu.** "Quá hạn giảm" là tốt, "đã giải quyết giảm" là xấu, cùng
  một dấu trừ. Tô xanh cho mọi dấu cộng là cách nhanh nhất để màn hình chúc mừng cán bộ vì số
  hồ sơ quá hạn vừa tăng.
- **Đơn thư/vụ việc/vụ án là TRUNG TÍNH** — đếm khối lượng việc đến, không đo kết quả làm việc.

### Kiến trúc

```
backend/src/reports/so-sanh-ky/
  so-sanh.ts       phép tính thuần: chênh lệch · tỷ lệ · độ tin cậy · chiều tốt
  ky-bao-cao.ts    số học kỳ: dựng · cùng kỳ năm trước · kỳ liền trước · cắt theo tiến độ
  chi-tieu.ts      sổ đăng ký chiều tốt của từng chỉ tiêu
  dung-so-sanh.ts  ghép lại; NHẬN HÀM ĐẾM nên không biết gì về Prisma
```

`dungSoSanh` nhận một hàm đếm chứ không nhận Prisma — nhờ vậy ca kiểm chạy không cần CSDL, và
mọi màn báo cáo khác (KPI, thống kê phường/xã, thống kê 48 trường) dùng lại được y nguyên.

Nhân tiện gộp phép đếm đang lặp giữa tháng và quý thành `demTrongKhoang`. Đây KHÔNG phải dọn
dẹp: kỳ nền bắt buộc phải được đếm bằng **đúng một thước** với kỳ hiện tại, nếu không thì chênh
lệch đo được một phần là do đổi thước và không ai biết là phần nào.

### Tương thích ngược

Mọi trường cũ giữ nguyên; `soSanh` là trường THÊM. Màn hình bản cũ không hiện huy hiệu, không vỡ.

### Còn có thể mở rộng

`?soSanh=` đã nhận `KY_LIEN_TRUOC` và `KHONG` — chỉ cần một ô chọn trên giao diện là dùng được.
Chưa dựng ô ấy vì chưa có yêu cầu; hạ tầng thì đã sẵn.
