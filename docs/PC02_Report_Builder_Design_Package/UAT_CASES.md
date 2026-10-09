# Bộ tiêu chí và kịch bản nghiệm thu

Dùng tài khoản test và dữ liệu giả trên staging. Trạng thái tất cả: NOT RUN. Preconditions chung: phiên bản mẫu đã publish, kỳ và phân công xác định, clock server có thể điều khiển. Mỗi case tạo dữ liệu riêng; reset về baseline sau case.

## UAT-001 Tải mẫu Excel

Liên kết BR-01 → FR-001 → AC-001 → M03-T01 → S02.

Thiết lập: file hợp lệ và file giả extension.

Bước1: mở màn S02 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Upload .xlsx hợp lệ tạo bản nháp và preview; file sai loại/vượt giới hạn báo lỗi, không publish.

Evidence: parser trả schema hoặc lỗi có mã. Kết quả: NOT RUN.

## UAT-002 Locked và input

Liên kết BR-01 → FR-002 → AC-002 → M03-T01 → S03.

Thiết lập: 4 tổ hợp locked/token.

Bước1: mở màn S03 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Locked literal chỉ đọc; unlocked token tạo input; locked token và unlocked trống/literal báo Sheet!Cell.

Evidence: schema field đúng và lỗi đúng ô. Kết quả: NOT RUN.

## UAT-003 Grammar token

Liên kết BR-01 → FR-003 → AC-003 → M03-T01 → S04.

Thiết lập: valid/invalid grammar và alias.

Bước1: mở màn S04 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Chấp nhận TEXT NUM DATE TIME, format optional, AGG optional; Num chuẩn NUM, AGV cảnh báo alias AVG; token sai bị chặn.

Evidence: fixture parser pass. Kết quả: NOT RUN.

## UAT-004 Bố cục Excel

Liên kết BR-01 → FR-004 → AC-004 → M04-T01 → S11.

Thiết lập: golden workbook nhiều sheet và cột AK.

Bước1: mở màn S11 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Giữ sheet merge font border wrap kích thước và freeze trong phạm vi hỗ trợ; cảnh báo thành phần ngoài phạm vi.

Evidence: đối soát vị trí và visual QA. Kết quả: NOT RUN.

## UAT-005 Ô gộp và ẩn

Liên kết BR-01 → FR-005 → AC-005 → M03-T01 → S03.

Thiết lập: merge A2:C2 và hidden input.

Bước1: mở màn S03 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Chỉ anchor của merge là field; input ẩn bị chặn publish; không nhân đôi giá trị.

Evidence: field count đúng. Kết quả: NOT RUN.

## UAT-006 Lịch tuần

Liên kết BR-02 → FR-006 → AC-006 → M02-T03 → S05.

Thiết lập: tuần cuối năm/đầu năm.

Bước1: mở màn S05 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Chọn thứ và giờ, preview 6 kỳ; ISO week-year đúng tại tuần giao năm.

Evidence: ngày giờ kỳ khớp fixture. Kết quả: NOT RUN.

## UAT-007 Lịch tháng

Liên kết BR-02 → FR-007 → AC-007 → M02-T03 → S06.

Thiết lập: tháng 2 nhuận và ngày 31.

Bước1: mở màn S06 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Ngày 1–31/cuối tháng, ngày thiếu chuyển cuối tháng và preview rõ.

Evidence: hạn đúng lịch. Kết quả: NOT RUN.

## UAT-008 Lịch quý

Liên kết BR-02 → FR-008 → AC-008 → M02-T03 → S07.

Thiết lập: Q4 sang Q1.

Bước1: mở màn S07 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Chọn tháng thứ 1/2/3 và ngày, quý hiện tại/kế tiếp; preview ngày thật.

Evidence: hạn không lệch năm. Kết quả: NOT RUN.

## UAT-009 Ngày chính xác

Liên kết BR-02 → FR-009 → AC-009 → M02-T03 → S08.

Thiết lập: ngày cụ thể với opens_at trước due_at.

Bước1: mở màn S08 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Tạo một kỳ tại ngày giờ chọn, không tự lặp; hiển thị khoảng dữ liệu.

Evidence: chỉ một kỳ được tạo. Kết quả: NOT RUN.

## UAT-010 Khóa server

Liên kết BR-02 → FR-010 → AC-010 → M04-T02 → S13.

Thiết lập: T−1ms T T+1ms.

Bước1: mở màn S13 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Tại now bằng hạn hoặc sau hạn API từ chối batch; đồng hồ client/job chậm không thay đổi kết quả.

Evidence: IT transaction và UI readonly. Kết quả: NOT RUN.

## UAT-011 Phân công

Liên kết BR-03 → FR-011 → AC-011 → M03-T02 → S09.

Thiết lập: user trùng/inactive/không quản lý.

Bước1: mở màn S09 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Đúng một quản lý, nhiều người nhập không trùng, bỏ user inactive khi gán mới; publish thiếu người bị chặn.

Evidence: validation + DB unique. Kết quả: NOT RUN.

## UAT-012 Combo theo quyền

Liên kết BR-03 → FR-012 → AC-012 → M02-T02 → S11.

Thiết lập: ba identity và giả report id.

Bước1: mở màn S11 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Chế độ nhập chỉ báo cáo được giao; quản lý chỉ báo cáo quản lý; truy cập trực tiếp ngoài phạm vi bị từ chối.

Evidence: API list/detail không lộ dữ liệu. Kết quả: NOT RUN.

## UAT-013 Mặc định tổng hợp

Liên kết BR-04 → FR-013 → AC-013 → M05-T02 → S15.

Thiết lập: 3 người gồm nháp và hoàn thành.

Bước1: mở màn S15 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Quản lý chọn báo cáo/kỳ mở tổng hợp all_saved, badge tạm tính và X/Y hoàn thành.

Evidence: số tổng và contributor khớp. Kết quả: NOT RUN.

## UAT-014 Xem cá nhân chỉ đọc

Liên kết BR-04 → FR-014 → AC-014 → M05-T02 → S16.

Thiết lập: quản lý thử PATCH dữ liệu người khác.

Bước1: mở màn S16 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Quản lý chọn người thấy dữ liệu cùng kỳ, không có write; API sửa hộ bị chặn.

Evidence: 403 và không đổi revision. Kết quả: NOT RUN.

## UAT-015 Mở lại từng người

Liên kết BR-05 → FR-015 → AC-015 → M04-T03 → S17.

Thiết lập: grant A nhưng thử ghi B.

Bước1: mở màn S17 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Grant chỉ đúng assignment/kỳ, lý do bắt buộc, manager hợp lệ; không mở các người hoặc kỳ khác.

Evidence: policy đúng phạm vi. Kết quả: NOT RUN.

## UAT-016 Mặc định ba giờ

Liên kết BR-05 → FR-016 → AC-016 → M04-T03 → S17.

Thiết lập: clock cố định 23:30.

Bước1: mở màn S17 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Default bằng server_now+3h, 23:30 chuyển 02:30 hôm sau; cấm thời điểm quá khứ.

Evidence: datetime dialog và API đúng. Kết quả: NOT RUN.

## UAT-017 Grant hết hạn và thu hồi

Liên kết BR-05 → FR-017 → AC-017 → M04-T03 → S14.

Thiết lập: expiry/revoke/before original due.

Bước1: mở màn S14 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: API từ chối sau expires_at hoặc revoke nếu quá hạn gốc; trước hạn gốc vẫn áp dụng quyền gốc.

Evidence: quyền ghi đúng tại boundary. Kết quả: NOT RUN.

## UAT-018 NUM

Liên kết BR-06 → FR-018 → AC-018 → M04-T01 → S12.

Thiết lập: âm thập phân overflow và format integer.

Bước1: mở màn S12 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Editor và API từ chối chữ/NaN/infinity, giữ decimal, validate scale/min/max; không âm thầm làm tròn.

Evidence: raw decimal không sai lệch. Kết quả: NOT RUN.

## UAT-019 DATE TIME

Liên kết BR-06 → FR-019 → AC-019 → M04-T01 → S12.

Thiết lập: date leap year và time range.

Bước1: mở màn S12 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Có picker, từ chối 31/02 số bất kỳ 25:80; date-only không đổi ngày vì timezone.

Evidence: client/server cùng kết quả. Kết quả: NOT RUN.

## UAT-020 TEXT và an toàn hiển thị

Liên kết BR-06 → FR-020 → AC-020 → M04-T01 → S11.

Thiết lập: text Unicode HTML và =1+1.

Bước1: mở màn S11 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Giữ Unicode và số 0 đầu, escape HTML, TEXT bắt đầu = không thực thi công thức.

Evidence: UI/export đúng kiểu string. Kết quả: NOT RUN.

## UAT-021 Paste

Liên kết BR-06 → FR-021 → AC-021 → M04-T01 → S12.

Thiết lập: paste qua merge/locked/date sai.

Bước1: mở màn S12 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Paste TSV giữ vị trí; block có ô khóa/invalid từ chối nguyên khối với lỗi đúng ô.

Evidence: không có partial write. Kết quả: NOT RUN.

## UAT-022 Autosave và mất mạng

Liên kết BR-07 → FR-022 → AC-022 → M04-T02 → S26.

Thiết lập: timeout trước/sau commit.

Bước1: mở màn S26 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Debounce 2s, trạng thái lưu rõ; retry idempotent; mất mạng không báo đã lưu.

Evidence: một revision, không trùng. Kết quả: NOT RUN.

## UAT-023 Hoàn thành

Liên kết BR-07 → FR-023 → AC-023 → M04-T02 → S11.

Thiết lập: complete thiếu/đủ và edit tiếp.

Bước1: mở màn S11 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Chỉ hoàn thành khi required hợp lệ; sửa revision đã hoàn thành chuyển đang nhập; không khóa sớm ngoài hạn.

Evidence: state transition đúng. Kết quả: NOT RUN.

## UAT-024 Đồng thời

Liên kết BR-07 → FR-024 → AC-024 → M04-T02 → S26.

Thiết lập: hai tab cùng revision.

Bước1: mở màn S26 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Revision cũ trả 409; giữ buffer và cho so sánh, không overwrite người dùng âm thầm.

Evidence: một commit một conflict. Kết quả: NOT RUN.

## UAT-025 SUM AVG và null

Liên kết BR-04 → FR-025 → AC-025 → M05-T01 → S18.

Thiết lập: fixture 3 assignment nhiều revision.

Bước1: mở màn S18 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: 10,0,null cho SUM10 AVG5 COUNT2; empty SUM là null COUNT0; mỗi assignment góp một revision.

Evidence: expected independent pass. Kết quả: NOT RUN.

## UAT-026 NONE và kiểu tổng hợp

Liên kết BR-04 → FR-026 → AC-026 → M05-T01 → S15.

Thiết lập: mixed types.

Bước1: mở màn S15 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: TEXT DATE TIME mặc định NONE, bản tổng hiện không tổng hợp; cấu hình SUM text bị chặn.

Evidence: không tự chọn giá trị người cuối. Kết quả: NOT RUN.

## UAT-027 Công thức hai tầng

Liên kết BR-04 → FR-027 → AC-027 → M05-T01 → S18.

Thiết lập: tỷ lệ khác nhau + cycle + div0.

Bước1: mở màn S18 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Tính cá nhân rồi tổng input rồi công thức tổng; tỷ lệ chung từ tử/mẫu tổng; cấm vòng lặp và external ref.

Evidence: kết quả đúng hoặc lỗi rõ. Kết quả: NOT RUN.

## UAT-028 Theo dõi mọi lượt giao

Liên kết BR-08 → FR-028 → AC-028 → M06-T01 → S19.

Thiết lập: 3 reports cùng user và user inactive.

Bước1: mở màn S19 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: C lấy assignment làm mẫu số, gồm người chưa nhập, loại miễn có lý do; người có 3 báo cáo là 3 lượt.

Evidence: mẫu số khớp phân công. Kết quả: NOT RUN.

## UAT-029 Bộ lọc kỳ

Liên kết BR-08 → FR-029 → AC-029 → M06-T02 → S19.

Thiết lập: filter kết hợp và back từ B.

Bước1: mở màn S19 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Chọn report/kỳ/đơn vị/người/status, UI và export dùng cùng filter; mixed period hiện khoảng ngày thật.

Evidence: filter và kết quả giữ đúng. Kết quả: NOT RUN.

## UAT-030 Trạng thái và KPI

Liên kết BR-08 → FR-030 → AC-030 → M06-T01 → S19.

Thiết lập: reopen completed và 0 obligations.

Bước1: mở màn S19 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Progress, quyền nhập, đúng hạn độc lập; mở lại không xóa trễ; mẫu số0 hiện —.

Evidence: KPI không cộng trùng. Kết quả: NOT RUN.

## UAT-031 Drilldown và ma trận

Liên kết BR-08 → FR-031 → AC-031 → M06-T02 → S20.

Thiết lập: cặp có/không assignment.

Bước1: mở màn S20 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Click status mở đúng B report/kỳ/người; không giao khác chưa nhập; ma trận giới hạn số cột.

Evidence: đúng route và trạng thái. Kết quả: NOT RUN.

## UAT-032 Phiên bản mẫu

Liên kết BR-09 → FR-032 → AC-032 → M03-T02 → S22.

Thiết lập: v1 đã nhập rồi publish v2.

Bước1: mở màn S22 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Publish mẫu mới không đổi kỳ cũ; không thay layout kỳ có dữ liệu; ngừng phát sinh không xóa dữ liệu.

Evidence: kỳ cũ vẫn render v1. Kết quả: NOT RUN.

## UAT-033 Lịch sử và audit

Liên kết BR-09 → FR-033 → AC-033 → M04-T03 → S21.

Thiết lập: thực hiện chuỗi nghiệp vụ.

Bước1: mở màn S21 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Save/complete/grant/revoke/publish/phân công lưu actor thời điểm lý do và revision; không sửa audit từ UI.

Evidence: audit đủ và đúng thứ tự. Kết quả: NOT RUN.

## UAT-034 Xuất Excel

Liên kết BR-09 → FR-034 → AC-034 → M06-T03 → S25.

Thiết lập: export khi có concurrent save.

Bước1: mở màn S25 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Export giữ layout/format/typed values và snapshot source; quyền download kiểm tra lại.

Evidence: file không trộn revision. Kết quả: NOT RUN.

## UAT-035 Hai vai trò

Liên kết BR-10 → FR-035 → AC-035 → M02-T02 → S16.

Thiết lập: dual role.

Bước1: mở màn S16 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: User vừa quản lý vừa nhập có mode rõ; quản lý readonly, nhập chỉ own assignment.

Evidence: không có write hộ. Kết quả: NOT RUN.

## UAT-036 Trạng thái UI

Liên kết BR-10 → FR-036 → AC-036 → M07-T01 → S23.

Thiết lập: fault injection UI.

Bước1: mở màn S23 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Mỗi màn có loading empty error forbidden; lock/mạng/conflict không che mất thông báo lưu.

Evidence: ảnh và E2E state pass. Kết quả: NOT RUN.

## UAT-037 Keyboard và responsive

Liên kết BR-10 → FR-037 → AC-037 → M07-T02 → S24.

Thiết lập: keyboard và viewport.

Bước1: mở màn S24 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Tab chỉ đi qua input, focus/error đọc được, 1366/1024/768 không che nút hoặc mất ô.

Evidence: biên bản usability. Kết quả: NOT RUN.

## UAT-038 Hiệu năng

Liên kết BR-10 → FR-038 → AC-038 → M07-T02 → S11.

Thiết lập: benchmark sau chốt fixture.

Bước1: mở màn S11 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Fixture 5000 input/200 người, 50 concurrent; p95 form3s save1s aggregate3s trên cấu hình đã ghi.

Evidence: báo cáo p95 và không mất dữ liệu. Kết quả: NOT RUN.

## UAT-039 Upload không an toàn

Liên kết BR-10 → FR-039 → AC-039 → M03-T01 → S04.

Thiết lập: fixture độc hại giả lập.

Bước1: mở màn S04 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Reject macro/encrypted/external link/zip bomb, parser không gọi URL ngoài và có resource limit.

Evidence: lỗi an toàn và log không secret. Kết quả: NOT RUN.

## UAT-040 Job và timezone

Liên kết BR-02 → FR-040 → AC-040 → M02-T03 → S05.

Thiết lập: retry job và gap clock.

Bước1: mở màn S05 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Sinh kỳ idempotent, phục hồi downtime không trùng, UTC storage hiển thị UTC+7 nhất quán.

Evidence: unique period và hạn đúng. Kết quả: NOT RUN.

## UAT-041 Thay phân công

Liên kết BR-09 → FR-041 → AC-041 → M03-T02 → S22.

Thiết lập: remove/add inactive/miễn.

Bước1: mở màn S22 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Mặc định từ kỳ kế tiếp; kỳ hiện tại thao tác riêng có lý do và lịch sử mẫu số, không xóa submission.

Evidence: lịch sử giữ và số denominator đúng. Kết quả: NOT RUN.

## UAT-042 Triển khai an toàn

Liên kết BR-10 → FR-042 → AC-042 → M08-T02 → S23.

Thiết lập: staging deploy rồi rollback.

Bước1: mở màn S23 với actor phù hợp chức năng. Bước2: thực hiện lần lượt các trường hợp đầu vào và điều kiện biên đã nêu. Bước3: đối chiếu UI, response API và revision/audit; tải lại trang để kiểm tra trạng thái lưu.

Expected: Feature flag pilot, migration additive, restore/rollback đã thử; báo cáo cũ không hồi quy.

Evidence: runbook và biên bản restore. Kết quả: NOT RUN.

## Các gate kiểm tra bổ sung

UAT-901: biên bản D01 đến D10, repository baseline và role matrix được chốt; thiếu mục nào không cho qua M01.

IT-902: chạy parse render và tính công thức trên ba mẫu thật; đối soát toàn bộ ô input và license engine, ghi thời gian và giới hạn.

UAT-903: người thiết lập người nhập và quản lý walkthrough toàn bộ Screen ID; ký xác nhận luồng, không nhầm quyền và trạng thái.

IT-904: migration staging, foreign keys unique constraints revision concurrency và rollback tương thích; không mất dữ liệu cũ.

UAT-905: toàn bộ UAT-001 đến UAT-042 pass, không P0 P1, owner nghiệp vụ chấp thuận.
