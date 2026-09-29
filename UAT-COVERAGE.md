# UAT coverage ? petition all-column search

Original spec: docs/superpowers/specs/2026-09-27-petition-all-column-search-design.md
Evidence: docs/uat/petition-all-column-search/REPORT.md; isolated UAT 27/27 PASS, retries 0, 0 cached. Scope covers this feature, not historical whole-application UAT.

| ID | M?n h?nh/Ch?c n?ng | Vi?t test | Ch?y test | K?t qu? |
|---|---|---|---|---|
| C01 | Danh s?ch ??n th?: stt | C? | API + E2E | PASS |
| C02 | Danh s?ch ??n th?: sttCu | C? | API + E2E | PASS |
| C03 | Danh s?ch ??n th?: loaiThongTin | C? | API + E2E | PASS |
| C04 | Danh s?ch ??n th?: nguonDon | C? | API + E2E | PASS |
| C05 | Danh s?ch ??n th?: nguoiGui | C? | API + E2E | PASS |
| C06 | Danh s?ch ??n th?: tomTat | C? | API + E2E | PASS |
| C07 | Danh s?ch ??n th?: donViGiaiQuyet | C? | API + E2E | PASS |
| C08 | Danh s?ch ??n th?: ketQuaXuLyKhac | C? | API + E2E | PASS |
| C09 | Danh s?ch ??n th?: nguoiNhap | C? | API + E2E | PASS |
| C10 | Danh s?ch ??n th?: trangThai | C? | API + E2E | PASS |
| C11 | Danh s?ch ??n th?: doiTuong | C? | API + E2E | PASS |
| C12 | Danh s?ch ??n th?: hanXuLy | C? | API + E2E | PASS |
| C13 | Danh s?ch ??n th?: ngayTao | C? | API + E2E | PASS |
| C14 | Danh s?ch ??n th?: ngayDeXuat | C? | API + E2E | PASS |
| C15 | Danh s?ch ??n th?: ngayTiepNhan | C? | API + E2E | PASS |
| C16 | Danh s?ch ??n th?: ngayTiepNhanNguonTin | C? | API + E2E | PASS |
| C17 | Danh s?ch ??n th?: ngayVietDon | C? | API + E2E | PASS |
| C18 | Danh s?ch ??n th?: ngayGiaoDonViGiaiQuyet | C? | API + E2E | PASS |
| C19 | Danh s?ch ??n th?: ngayPhieuChuyen | C? | API + E2E | PASS |
| C20 | Danh s?ch ??n th?: ngayCapCCCD | C? | API + E2E | PASS |
| C21 | Danh s?ch ??n th?: ngayVietDonChu | C? | API + E2E | PASS |
| B01 | Enter, kh?ng t?m live khi g? | C? | E2E | PASS |
| B02 | Ch?n g?i ? Lo?i th?ng tin | C? | E2E | PASS |
| B03 | ?n c?t kh?ng ??i ph?m vi t?m | C? | E2E | PASS |
| B04 | T?m kh?ng d?u | C? | API + E2E | PASS |
| B05 | Chip Lo?i th?ng tin v? search c? | C? | API | PASS |
| B06 | Ng?y ??y ??/th?ng/n?m | C? | API + E2E | PASS |
| B07 | Giao b? l?c tr?ng th?i v? ph?n trang | C? | API | PASS |
| B08 | Th?ng k? c?ng ?i?u ki?n | C? | API | PASS |
| B09 | Ph?n quy?n v? t? ch?i kh?ng ??ng nh?p | C? | API | PASS |
| B10 | Xu?t ??ng h? s? ?? t?m | C? | API + E2E | PASS |
| B11 | Kh?ng c? k?t qu? | C? | API | PASS |
| B12 | H? s? c? c? ch? m?c kh?ng r?ng ???c n?p l?i | C? | PostgreSQL integration | PASS |
| B13 | S?a d? li?u c?p nh?t ch? m?c, kh?ng ??i ng?y khi n?p l?i | C? | PostgreSQL integration | PASS |
| B14 | Petition list: select a calendar date, create a global-search chip, and find the matching record | Yes | API smoke + Playwright Chromium | PASS |

Reverse alignment: every data column in the petition list registry appears above, including hidden columns and free-text petition dates. API and UI behavior rows map to persisted qa/petition-search tests; database rows map to the isolated fixture assertions. Overall protocol remains NOT DONE because full-repository lint, default Playwright fixtures and cross-model review have outstanding gates.


---

## Historical UAT guidance (preserved)

# UAT-COVERAGE — đã chuyển về đúng chỗ

Tệp này từng chứa một ma trận **46 dòng viết tay** cho đợt 22/09/2026. Nó sai ở hai điểm, và
cả hai đều là lỗi quy trình chứ không phải lỗi nội dung:

1. **Đặt sai chỗ.** Quy ước của kho là mỗi đợt một thư mục `docs/uat/dot-XXXX/` gồm **bốn** tệp:
   `_domain-pack.md` (oracle) · `_coverage-ledger.md` (sổ phủ + `TC_min`) · `_platform.json`
   (nền tảng + vật cản) · `UAT-COVERAGE.md` (ma trận). Xem `docs/uat/dot-1809/` và
   `docs/uat/dot-2009/`. Tệp ở gốc kho không đi qua được công cụ nào.

2. **Con số 46 là em tự đặt.** Không tính từ phương pháp nào. Sàn thật do
   `coverage_calc.py` tính từ sổ phủ: `M1=140 · M2=120 · M3=33 · M4=120 → TC_min = 140`.
   Ma trận viết tay thiếu **94 ca**.

## Đợt 22–23/09/2026 nay nằm ở

**[`docs/uat/dot-2309/`](docs/uat/dot-2309/)** — 140 ca / 10 nhóm A–J, phủ trọn 12 PR
(#467 → #482) và cả 14 yêu cầu của anh trong hai ngày.

| Tệp | Vai |
|---|---|
| [`_domain-pack.md`](docs/uat/dot-2309/_domain-pack.md) | Oracle — 47 luật lấy từ yêu cầu của anh, không lấy từ mã |
| [`_coverage-ledger.md`](docs/uat/dot-2309/_coverage-ledger.md) | Sổ phủ 140 mệnh đề + cách tính `TC_min` |
| [`_platform.json`](docs/uat/dot-2309/_platform.json) | Nền tảng, phạm vi, vật cản |
| [`UAT-COVERAGE.md`](docs/uat/dot-2309/UAT-COVERAGE.md) | Ma trận 140 dòng |
| [`uat.json`](docs/uat/dot-2309/uat.json) | Bản máy đọc, bàn giao cho `uat-test-runner` |

## Trạng thái đo được

| | |
|---|---|
| Cổng máy | `validate_uat_json` ĐẠT · `coverage_calc` ĐẠT (140/140) · `self_audit` **SẴN SÀNG-KÈM-KHUYẾT** |
| Độ phủ | 134/140 item = 95,7% · 6 item là GAP có lý do |
| Đã chạy | **2/140** — mốc bản dựng, đo 23/09 04:38, `buildId 290f65d17c` khớp `origin/main` |
| Chưa chạy | **138/140** — chặn ở tài khoản thử prod |

Hai trong ba mục máy không đo được **đã làm**: soát đối kháng (Codex, 7 lỗi thật, đã sửa,
bộ ca 136 → 140) và gieo lỗi (`_fault-seeding.md`, 47 luật, 0 luật không ca nào bắt).
Còn trống **đánh giá trải nghiệm bằng người đóng vai thật** — cần tài khoản prod.

## Chặn ở anh

1. **Một tài khoản thử trên prod.** 5 tài khoản cũ khoá từ 20/09 vì mật khẩu lộ ở repo công khai.
2. **Một tài khoản cán bộ thuộc tổ khác.** Không có tài khoản thứ hai thì bốn ca phạm vi dữ liệu
   chỉ chứng minh được là mình thấy hồ sơ của mình, không chứng minh được ranh giới.
