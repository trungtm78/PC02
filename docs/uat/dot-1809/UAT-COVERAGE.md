# UAT-COVERAGE — đợt 18/09/2026 "Danh sách dễ đọc + tự cập nhật + dữ liệu hệ cũ thiếu"

> Oracle: yêu cầu và quyết định của anh ngày 18/09 (`_domain-pack.md`), không phải hành vi mã. Sổ phủ chi tiết:
> `_coverage-ledger.md`. Ca kiểm: `tests/e2e/dot-1809-uat.e2e.spec.ts`, `tests/api/dot-1809-uat.api.spec.ts`.

## 1. Kết quả thực thi (lượt cuối, 19/09/2026 ~05:40)

| Môi trường | Tầng | Đạt | Đỏ | Bỏ qua | Ghi chú |
|---|---|---|---|---|---|
| **Prod** `31a5cbcc` | API | **18/18** | 0 | 0 | gồm A10 phạm vi OFFICER (officer1) |
| **Prod** `31a5cbcc` | E2E Chrome | **25** | 0 | 0 | E17 sau lượt E, E18 sau lượt D (19/09) |
| Bản sao `pc02_e2e_c` (đã chạy 3 CLI) | API | **18/18** | 0 | 0 | — |
| Bản sao | E2E Chrome | **24** | 0 | 1 | E05: trang đầu bản sao không có tóm tắt dài — **đã PASS trên prod** |

**Phủ mệnh đề: 46/46 dòng ledger có bằng chứng PASS** (mỗi dòng ở đúng tầng chủ ngữ của nó; dòng chủ ngữ là hàm thì
câu đã thu hẹp). R6: anh duyệt lượt ghi **E** 19/09 → C6.1 (tìm "Kha Tử Thạnh" ra 26-11732) **PASS trên prod** (E17).
Anh duyệt lượt ghi **D** 19/09 → C6.2 ("Lê Nguyễn Yến Thanh" ở Đơn thư ra 26-11129 "Đã chuyển vụ án") **PASS trên prod** (E18).

## 2. Lỗi UAT bắt được (đều đã sửa, deploy, chạy lại PASS)

| # | Lỗi | Mức | Tầng bắt | Vì sao ca đơn vị/rà mã sót | Sửa |
|---|---|---|---|---|---|
| U1 | Ô Tóm tắt tràn mà **không có "Xem thêm"** (20 ô tràn, 18 nút): đo trước khi font Source Serif nạp; khung kẹp 5 dòng không đổi cỡ nên ResizeObserver im | S2 | E2E Chrome (E04) | jsdom không nạp font, không tính CSS | #416 — đo lại khi `document.fonts.ready`/`loadingdone` |
| U2 | Lượt kiểm bản mới đầu **bị bỏ** khi effect chạy lại (StrictMode): lượt hỏi đang bay dùng chung qua ref, mang cờ huỷ của effect đã chết | S3 (prod gần 0 — StrictMode chỉ ở dev) | E2E Chrome (E01) + chẩn đoán | jsdom không lặp lại thứ tự StrictMode | #416 — lượt hỏi riêng từng lần chạy effect |
| U3 | Ô "Cán bộ nhập" chỉ tải **200/245** cán bộ → ~45 người không lọc được | S2 | E2E **prod** (E10) | dữ liệu kiểm < 200 người | #418 — tải theo trang tới đủ `total` |
| U4 | **13 cặp trùng họ tên** không phân biệt (vd `mrtea`/`tra.buithanh.doi2` đều "Bùi Thanh Trà") → chọn nhầm lọc ra 0 | S3 | E2E **prod** (E10) | dữ liệu kiểm không có tên trùng | #418 — trùng tên kèm tên đăng nhập |

Mix mức độ: 0 S1, 2 S2, 2 S3 — không lỗi chức năng nghiêm trọng nào lọt tới UAT; U3/U4 là lỗi "vừa với dữ liệu thật",
đúng loại UAT nên bắt.

## 3. Lỗi của chính bộ ca kiểm (đã sửa trong ca, không phải lỗi sản phẩm)

- Chờ `networkidle` treo vì kết nối SSE thông báo mở suốt → chờ điều kiện trên màn.
- Bộ chọn "Xem thêm" theo chữ trỏ sang ô kế tiếp sau khi bấm → đánh dấu cố định ô.
- Chọn "cán bộ đầu ô chọn" (người không có hồ sơ) → chọn đúng id người nhập dòng đầu.
- Đọc biến đánh dấu trước khi trang kịp tải lại → thăm dò.
- Giới hạn tần suất (5 lượt/phút/điểm cuối xuất; 15 lượt/phút đăng nhập) → ca tôn trọng `Retry-After`; C5.8 kiểm chính
  giới hạn này (A09).

## 4. Hiệu lực — gieo lỗi (fault seeding) 15/15 bị bắt

| Mã | Lỗi gieo (cách hỏng thật của yêu cầu) | Tầng | Ca bắt |
|---|---|---|---|
| S1 | "Xem thêm" không chặn lan → bấm nhảy sang hồ sơ | E2E | E04, E05 |
| S2 | Kẹp 3 dòng thay vì 5 | E2E | E04 ×4 |
| S3 | Bảng không xuống dòng | E2E | E07 ×3 |
| S4 | Không có thanh cuộn trên | E2E | E07 ×3 |
| S5 | Không nhận ra bản mới | E2E | E01 |
| S6 | Mật độ không lưu máy chủ | E2E | E15 |
| S7 | Nút xuất bỏ qua bộ lọc | E2E | E09 ×3 |
| S8 | Nhãn kỳ luôn là kỳ mặc định | E2E | E11 |
| S9 | Font có chân không đo lại (U1) | E2E | E04 |
| S10 | Lượt hỏi /health dùng chung (U2 — trả về đúng bản lỗi) | đơn vị | `capNhat.test.tsx` |
| B1 | Bỏ lọc Cán bộ nhập khỏi điều kiện chung | jest | `petitions-mot-where`, `petitions-xuat-danh-sach` |
| B2 | Bỏ trần 50.000 dòng | jest | `xuat-danh-sach.spec` |
| B3 | Bộ nạp quên Cán bộ nhập Vụ việc | jest | `vu-viec-can-bo-nhap.spec` |
| B4 | Đọc dòng xuất không bỏ hồ sơ đã xoá | jest | `cases-xuat-danh-sach.spec` |
| B5 | Đồng bộ hệ cũ đè Cán bộ nhập đã chọn | jest | `legacy-migration.service.spec` |

Mọi tệp đã trả nguyên trạng sau mỗi lượt gieo (kiểm `git status`).

## 5. Khoảng trống còn lại (có lý do)

| Mục | Lý do | Đề xuất |
|---|---|---|
| ~~YC-6 "Lê Nguyễn Yến Thanh" ở Đơn thư (E18)~~ | ĐÃ ĐÓNG trên prod 19/09 06:47: sao lưu `pre-bu-don-thu-lech-loai-20260919-0647.sql.gz`; thêm 86 đơn gắn kèm (61 vụ án + 25 vụ việc), mỗi đơn nối đúng hồ sơ đích; 0 số trùng; chạy lại 0 | — |
| ~~Trùng số hệ mới → số mới + STT cũ (C6.4)~~ | ĐÃ ĐÓNG trên prod 19/09: 13 đơn 11729–11742 → 2026-11936…11948, 13/13 có STT cũ, 0 số trùng, chạy lại 0 | — |
| Hiệu năng xuất 47k dòng | Không đo thời gian ở UAT | Đo lúc anh bấm thử lần đầu |
| axe tự động | Chưa cài `@axe-core/playwright` | Đã kiểm tên: aria-pressed/aria-expanded/bàn phím (E05, E16) |

## 6. Đề xuất nghiệm thu

**Đề xuất GO** cho YC-1…YC-5 + font + mật độ dòng (0 lỗi mở, 46/46 dòng ledger PASS, 15/15 lỗi gieo bị bắt).
**YC-6:** Kha Tử Thạnh ĐÃ ĐÓNG trên prod (lượt E, sao lưu `pre-cap-nhat-he-cu-20260919-0628.sql.gz`). Lê Nguyễn Yến Thanh ở
Đơn thư ĐÃ ĐÓNG (lượt D, sao lưu `pre-bu-don-thu-lech-loai-20260919-0647.sql.gz`, E18 PASS prod); bù Cán bộ nhập 4.601 vụ việc ĐÃ CHẠY (lượt C2 19/09 06:58, sao lưu `pre-bu-can-bo-nhap-vu-viec-20260919-0657.sql.gz`; chạy lại 0; lọc Vụ việc theo Cán bộ nhập ra đúng 2.208 hồ sơ của Admin hệ cũ). Chữ ký nghiệm thu là của anh
(AI không tự duyệt).
