# Domain pack — oracle đợt 20/09/2026

**Oracle lấy từ ĐẶC TẢ, không lấy từ mã.** Nguồn: (1) 5 yêu cầu anh gửi 20/09; (2) các quyết
định Đ1–Đ12 trong plan đã qua `/plan-eng-review`; (3) chuẩn ngoài được viện dẫn. Đọc kết quả
mong đợi từ mã là tự chứng minh mình đúng — mã sai thì ca kiểm cũng sai theo.

---

## R1 — Ô chọn cán bộ gom nhóm theo Tổ

**Nguồn: yêu cầu 1 của anh, nguyên văn ví dụ hiển thị.**

| Mã | Luật |
|---|---|
| R1-GROUP | Danh sách cán bộ hiện theo NHÓM TỔ, mỗi nhóm có tiêu đề là tên tổ. |
| R1-NAME | Gõ TÊN NGƯỜI → chỉ những người khớp còn lại, vẫn kê dưới nhóm của họ; nhóm rỗng biến mất. |
| R1-TEAM | Gõ TÊN TỔ → **cả nhóm** ấy giữ nguyên, không lọc bớt người bên trong. |
| R1-MULTI | Cán bộ thuộc 2 tổ xuất hiện ở CẢ HAI nhóm. |
| R1-NOTEAM | Người không thuộc tổ nào vào nhóm "Chưa có tổ", nhóm ấy luôn ở CUỐI. |
| R1-FULL | Danh sách có ĐỦ cán bộ đang hoạt động. Prod 20/09: **245 tài khoản hoạt động**. |
| R1-LOCKED | Tài khoản đã khoá KHÔNG mời chọn. Nhưng người ĐANG được giao mà đã khoá thì vẫn hiện (mất mục = mất phân công). |
| R1-KEY | Bàn phím: Tab tới ô, Enter/Space/↓ mở, ↑↓ đi xuyên nhóm không nhảy cóc, Enter chọn mục đang tô. |
| R1-A11Y | WAI-ARIA APG Combobox + Listbox có nhóm: `role=combobox` trên phần bấm được Tab tới, `role=listbox`, `role=group`+`aria-label` mỗi tổ, `role=option`, `aria-activedescendant` báo mục đang tô, `aria-selected` chỉ báo mục ĐÃ CHỌN. |

**Biên:** tên tổ thật là "Tổ CT số 4" … "Tổ CT số 10" → xếp theo SỐ, "số 10" đứng SAU "số 4".

---

## R2 — Nguồn đơn/Đơn vị giao thành danh mục

**Nguồn: yêu cầu 2 + Đ2 + Đ10 + Đ12.**

| Mã | Luật |
|---|---|
| R2-SEARCH | Ô Nguồn đơn tìm được như "Loại thông tin": gõ để lọc, có dấu hay không dấu đều ra. |
| R2-CREATE | Gõ tên chưa có → tạo nhanh được, mục mới ở trạng thái CHỜ DUYỆT. |
| R2-DEDUP | Gõ tên đã có (khác hoa/thường, khác dấu, khác NFC/NFD) → trả về mục cũ, KHÔNG tạo bản trùng. |
| R2-SCOPE | Áp cho **Đơn thư và Vụ án** (Đ2). Vụ việc `chuyenTuDonVi` KHÔNG đụng. |
| R2-FLAG | Cờ "Trực tiếp" suy từ TÊN bằng hàm thuần, chạy y hệt ở trình duyệt và máy chủ. Mục tạo nhanh tên "Trực tiếp" TỰ mang cờ. |
| R2-FLAG-NEG | Hàm bảo thủ: "Không trực tiếp", "Đơn vị trực tiếp thụ lý" KHÔNG phải Trực tiếp. Nhận nhầm = chặn Lưu hồ sơ cũ. |

---

## R3 — Nhóm ô gập được

**Nguồn: yêu cầu 2 (nhóm định danh) + yêu cầu 5 (Thông tin khác) + Đ4 + Đ11 + TK2.**

| Mã | Luật |
|---|---|
| R3-AUTO | Nhóm định danh nguyên đơn BUNG khi Nguồn đơn là Trực tiếp, THU khi không phải. |
| R3-HASVAL | Ô trong nhóm ĐÃ CÓ giá trị → nhóm vẫn bung. Thu gọn mà giấu dữ liệu đã nhập là hỏng tệ nhất. |
| R3-ERR | Nhóm chứa ô đang báo lỗi → tự bung + cuộn tới ô. Lưới an toàn phải NHÌN THẤY được. |
| R3-MANUAL | Bấm tay thắng luật tự-bung TRONG PHIÊN, nhưng KHÔNG được thắng R3-ERR: đóng tay rồi bấm Lưu thì ô gây chặn vẫn phải hiện ra (lớp lỗi PR #248). |
| R3-COUNT | Tiêu đề nhóm hiện "N ô · M đã nhập". Có ô bắt buộc bên trong → tiêu đề mang dấu `*`. |
| R3-QUIET | Chưa bấm Lưu thì nhóm KHÔNG viền đỏ — không mắng trước khi người ta làm gì. |
| R3-LAYOUT | Gom nhóm KHÔNG được xáo chỗ ô nào so với hệ cũ. Nhóm lấy dải LIỀN MẠCH trong đặc tả. |
| R3-OTHER | "Điều tra viên thụ lý" + "Lãnh đạo phụ trách tố tụng" vào nhóm "Thông tin khác", thu gọn sẵn, cuối tab Thông tin. Bản lặp ở 3 tab khác KHÔNG đổi. |

---

## R4 — Số điện thoại nguyên đơn bắt buộc CÓ ĐIỀU KIỆN

**Nguồn: yêu cầu 2 ("chỉ được nhập khi Nguồn đơn là Trực tiếp") + Đ6.**

| Mã | Luật |
|---|---|
| R4-REQ | Nguồn Trực tiếp + SĐT trống → CHẶN Lưu, báo đúng ô, ô phải NHÌN THẤY được. |
| R4-OPT | Nguồn khác + SĐT trống → **LƯU ĐƯỢC**. |
| R4-FMT | Định dạng SĐT áp cho MỌI nguồn. "Bưu điện" + "abc" → vẫn chặn. Nới "bắt buộc" không được nới luôn "hợp lệ". |
| R4-SYNC | Trình duyệt và máy chủ CÙNG một luật. Nới một bên là 400 im lặng. |
| R4-ANON | Đơn nặc danh → không bắt buộc, kể cả Trực tiếp. |

---

## R5 — Ngày viết đơn nhập thiếu thành phần

**Nguồn: yêu cầu 3 + Đ1 + Đ5 + TK3. Chuẩn ngoài: ISO 8601-2 (EDTF) Level 1 — Library of
Congress; NN/g "Date Input" + uxpatterns.dev khuyến nghị ba ô phân đoạn thay vì một ô mặt nạ.**

| Cán bộ nhập | Cột ngày thật | Cột chữ (EDTF) | Hiện lại |
|---|---|---|---|
| `15/12/2026` | `2026-12-15` | `2026-12-15` | `15/12/2026` |
| `__/12/2026` | RỖNG | `2026-12-XX` | `__/12/2026` |
| `__/__/2026` | RỖNG | `2026-XX-XX` | `__/__/2026` |
| để trống | RỖNG | RỖNG | rỗng |

| Mã | Luật |
|---|---|
| R5-NOFAKE | **Không bao giờ bịa ngày 01.** Nhập thiếu thì cột ngày thật phải RỖNG. |
| R5-ROUND | Vòng khứ hồi: gõ → lưu → mở lại đúng nguyên văn đã gõ. Áp cho cả 4 dạng trên. |
| R5-REAL | Ngày ráp lại phải CÓ THẬT: `31/02/2026`, `13` tháng, `29/02/2025` → chặn. Validate ngày RÁP LẠI, không validate từng ô. |
| R5-ORDER | Thiếu từ trái sang phải thì được (`__/12/2026`); thiếu từ phải sang thì vô nghĩa (`15/12/____`) → chặn. |
| R5-SEG | Ba ô trong `fieldset`, mỗi ô một tên riêng (Ngày/Tháng/Năm). Gõ đủ số tự nhảy ô kế; Backspace ở ô rỗng lùi ô trước; ←→ đi lại; dán "15/12/2026" tách đúng ba ô. |
| R5-TYPE | Chỉ nhận chữ số. |
| R5-PRINT | **In chứng từ**: đơn nhập thiếu in ra `__/12/2026`, KHÔNG in trống, KHÔNG in ngày bịa. |
| R5-LEGACY | Đơn DI TRÚ có ngày viết đơn là chữ tự do (prod: 4.447 bản ghi kiểu "tháng 5/2026") → in NGUYÊN VĂN, không bị hàm mới ghi đè. |
| R5-SCOPE | Chỉ Đơn thư. Vụ án/Vụ việc giữ nguyên. |

---

## R6 — Cán bộ đề xuất mặc định

**Nguồn: yêu cầu 4.**

| Mã | Luật |
|---|---|
| R6-NEW | Tạo mới → ô có sẵn người đang đăng nhập. |
| R6-EDIT | Sửa hồ sơ cũ → KHÔNG ghi đè người cũ. |
| R6-LATE | Hồ sơ người dùng về muộn hơn lượt dựng form → vẫn điền được. |

---

## Ba lớp lỗi phải chứng minh là đã chết

Không phải yêu cầu của anh, nhưng vá trong đợt này nên UAT phải phủ.

| Mã | Luật | Trước đây |
|---|---|---|
| X1-ASSIGN | Hộp Phân công: dropdown Tổ VÀ dropdown Cán bộ đều có dữ liệu | cả hai LUÔN rỗng trên prod |
| X2-COUNT | Ba form có đủ cán bộ, không lọt tài khoản đã khoá | thiếu ~45/245, lọt TK khoá |
| X3-CREATE | Tạo đơn MỚI có ngày nhập thiếu → lưu xuống cả hai cột | đường tạo mới bỏ quên cột chữ |
| X4-LOCKED | Hồ sơ giao cho người đã khoá → vẫn hiện tên, ghim đầu danh sách | rơi xuống đáy 245 người / mất hẳn |

---

## Đặc tính ISO 25010 áp dụng

| Đặc tính | Nhóm ca | Ghi chú |
|---|---|---|
| Phù hợp chức năng | A, B, C, D, E, F, G, H | lõi của đợt |
| Khả dụng (usability/a11y) | I1–I3, A5–A6, A19 | WAI-ARIA APG là oracle, không phải "trông có vẻ ổn" |
| Tin cậy | A14, B2–B3, R5-LEGACY | dữ liệu đã nhập không được mất |
| Bảo mật | H1 (không rò tài khoản khoá), H6 (quyền tạo danh mục) | |
| Tương thích | J1–J3 | Chrome thật — jsdom không tính CSS |
| Bảo trì | các cổng CI mới (7 cổng) | gieo lỗi đã chứng minh từng cổng đỏ được |
