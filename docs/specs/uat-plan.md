# UAT Plan - Case Management

**Path**: docs/specs/uat-plan.md | **Version**: v1.1.0 | **TASK_ID**: TASK-2026-000001

## 1. Scope
Kiem thu toan bo cac tinh nang dieu huong, hien thi va xu ly cua module Quan ly vu an (khong dau).

## 2. Test Scenarios
| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| UAT-1 | Kiem tra hien thi menu | 1. Dang nhap<br>2. Mo Sidebar | Thay menu "Quan ly vu an" trong "NGHIEP VU CHINH" (khong dau). |
| UAT-2 | Xem danh sach vu an | 1. Click "Danh sach vu an" | Chuyen sang /cases, hien thi bang voi columns khong dau. |
| UAT-3 | Them moi ho so | 1. Nhap field Tab 1<br>2. Nhan "Luu ho so" | Toast thanh cong, ve trang danh sach. |
| UAT-4 | Xem chi tiet ho so | 1. Click icon Eye tai danh sach | Chuyen sang /cases/:id, hien thi data readonly. |
| UAT-5 | Chinh sua ho so | 1. Click icon Edit<br>2. Sua Tieu đe<br>3. Luu | Data duoc cap nhat (mock). |
| UAT-6 | Kiem tra 10 tabs khong dau | Duyet qua 10 tabs | Tat ca label tabs va fields deu khong dau. |
| UAT-7 | Kiem tra man hinh Xuat bao cao | 1. Click menu Báo cáo & Thống kê -> Xuất báo cáo | Chuyen sang /export-reports, hien thi bang data mock co filter va icon Excel/Word |
| UAT-8 | Kiem tra bieu do Thong ke quan/huyen | 1. Click menu Thống kê -> Thống kê | Chuyen sang /statistics/district, hien thi 2 chart (Recharts) |
| UAT-9 | Kiem tra man hinh Ho so tre han | 1. Click menu Hồ sơ trễ hạn | Chuyen sang /settings/overdue-records, hien thi bang du lieu co badge uu tien |
| UAT-10| Kiem tra Nhat ky nghiep vu | 1. Click menu Nhật ký nghiệp vụ | Chuyen sang /activity-log, hien thi ds log, co the filter = text hoac drop-down |

## 3. Data Requirement
- Mock data (Case list, Case detail, Reports mock data).

## 4. Environment
- Local development.
