# Shell Parity Matrix — Legacy (git 2cbdd90) vs Current Shells

**Updated**: 2026-08-25 after v0.73.0.0 (danh sách theo bố cục hệ cũ). Trước đó: 2026-08-24 (v0.72), 2026-05-30 (v0.66).
**Truth-of-record**: legacy commit `2cbdd90` (parent of `a8016b6` v0.57.0.0 deletion).
**Method**: testid extraction + registry inspection.

## Status v0.66 (chain complete)

- ✅ Cases (v0.63 PR1b): 8 actions + 5 filters via casesRowActions + casesListFilters.
- ✅ Incidents (v0.64 PR2): 4 actions + 4 filters. Transition+Prosecute → PR2-bis.
- ✅ Petitions (v0.65 PR3): 4 actions + 5 filters. Archive+Convert → PR3-bis.
- ✅ Comprehensive (v0.66 PR4): 3 polyglot actions (dispatched by row.recordType) + 5 filters.

## CI Gate (this file = process fix)

`.github/workflows/shell-parity-gate.yml`:
- Any PR modifying `*ListPageShell.tsx` MUST also update this matrix file.
- Bypass: `[parity-skip]` in PR title for refactor-only changes.

## v0.72.0.0 — Sắp xếp danh sách (feat/list-sort-newest-first)

Bổ sung năng lực MỚI cho cả ba shell, không có ở bản cũ (legacy `2cbdd90` cũng không có):

| Năng lực | Cases | Incidents | Petitions | Ghi chú |
|---|---|---|---|---|
| Bấm tiêu đề cột để sắp | ✅ | ✅ | ✅ | `ColumnDef.sortKey` + `SortableHeader`, có `aria-sort` |
| Thứ tự lưu trong địa chỉ trang | ✅ | ✅ | ✅ | `useListSort` (tiền tố riêng mỗi shell) |
| Sắp mặc định mới→cũ theo ngày nhận | ✅ `ngayDeXuat` | ✅ `ngayDeXuat` | ✅ `receivedDate` | trước đây cả ba dùng `createdAt` |
| Cột "Ngày tiếp nhận" | ✅ THÊM MỚI | ✅ THÊM MỚI | ✅ đã có ("Ngày nhận") | |
| Cột "Ngày tạo" | ✅ đã có | ✅ đã có | ✅ THÊM MỚI | có chú giải: hồ sơ di trú cùng một ngày |
| Đánh dấu ngày phi lý | ✅ | ✅ | ✅ | `DateCell`, ngoài khoảng 1900–2100 |

**Không xoá năng lực nào.** Mọi hành động và bộ lọc sẵn có giữ nguyên; thay đổi chỉ thêm
cột và khả năng sắp xếp.

Cơ sở chọn trường sắp (đo trên dữ liệu thật 2026-08-24): `createdAt` giống hệt nhau ở toàn
bộ hồ sơ di trú (45.459 đơn thư và 4.713 vụ việc cùng MỘT ngày), nên không dùng được.
`cases.receiveDate` chỉ có 2/3.304 hồ sơ → phải dùng `ngayDeXuat` (98,8%).

## v0.73.0.0 — Danh sách theo bố cục hệ cũ (feat/danh-sach-giong-he-cu)

Cán bộ vừa chuyển sang hệ mới yêu cầu ba trang danh sách **giống hệ cũ**. Đối chiếu ảnh
chụp hệ cũ cho thấy khoảng cách nằm ở GIAO DIỆN, không ở dữ liệu: mọi cột hệ cũ đều đã có
sẵn trong cơ sở dữ liệu, chỉ là không được hiện.

### Cột bổ sung

| Cột hệ cũ | Cases | Incidents | Petitions | Nguồn dữ liệu · độ phủ thật (25/08) |
|---|---|---|---|---|
| **Tóm tắt nội dung** | ✅ THÊM MỚI | ✅ THÊM MỚI | ✅ THÊM MỚI | `moTaChiTiet` 98% · `description` 99,98% · `summary` 99,99% |
| Nguồn đơn/Đơn vị giao | — | — | ✅ THÊM MỚI | `nguonDon` 99,9% |
| Kết quả xử lý, giải quyết khác | — | ✅ THÊM MỚI | ✅ THÊM MỚI | `ketQuaXuLy` 54% · `ketQuaXuLyKhac` 24% |
| Người nhập | ✅ THÊM MỚI | ✅ THÊM MỚI | ✅ THÊM MỚI | `createdBy` · `canBoNhap` · `enteredBy` |
| Thao tác ở ĐẦU, ngay sau ô tick | ✅ | ✅ | ✅ | **CỐ Ý KHÁC hệ cũ** — xem ghi chú dưới |
| Mã hồ sơ hiện dạng ngắn `26-11171` | ✅ | ✅ | ✅ | `formatHoSoCode` — chỉ đổi HIỂN THỊ, dữ liệu giữ nguyên |

#### Bảng cuộn ngang — vá 25/08/2026

Anh báo "thiếu scroll ngang". Vùng cuộn không hề thiếu: `TABLE_WRAPPER` là `overflow-x-auto`
từ lâu. Thứ thiếu là **cái để tràn ra** — ô không cấm chữ xuống dòng nên bề rộng tối thiểu
của bảng tụt rất thấp, bảng luôn vừa khít khung chứa, và 13 cột bị ép vào bề ngang khung với
chữ vỡ vụn ba bốn dòng.

| Hạng mục | Trước | Sau |
|---|---|---|
| Ô dữ liệu | xuống dòng tự do | **một dòng** (`whitespace-nowrap`) |
| Tiêu đề cột | xuống dòng | **giữ nguyên** — nhãn 45 ký tự không được quyết bề rộng cột |
| Cột chữ tự do | không trần | `TABLE_CELL_TRUNCATE` (trần 20rem + cắt đuôi) |
| Cột Tóm tắt | tự cắt 150 ký tự | **giữ nguyên** — `SummaryCell` tự lo |
| Ô tick + Thao tác khi cuộn | trôi mất | **ghim mép trái** |
| Nền ô ghim | đặt cứng `bg-white` | **nền thật của hàng** |

Ghi chú: cần ghim cột Thao tác vì bảng nay cuộn thật — không ghim thì cột vừa đưa lên đầu sẽ
trôi khỏi màn hình ngay khi cuộn, mất đúng cái lợi vừa làm.

Vá kèm hai lỗi có sẵn: ô ghim đặt cứng nền trắng nên hàng đang chọn / hàng quá hạn hiện một
vệt trắng lệch màu ở mép trái; và ô tick hàng tiêu đề dùng `bg-slate-50` lệch tông với hàng
tiêu đề `#003973/5`.

#### Bề rộng cột lấy từ số đo dữ liệu thật — 25/08/2026

Có thanh cuộn rồi nhưng bề rộng cột vẫn do **chuỗi dài nhất trong cột** quyết, không do người
thiết kế quyết: bố cục bảng `auto` lấy bề rộng nội dung tối thiểu làm mốc, mà ô đang
`whitespace-nowrap` nên `width` khai trên cột bị bỏ qua và `truncate` không bao giờ cắt.

Bật `table-fixed` cho ba bảng này để `width` thành lệnh, rồi đặt bề rộng theo **số đo trên
bản chạy thật** (độ dài nội dung, trung vị / phân vị 90):

| Cột | Đơn thư | Vụ việc | Vụ án | Bề rộng |
|---|---|---|---|---|
| Tóm tắt nội dung | 350 / 973 | 855 / 1776 | 309 / 1332 | **30rem** — rộng nhất |
| Kết quả xử lý | 39 / 85 | — | — | 16rem |
| Tên cá nhân… | 16 / 38 | *(xem dưới)* | 40 / 117 | 14-16rem |
| Nguồn đơn | 9 / 33 | — | — | 12rem |
| STT / mã hồ sơ | 9 / 9 | — | — | 7rem |

Anh nêu đích danh: Tóm tắt phải rộng hơn Tên cá nhân. Có ca kiểm chốt điều đó ở cả ba trang.

**Cảnh báo dữ liệu (chưa xử lý):** 4.598/4.716 vụ việc — **97,5%** — có ô "Tên" trùng y hệt ô
"Tóm tắt"; di trú hệ cũ đổ mô tả vào cả hai cột. Bề rộng cột Tên của Vụ việc vì vậy đặt theo
NGHĨA của cột (tên người / cơ quan) chứ không theo độ dài đang có — đặt theo độ dài đang có là
hợp thức hoá lỗi dữ liệu và tốn thêm 30rem để hiện lại đúng thứ cột bên cạnh đã hiện.

##### Vá tiếp: chữ đè sang cột bên (anh chụp màn hình 25/08/2026)

Đặt bề rộng cố định xong thì lộ ra vế còn thiếu: ô `whitespace-nowrap` mà **không**
`overflow-hidden` thì bản ghi dài hơn cột sẽ tràn ra và **vẽ đè** lên cột bên cạnh. Trên Vụ
việc, mã `VV-LEGACY-TamDinhChi_vu_viec_21_…` (~35 ký tự) trong cột STT rộng 7rem đè lên cột
"Tên cá nhân" — hai dòng chữ chồng nhau, không đọc được cột nào.

`whitespace-nowrap` và `overflow-hidden` là một **cặp**, không phải hai lựa chọn độc lập. Đã
thêm `overflow-hidden text-ellipsis` vào `TABLE_CELL`. Menu "Thao tác khác" không bị cắt vì
nó render qua portal ra `document.body`.

Ghi chú còn lại: 121 vụ việc mang mã tạm `VV-LEGACY-…` nay hiện dạng cắt cụt (`VV-LEGACY-T…`).
Cắt cụt đúng hơn là đè chữ, nhưng mã ấy vẫn vô nghĩa với cán bộ — gốc rễ là những hồ sơ chưa
suy được mã từ nguồn `TamDinhChi_vu_viec_21` (không có `nam`/`stt`), chưa xử lý.

#### Bộ cột mặc định = bộ hệ cũ, phần còn lại bật/tắt kiểu Odoo — 25/08/2026

Anh gửi ba ảnh hệ cũ và yêu cầu cột hiện mặc định **đúng như ảnh**, phần còn lại ẩn đi và cho
tích để hiện lại như treeview Odoo. Đối chiếu ba ảnh: **cả ba màn hình hệ cũ dùng chung MỘT
bộ 9 cột** — STT · Ngày đề xuất · Nguồn đơn/Đơn vị giao · Tên cá nhân… · Tóm tắt nội dung ·
Đơn vị giải quyết · Kết quả xử lý, giải quyết khác · Người nhập · Thao tác.

Anh chốt ba điểm: Thao tác **giữ ở đầu** (yêu cầu 25/08 thắng ảnh hệ cũ); Trạng thái **giữ
hiện sẵn** (hệ cũ không có khái niệm này, hệ mới có 15 trạng thái và có chip lọc theo chúng);
lựa chọn lưu ở **trình duyệt**, đúng cách Odoo làm.

| | Đơn thư | Vụ việc | Vụ án |
|---|---|---|---|
| Luôn hiện, không vào menu | Thao tác · STT | Thao tác · STT | Thao tác · STT |
| Tích sẵn | 8 cột hệ cũ + Trạng thái | 7 cột + Trạng thái | 8 cột hệ cũ + Trạng thái |
| Chưa tích | Đối tượng bị tố · Hạn xử lý · Ngày tạo | Điều tra viên · Hạn xử lý · Ngày tạo | Nguồn đơn/Đơn vị giao · Điều tra viên · Ngày tạo |
| Bề rộng bộ mặc định | ~96rem (1.544px) | ~94rem (1.496px) | ~101rem (1.616px) |

Bộ mặc định vừa một màn hình; bật thêm cột thì tổng vượt bề ngang và thanh cuộn ngang xuất
hiện — đúng điều anh nêu.

**Cột thêm mới cho Vụ án** (hệ cũ có, hệ mới thiếu): `nguonDon` phủ **89,9%** (3.038/3.380) và
`ketQuaXuLyKhac` phủ **6,6%** (222/3.380). Cột thứ hai sẽ gần như trống — thêm vì hệ cũ có, và
ảnh hệ cũ anh gửi cũng đang trống ở cột ấy. API danh sách vụ án dùng `select` tường minh nên
đã mở thêm hai trường ở máy chủ, có ca kiểm chốt.

**Nhãn đổi theo chữ hệ cũ:** "Ngày nhận" / "Ngày tiếp nhận" → **"Ngày đề xuất"**; "Đơn vị"
(vụ án) → **"Đơn vị giải quyết"**.

#### Đọc thẳng mã nguồn ba màn hệ cũ — 27/08/2026 (tối)

Anh chỉ đúng đường: menu **"Phân loại đơn, vụ việc, vụ án"** → `/doi-1/don-thu`,
`/doi-1/vu-viec-da-phan-loai`, `/doi-1/vu-an-da-phan-loai`. Em đăng nhập (CHỈ ĐỌC) và lấy
phần khai cột trong mã nguồn từng màn. **Cả ba màn khai cùng một bộ cột:**

```
STT · Ngày đề xuất · Nguồn đơn/Đơn vị giao · Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại
· Tóm tắt nội dung · Đơn vị giải quyết · Kết quả xử lý, giải quyết khác · Người nhập · Thao tác
```

Hệ cũ **tắt cột bằng cách chú thích dòng khai** chứ không xoá. Ba cột đang tắt ở cả ba màn:
`bi_can_info` (Đối tượng bị can) · `don_vi_ten` (Đơn vị) · `stt_cu` (STT cũ).

Trường mà mỗi cột đọc — xác nhận trực tiếp bốn bản vá cùng ngày:

| Cột hệ cũ | Trường hệ cũ |
|---|---|
| Ngày đề xuất | `ngay_de_xuat` |
| Tên cá nhân, cơ quan… | `ten_ca_nhan_co_quan_to_chuc_cung_cap` |
| Tóm tắt nội dung | `tom_tat_noi_dung` |
| Đơn vị giải quyết | `don_vi_giai_quyet` |
| Người nhập | `nguoi_them_ten` |

**Sắp mặc định của hệ cũ là `stt` TĂNG dần.** Anh yêu cầu giảm dần, nên hệ mới để giảm dần —
khác hệ cũ, có chủ ý.

Hai chỗ phải sửa sau khi đọc đúng màn:

- **Vụ án** thiếu cột "Nguồn đơn/Đơn vị giao" — trước đó ẩn đi vì đo màn `/VuAn`, một màn
  KHÁC. Nay hiện.
- **Vụ án** giữ cả "Đối tượng bị can": màn `/VuAn` có cột ấy và anh chốt 26/08/2026 lấy
  `/VuAn` làm chuẩn, còn màn 27/08 anh chỉ thì tắt nó. Hai lần chốt khác nhau vì hai màn khác
  nhau — giữ cả hai vì cả hai đều có dữ liệu thật, bỏ cột nào cũng là lấy đi một thứ cán bộ
  đang nhìn thấy.

Hai cột hệ cũ **không dựng được**, đã đo: "Đơn vị" (`don_vi_ten` — hệ cũ suy tên lúc chạy,
bản gốc 0 bản ghi, mã đơn vị ánh xạ ra nhiều tên) và "Đối tượng bị can" của Vụ việc
(`bi_can_info` rỗng ở cả 5.000 hồ sơ mẫu). Dựng cột rỗng cho khớp danh sách là bịa.

Cổng `boCotMacDinhKhopHeCu.gate.test.ts` chốt bộ cột mặc định của ba màn.

#### Rà soát TỪNG CỘT ba màn so bản gốc hệ cũ — 27/08/2026 (chiều)

Anh yêu cầu kiểm từng cột, và thêm yêu cầu sắp xếp theo STT. Em so từng ô, từng hồ sơ, trên
54.736 hồ sơ di trú — mỗi hồ sơ mang nguyên bản ghi gốc trong `legacyRaw`.

Không cột nào **hụt** dữ liệu, và bộ cột mặc định đã khớp hệ cũ. Nhưng **bốn cột đầy dữ liệu
mà nội dung không phải thứ hệ cũ hiển thị**:

| Màn | Cột | Đang đọc | Phải đọc | Số đo |
|---|---|---|---|---|
| Đơn thư | Ngày đề xuất | `receivedDate` = ngày **tiếp nhận** | `ngayDeXuat` | lệch **29.026**/46.499 |
| Đơn thư | Tóm tắt nội dung | `summary` (bản rút gọn) | `detailContent` | lệch 58, hụt 1 |
| Vụ việc | Tên cá nhân… | `doiTuongCaNhan` = **đối tượng bị tố** | `benVu` | khớp gốc **0%** |
| Vụ án | Tên cá nhân… | `name` = **tên vụ án** | `tenCungCap` | khớp gốc **0%** |

Form đã trỏ đúng cả bốn từ trước — chỉ danh sách lệch. Bỏ luôn dự phòng `|| r.name` của Vụ
việc: rơi về tên vụ việc là bịa dữ liệu vào ô mà hệ cũ để trống.

**Hệ quả nhìn thấy được:** cột "Tên cá nhân…" của Vụ án trống ở **2.613/3.359** dòng, vì hệ
cũ chỉ có 746 hồ sơ điền ô ấy. Đó là đúng.

Các cột còn lại khớp bản gốc **100%**, và "Người nhập" cũng đúng: 25 mã cán bộ hệ cũ, mỗi mã
ánh xạ đúng một tài khoản hệ mới, 0 mã lệch.

Cổng `cotDanhSachPhaiTroDungCotForm.gate.test.ts` nay duyệt **mọi nhãn** của cả ba màn thay
vì chốt từng nhãn một — nhãn nào có trong bố cục hệ cũ thì cột danh sách phải trỏ đúng cột
form ghi.

#### Sắp xếp mặc định theo STT giảm dần, bấm tiêu đề đổi chiều — 27/08/2026

Anh yêu cầu. Mã hồ sơ là chuỗi `"2026-11171"` nên sắp thẳng trên nó ra sai thứ tự
(`2026-9395` đứng sau `2026-11171`). Thêm cột số `sttSort` do **trigger của CSDL** giữ — mã
được sinh ở nhiều đường nên tính trong mã ứng dụng kiểu gì cũng sót một đường.

Mã không đúng dạng `năm-số` cho ra NULL và chìm xuống cuối: đơn thư 426 · vụ việc 250 · vụ
án 330 (trong đó 218 mã rỗng).

#### Cột "Đơn vị giải quyết" đọc `donViGiaiQuyet`, không đọc `unit` — 27/08/2026

Anh chỉ ra trên ảnh chụp hệ cũ: cột ấy không có dữ liệu. Đo lại thì hỏng thật, và hỏng hoàn
toàn — ba lớp (ô form · cột danh sách · bộ lọc) của Đơn thư và Vụ án đều trỏ `unit`, trong khi
bộ di trú đổ vào `donViGiaiQuyet`.

| Cột | Đơn thư | Vụ án | Vụ việc |
|---|---|---|---|
| `unit` (đang đọc trước 27/08) | 0 | 0 | — |
| `donViGiaiQuyet` (dữ liệu thật) | 46.642 | 3.286 | 4.203 |

Lược đồ tách hai khái niệm: `unit` là đơn vị **tiếp nhận**, `donViGiaiQuyet` là đơn vị **giải
quyết**. Hệ quả kép — danh sách hiện dấu gạch mọi dòng, và bộ lọc theo đơn vị không bao giờ ra
kết quả. Quy cả ba màn về `donViGiaiQuyet` (Vụ việc vốn đã đúng). `unit` giữ trong lược đồ cho
"đơn vị tiếp nhận" — hiện chưa có ô nhập nào, khai vào nợ kỹ thuật.

Cổng `o-form-va-cot-danh-sach-phai-trung-cot.gate.spec.ts` chốt sáu nhánh của cùng một cột: ô
form · cột danh sách · bộ lọc `getList`/`getStats` · đường đọc · đường tạo · đường sửa.

**Vụ việc KHÔNG THỂ có cột "Nguồn đơn/Đơn vị giao"** — bảng `incidents` không có trường
`nguonDon`. Không bịa cột rỗng; cần quyết có bổ sung trường hay không.

#### Vụ án lấy `/VuAn` làm màn chuẩn, không phải `/doi-1` — 26/08/2026

Lần chốt 25/08 gộp ba ảnh hệ cũ thành "một bộ 9 cột chung". Đối chiếu lại trực tiếp trên hệ cũ
ngày 26/08 cho thấy điều đó **sai với riêng màn Vụ án**: `/doi-1` (DS đơn, vụ việc, vụ án) và
`/VuAn` (Danh sách vụ án) khác nhau đúng **một cột — cột thứ ba**:

| | `/doi-1` | `/VuAn` |
|---|---|---|
| Cột 3 | Nguồn đơn/Đơn vị giao | **Đối tượng bị can** |

Anh chốt màn chuẩn cho `/cases` là **`/VuAn`**. Vì vậy:

- Thêm cột **`Đối tượng bị can`** ở vị trí thứ ba, tích sẵn. Nguồn dữ liệu là bảng `subjects`
  (`type = SUSPECT`) — **không** dùng ô văn bản `nghiVanDoiTuong`: ô ấy là nghi vấn ban đầu ở
  tab Thông tin, còn cột hệ cũ in danh sách bị can đã khởi tố.
- `Nguồn đơn/Đơn vị giao` chuyển sang **chưa tích** (vẫn bật lại được từ menu chọn cột), vì
  `/VuAn` không có cột ấy. Không xoá — ai quen màn `/doi-1` vẫn dùng được.
- Máy chủ cắt sẵn ở **5 tên** (`LIST_SUSPECT_NAMES_LIMIT`); phần dư hiển thị `+N` suy từ
  `subjectsCount` đã có. Bảng dùng bố cục cố định nên một hồ sơ nhiều bị can mà in hết sẽ kéo
  dòng cao bất thường.

Bộ cột mặc định của Vụ án nay là: Thao tác · STT · Ngày đề xuất · **Đối tượng bị can** ·
Tên cá nhân… · Tóm tắt nội dung · Đơn vị giải quyết · Kết quả xử lý, giải quyết khác ·
Người nhập · Trạng thái.

Nút chọn cột đặt ở **thanh công cụ** cạnh nút "Bộ lọc", không ở góc phải hàng tiêu đề như
Odoo: bảng của ta cuộn ngang, nút ở hàng tiêu đề sẽ trôi khỏi màn hình đúng lúc cần nó nhất.

#### Kỳ thống kê áp cho thẻ số · danh sách · badge menu — 25/08/2026

Anh yêu cầu mọi con số đếm tính theo một **kỳ cấu hình được** trong Cài đặt hệ thống. Anh
chốt: kỳ áp cho **cả thẻ lẫn danh sách** (hai bên không được nói hai con số); **admin đặt mặc
định, cán bộ đổi tạm** trên trang.

| Khoá cấu hình | Giá trị | Mặc định |
|---|---|---|
| `THONG_KE_KY` | tháng · quý · năm hiện tại · khoảng tuỳ chọn · tất cả | **tháng hiện tại** |
| `THONG_KE_TRUONG_NGAY` | ngày tiếp nhận · ngày tạo | **ngày tiếp nhận** |

Một hàm duy nhất tính kỳ (`giaiKyThongKe` + `apDungKyVaoWhere`) cho **bảy** chỗ đếm: danh sách
và thống kê của ba module, cộng badge menu. Ca kiểm so **thẳng điều kiện truy vấn** của
`getStats` với `getList` — so hai con số thì chúng có thể tình cờ bằng nhau.

Giao diện: nhãn kỳ trên thanh thẻ lấy từ kỳ **máy chủ thật sự đã áp**, không phải kỳ giao diện
tự đoán. Ô "Tính theo" khai vào registry lọc sẵn có, **không** dựng bộ chọn ngày thứ hai.

**ĐỔI HÀNH VI:** hai ô ngày của **Vụ án** trước đây lọc theo `createdAt`, khác hẳn Đơn thư
(`receivedDate`) và Vụ việc (`ngayDeXuat`) — mà hồ sơ di trú dồn chung MỘT ngày tạo nên bộ lọc
ấy gần như không lọc được gì. Nay theo `ngayDeXuat` như hai module kia.

**Hai điều chưa xử lý, cần quyết riêng:** badge menu không lọc theo phạm vi dữ liệu (cán bộ
thấy con số toàn đơn vị); và badge đếm khác thẻ số (badge: vụ án REGULAR, vụ việc/đơn thư chưa
giải quyết — thẻ: tất cả). Giữ nguyên ngữ nghĩa cũ, có ca kiểm ghi rõ.

#### Cột Điều tra viên: sửa thứ tự họ tên — 25/08/2026

Anh báo ô "Điều tra viên chính" hiện "Thành Phường Tân". Gốc bệnh không nằm ở danh mục
phường/xã mà ở phép ghép họ tên: cơ sở dữ liệu lưu `lastName` = họ và tên đệm, `firstName` =
tên gọi, còn mã ghép `[firstName, lastName]` theo quy ước tiếng Anh.

Cột "Điều tra viên" trên cả ba shell dùng chung phép ghép ấy nên cũng sai. Nay dùng hàm chung
`lib/hoTen.ts` (họ trước, tên sau) — một nơi duy nhất quyết định thứ tự, thay cho 19 chỗ chép
tay. 256/257 tài khoản có cả hai trường nên lỗi chạm gần như mọi cán bộ.

Không đổi cột nào, không đổi thứ tự cột — chỉ đổi cách hiển thị tên trong ô.

#### Vị trí cột Thao tác — một chỗ cố ý khác hệ cũ

24/08/2026 bản đầu chuyển Thao tác về **cuối** bảng cho giống hệ cũ. 25/08/2026 anh yêu cầu
ngược lại: đưa lên **đầu**, ngay sau ô tick, lý do là thao tác.

Lý do ấy đo được. Ba bảng rộng 10-13 cột nên phải cuộn ngang. Thao tác ở cuối thì mỗi lần
muốn bấm sửa/xoá một hồ sơ là phải cuộn sang phải, bấm xong cuộn ngược về để đọc hồ sơ kế
tiếp. Ở đầu thì nút nằm sẵn trong tầm nhìn ngay khi mở trang.

Hệ quả phụ tốt: cả hàng bấm được để mở hồ sơ, trừ ô tick và nút thao tác — xếp hai thứ ấy
cạnh nhau ở mép trái tạo một vùng điều khiển gọn, phần còn lại của hàng thuần tuý là "bấm
để mở".

Sau thay đổi này **cả năm bảng danh sách thống nhất** — Tra cứu tổng hợp và Ủy thác điều tra
vốn đã để Thao tác ở đầu từ trước, chỉ ba bảng này lệch.

**Chưa làm, cần anh quyết:** ô tick có `sticky left-0` nên vẫn ghim khi cuộn ngang, còn cột
Thao tác thì không. Nghĩa là cuộn sang phải một đoạn thì nút thao tác trôi khỏi màn hình.
Ghim luôn cột Thao tác sẽ trọn vẹn hơn, nhưng vướng một lỗi sẵn có: ô tick đang đặt cứng
`bg-white`, nên trên hàng đang chọn (`bg-blue-50`) hay hàng quá hạn, ô ghim vẫn trắng trong
khi phần còn lại của hàng đổi màu. Ghim thêm một cột nữa là nhân đôi lỗi ấy.

### Bộ lọc bổ sung — khai vào registry `list-filters` sẵn có

Bản đầu (24/08) dựng một thẻ lọc RIÊNG tên `LegacyFilterPanel` đặt cạnh bộ lọc nâng cao có
sẵn từ v0.62. Đó là một mặt lọc THỨ HAI trên cùng màn hình, và nó sinh lỗi thật: trang Đơn
thư và Vụ án có hai ô "Từ ngày" dùng hai khoá địa chỉ trang khác nhau
(`petitions_from_date` với `petitions_fromDate`), không đồng bộ với nhau, nên đặt ngày ở ô
này thì ô kia vẫn trống và người dùng không có cách nào biết ô nào đang có hiệu lực.

25/08 gỡ hẳn thẻ ấy và khai các ô mới vào registry sẵn có. Mỗi trang giờ có **đúng một**
mặt lọc, nên câu hỏi "ô nào đang có hiệu lực" không còn tồn tại.

| Ô lọc | Cases | Incidents | Petitions | Khoá địa chỉ trang · cột máy chủ |
|---|---|---|---|---|
| STT (nhận cả `26-…` lẫn `2026-…`) | ✅ | ✅ | ✅ | `stt` → `caseCode` · `code` · `stt` |
| STT cũ | ✅ | ✅ | ✅ | `stt_cu` → `sttCu` (đã có chỉ mục) |
| Cán bộ nhập | ✅ `created_by` | ✅ `can_bo_nhap` | ✅ `entered_by` | cột thật của từng module |
| Từ ngày · Đến ngày | ✅ ĐÃ CÓ | ✅ THÊM MỚI | ✅ ĐÃ CÓ | `from_date` · `to_date` |
| Khoảng thời gian (5 mốc) | ✅ | ✅ | ✅ | chip `DateRangePresets`, ghi vào hai ô ngày trên |

Ca kiểm chốt hồi quy: mỗi trang chỉ có ĐÚNG MỘT ô "Từ ngày", và mọi khoá địa chỉ trang
trong một registry phải khác nhau — trùng khoá là đúng cơ chế đã sinh ra lỗi này.

### KHÔNG xoá năng lực nào

Chip trạng thái, thẻ thống kê bấm-để-lọc, sắp xếp theo cột, chọn nhiều dòng — **giữ nguyên
toàn bộ**. Anh chốt rõ: giống hệ cũ về nội dung và bảng lọc, nhưng không đánh đổi năng lực
mới lấy giao diện cũ. Có ca kiểm hồi quy chốt điều này ở cả ba shell.

### Cố ý KHÔNG dựng

- **Ô "Từ khóa" trong thẻ lọc** — thanh công cụ ngay trên đã có ô tìm kiếm; hai ô tìm trên
  một màn hình gây nhầm chứ không tiện.
- **"Đã chuyển đội khác"** và **"Tìm trường bỏ trống"** — hệ mới chưa có khái niệm tương
  đương; dựng theo phỏng đoán sẽ cho kết quả lọc sai mà cán bộ không biết.

## Summary (original audit, retained for reference)

| Page | Legacy actions | Legacy filters | Shell actions | Shell filters | MISSING |
|---|---|---|---|---|---|
| Cases | 8 | 5 | **0** | **0** | 13 |
| Incidents | 8 | 1+ | **0** | **0** | 9+ |
| Petitions | 9 | 5 | **0** | **0** | 14 |
| Comprehensive | 3 | 0 (visible) | **0** | **0** | 3 |
| **TOTAL** | **28** | **11+** | **0** | **0** | **39+** |

> Note: v0.61 restored *bulk* actions (export, assign, delete, restore) + chip counts. Matrix below tracks **single-row** actions + **advanced filters** only — those are still missing.

---

## Cases (`/cases`)

### Single-row actions

| testid (legacy) | Action | Status guard | Permission | Current shell | Status |
|---|---|---|---|---|---|
| `btn-view-{id}` | View detail (Eye) | — | — | ❌ missing | NEEDED |
| `btn-edit-{id}` | Edit (Pencil) | — | canEdit | ❌ missing | NEEDED |
| `btn-assign-{id}` | Phân công (UserCheck) | — | canDispatch | ❌ missing | NEEDED |
| `btn-manage-defendants-{id}` | Quản lý bị can (Users) | — | — | ❌ missing | NEEDED |
| `btn-manage-lawyers-{id}` | Quản lý luật sư (Briefcase) | — | — | ❌ missing | NEEDED |
| `btn-conclusion-{id}` | Kết luận điều tra (FileText) | — | — | ❌ missing | NEEDED |
| `btn-transfer-{id}` | Chuyển xử lý (ArrowRightLeft) | — | — | ❌ missing | NEEDED |
| `btn-delete-{id}` | Xóa vụ án (Trash2) | TIEP_NHAN only | canDelete | ❌ missing | NEEDED |

### Advanced filters

| testid (legacy) | Field | Type | Current shell | Status |
|---|---|---|---|---|
| `filter-from-date` | Từ ngày | date | ❌ missing | NEEDED |
| `filter-to-date` | Đến ngày | date | ❌ missing | NEEDED |
| `filter-unit` | Đơn vị | text | ❌ missing | NEEDED |
| `filter-investigator` | Điều tra viên | text | ❌ missing | NEEDED |
| `filter-charges` | Tội danh | text/FKSelect | ❌ missing | NEEDED |

### Header actions (verify shell has)

| testid (legacy) | Action | Current shell |
|---|---|---|
| `btn-refresh` | Refresh | ✅ via PageHeader |
| `btn-add-case` | Tạo mới | ✅ via PageHeader |
| `btn-advanced-filter` | Toggle Bộ lọc nâng cao | ❌ missing (no filter panel exists) |

### Delete modal

| testid (legacy) | Element | Current shell |
|---|---|---|
| `btn-cancel-delete` | Modal cancel button | ❌ missing (no delete UI) |
| `btn-confirm-delete` | Modal confirm button | ❌ missing (no delete UI) |

---

## Incidents (`/incidents`)

### Single-row actions

| testid (legacy) | Action | Current shell | Status |
|---|---|---|---|
| `btn-view-{id}` | View | ❌ missing | NEEDED |
| `btn-edit-{id}` | Edit | ❌ missing | NEEDED |
| `btn-assign` | Phân công | ❌ missing | NEEDED |
| `btn-transition` | Chuyển trạng thái | ❌ missing | NEEDED |
| `btn-confirm-transition` | Modal confirm transition | ❌ missing | NEEDED |
| `btn-prosecute` | Khởi tố | ❌ missing | NEEDED |
| `btn-confirm-prosecute` | Modal confirm prosecute | ❌ missing | NEEDED |
| `btn-delete` | Xóa | ❌ missing | NEEDED |
| `btn-action-menu` | ⋮ kebab | ❌ missing | NEEDED |

### Advanced filters

| testid (legacy) | Field | Current shell | Status |
|---|---|---|---|
| `filter-keyword` | Từ khóa | ❌ missing | NEEDED |
| (also need): `filter-loai-don-vu` enum | TO_GIAC \| TIN_BAO \| KIEN_NGHI_KHOI_TO | ❌ missing | NEEDED |
| (also need): `filter-reporter` | Người tố giác | ❌ missing | NEEDED |
| (also need): `filter-unit` | Đơn vị | ❌ missing | NEEDED |
| `btn-advanced-search` | Toggle advanced filter | ❌ missing | NEEDED |

### Header / bulk

| testid | Status |
|---|---|
| `btn-add-incident` | ✅ via PageHeader |
| `btn-refresh` | ✅ via PageHeader |
| `btn-export` | ✅ via v0.61 BulkActionBar |

---

## Petitions (`/petitions`)

### Single-row actions

| testid (legacy) | Action | Current shell | Status |
|---|---|---|---|
| `btn-view-{id}` | View | ❌ missing | NEEDED |
| `btn-edit-{id}` | Edit | ❌ missing | NEEDED |
| `btn-assign` | Phân công | ❌ missing | NEEDED |
| `btn-archive` | Lưu trữ | ❌ missing | NEEDED |
| `btn-convert-case` | Chuyển thành vụ án | ❌ missing | NEEDED |
| `btn-confirm-convert-case` | Modal confirm | ❌ missing | NEEDED |
| `btn-convert-incident` | Chuyển thành vụ việc | ❌ missing | NEEDED |
| `btn-confirm-convert-incident` | Modal confirm | ❌ missing | NEEDED |
| `btn-delete-{id}` | Xóa | ❌ missing | NEEDED |
| `btn-action-menu` | ⋮ kebab | ❌ missing | NEEDED |

### Advanced filters

| testid (legacy) | Field | Current shell | Status |
|---|---|---|---|
| `filter-from-date` | Từ ngày | ❌ missing | NEEDED |
| `filter-to-date` | Đến ngày | ❌ missing | NEEDED |
| `filter-sender` | Người gửi | ❌ missing | NEEDED |
| `filter-status` | Trạng thái | ❌ missing | NEEDED |
| `filter-unit` | Đơn vị | ❌ missing | NEEDED |
| `btn-advanced-search` | Toggle | ❌ missing | NEEDED |

### Header / bulk

| testid | Status |
|---|---|
| `btn-add-petition` | ✅ via PageHeader |
| `btn-refresh` | ✅ via PageHeader |
| `btn-export` | ✅ via v0.61 BulkActionBar |
| `btn-batch-export` | ✅ via v0.61 BulkActionBar |
| `btn-batch-clear` | ✅ via v0.61 useBulkSelection |
| `btn-guide` | ✅ giữ trong shell (verify) |
| Xuất Word hàng loạt | ✅ v0.70.3.0 — **chuyển** từ dropdown header sang BulkActionBar (`export-word`) |

---

## Comprehensive (`/comprehensive`)

### Single-row actions (polyglot: row type ∈ Case/Incident/Petition)

| testid (legacy) | Action | Current shell | Status |
|---|---|---|---|
| `btn-edit-{id}` | Edit (route per type) | ❌ missing | NEEDED |
| `btn-delete-{id}` | Xóa (route per type) | ❌ missing | NEEDED |
| `btn-transfer-{id}` | Chuyển xử lý | ❌ missing | NEEDED |

### Filters

Legacy Comprehensive had 7 filter fields (FilterData interface lines 29-36):
- `quickSearch`, `fromDate`, `toDate`, `district`, `status`, `createdBy`, `type`

All ❌ missing trong shell.

---

## Cross-cutting v0.61 baselines (must NOT regress)

| Feature | testid pattern | Verify still works after PR1b |
|---|---|---|
| Bulk checkbox header | `bulk-select-all` | ✅ |
| Bulk checkbox row | `bulk-select-row-{id}` | ✅ |
| Status chips | `status-chip-{value}` | ✅ chip counts visible |
| Bulk action bar | `bulk-action-bar` | ✅ appears when selected |
| Bulk export | `bulk-action-export` | ✅ |
| Bulk delete | `bulk-action-delete` | ✅ |

---

## A11y gaps (Claude finding #8 — pre-existing in `ActionMenuPortal`)

| Feature | Status | Fix in PR1a |
|---|---|---|
| Escape closes menu | ✅ exists | — |
| Click outside closes | ✅ exists | — |
| Arrow Up/Down nav | ❌ missing | YES |
| Focus first item on open | ❌ missing | YES |
| Return focus to anchor on close | ❌ missing | YES |
| `role="menu"` + `role="menuitem"` | unverified | YES |
| Focus visible ring on items | unverified | YES |

---

## Action Plan (PR mapping)

- **PR1a (v0.62.0.0)**: Build registry infra + Modal Providers + a11y patch. Wire Lawyers + Subjects (existing, low-risk) as canary. NO new actions on Cases yet — canary validates pattern.
- **PR1b (v0.62.1.0)**: Register 8 Cases actions + 5 Cases filters. Wire CaseListPageShell. ✅ Anh's complaint #1 + #2 resolved for Cases.
- **PR2 (v0.63.0.0)**: Register 8 Incidents actions + 4 Incidents filters.
- **PR3 (v0.64.0.0)**: Register 9 Petitions actions + 5 Petitions filters.
- **PR4 (v0.65.0.0)**: Register 3 Comprehensive actions (polyglot) + 7 Comprehensive filters.
- **PR5 (v0.65.1.0)**: husky pre-commit + CI workflow blocking future swap PRs without parity matrix update. Also: implement `scripts/audit-shell-parity.mjs` (ts-morph) for automated matrix generation.

## Acceptance criteria

After all PRs ship, this matrix must show **0 ❌ missing** rows for Cases/Incidents/Petitions/Comprehensive single-row actions + advanced filters. Bulk + chip baselines must remain ✅.

---

## v0.70.0.0 — Phím tắt danh sách (cross-cutting, không đổi feature parity)

Bổ sung hook `useListShortcuts` (Alt+N thêm mới, Alt+R làm mới, Ctrl+K tìm kiếm)
**đồng nhất** cho cả 4 shell (Cases, Comprehensive, Incidents, Petitions) +
sửa 1 comment stale trong `PetitionListPageShell`. Đây là hành vi bàn phím
xuyên suốt, **không thêm/bớt cột/lọc/bulk-action** nên **không thay đổi ma trận
parity** ở trên — ghi nhận ở đây để thỏa gate `shell-parity-gate`.

---

## v0.70.0.3 — Gợi ý phím tắt cạnh nút (cross-cutting, không đổi feature parity)

Thêm `<ShortcutHint action="newRecord" />` (hiện `<kbd>Alt+N</kbd>`) cạnh nút
"Tạo mới" ở cả 4 shell (Cases, Comprehensive, Incidents, Petitions). Chỉ là gợi
ý phím tắt hiển thị, **không thêm/bớt cột/lọc/bulk-action** nên **không đổi ma
trận parity** — ghi nhận để thỏa gate `shell-parity-gate`.

---

## v0.70.3.0 — Xuất Word hàng loạt: DỜI vị trí + MỞ RỘNG (có đổi parity)

**Chỉ ảnh hưởng `PetitionListPageShell`.** Đây là thay đổi parity thật, không phải
refactor, nên ghi nhận đầy đủ:

**Gỡ khỏi header:** dropdown "Xuất Word (N)" màu hổ phách (`FileText` + `ChevronDown`,
danh sách 7 mã cứng từ `features/petitions/docTypes.ts` — file này đã xoá vì mồ côi).
Dropdown chỉ chọn được **1 mẫu** cho N đơn.

**Thêm vào thanh chọn:** bulk action `export-word` ("Xuất Word", `variant:'outline'`,
quyền `petitions/view`). Bấm → mở `BatchExportDocumentsModal` chọn **nhiều mẫu một
lượt** (danh sách lấy ĐỘNG từ CSDL qua `listExportTemplates`) → 1 file ZIP.

**Không mất tính năng nào**: modal mới là bản mở rộng thực sự của dropdown cũ
(1 mẫu → M mẫu). Để cả hai lối vào sẽ gây rối vì chúng làm hai việc khác nhau.

**Cột / bộ lọc / chip: KHÔNG đổi.** Các shell còn lại (Cases, Incidents,
Comprehensive) **không đụng tới** — `export-word` chỉ bật khi adapter được truyền
`onExportWord`, mặc định tắt.

**Hạ tầng bulk dùng chung có thêm 1 field optional** `BulkAction.skipConfirm`
(bỏ hộp xác nhận cho action tự mở UI kế tiếp). `undefined` → hành vi cũ nguyên vẹn,
nên 5 màn đang dùng `BulkActionBar` không đổi parity.

---

## v0.70.4.0 — Thẻ thống kê bấm được để lọc (có đổi parity, cả 3 shell)

**Ảnh hưởng CẢ BA shell**: `CaseListPageShell`, `IncidentListPageShell`,
`PetitionListPageShell`. Đây là thay đổi parity thật, không phải refactor.

**Thêm — thanh thẻ thống kê (`StatsCardsStrip`) nay là bộ lọc:** bấm thẻ lọc danh sách
theo nhóm trạng thái tương ứng. Thẻ đang chọn nổi bật và `aria-disabled` (không bấm lại);
thẻ "Tổng" bấm để bỏ lọc. Nút Back của trình duyệt quay lại được bộ lọc trước
(`useListPageUrlState` thêm tuỳ chọn `history:'push'`).

| Shell | Param lọc | Nguồn số trên thẻ |
|---|---|---|
| Vụ án | `cases_statusGroup` (mới) | `/cases/stats` → `byGroup` |
| Đơn thư | `petitions_statusGroup` (mới) | `/petitions/stats` → `byGroup` |
| Vụ việc | `incidents_phase` (**sẵn có**, không thêm param) | `/incidents/stats` → `byGroup` |

**Gỡ khỏi bộ lọc nâng cao** (đều đang gây lỗi 400 vì param không có trong DTO):
- Đơn thư: field `status` — ghi trùng key `petitions_status` của thanh chip, là gốc rễ
  param `advancedStatus`. Lọc theo trạng thái nay dùng thanh chip hoặc thẻ.
- Vụ việc: field `keyword` — trùng chức năng với ô tìm kiếm trên thanh công cụ.

**Đổi tên param cho khớp DTO** (không đổi giao diện): `sender`→`senderName`,
`investigator`→`investigatorName`, `unit`→`donViGiaiQuyet` (Vụ việc). Thêm `charges`
(Vụ án) và `reporter` (Vụ việc, tra CCCD/SĐT) vào DTO.

**Cột / chip / bulk action: KHÔNG đổi.** `StatsCardsStrip` chỉ bấm được khi trang truyền
`onCardSelect`, nên 16+ trang khác đang dùng component này giữ nguyên DOM.
`StatusChips` thêm prop optional `groupActive` (chip "Tất cả" không sáng khi đang lọc
theo nhóm) — optional nên không đổi parity của shell nào khác.

## v0.74.0.0 — Cá nhân hoá cột bảng (feat/ca-nhan-hoa-cot-bang)

**Anh yêu cầu 28/08/2026**: cán bộ tự kéo giãn bề rộng cột và đổi thứ tự cột, lưu theo TỪNG
TÀI KHOẢN — *"giống như việc cá nhân hoá ẩn hiện column vậy"*.

**Không phải parity với hệ cũ.** Quét 182 chỗ khởi tạo Kendo Grid trong bản sao mã nguồn hệ
cũ: **0** chỗ khai `resizable`/`reorderable`/`columnMenu`, bề rộng là hằng số cứng
(`VuAn_list.tpl:30-64` — `width: 80/100/120/200/300`), thêm `scrollable: false`, và không lưu
bố cục ở đâu (không localStorage/cookie/`getOptions`). Đây là năng lực hệ mới ĐI XA HƠN hệ cũ,
nên không có bản gốc để đối chiếu — mọi luật phải tự chốt bằng ca kiểm.

### Thêm cho cả 4 shell

| Shell | Khoá bảng | Kéo giãn | Ẩn/hiện | Đổi thứ tự | Về mặc định |
|---|---|---|---|---|---|
| Đơn thư | `petitions` | ✅ | ✅ (đã có, nay lưu máy chủ) | ✅ | ✅ |
| Vụ việc | `incidents` | ✅ | ✅ (đã có, nay lưu máy chủ) | ✅ | ✅ |
| Vụ án | `cases` | ✅ | ✅ (đã có, nay lưu máy chủ) | ✅ | ✅ |
| Tra cứu tổng hợp | `comprehensive` | ✅ | ✅ (**mới** — trước không có) | ✅ | ✅ |

### Đổi chỗ lưu, không thêm hệ thứ hai

Ẩn/hiện trước đây lưu `localStorage` khoá `<trang>_columns` — **từng máy**, nên đổi máy là mất
và cùng một người ngồi hai máy thấy hai kiểu. Nay cả ba loại tuỳ chỉnh dùng CHUNG một chỗ lưu
`user_table_layouts` (một hàng mỗi cặp người-dùng × bảng) và CHUNG nút "Về mặc định".

Lựa chọn cũ trong trình duyệt được **chuyển lên máy chủ một lần** lúc mở trang, và chỉ khi máy
chủ chưa có bố cục cho bảng ấy — không thì cán bộ mở bản mới thấy mọi cột đã tắt hiện lại hết.

### Ràng buộc giữ nguyên parity

- **Người chưa chỉnh gì thấy bảng y hệt trước** — bề rộng khai trong mã không đổi; `onKeoGian`
  không truyền thì `Table` giữ nguyên hoàn toàn (16+ trang khác dùng component này không đổi DOM).
- **Cột Thao tác vẫn ghim mép trái** khi cuộn ngang, và **không đổi chỗ được** — `position`
  chỉ áp trong nhóm cột khai `optional` và không `sticky`.
- **Cột định danh không ẩn được** (Thao tác, STT) — giữ nguyên luật `optional` của v0.73.
- Bộ cột mặc định, chip trạng thái, bulk action: **KHÔNG đổi**.

### Tra cứu tổng hợp — khai thêm bề rộng

Trang này trước chạy bố cục `auto` và chỉ cột `actions` có `width`. Bật `fixedLayout` mà thiếu
width thì phần dư bị chia đều và bảng đổi hình, nên đã khai đủ 7 cột, **bề rộng đo từ dữ liệu
thật trên máy chạy** (trung vị / phân vị 90, 28/08/2026): mã hồ sơ 9/9 → `8rem`; tên & người
gửi 16/42 → `22rem`; đơn vị 9/38 → `14rem`.
