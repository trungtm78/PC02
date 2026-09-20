# Coverage Ledger — đợt 20/09/2026 (form Đơn thư nhập liệu nhanh)

> Sinh TRƯỚC khi viết ca (enumerate-before-write). Oracle: `_domain-pack.md` — lấy từ đặc tả,
> không lấy từ mã. Cột **Tầng** nói bằng chứng đi qua đâu: **E2E** = Chrome thật + máy chủ +
> CSDL thật · **API** = HTTP thật · **UNIT** = ca kiểm đơn vị (chỉ dùng khi chủ ngữ của mệnh đề
> là một hàm, và câu chữ đã thu hẹp cho khớp).
>
> Ghi PASS cho mệnh đề rộng dựa trên bằng chứng hẹp là dạng trượt mà mọi tầng đều xanh trong
> khi tính năng không dùng được — đã gặp hai lần trong dự án này.

## TC_min = MAX(M1, M2, M3, M4)

| Phương pháp | Cách đếm | Giá trị |
|---|---|---|
| **M1** spec coverage items | 44 luật trong `_domain-pack.md` (R1×9, R2×6, R3×8, R4×5, R5×9, R6×3, X×4) + 18 ca phủ định khi áp dụng + 8 ca biên/phân vùng | **70** |
| **M2** ΣV(G) | Nhánh của mã mới: `laNguonTrucTiep` 6 · `gomCanBoTheoTo` 7 · `FKSelect` chế độ nhóm 9 · `NhomOGap` 8 · `PartialDateInput` 11 · `edtf.ts` 9 · `SdtNguyenDonHopLe` 5 · `kiemNhomLienNhau` 4 · CLI gộp 8 | 67 (đã phủ ở tầng UNIT: 5.868 BE + 3.629 FE) |
| **M3** FP^1.2 | 5 yêu cầu + 3 phần tăng phạm vi (ô Sinh năm, Vụ án dùng chung danh mục, `--chuan-hoa`) ≈ 22 FP → 22^1.2 | 41 |
| **M4** risk-tier | HIGH — form nhập liệu dùng HÀNG NGÀY trên 47.488 đơn, có ghi dữ liệu, có in văn bản GỬI RA NGOÀI NGÀNH, và đợt này vá 4 lỗi đang sống trên prod | 80 |

**TC_min = 80.** Ma trận `UAT-COVERAGE.md` ban đầu có **60 ca** (nhóm A–J) ⇒ thiếu 20.
Đã bù **nhóm K** (10 ca, chỗ hỏng đắt nhất) và **nhóm L** (10 ca, bề mặt liền kề không sửa
nhưng đọc cột/ô vừa đổi). **Tổng 80 ca, 80 mã duy nhất** — đã đếm lại bằng máy.

## Sổ mệnh đề

| # | Mệnh đề | Luật | Loại | Tầng | Ca |
|---|---|---|---|---|---|
| C1.1 | Ô chọn cán bộ hiện theo nhóm tổ, tiêu đề là tên tổ | R1-GROUP | GREEN | E2E | A1, D1, E1, E2 |
| C1.2 | Gõ tên người → lọc trong nhóm, nhóm rỗng biến mất | R1-NAME | GREEN | E2E | A2 |
| C1.3 | Gõ tên tổ → giữ CẢ nhóm | R1-TEAM | GREEN | E2E | A3 |
| C1.4 | Gõ không dấu và gõ tắt đều ra | R1-NAME | EP | E2E | A4 |
| C1.5 | Cán bộ 2 tổ hiện ở cả hai nhóm | R1-MULTI | EDGE | UNIT | `gomCanBoTheoTo.test.ts` |
| C1.6 | "Chưa có tổ" luôn cuối, chỉ dựng khi có người | R1-NOTEAM | EDGE | UNIT | `gomCanBoTheoTo.test.ts` |
| C1.7 | Tổ xếp theo SỐ: "Tổ CT số 10" sau "Tổ CT số 4" | R1-GROUP | BOUNDARY | UNIT | `gomCanBoTheoTo.test.ts` (tên tổ THẬT) |
| C1.8 | Danh sách đủ 245 cán bộ hoạt động | R1-FULL | DATA | E2E | A1 |
| C1.9 | Tài khoản đã khoá không mời chọn | R1-LOCKED | SECURITY | E2E | A7 |
| C1.10 | Người đang được giao mà đã khoá vẫn hiện, ghim đầu | R1-LOCKED, X4 | EDGE | E2E | B6, D3, E3 |
| C1.11 | Mũi tên đi xuyên nhóm, Enter chọn mục đang tô | R1-KEY | GREEN | E2E | A5 |
| C1.12 | Tab tới ô và MỞ được bằng bàn phím | R1-KEY | RED/A11Y | E2E | A6, I1 |
| C1.13 | Enter khi CHƯA tô không tự lấy người đầu | R1-KEY | EDGE | UNIT | `FKSelect.test.tsx` |
| C1.14 | Danh sách đổi dưới chân thì bỏ tô, không chọn nhầm người | R1-KEY | STATE | UNIT | `FKSelect.test.tsx` |
| C1.15 | `aria-activedescendant` trỏ mục đang tô; `aria-selected` chỉ mục đã chọn | R1-A11Y | A11Y | E2E | I1 |
| C1.16 | Ba trạng thái rỗng phân biệt: đang tải / không có ai / không tìm thấy | R1-FULL | EDGE | UNIT | `FKSelect.test.tsx` |
| C2.1 | Ô Nguồn đơn tìm được, có dấu/không dấu đều ra | R2-SEARCH | GREEN | E2E | A9, D2 |
| C2.2 | Gõ tên chưa có thì tạo nhanh, mục ở trạng thái chờ duyệt | R2-CREATE | GREEN | E2E | A9, G2 |
| C2.3 | Gõ tên đã có khác hoa/dấu/NFC thì trả mục cũ, không tạo trùng | R2-DEDUP | EP | API | H6 |
| C2.4 | Áp cho cả Vụ án; Vụ việc KHÔNG đụng | R2-SCOPE | REGRESSION | E2E | D2, D4 |
| C2.5 | Mục tạo nhanh tên "Trực tiếp" tự mang cờ | R2-FLAG | GREEN | E2E | G3 |
| C2.6 | "Không trực tiếp" / "Đơn vị trực tiếp thụ lý" KHÔNG phải Trực tiếp | R2-FLAG-NEG | RED | UNIT | `truc-tiep` (corpus dùng chung FE+BE) |
| C3.1 | Nguồn = Trực tiếp thì nhóm định danh bung | R3-AUTO | GREEN | E2E | A10 |
| C3.2 | Đổi sang nguồn khác thì nhóm thu | R3-AUTO | EP | E2E | A11 |
| C3.3 | Ô trong nhóm đã có giá trị thì vẫn bung | R3-HASVAL | EDGE | E2E | B5 |
| C3.4 | Nhóm có ô báo lỗi thì tự bung + cuộn tới | R3-ERR | RED | E2E | A13 |
| C3.5 | Đóng tay rồi bấm Lưu thì ô gây chặn VẪN hiện ra | R3-MANUAL | STATE | E2E | A14 |
| C3.6 | Chưa bấm Lưu thì không viền đỏ | R3-QUIET | UX | E2E | A15 |
| C3.7 | Tiêu đề hiện "N ô · M đã nhập" đúng số | R3-COUNT | GREEN | E2E | A21 |
| C3.8 | Có ô bắt buộc bên trong thì tiêu đề mang dấu sao + nhãn đọc được | R3-COUNT | A11Y | E2E | I2 |
| C3.9 | Gom nhóm không xáo chỗ ô nào | R3-LAYOUT | REGRESSION | E2E + đo ảnh | J1, J2 |
| C3.10 | Nhóm "Thông tin khác" thu gọn sẵn, bấm bung | R3-OTHER | GREEN | E2E | A20 |
| C3.11 | Bản lặp hai ô ấy ở 3 tab khác KHÔNG đổi | R3-OTHER | REGRESSION | UNIT | cổng `nhomPhaiLienNhau` |
| C4.1 | Trực tiếp + SĐT trống thì chặn Lưu, ô nhìn thấy được | R4-REQ | RED | E2E | A13 |
| C4.2 | Nguồn khác + SĐT trống thì LƯU ĐƯỢC | R4-OPT | GREEN | E2E + API | A12, H2 |
| C4.3 | Máy chủ cùng luật: Trực tiếp thiếu SĐT thì 400 câu rõ | R4-SYNC | RED | API | H3 |
| C4.4 | Định dạng áp cho MỌI nguồn ("Bưu điện" + "abc" thì chặn) | R4-FMT | RED | API | *(ca bù K1)* |
| C4.5 | Đơn nặc danh thì không bắt buộc, kể cả Trực tiếp | R4-ANON | EDGE | UNIT | `sdt-nguyen-don.validator.spec.ts` |
| C5.1 | `15/12/2026` lưu rồi mở lại đúng nguyên văn | R5-ROUND | GREEN | E2E | A22 |
| C5.2 | `__/12/2026` lưu rồi mở lại đúng nguyên văn | R5-ROUND | GREEN | E2E | A16, B4 |
| C5.3 | `__/__/2026` lưu rồi mở lại đúng nguyên văn | R5-ROUND | GREEN | E2E | A17 |
| C5.4 | Để trống thì cả hai cột rỗng | R5-ROUND | EP | UNIT | `edtf.test.ts` |
| C5.5 | Nhập thiếu thì cột ngày thật RỖNG, không bịa mồng 1 | R5-NOFAKE | BOUNDARY | API | *(ca bù K2)* |
| C5.6 | `31/02/2026` bị chặn tại chỗ | R5-REAL | RED | E2E | A18 |
| C5.7 | Máy chủ cũng chặn `2026-02-31` | R5-REAL | RED | API | H4 |
| C5.8 | `15/12/____` (thiếu từ phải) bị chặn | R5-ORDER | RED | UNIT | `edtf.test.ts` |
| C5.9 | Tự nhảy ô, Backspace lùi ô, mũi tên ngang, dán tách ba ô | R5-SEG | GREEN | E2E | A19 |
| C5.10 | Chỉ nhận chữ số | R5-TYPE | EP | UNIT | `PartialDateInput.test.tsx` |
| C5.11 | Ba ô có tên riêng, nhóm có tên chung | R5-SEG | A11Y | E2E | I3 |
| C5.12 | In đơn nhập ĐỦ thì bản in có ngày đúng | R5-PRINT | GREEN | E2E | F1 |
| C5.13 | In đơn nhập THIẾU thì in `__/12/2026`, không trống | R5-PRINT | RED | E2E | F2 |
| C5.14 | In đơn DI TRÚ chữ tự do thì in NGUYÊN VĂN | R5-LEGACY | REGRESSION | E2E | F3 |
| C5.15 | Không bản in nào ra ngày bịa | R5-NOFAKE | BOUNDARY | E2E | F4 |
| C5.16 | Mọi nơi in đi qua một hàm | R5-PRINT | MAINT | UNIT | cổng `moiNoiInNgayVietDon` (gieo lỗi) |
| C6.1 | Tạo mới thì ô có sẵn người đăng nhập | R6-NEW | GREEN | E2E | A8 |
| C6.2 | Sửa hồ sơ cũ thì không ghi đè người cũ | R6-EDIT | REGRESSION | E2E | *(ca bù K3)* |
| C6.3 | Hồ sơ người dùng về muộn thì vẫn điền | R6-LATE | STATE | UNIT | `PetitionFormPage` test |
| CX.1 | Hộp Phân công: danh sách Tổ có dữ liệu | X1-ASSIGN | RED | E2E | C1 |
| CX.2 | Hộp Phân công: danh sách Cán bộ có dữ liệu, đúng tổ đã chọn | X1-ASSIGN | RED | E2E | C2, C3 |
| CX.3 | Phân công thành công, hồ sơ cập nhật | X1-ASSIGN | GREEN | E2E | C4 |
| CX.4 | Tạo đơn MỚI ngày thiếu thì lưu xuống cả hai cột | X3-CREATE | RED | API | *(ca bù K2)* |
| CO.1 | `GET /admin/users` trả `teams[]`, consumer cũ không vỡ | R1-GROUP | REGRESSION | API | H1 |
| CO.2 | Tạo đơn BÌNH THƯỜNG vẫn 201 (không 400 vì khoá form mới) | — | REGRESSION | API | H5 |
| CO.3 | Mở hồ sơ DI TRÚ thì không ô nào biến mất | — | REGRESSION | E2E | B1 |
| CO.4 | Mở đơn cũ có ngày thì ba ô hiện đúng, không trắng | X3-CREATE | RED | E2E | B2 |
| CO.5 | Lưu đơn cũ không đụng ngày thì ngày giữ nguyên | X3-CREATE | REGRESSION | E2E | B3 |
| CO.6 | Bố cục tab Thông tin Vụ án không xáo | R3-LAYOUT | REGRESSION | E2E | D5 |
| CO.7 | Loại "Nguồn đơn/Đơn vị giao" hiện ở trang Danh mục | R2-CREATE | GREEN | E2E | G1 |
| CO.8 | Bảng phân công: thêm/xoá cán bộ, nhãn khớp ô chọn | X4-LOCKED | GREEN | E2E | B7 |
| CO.9 | Máy chủ báo `buildId` khớp lượt deploy | — | OAT | API | *(ca bù K4)* |
| CO.10 | Bề rộng ba ô ngày sau khi đổi font không giật | R5-SEG | COMPAT | đo Chrome | J3 |

## Ca bù nhóm K cho ngưỡng rủi ro (60 → 70)

M4 đòi 80. Mười ca bù, chọn theo chỗ hỏng đắt nhất chứ không chọn cho đủ số:

| ID | Ca bù | Vì sao ca này |
|---|---|---|
| K1 | API: nguồn "Bưu điện" + SĐT `abc` thì 400 | `@ValidateIf` từng làm lọt thẳng xuống cột; phải chứng minh đã chết |
| K2 | API: tạo đơn `ngayVietDonEdtf=2026-12-XX`, đọc lại thấy cột ngày thật RỖNG và cột chữ CÓ | lỗi P1 đường tạo mới; ca giao diện dừng ở thân yêu cầu nên không bắt được |
| K3 | Sửa đơn cũ có cán bộ đề xuất khác mình, lưu, vẫn là người cũ | yêu cầu 4 dễ gây ghi đè ngầm |
| K4 | `GET /health` sau deploy báo `buildId` khớp commit đã merge | chống "deploy xong mà bản cũ còn sống" — đã gặp |
| K5 | OFFICER (không phải ADMIN) mở form: chọn được cán bộ, tạo được mục danh mục | `read:Directory` / `write:Petition`; OFFICER từng không lưu được đơn |
| K6 | Đơn nặc danh + Trực tiếp + SĐT trống thì LƯU ĐƯỢC | giao điểm hai luật, dễ sót |
| K7 | Nguồn đơn để TRỐNG thì nhóm định danh thu, lưu được | trạng thái rỗng là giá trị thật, không phải ca biên |
| K8 | Hai tab cùng mở một đơn, tab A lưu ngày thiếu, tab B tải lại thấy đúng | ghi/đọc một quy ước, hai phía |
| K9 | Mạng hỏng giữa lúc Lưu: báo lỗi rõ, KHÔNG mất thứ đã gõ | dữ liệu người ta gõ là thứ đắt nhất |
| K10 | Ô chọn cán bộ khi máy chủ trả lỗi: báo hỏng, KHÔNG hiện "không có cán bộ nào" | tải hỏng khác rỗng (cổng `congSoLieuKhiTaiHong`) |

## Khoảng trống CÓ LÝ DO

| Không phủ | Vì sao |
|---|---|
| Đo thời gian mở ô chọn 245 người | Chưa có mốc đối chứng; đề xuất đo khi anh chạy thật |
| Trình đọc màn hình thật (NVDA/JAWS) | Không có trên máy; kiểm được vai trò + tên + bàn phím, không kiểm được lời đọc |
| `--that` / `--chuan-hoa` của CLI trên prod | Anh chốt chỉ chạy `--csv`; chưa duyệt thì chưa có gì để kiểm |
| Safari / iOS | Cán bộ dùng Chrome/Edge Chromium; host Windows không dựng được |
