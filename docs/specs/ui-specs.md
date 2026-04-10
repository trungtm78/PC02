# UI Specifications — Government Theme (Navy/Gold)
Path: docs/specs/ui-specs.md | Version: v1.1.0 | TASK_ID: TASK-2026-000001

## 1. Screen Inventory
- Sidebar (src/components/AppSidebar.tsx)
- Case List (src/pages/cases/CaseListPage.tsx)
- Case Form (src/pages/cases/CaseFormPage/index.tsx)
- Case Detail (src/pages/cases/CaseDetailPage.tsx) [NEW]

## 2. Global Styles (Government Theme)
Tuân thủ chuẩn premium, woa aesthetics:
- **Primary**: #003973 (Xanh Cong An) - Dung cho Header, Buttons chính.
- **Secondary**: #DC2626 (Đo) - Dung cho Alerts, Overdue.
- **Accent**: #F59E0B (Vang sao) - Dung cho Hover, Icons quan trọng.
- **Background**: #F8FAFC (Slate-50)

## 3. Screen Definitions

### 3.1 AppSidebar
- Section "NGHIEP VU CHINH" (All caps, no accents).
- Menu "Quan ly vu an" -> Sub-menus:
  - "Danh sach vu an"
  - "Them moi ho so"
  - "Danh sach tong hop"
  - "Vu an/viec ban dau"

### 3.3 Case Management List
- **Features**: 
  - Bang du lieu: Ma ho so, Tieu đe, Loai ho so, Ngay tiep nhan, Trang thai (Badge), Nguoi xu ly.
  - Thao tac: Xem chi tiet (Eye), Chinh sua (Edit).

### 3.4 Case Management Form (Add/Edit)
- **Structure**: 10 Tabs ngang (khong dau): Thong tin, Vu viec, Vu an, DTBS, Vu viec TDC, Vu an TDC, Vat chung, HS nghiep vu, TK 48 truong, Ghi am ghi hinh.
- **Edit Mode**: Ma ho so bi lock (readonly). Tai du lieu cu vao form.

### 3.5 Case Detail View [NEW]
- **Route**: `/cases/:id`
- **UI**: Giao dien 10 tabs tuong tu Form nhung tat ca cac field đeu ow che đo readonly (View Mode). Premium layout voi cac thong tin quan trong đuoc highlight.

## 4. Field Definitions (Table 2.2.A)
| Field | Required | Type | Format |
|-------|----------|------|--------|
| Ma ho so | YES | String | HS-YYYY-NNN |
| Tieu đe | YES | String | Khong dau |

## 5. Form Submission (Table 2.2.E)
- **Action**: Click "Luu ho so" hoac "Cap nhat".
- **Validation**: Check required fields in Tab 1.
- **On Success**: Navigate ve `/cases` voi toast xanh.
