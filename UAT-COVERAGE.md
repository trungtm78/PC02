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

Soát đối kháng **đã chạy** — Codex bắt 7 lỗi thật, đã sửa trọn (bộ ca 136 → 140). Còn trống
hai phép đo máy không làm được, và **không ai được tự tích thay**: gieo lỗi, đánh giá trải
nghiệm bằng người đóng vai thật.

## Chặn ở anh

1. **Một tài khoản thử trên prod.** 5 tài khoản cũ khoá từ 20/09 vì mật khẩu lộ ở repo công khai.
2. **Một tài khoản cán bộ thuộc tổ khác.** Không có tài khoản thứ hai thì bốn ca phạm vi dữ liệu
   chỉ chứng minh được là mình thấy hồ sơ của mình, không chứng minh được ranh giới.
