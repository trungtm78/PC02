# ANTIGRAVITY_RUNNER_PROMPT

**TASK_ID**: TASK-2026-260226 | **INTAKE_ID**: INTAKE-20260226-01-A9B8
**TARGET**: Opencode (AI Developer)
**GOAL**: Refactor ObjectListPage for dynamic summary & Implement Victim features.

---

## A. IDENTITY & ROLE
Bạn là **Opencode**, một Chuyên gia Phát triển Phần mềm AI. Nhiệm vụ của bạn là thực hiện các thay đổi mã nguồn dựa trên bản phân tích (ANALYSIS_PACKAGE) và tuân thủ tuyệt đối các quy trình kiểm soát chất lượng (QA Gate).

---

## B. GOVERNANCE CONTROL (SPECIFICATIONS)
Toàn bộ thay đổi PHẢI tuân thủ các tài liệu đặc tả sau (đã được cập nhật):
- **FRD**: [docs/specs/FRD.md](file:///c:/PC02/pc02-case-management/docs/specs/FRD.md) (Xem FR-14, FR-15)
- **UI_Specs**: [docs/specs/UI_Specs.md](file:///c:/PC02/pc02-case-management/docs/specs/UI_Specs.md) (Xem Section 8)
- **User Manual**: [docs/user-manual/CaseManagement-manual.md](file:///c:/PC02/pc02-case-management/docs/user-manual/CaseManagement-manual.md)

---

## C. MANDATORY QUALITY GATE (OPENCODE_QA_GATE.md)
Bạn PHẢI thực hiện đúng và đủ các bước từ 0 đến 8 theo bộ quy chuẩn tại [OPENCODE_QA_GATE.md](file:///c:/PC02/Promt_lib/OPENCODE_QA_GATE.md). 
**Lưu ý quan trọng**: 
- Phải có E2E/UAT test bằng Playwright.
- Phải chụp screenshot và tạo SCREENSHOT_MANIFEST.
- Tuyệt đối không dùng "manual verification" làm bằng chứng.

---

## D. ANALYSIS_PACKAGE (CONTEXT)
### 1. Hiện trạng:
- `ObjectListPage.tsx` đang dùng một bộ `stats` cố định cho cả Bị can, Bị hại và Nhân chứng.
- Màn hình Bị hại thiếu nút "Thêm bị hại" (label đang là chung chung hoặc chưa đúng chuẩn).
- Màn hình Luật sư (`LawyerListPage.tsx`) cần đối soát lại các trường thông tin với mẫu tham chiếu.

### 2. File tham chiếu (Refs):
Hãy tham khảo logic và UI trong các file sau để implement chính xác:
- [SuspectsList.tsx](file:///c:/PC02/Refs/src/app/pages/SuspectsList.tsx)
- [VictimsList.tsx](file:///c:/PC02/Refs/src/app/pages/VictimsList.tsx)
- [WitnessesList.tsx](file:///c:/PC02/Refs/src/app/pages/WitnessesList.tsx)
- [LawyerList.tsx](file:///c:/PC02/Refs/src/app/pages/LawyerList.tsx)

---

## E. IMPLEMENTATION SPECIFICATIONS
### 1. Refactor `ObjectListPage.tsx`
- Tạo hàm `renderStats()` nhận `subjectType` (SUSPECT, VICTIM, WITNESS).
- Định nghĩa 4 block thống kê cho mỗi loại theo [UI_Specs Section 8](file:///c:/PC02/pc02-case-management/docs/specs/UI_Specs.md#L45).
- **Logic dữ liệu**: Nếu backend chưa trả về count cho từng loại status, hãy dùng `useMemo` để tính toán từ `data` trả về của trang hiện tại (client-side aggregation) để đảm bảo UI hiển thị số liệu.

### 2. Cải thiện `VictimsListPage.tsx`
- Đổi nhãn nút tạo mới thành "Thêm bị hại".
- Đảm bảo icon tương ứng với loại đối tượng bị hại.

### 3. Cập nhật `LawyerListPage.tsx`
- Bổ sung trường `barNumber` (Số thẻ luật sư), `lawFirm` (Văn phòng luật) vào danh sách và form.
- Đảm bảo form thêm mới luật sư hiển thị đúng các trường nghiệp vụ.

---

## F. E2E/UAT TEST SPEC (MANDATORY)
Bạn phải implement và chạy các scenarios sau bằng **Playwright**:

| Scenario ID | Description | Expected Result |
|-------------|-------------|-----------------|
| UAT-OBJ-01 | Kiểm tra Thống kê Bị can | Hiển thị 4 block: Tổng số, Đang tạm giam, Truy nã, Đang điều tra. |
| UAT-OBJ-02 | Kiểm tra Thống kê Bị hại | Hiển thị 4 block: Tổng số, Đã bồi thường, Đang xử lý, Tổng thiệt hại. |
| UAT-OBJ-03 | Kiểm tra Thống kê Nhân chứng | Hiển thị 4 block: Tổng số, Đã khai báo, Chờ khai báo, Từ chối. |
| UAT-OBJ-04 | Kiểm tra Tạo mới Bị hại | Nhấn nút "Thêm bị hại", form hiện ra, nhập liệu và lưu thành công. |

---

## G. EXECUTION_RETURN_PACKAGE
Nộp bài bằng file `EXECUTION_RETURN_PACKAGE_TASK-2026-260226.md` bao gồm:
1. `TOOL_READINESS_REPORT`
2. `E2E_PRE_COMMITMENT_RECORD`
3. `UI_ELEMENT_SCAN_RECORD`
4. `CODING_STATUS`
5. `UT_STATUS` & `IT_STATUS`
6. `CODE_REVIEW_STATUS`
7. `REFACTORING_STATUS`
8. `SCREENSHOT_MANIFEST` (Kèm link ảnh và mô tả)
9. `UAT_STATUS` (Kèm Playwright report)
