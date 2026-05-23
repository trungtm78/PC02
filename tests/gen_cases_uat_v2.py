#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gen JSON cho UAT Cases v2 - 320+ TC enterprise standard.
Module Cases: cases.controller.ts + cases.service.ts (~1335 LOC).
"""
import json
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'uat', 'uat_quan_ly_vu_viec.json')

tcs = []
counter = [0]


def add(type_, pri, mod, title, **kw):
    counter[0] += 1
    tc = {
        "tc_id": f"TC-{counter[0]:03d}",
        "type": type_,
        "priority": pri,
        "module": mod,
        "title": title,
        "requirement": kw.get("requirement", f"REQ-CASE-{mod.upper().replace(' ', '_')}-{counter[0]:03d}"),
        "technique": kw.get("technique", "Use case testing"),
        "risk_level": kw.get("risk_level", "Cao" if pri == "P0" else ("TB" if pri == "P1" else "Thấp")),
        "preconditions": kw.get("pre", "1. User đã login\n2. Token JWT hợp lệ"),
        "steps": kw.get("steps", ""),
        "test_data": kw.get("data", ""),
        "expected_ui": kw.get("ui", ""),
        "expected_api": kw.get("api", ""),
        "expected_side": kw.get("side", ""),
        "severity_if_fail": kw.get("sev", "High"),
        "notes": kw.get("notes", ""),
    }
    tcs.append(tc)


# ============================================================
# MODULE 1: CREATE — GREEN happy paths (16 TC)
# ============================================================
add("GREEN", "P0", "Create", "Tạo Case DIRECT_DISCOVERY thành công với input đầy đủ",
    pre="1. Login dieuTra1@pc02.local (role INVESTIGATOR)\n2. User thuộc Team-Q1\n3. JWT valid",
    steps="1. Navigate /cases/new\n2. Nhập name = 'Vụ trộm cắp xe máy tại Q1 ngày 12/05/2026'\n3. Chọn caseProvenance = DIRECT_DISCOVERY\n4. Nhập crime = 'Trộm cắp tài sản — Đ.173 BLHS'\n5. Chọn capDoToiPham = NGHIEM_TRONG\n6. Nhập subjectsCount = 2\n7. Nhập ngayKhoiTo = '2026-05-12'\n8. Click 'Lưu'",
    data="name='Vụ trộm cắp xe máy tại Q1 ngày 12/05/2026', caseProvenance='DIRECT_DISCOVERY', crime='Trộm cắp tài sản — Đ.173 BLHS', capDoToiPham='NGHIEM_TRONG', subjectsCount=2, ngayKhoiTo='2026-05-12'",
    ui="1. Toast 'Tạo vụ án thành công'\n2. Redirect /cases/<id>\n3. Trang detail hiển thị đủ field\n4. Badge status = 'Tiếp nhận'",
    api="1. POST /api/v1/cases trả 201\n2. Body: success=true, data.id, data.status='TIEP_NHAN', data.caseProvenance='DIRECT_DISCOVERY', data.createdById=<userId>\n3. data.assignedTeamId auto-set từ dataScope",
    side="1. Row trong table cases, deletedAt=NULL\n2. Audit log CASE_CREATED có ipAddress, userAgent\n3. assignedTeamId auto từ ward officer scope (v0.33)",
    sev="Critical")

add("GREEN", "P0", "Create", "Tạo Case FROM_PETITION link Petition đang status TIEP_NHAN + expectedPetitionUpdatedAt khớp",
    pre="1. Login INVESTIGATOR\n2. Có Petition PET-001 status=TIEP_NHAN, updatedAt='2026-05-20T10:00:00.000Z', linkedCaseId=NULL",
    steps="1. Vào /petitions/PET-001\n2. Click 'Khởi tố vụ án'\n3. Form mở với caseProvenance=FROM_PETITION, linkedPetitionId=PET-001 pre-filled\n4. Nhập name = 'Vụ án từ đơn thư PET-001'\n5. Submit",
    data="linkedPetitionId='PET-001', expectedPetitionUpdatedAt='2026-05-20T10:00:00.000Z', caseProvenance='FROM_PETITION'",
    ui="1. Toast 'Tạo vụ án thành công'\n2. Redirect /cases/<newId>\n3. Tab 'Nguồn tin' hiển thị link sang Petition PET-001",
    api="1. POST /cases trả 201\n2. data.linkedPetitionId='PET-001'\n3. Atomic update Petition.status=DA_CHUYEN_VU_AN",
    side="1. cases row có linkedPetitionId\n2. petitions PET-001: linkedCaseId=newId, status=DA_CHUYEN_VU_AN\n3. Audit CASE_CREATED metadata.linkedPetitionId='PET-001'",
    sev="Critical")

add("GREEN", "P0", "Create", "Tạo Case FROM_INCIDENT link Incident chưa khởi tố + expectedIncidentUpdatedAt khớp",
    pre="1. Login INVESTIGATOR\n2. Có Incident INC-001 deletedAt=NULL, linkedCaseId=NULL, updatedAt='2026-05-20T11:00:00.000Z'",
    steps="1. Vào /incidents/INC-001\n2. Click 'Khởi tố vụ án'\n3. Form pre-fill caseProvenance=FROM_INCIDENT, linkedIncidentId=INC-001\n4. Nhập name='Vụ án khởi tố từ INC-001'\n5. Submit",
    data="linkedIncidentId='INC-001', expectedIncidentUpdatedAt='2026-05-20T11:00:00.000Z', caseProvenance='FROM_INCIDENT'",
    ui="1. Toast success\n2. Redirect /cases/<newId>\n3. Detail page có badge 'Khởi tố từ vụ việc INC-001'",
    api="1. POST /cases trả 201\n2. data.linkedIncidentId='INC-001'\n3. Incident INC-001 update linkedCaseId=newId",
    side="1. cases.linkedIncidentId, incidents.linkedCaseId updated atomic\n2. Audit CASE_CREATED metadata.linkedIncidentId",
    sev="Critical")

add("GREEN", "P0", "Create", "Tạo Case TRANSFERRED với sourceDocumentNote",
    pre="1. Login INVESTIGATOR",
    steps="1. Mở form tạo vụ án\n2. Chọn caseProvenance=TRANSFERRED\n3. Nhập sourceDocumentNote='Công văn chuyển từ Cơ quan ANĐT Thành phố số 1234/CV ngày 10/05/2026'\n4. Nhập name + submit",
    data="caseProvenance='TRANSFERRED', sourceDocumentNote='Công văn chuyển từ Cơ quan ANĐT Thành phố số 1234/CV ngày 10/05/2026', name='Vụ chuyển CQĐT khác'",
    ui="Toast 'Tạo vụ án thành công', detail hiện sourceDocumentNote",
    api="POST /cases 201, data.caseProvenance='TRANSFERRED', data.sourceDocumentNote set",
    side="cases row có sourceDocumentNote saved", sev="High")

add("GREEN", "P0", "Create", "Tạo Case OTHER_LEGAL_SOURCE",
    steps="1. Form tạo\n2. Chọn provenance=OTHER_LEGAL_SOURCE\n3. Nhập name='Vụ phát hiện qua tin báo nặc danh', sourceDocumentNote='Tin báo Hotline 113'\n4. Submit",
    data="caseProvenance='OTHER_LEGAL_SOURCE', name='Vụ phát hiện qua tin báo nặc danh', sourceDocumentNote='Tin báo Hotline 113'",
    ui="Toast success", api="201 with caseProvenance=OTHER_LEGAL_SOURCE", side="Row saved", sev="High")

add("GREEN", "P0", "Create", "Tạo Case với capDoToiPham=DAC_BIET_NGHIEM_TRONG để KPI-4 tính",
    steps="1. Tạo Case mới\n2. Chọn capDoToiPham=DAC_BIET_NGHIEM_TRONG\n3. crime='Giết người — Đ.123 BLHS'\n4. Submit",
    data="capDoToiPham='DAC_BIET_NGHIEM_TRONG', crime='Giết người — Đ.123 BLHS'",
    ui="Detail hiện badge mức độ 'Đặc biệt nghiêm trọng' màu đỏ",
    api="data.capDoToiPham='DAC_BIET_NGHIEM_TRONG'",
    side="KPI-4 dashboard cập nhật count án ĐBNT +1", sev="High")

add("GREEN", "P0", "Create", "Auto-deadline tính theo SystemSetting THOI_HAN_GIAI_QUYET",
    pre="SystemSetting THOI_HAN_GIAI_QUYET = 120 (ngày)",
    steps="1. Tạo Case mới ngày 2026-05-23\n2. KHÔNG nhập deadline\n3. Submit",
    data="name='Test auto deadline', caseProvenance='DIRECT_DISCOVERY'",
    ui="Detail hiển thị deadline = 2026-09-20 (120 ngày sau)",
    api="data.deadline = createdAt + 120 days (UTC)",
    side="Deadline auto-set từ SystemSetting, không phải từ user input", sev="High")

add("GREEN", "P0", "Create", "Tạo Case manual deadline override auto-deadline",
    steps="1. Form tạo\n2. Nhập deadline='2026-08-15' (60 ngày sau)\n3. Submit",
    data="deadline='2026-08-15'", ui="Detail show deadline=15/08/2026", api="data.deadline=2026-08-15T00:00:00.000Z",
    side="cases.deadline = user input (không bị auto-calc override)", sev="High")

add("GREEN", "P0", "Create", "Tạo Case với metadata custom (người báo tin)",
    steps="1. Tạo Case\n2. Nhập metadata.nguoiBaoTin='Nguyễn Văn A', metadata.diaChi='12 Lê Lợi Q1'\n3. Submit",
    data="metadata={nguoiBaoTin:'Nguyễn Văn A', diaChi:'12 Lê Lợi Q1', soDienThoai:'0901234567'}",
    ui="Detail tab 'Thông tin báo tin' show nguoiBaoTin, diaChi", api="data.metadata.nguoiBaoTin='Nguyễn Văn A'",
    side="JSONB metadata saved", sev="High")

add("GREEN", "P0", "Create", "Ward officer auto-set assignedTeamId theo wardTeamId (silent override)",
    pre="Login wardOfficer1@pc02.local thuộc Team-WARD-01",
    steps="1. Form tạo\n2. CỐ NHẬP assignedTeamId='Team-DIFFERENT-99' (team khác)\n3. Submit",
    data="dto.assignedTeamId='Team-DIFFERENT-99'",
    ui="Toast success (KHÔNG báo lỗi)", api="POST 201, data.assignedTeamId='Team-WARD-01' (auto override)",
    side="Server silent override theo dataScope.wardTeamId — UX safer per D-eng-fix M3", sev="High")

add("GREEN", "P1", "Create", "Tạo Case bỏ trống các field optional",
    steps="1. Form tạo\n2. CHỈ nhập name + caseProvenance\n3. Submit",
    data="name='Vụ tối thiểu', caseProvenance='DIRECT_DISCOVERY'",
    ui="Toast success, detail hiện các field optional là '-'",
    api="201, crime=NULL, investigatorId=NULL, capDoToiPham=NULL, subjectsCount=0 (default)",
    side="DB row với null optional fields", sev="Medium")

add("GREEN", "P1", "Create", "Tạo Case với investigatorId là user khác đang active",
    pre="Có user dieuTra2@pc02.local đang active",
    steps="1. Tạo Case\n2. Chọn investigator='Nguyễn ĐTV2' từ FK dropdown\n3. Submit",
    data="investigatorId='<dieuTra2.id>'",
    ui="Detail show investigator name = 'Nguyễn ĐTV2'", api="data.investigatorId=<dieuTra2.id>",
    side="cases.investigatorId set", sev="Medium")

add("GREEN", "P1", "Create", "Tạo Case với ngayKhoiTo lùi vài ngày trước hôm nay (đã khởi tố trước khi vào hệ thống)",
    steps="1. Tạo Case\n2. ngayKhoiTo='2026-05-15' (8 ngày trước)\n3. Submit",
    data="ngayKhoiTo='2026-05-15'", ui="Detail show ngày khởi tố 15/05/2026",
    api="data.ngayKhoiTo='2026-05-15T00:00:00.000Z'", side="Saved without 'future date' validation",
    sev="Medium")

add("GREEN", "P1", "Create", "Dispatcher tạo Case có thể chọn assignedTeamId bất kỳ",
    pre="Login dispatcher@pc02.local (canDispatch=true)",
    steps="1. Tạo Case\n2. assignedTeamId='Team-OTHER-WARD-05' (team khác phường)\n3. Submit",
    data="assignedTeamId='Team-OTHER-WARD-05'",
    ui="Toast success, detail show team đã chọn", api="data.assignedTeamId='Team-OTHER-WARD-05' (KHÔNG bị override)",
    side="Dispatcher bypass ward auto-override", sev="High")

add("GREEN", "P1", "Create", "Tạo Case ADMIN với toàn bộ field bao gồm field hiếm dùng",
    pre="Login admin@pc02.local",
    steps="Tạo Case với laCongNgheCao=false, soLanGiaHan=0, daRaSoat=false (default), submit",
    data="laCongNgheCao=false, soLanGiaHan=0", ui="Detail hiển thị 'Không phải án CNC'",
    api="201, các field default applied", side="Default values saved", sev="Medium")

add("GREEN", "P1", "Create", "POST trả response message tiếng Việt 'Tạo vụ án thành công'",
    steps="1. POST /cases với DTO hợp lệ",
    data="dto đầy đủ", ui="-", api="Response: {success:true, data:{...}, message:'Tạo vụ án thành công'}",
    side="-", sev="Low",
    notes="Verify response shape khớp với contract message field")


# ============================================================
# MODULE 1B: CREATE — RED (validation field-level) (50 TC)
# ============================================================

# name field (text) — multiplier ≥14
add("RED", "P0", "Create-name", "Thiếu trường name (required) trả 400",
    steps="1. POST /cases với dto thiếu key name", data="{caseProvenance:'DIRECT_DISCOVERY'}",
    ui="Form: hiện inline error 'Tên vụ án bắt buộc'", api="400 BadRequest, error message includes 'name'",
    side="Không tạo row", sev="Critical")

add("RED", "P0", "Create-name", "name là chuỗi rỗng '' trả 400 'Tên vụ án bắt buộc'",
    steps="POST /cases với name=''", data="name=''",
    ui="Error 'Tên vụ án bắt buộc'", api="400 message ='Tên vụ án bắt buộc' (sau Transform trim)",
    side="-", sev="Critical")

add("RED", "P0", "Create-name", "name chỉ whitespace '   ' bị trim thành '' → 400",
    steps="POST với name='     '", data="name='     ' (5 spaces)",
    ui="Error 'Tên vụ án bắt buộc'", api="400 (Transform trim chạy trước IsNotEmpty)",
    side="-", sev="Critical", notes="UAT 2026-05-23 BUG-001 đã fix")

add("RED", "P0", "Create-name", "name là null → 400",
    steps="POST với name=null", data="name=null", ui="Error", api="400", side="-", sev="Critical")

add("RED", "P0", "Create-name", "name là số 12345 không phải string → 400 IsString",
    steps="POST name=12345 (number)", data="name=12345", ui="-", api="400 IsString failed", side="-", sev="High")

add("RED", "P0", "Create-name", "name vượt 500 ký tự (501 chars) → 400 MaxLength",
    steps="POST với name='A' lặp 501 lần", data="name='A'.repeat(501)",
    ui="Error 'Tên không quá 500 ký tự'", api="400 MaxLength(500)", side="-", sev="High")

add("RED", "P1", "Create-name", "name là object JSON → 400 IsString",
    steps="POST name={text:'abc'}", data="name={text:'abc'}", ui="-", api="400", side="-", sev="Medium")

add("RED", "P1", "Create-name", "name là array → 400 IsString",
    steps="POST name=['abc']", data="name=['abc']", ui="-", api="400", side="-", sev="Medium")

# caseProvenance
add("RED", "P0", "Create-prov", "Thiếu caseProvenance → 400",
    steps="POST không có caseProvenance",
    data="{name:'X'}", ui="Inline error 'caseProvenance bắt buộc'",
    api="400 IsEnum message includes 'BLTTHS Đ.143'", side="-", sev="Critical")

add("RED", "P0", "Create-prov", "caseProvenance không phải enum value → 400",
    steps="POST caseProvenance='INVALID_VALUE'", data="caseProvenance='INVALID_VALUE'",
    ui="-", api="400 IsEnum violation", side="-", sev="Critical")

add("RED", "P0", "Create-prov", "caseProvenance là tiếng Việt (legacy payload) → 400",
    steps="POST caseProvenance='Phát hiện trực tiếp'", data="caseProvenance='Phát hiện trực tiếp'",
    ui="-", api="400 — v0.37.2.4 BLTTHS Đ.143 — phải dùng enum value tiếng Anh",
    side="-", sev="Critical", notes="Root cause v0.37.2.4 P0 hot-fix")

add("RED", "P0", "Create-prov", "FROM_PETITION nhưng thiếu linkedPetitionId → 400",
    steps="POST caseProvenance=FROM_PETITION, không có linkedPetitionId",
    data="caseProvenance='FROM_PETITION'",
    ui="Error 'linkedPetitionId required when caseProvenance is FROM_PETITION'",
    api="400 ValidateIf failed", side="-", sev="Critical")

add("RED", "P0", "Create-prov", "FROM_INCIDENT thiếu linkedIncidentId → 400",
    steps="POST caseProvenance=FROM_INCIDENT, không linkedIncidentId",
    data="caseProvenance='FROM_INCIDENT'", ui="Error", api="400", side="-", sev="Critical")

add("RED", "P0", "Create-prov", "FROM_PETITION thiếu expectedPetitionUpdatedAt → 400 IsISO8601",
    steps="POST có linkedPetitionId nhưng không expectedPetitionUpdatedAt",
    data="caseProvenance=FROM_PETITION, linkedPetitionId='PET-001'", ui="-", api="400", side="-", sev="Critical")

add("RED", "P0", "Create-prov", "FROM_PETITION với expectedPetitionUpdatedAt cũ hơn current → 409 Conflict",
    pre="Petition PET-001 updatedAt='2026-05-22T15:00:00.000Z' (đã được update bởi user khác)",
    steps="POST với expectedPetitionUpdatedAt='2026-05-20T10:00:00.000Z'",
    data="expectedPetitionUpdatedAt='2026-05-20T10:00:00.000Z'",
    ui="Toast 'Đơn thư đã được chỉnh sửa hoặc link bởi người dùng khác'",
    api="409 ConflictException", side="Case KHÔNG tạo, Petition KHÔNG update", sev="High")

add("RED", "P0", "Create-prov", "FROM_PETITION với linkedPetitionId KHÔNG tồn tại → 404",
    steps="POST linkedPetitionId='PET-NOT-EXIST-999'",
    data="linkedPetitionId='PET-NOT-EXIST-999', expectedPetitionUpdatedAt='2026-05-20T10:00:00.000Z'",
    ui="Toast 'Đơn thư không tồn tại hoặc không nằm trong phạm vi của bạn'",
    api="404 NotFoundException — no enumeration leak", side="-", sev="High",
    notes="IDOR-safe: not-found vs out-of-scope cùng response")

add("RED", "P0", "Create-prov", "FROM_PETITION với Petition của user KHÁC scope → 404 (không lộ tồn tại)",
    pre="Login wardOfficer-Q1, Petition PET-A99 thuộc Team-Q3",
    steps="POST FROM_PETITION linkedPetitionId='PET-A99'",
    data="linkedPetitionId='PET-A99'",
    ui="Toast 'Đơn thư không tồn tại hoặc không nằm trong phạm vi của bạn'",
    api="404 (không 403)", side="IDOR-safe enumeration prevention", sev="Critical")

add("RED", "P0", "Create-prov", "FROM_PETITION với Petition đã có linkedCaseId (đã khởi tố trước) → 404",
    pre="PET-002 đã có linkedCaseId='CASE-OLD'",
    steps="POST FROM_PETITION với linkedPetitionId='PET-002'",
    data="linkedPetitionId='PET-002'", ui="Toast 'Đơn thư đã được khởi tố rồi'",
    api="404 (filter linkedCaseId:null trong findFirst)", side="Không double-create", sev="Critical")

add("RED", "P0", "Create-prov", "FROM_PETITION với deletedAt != null → 404",
    pre="PET-003 đã soft-deleted",
    steps="POST FROM_PETITION linkedPetitionId='PET-003'",
    data="linkedPetitionId='PET-003'", ui="-", api="404", side="-", sev="High")

add("RED", "P1", "Create-prov", "expectedPetitionUpdatedAt sai format (không ISO 8601) → 400",
    steps="POST expectedPetitionUpdatedAt='20/05/2026'",
    data="expectedPetitionUpdatedAt='20/05/2026'", ui="-", api="400 IsISO8601 failed", side="-", sev="Medium")

# investigatorId
add("RED", "P0", "Create-inv", "investigatorId không tồn tại trong users table → 400",
    steps="POST investigatorId='NON_EXIST_USER_XXX'",
    data="investigatorId='NON_EXIST_USER_XXX'",
    ui="Toast 'Điều tra viên không tồn tại'", api="400 BadRequestException msg=Điều tra viên không tồn tại",
    side="-", sev="High")

# capDoToiPham
add("RED", "P1", "Create-capDo", "capDoToiPham là invalid enum 'INVALID' → 400 với message tiếng Việt",
    steps="POST capDoToiPham='INVALID'",
    data="capDoToiPham='INVALID'", ui="-",
    api="400 'capDoToiPham phải là IT_NGHIEM_TRONG, NGHIEM_TRONG, RAT_NGHIEM_TRONG hoặc DAC_BIET_NGHIEM_TRONG'",
    side="-", sev="Medium")

# subjectsCount
add("RED", "P1", "Create-subC", "subjectsCount = -1 → 400 @Min(0)",
    steps="POST subjectsCount=-1", data="subjectsCount=-1", ui="Error 'Phải ≥ 0'", api="400 @Min(0)", side="-", sev="Medium")

add("RED", "P1", "Create-subC", "subjectsCount = 1.5 (float) → 400 IsInt",
    steps="POST subjectsCount=1.5", data="subjectsCount=1.5", ui="-", api="400 IsInt", side="-", sev="Medium")

add("RED", "P1", "Create-subC", "subjectsCount = 'abc' string → 400 IsInt",
    steps="POST subjectsCount='abc'", data="subjectsCount='abc'", ui="-", api="400", side="-", sev="Medium")

# crime / unit (string + MaxLength 255)
add("RED", "P1", "Create-crime", "crime > 255 ký tự → 400 MaxLength",
    steps="POST crime với 256 chars",
    data="crime='X'.repeat(256)", ui="Error 'không quá 255 ký tự'", api="400", side="-", sev="Medium")

add("RED", "P1", "Create-unit", "unit > 255 ký tự → 400",
    steps="POST unit với 256 chars", data="unit='X'.repeat(256)", ui="-", api="400 MaxLength(255)", side="-", sev="Medium")

# deadline / ngayKhoiTo (DateString)
add("RED", "P0", "Create-deadline", "deadline sai format 'không-phải-ngày' → 400 IsDateString",
    steps="POST deadline='abc-xyz'", data="deadline='abc-xyz'", ui="-", api="400 IsDateString", side="-", sev="High")

add("RED", "P1", "Create-deadline", "deadline format DD/MM/YYYY → 400 IsDateString chỉ accept ISO",
    steps="POST deadline='15/08/2026'", data="deadline='15/08/2026'",
    ui="-", api="400 IsDateString cần ISO 8601", side="-", sev="Medium",
    notes="Frontend phải convert sang ISO trước POST")

add("RED", "P1", "Create-ngayKT", "ngayKhoiTo='2026-13-45' (tháng 13, ngày 45) → 400",
    steps="POST ngayKhoiTo='2026-13-45'", data="ngayKhoiTo='2026-13-45'", ui="-", api="400 IsDateString", side="-", sev="Medium")

# sourceDocumentNote (≤ 1000)
add("RED", "P1", "Create-src", "sourceDocumentNote > 1000 ký tự → 400",
    steps="POST sourceDocumentNote='Y'.repeat(1001)", data="sourceDocumentNote.length=1001",
    ui="Error 'không quá 1000 ký tự'", api="400 MaxLength(1000)", side="-", sev="Medium")

# linkedPetitionId + linkedIncidentId conflict
add("RED", "P0", "Create-prov", "caseProvenance=DIRECT_DISCOVERY nhưng vẫn truyền linkedPetitionId → field bị ignore",
    steps="POST DIRECT_DISCOVERY + linkedPetitionId='PET-001'",
    data="caseProvenance='DIRECT_DISCOVERY', linkedPetitionId='PET-001'",
    ui="Tạo thành công", api="201, data.linkedPetitionId=NULL (ignore)",
    side="DTO bỏ qua linkedPetitionId nếu provenance không phải FROM_PETITION (ValidateIf)",
    sev="Medium", notes="Validation chỉ apply khi FROM_PETITION → DIRECT_DISCOVERY không validate field")

# metadata
add("RED", "P1", "Create-meta", "metadata là array thay vì object → 400 IsObject",
    steps="POST metadata=[1,2,3]", data="metadata=[1,2,3]", ui="-", api="400 IsObject", side="-", sev="Medium")

add("RED", "P1", "Create-meta", "metadata là string → 400 IsObject",
    steps="POST metadata='abc'", data="metadata='abc'", ui="-", api="400", side="-", sev="Medium")

# assignedTeamId
add("RED", "P1", "Create-team", "assignedTeamId KHÔNG tồn tại trong teams (FK invalid) → ?",
    steps="POST assignedTeamId='TEAM_NOT_EXIST'", data="assignedTeamId='TEAM_NOT_EXIST'",
    ui="Toast lỗi", api="500 hoặc 400 do Prisma FK constraint violation",
    side="Không tạo row", sev="Medium", notes="Backend nên catch P2003 trả 400 thân thiện")

# whitelist (forbidNonWhitelisted)
add("RED", "P1", "Create-wl", "POST kèm field lạ 'evilField=hack' với whitelist=true → 400",
    steps="POST {name:'X', caseProvenance:'DIRECT_DISCOVERY', evilField:'hack'}",
    data="evilField='hack'", ui="-", api="400 'property evilField should not exist'",
    side="-", sev="Medium", notes="forbidNonWhitelisted: true")

# Permission
add("RED", "P0", "Create-perm", "User KHÔNG có permission write/Case (role VIEWER) → 403",
    pre="Login viewer@pc02.local role VIEWER",
    steps="POST /cases với DTO hợp lệ", data="any valid", ui="Toast 'Bạn không có quyền'",
    api="403 ForbiddenException PermissionsGuard", side="-", sev="Critical")

# Auth
add("RED", "P0", "Create-auth", "POST không có Authorization header → 401",
    pre="-", steps="POST /cases không kèm JWT", data="-", ui="Redirect login",
    api="401 JwtAuthGuard rejected", side="-", sev="Critical")

add("RED", "P0", "Create-auth", "POST JWT đã hết hạn → 401",
    pre="JWT exp < now()", steps="POST với JWT cũ", data="-", ui="-",
    api="401 token expired", side="-", sev="Critical")

add("RED", "P0", "Create-auth", "POST JWT bị tamper signature → 401",
    pre="JWT signature thay đổi", steps="POST với JWT.split('.')[2]='evil_sig'",
    data="-", ui="-", api="401 JWT invalid signature", side="-", sev="Critical")

# Field type errors
add("RED", "P1", "Create-type", "deadline là object → 400 IsDateString",
    steps="POST deadline={year:2026}", data="deadline={year:2026}", ui="-", api="400", side="-", sev="Medium")

add("RED", "P1", "Create-type", "investigatorId là number 12345 → 400 IsString",
    steps="POST investigatorId=12345", data="investigatorId=12345", ui="-", api="400 IsString", side="-", sev="Medium")

# Pre-flight assignedTeamId check
add("RED", "P1", "Create-team", "assignedTeamId của team đã isActive=false → field saved nhưng cảnh báo",
    pre="Team-INACTIVE-01 isActive=false",
    steps="POST assignedTeamId='Team-INACTIVE-01'",
    data="assignedTeamId='Team-INACTIVE-01'",
    ui="Toast cảnh báo 'Team đã ngừng hoạt động'", api="? — hiện tại không validate trong create",
    side="Cần thêm validation isActive=true",
    sev="Medium", notes="Gap có thể trong logic — refer service check chỉ ở assignCase, không create")

# Provenance variant: SELF_SURRENDER (nếu enum có)
add("RED", "P1", "Create-prov", "caseProvenance=SELF_SURRENDER cần linkedPetitionId hoặc khác? — check enum",
    steps="POST SELF_SURRENDER không link", data="caseProvenance='SELF_SURRENDER'",
    ui="-", api="201 nếu không có ValidateIf riêng cho SELF_SURRENDER",
    side="Check schema xem có ValidateIf không", sev="Medium",
    notes="ValidateIf chỉ enforce với FROM_PETITION/FROM_INCIDENT")

# Whitespace name trim variants (BUG-001/002/004 v0.37.2.7)
add("RED", "P0", "Create-name", "name='\\t\\t\\t' (3 tab) bị trim thành '' → 400",
    steps="POST name='\\t\\t\\t'", data="name='\\t\\t\\t' (3 tabs)",
    ui="Error 'Tên vụ án bắt buộc'", api="400 IsNotEmpty sau Transform trim",
    side="-", sev="High")

add("RED", "P0", "Create-name", "name='\\n\\n\\n' (3 newline) bị trim → 400",
    steps="POST name='\\n\\n\\n'", data="name='\\n\\n\\n'",
    ui="Error", api="400", side="-", sev="High")

add("RED", "P1", "Create-name", "name=' Vụ ABC ' (có space đầu/cuối) bị trim → save 'Vụ ABC'",
    steps="POST name=' Vụ ABC '", data="name=' Vụ ABC '",
    ui="Detail show name='Vụ ABC' (đã trim)", api="201, data.name='Vụ ABC'",
    side="DB name='Vụ ABC' (no leading/trailing space)", sev="Medium")

# Conflict 409 race
add("RED", "P0", "Create-prov", "Race condition: 2 user đồng thời FROM_PETITION cùng PET-001 → 1 ConflictException",
    steps="User A và B đồng thời POST FROM_PETITION với cùng linkedPetitionId='PET-001'",
    data="2 request parallel",
    ui="User thắng race: success. User thua: 'Đơn thư đã được link bởi người dùng khác'",
    api="1 trả 201, 1 trả 409",
    side="Chỉ 1 Case tạo, Petition.linkedCaseId = winner's caseId, không double-link",
    sev="Critical", notes="Atomic via WHERE updatedAt + linkedCaseId=null + P2025/P2002 catch")

add("RED", "P1", "Create-prov", "FROM_INCIDENT với Incident updatedAt mismatch → 409 'Vụ việc đã chỉnh sửa'",
    pre="INC-001 updatedAt='2026-05-22T12:00'",
    steps="POST FROM_INCIDENT expectedIncidentUpdatedAt='2026-05-20T10:00' (cũ)",
    data="expectedIncidentUpdatedAt='2026-05-20T10:00:00.000Z'",
    ui="Toast 'Vụ việc đã chỉnh sửa hoặc link bởi người dùng khác'",
    api="409 ConflictException", side="-", sev="High")

# Cross-field
add("RED", "P1", "Create-prov", "FROM_PETITION + ngayKhoiTo trước Petition.receivedDate? — business logic cần check",
    steps="POST FROM_PETITION với ngayKhoiTo='2025-01-01' (trước Petition.receivedDate)",
    data="ngayKhoiTo='2025-01-01'", ui="-", api="? — hiện không validate",
    side="Cần audit business rule", sev="Low", notes="Gap nếu cần enforce")


# ============================================================
# MODULE 2: READ LIST + DETAIL (30 TC)
# ============================================================
add("GREEN", "P0", "List", "GET /cases trả paginated 20 items default sorted createdAt desc",
    pre="DB có ≥30 Case", steps="GET /api/v1/cases",
    data="query: (none)", ui="Table show 20 row, pagination 1 of 2",
    api="200, data=[20 items], total=30, page=1, pageSize=20, sort createdAt desc",
    side="-", sev="High")

add("GREEN", "P0", "List", "GET /cases?limit=50 trả tối đa 50",
    steps="GET /cases?limit=50", data="limit=50",
    ui="Table 50 row", api="200, data.length≤50", side="-", sev="Medium")

add("RED", "P0", "List", "GET /cases?limit=101 → 400 @Max(100)",
    steps="GET ?limit=101", data="limit=101", ui="-", api="400 max 100", side="-", sev="Medium")

add("RED", "P1", "List", "GET /cases?limit=0 → 400 @Min(1)",
    steps="GET ?limit=0", data="limit=0", ui="-", api="400 min 1", side="-", sev="Medium")

add("RED", "P1", "List", "GET /cases?limit=-5 → 400",
    steps="GET ?limit=-5", data="limit=-5", ui="-", api="400", side="-", sev="Medium")

add("RED", "P1", "List", "GET /cases?limit=abc (NaN) → 400 @IsInt",
    steps="GET ?limit=abc", data="limit='abc'", ui="-", api="400", side="-", sev="Medium")

add("GREEN", "P0", "List", "Filter status=DANG_DIEU_TRA chỉ trả Case status đó",
    steps="GET /cases?status=DANG_DIEU_TRA", data="status='DANG_DIEU_TRA'",
    ui="Tất cả row có badge 'Đang điều tra'", api="200, mọi data[].status=DANG_DIEU_TRA",
    side="-", sev="High")

add("RED", "P1", "List", "Filter status=INVALID → 400 IsEnum",
    steps="GET ?status=INVALID", data="status='INVALID'", ui="-", api="400", side="-", sev="Medium")

add("GREEN", "P0", "List", "Filter overdue=true trả case quá hạn",
    pre="Có Case deadline='2026-05-10' (đã qua) status=DANG_DIEU_TRA",
    steps="GET /cases?overdue=true", data="overdue=true",
    ui="Row hiển thị highlight đỏ 'Quá hạn'",
    api="200, mỗi data[].deadline < now() AND status NOT IN [DA_KET_LUAN, DA_LUU_TRU, DINH_CHI]",
    side="-", sev="High")

add("GREEN", "P0", "List", "Filter overdue=true KHÔNG include Case DA_KET_LUAN dù deadline đã qua",
    pre="Case-X deadline='2026-04-01', status=DA_KET_LUAN",
    steps="GET ?overdue=true", data="overdue=true",
    ui="Case-X KHÔNG xuất hiện", api="data[].id KHÔNG có Case-X",
    side="-", sev="High", notes="status NOT IN clause")

add("GREEN", "P0", "List", "Search 'Trộm cắp' tìm case có name/crime/unit chứa từ này (case-insensitive)",
    pre="Case A name='Vụ Trộm Cắp Xe', Case B crime='trộm cắp tài sản'",
    steps="GET /cases?search=Trộm cắp", data="search='Trộm cắp'",
    ui="Show cả A và B", api="OR contains insensitive, return 2 results", side="-", sev="High")

add("GREEN", "P0", "List", "Search với chữ có dấu vs không dấu (Unicode Vietnamese)",
    steps="GET ?search=tron cap (không dấu)", data="search='tron cap'",
    ui="-", api="Postgres không tìm thấy nếu thiếu collation → cần unaccent extension",
    side="-", sev="Medium", notes="Gap nếu Postgres mặc định case-insensitive nhưng accent-sensitive")

add("GREEN", "P1", "List", "Filter fromDate='2026-05-01' & toDate='2026-05-23' khoảng ngày",
    steps="GET ?fromDate=2026-05-01&toDate=2026-05-23",
    data="fromDate, toDate", ui="-", api="data[].createdAt BETWEEN '2026-05-01' AND '2026-05-23T23:59:59.999Z'",
    side="-", sev="Medium")

add("RED", "P1", "List", "toDate < fromDate → vẫn trả empty (không 400)",
    steps="GET ?fromDate=2026-05-23&toDate=2026-05-01",
    data="fromDate>toDate", ui="-", api="200 với data=[]", side="-", sev="Low",
    notes="Gap nếu cần 400 cho invalid range — hiện chấp nhận")

add("GREEN", "P1", "List", "Filter capDoToiPham=RAT_NGHIEM_TRONG",
    steps="GET ?capDoToiPham=RAT_NGHIEM_TRONG", data="capDoToiPham='RAT_NGHIEM_TRONG'",
    ui="-", api="data[].capDoToiPham=RAT_NGHIEM_TRONG", side="-", sev="Medium")

add("GREEN", "P1", "List", "Filter districtId qua subjects relation",
    pre="Subject S1 districtId='DIS-Q1' caseId='C1'",
    steps="GET ?districtId=DIS-Q1", data="districtId='DIS-Q1'",
    ui="-", api="data include C1 (qua subjects.some)", side="-", sev="Medium")

add("GREEN", "P1", "List", "Sort sortBy=name sortOrder=asc",
    steps="GET ?sortBy=name&sortOrder=asc", data="sortBy='name', sortOrder='asc'",
    ui="Table sort A→Z by name", api="orderBy name asc", side="-", sev="Medium")

add("RED", "P1", "List", "sortBy='evil_field' → fallback về createdAt (security: prevent SQL injection)",
    steps="GET ?sortBy=password", data="sortBy='password'",
    ui="-", api="200, allowedSortFields filter → orderBy createdAt",
    side="-", sev="High", notes="Whitelist sortBy chống SQLi qua orderBy")

add("GREEN", "P1", "List", "Pagination offset=20 trả page 2",
    steps="GET ?limit=20&offset=20", data="limit=20, offset=20",
    ui="Page 2 of N", api="data starts from item 21", side="-", sev="Medium")

add("GREEN", "P0", "Detail", "GET /cases/:id trả full detail có investigator + petitions include",
    pre="Case CASE-001",
    steps="GET /cases/CASE-001", data="id='CASE-001'",
    ui="Detail page show name, status, investigator, deadline, petitions tab",
    api="200, data.investigator{firstName,lastName,username,email}, data.petitions[]",
    side="-", sev="Critical")

add("RED", "P0", "Detail", "GET /cases/NOT_EXIST → 404",
    steps="GET /cases/NOT_EXIST", data="id='NOT_EXIST'",
    ui="Toast 'Vụ án không tồn tại'", api="404 NotFoundException", side="-", sev="High")

add("RED", "P0", "Detail", "GET /cases/:id của Case đã soft-deleted → 404 (deletedAt IS NOT NULL)",
    pre="CASE-DEL deletedAt='2026-05-20'",
    steps="GET /cases/CASE-DEL", data="id of deleted",
    ui="404 page", api="404 (where deletedAt:null filter)", side="-", sev="High")

add("RED", "P0", "Detail", "GET /cases/:id của Case ngoài scope → 403",
    pre="Login wardOfficer-Q1, CASE-Q3 thuộc Team-Q3",
    steps="GET /cases/CASE-Q3", data="-",
    ui="Toast 'Bạn không có quyền truy cập bản ghi này'",
    api="403 ForbiddenException (checkRecordInScope)", side="-", sev="Critical")

add("GREEN", "P0", "Detail", "Dispatcher xem mọi Case không bị scope chặn",
    pre="Login dispatcher@ canDispatch=true",
    steps="GET /cases/CASE-FOREIGN", data="-",
    ui="200 detail", api="200 (dispatcher bypass)", side="-", sev="High")

add("GREEN", "P0", "Detail", "ADMIN xem mọi Case (no scope)",
    pre="Login admin@", steps="GET /cases/CASE-ANY", data="-",
    ui="200", api="200 (dataScope=null → allow all)", side="-", sev="High")

add("GREEN", "P0", "Detail", "Owner (investigator) xem được Case mình phụ trách",
    pre="dieuTra1@ là investigatorId của CASE-001",
    steps="Login dieuTra1, GET /cases/CASE-001",
    data="-", ui="200", api="200 (ownerMatch)", side="-", sev="High")

add("GREEN", "P0", "Detail", "Cùng team xem được Case của đồng nghiệp",
    pre="dieuTra1 và dieuTra2 cùng Team-Q1, CASE-002 do dieuTra2 phụ trách assignedTeamId=Team-Q1",
    steps="Login dieuTra1, GET /cases/CASE-002",
    data="-", ui="200", api="200 (teamMatch)", side="-", sev="High")

add("GREEN", "P1", "Detail", "User được xem unassigned Case của team mình (assignedTeamId=null + teamIds.length>0)",
    steps="Login dieuTra1, GET /cases/CASE-UNASSIGNED",
    data="-", ui="200", api="200 (unassignedMatch)", side="-", sev="Medium")

add("GREEN", "P1", "List", "Filter wardTeamId='WARD-Q5' (cross-ward view PC02)",
    pre="Login PC02 user", steps="GET ?wardTeamId='WARD-Q5'",
    data="wardTeamId='WARD-Q5'", ui="-",
    api="data filter assignedTeam.wardId=WARD-Q5", side="-", sev="Medium")

add("GREEN", "P1", "List", "Filter investigatorId trả case của ĐTV cụ thể",
    steps="GET ?investigatorId=<U001>", data="investigatorId='U001'",
    ui="-", api="data[].investigatorId='U001'", side="-", sev="Medium")


# ============================================================
# MODULE 3: UPDATE (40 TC)
# ============================================================
add("GREEN", "P0", "Update", "Update name + crime case mình owner",
    pre="CASE-001 investigatorId=dieuTra1, status=TIEP_NHAN",
    steps="PUT /cases/CASE-001 với {name:'Đã sửa', crime:'Đã sửa loại tội'}",
    data="name='Đã sửa'", ui="Toast 'Cập nhật thành công', detail show new value",
    api="200, data.name='Đã sửa'", side="Audit CASE_UPDATED với before/after diff", sev="Critical")

add("GREEN", "P0", "Update", "Update với expectedUpdatedAt khớp current → success",
    pre="CASE-001 updatedAt='2026-05-22T10:00:00.000Z'",
    steps="PUT với expectedUpdatedAt='2026-05-22T10:00:00.000Z' và body sửa",
    data="expectedUpdatedAt='2026-05-22T10:00:00.000Z'",
    ui="Success", api="200", side="updatedAt mới refresh", sev="High")

add("RED", "P0", "Update", "Update với expectedUpdatedAt cũ → 409 Conflict",
    pre="CASE-001 updatedAt='2026-05-23T08:00' (đã có user khác update)",
    steps="PUT với expectedUpdatedAt='2026-05-22T10:00' (cũ)",
    data="expectedUpdatedAt='2026-05-22T10:00:00.000Z'",
    ui="Toast 'Hồ sơ đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang'",
    api="409 ConflictException", side="Không update", sev="Critical")

add("RED", "P0", "Update", "Update Case ngoài write-scope → 403",
    pre="Login wardOfficer-Q1, CASE-Q3 thuộc Team-Q3",
    steps="PUT /cases/CASE-Q3 {name:'hack'}",
    data="-", ui="Toast 'Bạn không có quyền chỉnh sửa bản ghi này'",
    api="403 ForbiddenException (checkWriteScope)", side="-", sev="Critical")

add("RED", "P0", "Update", "Update Case không tồn tại → 404",
    steps="PUT /cases/NOT_EXIST", data="-", ui="-", api="404", side="-", sev="High")

add("RED", "P0", "Update", "Update Case đã soft-deleted → 404",
    pre="CASE-DEL deletedAt set",
    steps="PUT /cases/CASE-DEL", data="-", ui="-", api="404 (where deletedAt:null)", side="-", sev="High")

add("GREEN", "P0", "Update", "Update status TIEP_NHAN → DANG_XAC_MINH tạo CaseStatusHistory + audit",
    pre="CASE-001 status=TIEP_NHAN",
    steps="PUT {status:'DANG_XAC_MINH'}",
    data="status='DANG_XAC_MINH'",
    ui="Badge change to 'Đang xác minh', tab History show entry",
    api="200, data.status=DANG_XAC_MINH",
    side="1. Row trong case_status_history với fromStatus=TIEP_NHAN, toStatus=DANG_XAC_MINH, changedById\n2. Audit CASE_STATUS_CHANGED",
    sev="Critical")

add("GREEN", "P0", "Update", "Update status DANG_DIEU_TRA → TAM_DINH_CHI với lyDoTamDinhChiVuAn auto-set ngày + count",
    pre="CASE-001 status=DANG_DIEU_TRA, soLanTamDinhChi=0",
    steps="PUT {status:'TAM_DINH_CHI', lyDoTamDinhChiVuAn:'CHUA_XAC_DINH_BI_CAN', soQuyetDinhTamDinhChi='QĐ-123'}",
    data="status, lyDoTamDinhChiVuAn, soQuyetDinhTamDinhChi",
    ui="Badge 'Tạm đình chỉ'",
    api="200, data.ngayTamDinhChi=now(), data.soLanTamDinhChi=1",
    side="ngayTamDinhChi auto-set + soLanTamDinhChi increment +1", sev="Critical")

add("RED", "P0", "Update", "Update → TAM_DINH_CHI thiếu lyDoTamDinhChiVuAn (Case post-migration) → 400",
    pre="CASE-NEW createdAt='2026-05-15' (sau 2026-04-30 MIGRATION_DATE), status=DANG_DIEU_TRA",
    steps="PUT {status:'TAM_DINH_CHI'} (thiếu lyDoTamDinhChiVuAn)",
    data="status='TAM_DINH_CHI'",
    ui="Toast 'Vui lòng chọn lý do tạm đình chỉ theo quy định Điều 229 BLTTHS 2015'",
    api="400 BadRequestException", side="Không update", sev="Critical")

add("GREEN", "P1", "Update", "Update → TAM_DINH_CHI thiếu lý do nhưng Case cũ (pre-migration) → SOFT warning",
    pre="CASE-OLD createdAt='2026-04-01' (trước MIGRATION_DATE)",
    steps="PUT {status:'TAM_DINH_CHI'} (không lý do)",
    data="-", ui="Banner warning 'Khuyến nghị cập nhật lý do theo Điều 229'",
    api="200, response.warning='Khuyến nghị: Vui lòng cập nhật lý do tạm đình chỉ theo quy định Điều 229 BLTTHS 2015 (áp dụng bắt buộc từ 30/04/2026)'",
    side="Update vẫn thành công với warning", sev="Medium", notes="90-day grace period")

add("RED", "P0", "Update", "lyDoTamDinhChiVuAn = invalid enum 'INVALID_REASON' → 400",
    steps="PUT lyDoTamDinhChiVuAn='INVALID_REASON'",
    data="lyDoTamDinhChiVuAn='INVALID_REASON'",
    ui="-", api="400 'Lý do tạm đình chỉ phải theo quy định BLTTHS Điều 229'",
    side="-", sev="High")

add("GREEN", "P0", "Update", "Update status TAM_DINH_CHI → DANG_DIEU_TRA (phục hồi) với daRaSoat + ngayRaSoat",
    pre="CASE-001 status=TAM_DINH_CHI",
    steps="PUT {status:'DANG_DIEU_TRA', daRaSoat:true, ngayRaSoat:'2026-05-23', soQuyetDinhPhucHoi:'PH-001', ketQuaPhucHoiVuAn:'DANG_DIEU_TRA_XAC_MINH'}",
    data="daRaSoat=true, ngayRaSoat, soQuyetDinhPhucHoi, ketQuaPhucHoiVuAn",
    ui="Badge 'Đang điều tra', tab 'Phục hồi' show số QĐ + ngày",
    api="200", side="Audit CASE_STATUS_CHANGED + cases row có daRaSoat=true", sev="Critical")

add("RED", "P1", "Update", "ketQuaPhucHoiVuAn = invalid → 400",
    steps="PUT ketQuaPhucHoiVuAn='INVALID'", data="ketQuaPhucHoiVuAn='INVALID'",
    ui="-", api="400 'Kết quả phục hồi vụ án phải là enum KetQuaPhucHoiVuAn'", side="-", sev="Medium")

add("RED", "P1", "Update", "lyDoTamDinhChiText > 500 ký tự → 400",
    steps="PUT lyDoTamDinhChiText='X'.repeat(501)", data="lyDoTamDinhChiText.length=501",
    ui="-", api="400 MaxLength(500)", side="-", sev="Medium")

add("RED", "P1", "Update", "soQuyetDinhTamDinhChi > 100 ký tự → 400",
    steps="PUT soQuyetDinhTamDinhChi='X'.repeat(101)", data="length=101",
    ui="-", api="400 MaxLength(100)", side="-", sev="Medium")

add("RED", "P1", "Update", "daRaSoat = 'yes' string thay vì boolean → 400 IsBoolean",
    steps="PUT daRaSoat='yes'", data="daRaSoat='yes'",
    ui="-", api="400 'daRaSoat phải là boolean'", side="-", sev="Medium")

add("RED", "P1", "Update", "ngayRaSoat sai ISO format → 400",
    steps="PUT ngayRaSoat='23/05/2026'", data="ngayRaSoat='23/05/2026'",
    ui="-", api="400 'ngayRaSoat không đúng định dạng ISO 8601'", side="-", sev="Medium")

add("GREEN", "P1", "Update", "Update KHÔNG đổi status → KHÔNG tạo CaseStatusHistory entry",
    pre="CASE-001 status=DANG_DIEU_TRA",
    steps="PUT {name:'sửa tên'} (không động status)",
    data="name='sửa tên'", ui="Tab History KHÔNG có entry mới",
    api="200", side="case_status_history KHÔNG insert row mới", sev="Medium",
    notes="Logic: if (dto.status !== undefined && dto.status !== existing.status)")

add("GREEN", "P1", "Update", "Update status với cùng giá trị status hiện tại → KHÔNG tạo history",
    pre="CASE-001 status=DANG_DIEU_TRA",
    steps="PUT {status:'DANG_DIEU_TRA'} (idempotent)",
    data="status='DANG_DIEU_TRA'", ui="-",
    api="200, không có entry history", side="case_status_history empty for this op",
    sev="Medium")

add("GREEN", "P1", "Update", "Update metadata.petitionType sync sang Petition liên kết",
    pre="CASE-001 có linkedPetition PET-001 petitionType='KHIEU_NAI'",
    steps="PUT metadata={petitionType:'TO_GIAC'}",
    data="metadata.petitionType='TO_GIAC'",
    ui="-", api="200", side="Petition PET-001.petitionType=TO_GIAC (sync v0.37.2.5)", sev="High")

add("GREEN", "P1", "Update", "Update metadata.petitionType mà KHÔNG có Petition link → silent ignore (no phantom create)",
    pre="CASE-002 không có linkedPetition",
    steps="PUT metadata={petitionType:'TO_GIAC'}",
    data="metadata.petitionType='TO_GIAC'",
    ui="-", api="200", side="KHÔNG tạo Petition mới (v0.37.2.5 fix phantom)",
    sev="High", notes="BLTTHS Đ.143 compliance — provenance model forbids side-effect Petition")

add("GREEN", "P0", "Update", "Audit CASE_UPDATED capture before/after diff đầy đủ",
    pre="CASE-001 name='Old', crime='Old crime'",
    steps="PUT {name:'New', crime:'New crime'}",
    data="-", ui="-", api="200",
    side="Audit log CASE_UPDATED metadata.diff={name:{before:'Old', after:'New'}, crime:{before:..., after:...}}",
    sev="High", notes="audit.wrapUpdate")

add("RED", "P1", "Update", "PUT lyDoTamDinhChiVuAn nhưng status không phải TAM_DINH_CHI → vẫn save (no enforce)",
    pre="CASE-001 status=DANG_DIEU_TRA",
    steps="PUT lyDoTamDinhChiVuAn='CHUA_XAC_DINH_BI_CAN' (status không đổi)",
    data="lyDoTamDinhChiVuAn='CHUA_XAC_DINH_BI_CAN'",
    ui="-", api="200, save value", side="cases row có lyDoTamDinhChiVuAn nhưng status=DANG_DIEU_TRA",
    sev="Low", notes="Gap nếu cần consistency — hiện không enforce")

add("RED", "P1", "Update", "investigatorId không tồn tại → 400",
    steps="PUT investigatorId='NOT_EXIST'", data="investigatorId='NOT_EXIST'",
    ui="Toast 'Điều tra viên không tồn tại'", api="400", side="-", sev="Medium")

add("GREEN", "P1", "Update", "Update deadline=null xóa deadline cũ",
    pre="CASE-001 deadline='2026-08-01'",
    steps="PUT {deadline:null}", data="deadline=null",
    ui="Detail show 'Chưa có deadline'", api="200, data.deadline=null",
    side="cases.deadline=NULL", sev="Medium")

add("GREEN", "P1", "Update", "Update capDoToiPham đổi từ NGHIEM_TRONG sang DAC_BIET_NGHIEM_TRONG",
    pre="capDoToiPham=NGHIEM_TRONG",
    steps="PUT capDoToiPham='DAC_BIET_NGHIEM_TRONG'",
    data="capDoToiPham='DAC_BIET_NGHIEM_TRONG'", ui="Badge update",
    api="200", side="KPI-4 dashboard recount", sev="Medium")

add("RED", "P1", "Update", "Update Case khi user role VIEWER → 403",
    pre="Login viewer", steps="PUT /cases/CASE-001",
    data="-", ui="-", api="403 PermissionsGuard", side="-", sev="High")

add("GREEN", "P0", "Update", "DTO whitelist reject field lạ trong UpdateCaseDto (forbidNonWhitelisted)",
    steps="PUT {name:'X', evilField:'hack'}", data="evilField='hack'",
    ui="-", api="400 'property evilField should not exist'", side="-", sev="Medium")

# Status transitions
add("STATE", "P0", "Update-status", "Transition TIEP_NHAN → DANG_XAC_MINH (valid)",
    pre="status=TIEP_NHAN", steps="PUT status=DANG_XAC_MINH",
    data="-", ui="Badge change", api="200", side="History entry created", sev="High")

add("STATE", "P0", "Update-status", "Transition DANG_XAC_MINH → DA_XAC_MINH (valid)",
    pre="status=DANG_XAC_MINH", steps="PUT status=DA_XAC_MINH",
    data="-", ui="-", api="200", side="-", sev="High")

add("STATE", "P0", "Update-status", "Transition DA_XAC_MINH → DANG_DIEU_TRA (valid)",
    pre="status=DA_XAC_MINH", steps="PUT status=DANG_DIEU_TRA",
    data="-", ui="-", api="200", side="-", sev="High")

add("STATE", "P0", "Update-status", "Transition DANG_DIEU_TRA → DA_KET_LUAN (valid)",
    pre="status=DANG_DIEU_TRA", steps="PUT status=DA_KET_LUAN",
    data="-", ui="-", api="200", side="-", sev="High")

add("STATE", "P0", "Update-status", "Transition DA_KET_LUAN → DANG_TRUY_TO (valid)",
    pre="status=DA_KET_LUAN", steps="PUT status=DANG_TRUY_TO",
    data="-", ui="-", api="200", side="-", sev="High")

add("STATE", "P0", "Update-status", "Transition DANG_TRUY_TO → DANG_XET_XU (valid)",
    pre="status=DANG_TRUY_TO", steps="PUT status=DANG_XET_XU",
    data="-", ui="-", api="200", side="-", sev="High")

add("STATE", "P0", "Update-status", "Transition DANG_XET_XU → DA_LUU_TRU (final state)",
    pre="status=DANG_XET_XU", steps="PUT status=DA_LUU_TRU",
    data="-", ui="-", api="200", side="-", sev="High")

add("STATE", "P0", "Update-status", "Transition any → DINH_CHI (đình chỉ vĩnh viễn)",
    pre="status=DANG_DIEU_TRA", steps="PUT status=DINH_CHI",
    data="-", ui="Badge 'Đình chỉ' đỏ", api="200", side="-", sev="High")

add("STATE", "P0", "Update-status", "Transition TAM_DINH_CHI → DA_KET_LUAN (phục hồi và kết luận luôn)",
    pre="status=TAM_DINH_CHI, daRaSoat=true",
    steps="PUT status=DA_KET_LUAN, ketQuaPhucHoiVuAn=KET_LUAN_DE_NGHI_TRUY_TO",
    data="ketQuaPhucHoiVuAn='KET_LUAN_DE_NGHI_TRUY_TO'", ui="-",
    api="200", side="Có 2 entry history (1 lần phục hồi, 1 lần kết luận)?", sev="High",
    notes="Implementation hiện chỉ tạo 1 entry — verify logic")

add("STATE", "P1", "Update-status", "Idempotent: PUT cùng status không tạo history",
    pre="status=DANG_DIEU_TRA", steps="PUT status=DANG_DIEU_TRA",
    data="-", ui="-", api="200", side="History KHÔNG entry mới", sev="Medium")

add("STATE", "P1", "Update-status", "DA_LUU_TRU → DA_KET_LUAN (rollback) — có cho phép?",
    pre="status=DA_LUU_TRU", steps="PUT status=DA_KET_LUAN",
    data="-", ui="-", api="? — hiện không enforce transition map ở backend",
    side="-", sev="Low", notes="Gap: thiếu state machine validation. Frontend disable button.")

add("STATE", "P0", "Update-status", "DINH_CHI → DANG_DIEU_TRA (sai logic) — cần block ở backend",
    pre="status=DINH_CHI", steps="PUT status=DANG_DIEU_TRA",
    data="-", ui="-", api="? — gap: hiện cho phép trừ khi frontend disable",
    side="-", sev="High", notes="Cần backend enforce transition map")

add("STATE", "P0", "Update-status", "DANG_XET_XU → TIEP_NHAN (rollback xa) — invalid logic",
    pre="status=DANG_XET_XU", steps="PUT status=TIEP_NHAN",
    data="-", ui="-", api="Gap: hiện cho phép", side="-", sev="High",
    notes="Sample case test gap: cần state validation")

add("STATE", "P0", "Update-status", "TAM_DINH_CHI lần thứ 2 (recurrent suspend) — soLanTamDinhChi=2",
    pre="status=DANG_DIEU_TRA, soLanTamDinhChi=1",
    steps="PUT status=TAM_DINH_CHI với lyDoTamDinhChiVuAn",
    data="lyDoTamDinhChiVuAn='BI_CAN_BENH_TAM_THAN'",
    ui="Detail show 'Đã tạm đình chỉ 2 lần'", api="200",
    side="soLanTamDinhChi increment to 2 (continuously)", sev="High")


# ============================================================
# MODULE 4: DELETE + RESTORE + PREFLIGHT (28 TC)
# ============================================================
add("GREEN", "P0", "Delete", "Soft delete Case TIEP_NHAN, reason 50 chars, creator → success",
    pre="CASE-001 status=TIEP_NHAN, createdById=dieuTra1, không có subjects/lawyers/conclusions",
    steps="1. Login dieuTra1\n2. DELETE /cases/CASE-001 với body {reason:'Tạo nhầm, cần xóa'}",
    data="reason='Tạo nhầm, cần xóa, hạng mục thừa khi import'",
    ui="Toast 'Xóa vụ án thành công'",
    api="200 message='Xóa vụ án thành công'",
    side="1. cases.deletedAt=now()\n2. Audit CASE_DELETED metadata.reason + hoursAfterCreation",
    sev="Critical")

add("RED", "P0", "Delete", "Reason < 10 ký tự → 400",
    steps="DELETE body {reason:'Sai'}", data="reason='Sai' (3 chars)",
    ui="Error 'Reason phải 10-500 ký tự'", api="400 (DTO MinLength(10))", side="-", sev="High")

add("RED", "P0", "Delete", "Reason > 500 ký tự → 400",
    steps="DELETE reason='X'.repeat(501)", data="length=501",
    ui="-", api="400 MaxLength(500)", side="-", sev="High")

add("RED", "P0", "Delete", "Thiếu reason → 400",
    steps="DELETE không body", data="{}", ui="Error", api="400 reason required", side="-", sev="High")

add("RED", "P0", "Delete", "Reason rỗng '' → 400",
    steps="DELETE reason=''", data="reason=''", ui="-", api="400", side="-", sev="High")

add("RED", "P0", "Delete", "Reason chỉ whitespace '          ' → 400 (Transform trim)",
    steps="DELETE reason='          '", data="reason='          '",
    ui="Error 'Reason bắt buộc'", api="400 sau Transform trim", side="-", sev="High",
    notes="Tương tự BUG-001 cho name field")

add("RED", "P0", "Delete", "Status ≠ TIEP_NHAN (DANG_DIEU_TRA) → 400 'Chỉ xóa được vụ án ở trạng thái Tiếp nhận'",
    pre="CASE-002 status=DANG_DIEU_TRA",
    steps="DELETE /cases/CASE-002 reason='Sai dữ liệu cần xóa'",
    data="-", ui="Toast '... Vụ án đã chuyển trạng thái không thể xóa'",
    api="400 BadRequestException", side="Không soft-delete", sev="Critical")

add("RED", "P0", "Delete", "Có ≥1 subject linked → 400 'có N đối tượng. Xóa các đối tượng trước'",
    pre="CASE-001 có 2 subjects deletedAt=null",
    steps="DELETE /cases/CASE-001 reason='...'",
    data="-", ui="'Không thể xóa: vụ án có 2 đối tượng. Xóa các đối tượng trước.'",
    api="400", side="-", sev="High")

add("RED", "P0", "Delete", "Có ≥1 lawyer linked → 400 'có N luật sư'",
    pre="CASE-001 có 1 lawyer",
    steps="DELETE reason='...'", data="-",
    ui="'Không thể xóa: vụ án có 1 luật sư đăng ký. Xóa các luật sư trước.'",
    api="400", side="-", sev="High")

add("RED", "P0", "Delete", "Có ≥1 conclusion → 400",
    pre="CASE-001 có 1 conclusion", steps="DELETE",
    ui="'... có 1 kết luận điều tra'", api="400", side="-", sev="High")

add("RED", "P0", "Delete", "Có ≥1 document → 400",
    pre="CASE-001 có 3 documents", steps="DELETE",
    ui="'... 3 tài liệu đính kèm'", api="400", side="-", sev="High")

add("RED", "P0", "Delete", "Có ≥1 linkedIncident → 400",
    pre="CASE-001 link với 1 Incident",
    steps="DELETE", ui="'... 1 vụ việc liên kết'", api="400", side="-", sev="High")

add("RED", "P0", "Delete", "User không phải creator + không phải ADMIN → 403",
    pre="CASE-001 createdById=dieuTra1, login bằng dieuTra2",
    steps="DELETE", ui="'Chỉ người tạo vụ án hoặc quản trị viên mới được xóa.'",
    api="403 ForbiddenException", side="-", sev="Critical")

add("RED", "P0", "Delete", "createdById=NULL (legacy data) + user không ADMIN → 403 message riêng",
    pre="CASE-LEGACY createdById=NULL",
    steps="Login dieuTra1, DELETE", ui="'Vụ án không có thông tin người tạo (dữ liệu cũ). Chỉ quản trị viên mới được xóa.'",
    api="403", side="-", sev="High")

add("GREEN", "P0", "Delete", "ADMIN xóa được Case của bất kỳ ai trong window",
    pre="Login admin@, CASE-X createdById=dieuTra1",
    steps="DELETE reason='ADMIN cleanup test data'",
    data="-", ui="Success", api="200", side="Soft-deleted + Audit", sev="High")

add("RED", "P0", "Delete", "Quá window (THOI_HAN_XOA_VU_AN=72h default) + không ADMIN → 400",
    pre="CASE-OLD createdAt='2026-05-19' (>72h trước), createdById=dieuTra1",
    steps="Login dieuTra1, DELETE",
    data="-", ui="'Đã quá 72 giờ kể từ khi tạo vụ án. Chỉ quản trị viên mới xóa được.'",
    api="400", side="-", sev="High")

add("GREEN", "P0", "Delete", "ADMIN có thể xóa Case quá 72h window",
    pre="CASE-OLD >72h", steps="Login admin@, DELETE",
    data="reason='ADMIN xóa sau window'", ui="Success", api="200",
    side="Bypass window check (isAdmin branch)", sev="High")

add("RED", "P0", "Delete", "Race condition: status đổi trong lúc DELETE → P2025 catch → 400 friendly",
    steps="DELETE while another user updates status TIEP_NHAN→DANG_XAC_MINH",
    data="-", ui="'Vụ án đã đổi trạng thái trong lúc thực hiện. Vui lòng tải lại danh sách.'",
    api="400 (P2025 catch)", side="Atomic status guard fired", sev="High",
    notes="Where: id, status=TIEP_NHAN, deletedAt=null")

add("RED", "P0", "Delete", "TOCTOU: subject vừa được insert giữa initial check và transaction → 400 trong tx",
    steps="Initial check pass (subjects=0), insert subject, transaction re-check (subjects=1)",
    data="-", ui="'Không thể xóa: vụ án có 1 đối tượng (vừa được thêm). Tải lại danh sách.'",
    api="400 trong transaction", side="Atomic — không orphan delete", sev="Critical",
    notes="TOCTOU fix per codex P1")

add("GREEN", "P0", "DeletePreflight", "GET /cases/:id/delete-preflight trả canDelete=true cho TIEP_NHAN + không blocker",
    pre="CASE-001 TIEP_NHAN, không sub-resource",
    steps="GET /cases/CASE-001/delete-preflight",
    data="-", ui="Modal show 'Có thể xóa', nút 'Xóa' enable",
    api="200, {canDelete:true, status:'TIEP_NHAN', blockers:{subjects:0,lawyers:0,...}, reasonsIfBlocked:[]}",
    side="-", sev="High")

add("RED", "P0", "DeletePreflight", "Preflight Case status=DA_KET_LUAN trả canDelete=false + reason",
    pre="CASE-003 status=DA_KET_LUAN",
    steps="GET preflight", data="-",
    ui="Modal hiện 'Không thể xóa', list reasons",
    api="canDelete=false, reasonsIfBlocked includes 'Trạng thái hiện tại không cho phép xóa (chỉ Tiếp nhận). Hiện: Đã kết luận.'",
    side="-", sev="High")

add("RED", "P0", "DeletePreflight", "Preflight Case có 2 subjects + 1 document → reasons detailed",
    steps="GET preflight",
    data="-", ui="2 reasons displayed", api="reasonsIfBlocked includes both",
    side="-", sev="Medium")

add("RED", "P0", "DeletePreflight", "Preflight Case ngoài scope → 403 (checkRecordInScope)",
    pre="Login wardOfficer-Q1, CASE-Q3", steps="GET preflight",
    data="-", ui="-", api="403", side="-", sev="High")

# Restore
add("GREEN", "P0", "Restore", "ADMIN khôi phục Case đã soft-deleted",
    pre="CASE-DEL deletedAt set, login admin@",
    steps="POST /cases/CASE-DEL/restore body {reason:'Sai sót xóa nhầm'}",
    data="reason='Sai sót xóa nhầm cần khôi phục lại'",
    ui="Toast 'Khôi phục vụ án thành công'",
    api="200 message", side="1. cases.deletedAt=NULL\n2. Audit CASE_RESTORED metadata.reason + hoursAfterDeletion",
    sev="Critical")

add("RED", "P0", "Restore", "Non-ADMIN gọi restore → 403 PermissionsGuard (action=restore)",
    pre="Login dieuTra1@", steps="POST /cases/X/restore",
    data="reason='try'", ui="403", api="403 PermissionsGuard ('restore' permission)", side="-", sev="Critical")

add("RED", "P0", "Restore", "Restore Case chưa từng bị xóa (deletedAt=null) → 404",
    pre="CASE-ACTIVE deletedAt=null",
    steps="POST /cases/CASE-ACTIVE/restore", data="reason='try restore'",
    ui="'Vụ án không tồn tại hoặc chưa bị xóa'", api="404", side="-", sev="High")

add("RED", "P0", "Restore", "Race: 2 ADMIN restore cùng case → 1 ConflictException friendly",
    steps="Đồng thời ADMIN-A và ADMIN-B gọi restore",
    data="-", ui="1 success, 1 'Vụ án đã được khôi phục bởi quản trị viên khác. Tải lại danh sách.'",
    api="1×200 + 1×400 (P2025 catch)", side="Chỉ 1 audit log", sev="High")

add("RED", "P1", "Restore", "Reason rỗng → 400 DTO validation",
    steps="POST restore reason=''", data="reason=''",
    ui="Error", api="400", side="-", sev="Medium")

add("GREEN", "P0", "ListDeleted", "ADMIN GET /cases/admin/deleted trả paginated deleted cases với deleteAudit",
    pre="DB có 5 case deleted", steps="Login admin@, GET /cases/admin/deleted",
    data="-", ui="Bảng danh sách xóa, mỗi row show người xóa + lý do",
    api="200, data[].deleteAudit{userId, metadata:{reason, ...}}",
    side="-", sev="High")

add("RED", "P0", "ListDeleted", "Non-ADMIN gọi /cases/admin/deleted → 403",
    pre="dieuTra1", steps="GET /cases/admin/deleted",
    data="-", ui="-", api="403 PermissionsGuard (restore action gate)", side="-", sev="Critical")


# ============================================================
# MODULE 5: ASSIGN (dispatcher) (16 TC)
# ============================================================
add("GREEN", "P0", "Assign", "Dispatcher phân công Case sang Team-Q2 + investigator của team",
    pre="Login dispatcher@, CASE-001 assignedTeamId=Team-Q1, dieuTra-Q2 thuộc Team-Q2",
    steps="PATCH /cases/CASE-001/assign {assignedTeamId:'Team-Q2', investigatorId:'<dieuTra-Q2>'}",
    data="assignedTeamId='Team-Q2', investigatorId='<dieuTra-Q2.id>'",
    ui="Toast 'Phân công vụ án thành công', detail show team mới",
    api="200", side="1. cases.assignedTeamId='Team-Q2'\n2. Audit CASE_ASSIGNED metadata.fromTeamId, toTeamId, fromInvestigatorId, toInvestigatorId",
    sev="Critical")

add("RED", "P0", "Assign", "Non-dispatcher gọi assign → 403 DispatchGuard",
    pre="Login dieuTra1@ (canDispatch=false)",
    steps="PATCH /cases/CASE-001/assign", data="-",
    ui="403", api="403 DispatchGuard", side="-", sev="Critical")

add("RED", "P0", "Assign", "Case ngoài scope của dispatcher (nếu dispatcher có scope giới hạn) → ?",
    steps="Dispatcher scope=ward, assign cross-ward",
    data="-", ui="-", api="Hiện DispatchGuard chỉ check role không check scope",
    side="-", sev="High", notes="Gap potential: dispatcher có thể assign vượt scope của họ")

add("RED", "P0", "Assign", "assignedTeamId team đã isActive=false → 400 'Tổ điều tra không tồn tại hoặc đã ngừng hoạt động'",
    pre="Team-INACTIVE isActive=false",
    steps="PATCH assign assignedTeamId='Team-INACTIVE'",
    data="assignedTeamId='Team-INACTIVE'",
    ui="Toast lỗi", api="400 BadRequestException", side="-", sev="High")

add("RED", "P0", "Assign", "investigatorId không thuộc team được chỉ định → 400 'Điều tra viên không thuộc tổ'",
    pre="dieuTra-Q1 chỉ thuộc Team-Q1",
    steps="PATCH assign assignedTeamId='Team-Q2', investigatorId='<dieuTra-Q1>'",
    data="-", ui="-", api="400 'Điều tra viên không thuộc tổ được chỉ định'",
    side="-", sev="High", notes="UserTeam join check")

add("GREEN", "P1", "Assign", "investigatorId=null khi assign (chỉ chuyển team, chưa giao cho ĐTV cụ thể)",
    steps="PATCH assign assignedTeamId='Team-Q2', investigatorId=null",
    data="investigatorId=null", ui="-", api="200, data.investigatorId=null", side="-", sev="High")

add("RED", "P0", "Assign", "Case không tồn tại → 404",
    steps="PATCH /cases/NOT_EXIST/assign", data="-", ui="-", api="404", side="-", sev="High")

add("RED", "P0", "Assign", "Case đã soft-deleted → 404",
    pre="CASE-DEL", steps="PATCH assign", data="-", ui="-", api="404", side="-", sev="High")

add("RED", "P0", "Assign", "expectedUpdatedAt mismatch → 409",
    steps="PATCH assign với expectedUpdatedAt cũ", data="expectedUpdatedAt cũ",
    ui="Toast 'Vụ án đã được chỉnh sửa bởi người dùng khác'", api="409", side="-", sev="High")

add("GREEN", "P0", "Assign", "Escalation: ward team → non-ward team → emit CASE_ESCALATED_FROM_WARD audit",
    pre="CASE-001 assignedTeam=Team-WARD-01 (wardId set)",
    steps="PATCH assign assignedTeamId='Team-PC02-CENTRAL' (wardId=null)",
    data="-", ui="-",
    api="200",
    side="1. Audit CASE_ASSIGNED\n2. Audit CASE_ESCALATED_FROM_WARD với metadata.oldWardId, oldWardName, newTeamId",
    sev="High", notes="v0.35a")

add("GREEN", "P1", "Assign", "Re-assign cùng team (no-op assignedTeamId không đổi) → audit không emit escalation",
    pre="CASE-001 Team-Q1", steps="PATCH assign assignedTeamId='Team-Q1', investigatorId='<other>'",
    data="-", ui="-", api="200", side="CASE_ASSIGNED có, ESCALATED_FROM_WARD KHÔNG", sev="Medium")

add("GREEN", "P1", "Assign", "Non-ward team → ward team (de-escalation) — audit không emit (chỉ from-ward)",
    pre="CASE-001 Team-PC02-CENTRAL (wardId=null)",
    steps="PATCH assign Team-WARD-01", data="-", ui="-",
    api="200", side="CASE_ASSIGNED có, không ESCALATED_FROM_WARD (logic chỉ wardId→null)",
    sev="Medium")

add("RED", "P1", "Assign", "assignedTeamId rỗng '' → 400",
    steps="PATCH assignedTeamId=''", data="assignedTeamId=''", ui="-", api="400", side="-", sev="Medium")

add("RED", "P1", "Assign", "Thiếu assignedTeamId → 400 DTO required",
    steps="PATCH /assign body={}", data="-", ui="-", api="400", side="-", sev="High")

add("GREEN", "P1", "Assign", "Dispatcher với expectedUpdatedAt KHỚP → success",
    steps="PATCH assign với expectedUpdatedAt match current",
    data="-", ui="-", api="200", side="updatedAt refreshed", sev="Medium")

add("RED", "P0", "Assign", "Non-dispatcher với JWT của dispatcher (token theft) → permission guard pass? — JWT check role thật",
    steps="Steal dispatcher's JWT, gọi từ user khác",
    data="-", ui="-", api="JWT decode trả role=dispatcher → guard pass (limitation)",
    side="-", sev="High", notes="Mitigate: JWT short expiry + IP binding (out of scope UAT)")


# ============================================================
# MODULE 6: EXPORT EXCEL (12 TC)
# ============================================================
add("GREEN", "P0", "Export", "GET /cases/export/ward trả file Excel với header BCA + 8 cột",
    pre="DB có 30 case",
    steps="GET /api/v1/cases/export/ward",
    data="-", ui="Browser download file 'VuAnPhuongXa_2026-05-23.xlsx'",
    api="200 Content-Type=spreadsheetml, Content-Disposition=attachment",
    side="1. File Excel valid, sheet 'Danh sách vụ án' header 'DANH SÁCH VỤ ÁN THEO PHƯỜNG/XÃ'\n2. Audit CASE_EXPORTED metadata.kind='ward', format='xlsx'",
    sev="High")

add("GREEN", "P0", "Export", "Export ward với fromDate + toDate trong period",
    steps="GET /cases/export/ward?fromDate=2026-05-01&toDate=2026-05-23",
    data="-", ui="Excel header 'Từ ngày 01/05/2026 đến ngày 23/05/2026'",
    api="200", side="Excel period row đúng format vi-VN", sev="Medium")

add("GREEN", "P0", "Export", "Export 'phân loại khác' với category filter",
    steps="GET /cases/export/other-classification?category=lừa đảo",
    data="category='lừa đảo'", ui="Download file",
    api="200, data filter crime contains 'lừa đảo' (insensitive)",
    side="-", sev="Medium")

add("RED", "P0", "Export", "Rate limit: gọi /export/ward 6 lần trong 60s → 429",
    steps="Gọi 6 lần liên tiếp trong 60s",
    data="-", ui="Lần 6: '429 Too Many Requests'",
    api="6th call returns 429 (Throttle 5 req/60s)",
    side="-", sev="High", notes="@Throttle({default:{ttl:60000, limit:5}})")

add("RED", "P0", "Export", "Export với scope filter — ward officer chỉ thấy case của ward mình",
    pre="Login wardOfficer-Q1",
    steps="GET /cases/export/ward (không param)",
    data="-", ui="Excel chỉ chứa case của Team-WARD-Q1",
    api="200, records filtered by scope", side="-", sev="Critical")

add("RED", "P0", "Export", "Dispatcher xem tất cả case khi export",
    steps="Login dispatcher@, GET export",
    data="-", ui="Excel có cả case của Team khác", api="200 not filtered",
    side="-", sev="High")

add("GREEN", "P1", "Export", "Export với take=500 limit cứng (không trả >500 row)",
    pre="DB có 1000 case",
    steps="GET export", data="-",
    ui="Excel max 500 row", api="findMany take:500", side="-", sev="Medium",
    notes="Limit cứng để tránh memory blow up")

add("RED", "P0", "Export", "Permission: user role VIEWER không có 'read Case' → 403",
    pre="Login viewer (no read permission)", steps="GET export",
    data="-", ui="-", api="403 PermissionsGuard", side="-", sev="High")

add("RED", "P0", "Export", "JWT thiếu → 401",
    steps="GET export không Authorization",
    data="-", ui="-", api="401", side="-", sev="Critical")

add("GREEN", "P1", "Export", "Export ward không có data → vẫn trả Excel với header + empty body + footer",
    steps="GET export filter range không match record nào",
    data="fromDate=2030-01-01&toDate=2030-01-02", ui="Empty Excel",
    api="200 file valid", side="-", sev="Medium")

add("RED", "P1", "Export", "Server crash giữa export (write fail) → response 500 JSON nếu chưa send header",
    steps="Mock workbook.xlsx.write throw",
    data="-", ui="Toast 'Export failed'",
    api="500 {error:'Export failed'}", side="-", sev="High",
    notes="Best-effort fallback")

add("GREEN", "P1", "Export", "Audit CASE_EXPORTED capture filters đầy đủ",
    steps="GET /cases/export/ward?unitId=Q1&fromDate=...",
    data="-", ui="-", api="-",
    side="Audit log metadata={format:'xlsx', kind:'ward', filters:{unitId:'Q1', fromDate, toDate}}",
    sev="High", notes="Sprint 2 S2.1 audit PII bulk leak")


# ============================================================
# MODULE 7: STATUS HISTORY (6 TC)
# ============================================================
add("GREEN", "P0", "History", "GET /cases/:id/status-history trả list sorted asc changedAt",
    pre="CASE-001 có 3 entries: TIEP_NHAN→DANG_XAC_MINH→DANG_DIEU_TRA",
    steps="GET /cases/CASE-001/status-history",
    data="-", ui="Tab 'Lịch sử' show 3 entries chronological",
    api="200, data=[{fromStatus, toStatus, changedAt, changedBy:{firstName,lastName,username}}, ...]",
    side="-", sev="High")

add("GREEN", "P1", "History", "Case không có status change → empty array",
    pre="CASE-NEW chưa update status",
    steps="GET /cases/CASE-NEW/status-history",
    data="-", ui="Tab show 'Chưa có lịch sử'", api="200 data=[]",
    side="-", sev="Medium")

add("RED", "P0", "History", "GET history của Case không tồn tại → 200 với data=[] (no 404 hiện tại)",
    steps="GET /cases/NOT_EXIST/status-history",
    data="-", ui="-", api="200 data=[]",
    side="-", sev="Medium", notes="Gap: nên 404 — hiện không check Case tồn tại")

add("GREEN", "P1", "History", "changedBy=null khi changedById=null (audit cũ chưa có user)",
    pre="Entry legacy changedById=null",
    steps="GET history", data="-", ui="Row hiện 'Hệ thống'",
    api="entry.changedBy=null", side="-", sev="Low")

add("RED", "P0", "History", "User ngoài scope GET history → ?",
    pre="Login wardOfficer-Q1, CASE-Q3",
    steps="GET /cases/CASE-Q3/status-history",
    data="-", ui="-", api="Hiện không enforce scope ở getStatusHistory — gap",
    side="-", sev="High", notes="Cần thêm checkRecordInScope")

add("GREEN", "P1", "History", "History entry có changedAt là datetime đầy đủ (ISO)",
    steps="GET history",
    data="-", ui="UI format DD/MM/YYYY HH:MM",
    api="data[].changedAt='2026-05-22T10:30:00.000Z'", side="-", sev="Low")


# ============================================================
# MODULE 8: TDC BACKFILL (5 TC)
# ============================================================
add("GREEN", "P0", "TdcBackfill", "PATCH /cases/:id/tdc-backfill update lyDoTamDinhChiVuAn",
    pre="CASE-OLD lyDoTamDinhChiVuAn=NULL (legacy)",
    steps="PATCH /cases/CASE-OLD/tdc-backfill {lyDoTamDinhChiVuAn:'CHUA_XAC_DINH_BI_CAN'}",
    data="lyDoTamDinhChiVuAn='CHUA_XAC_DINH_BI_CAN'",
    ui="Toast success, banner backfill ẩn",
    api="200", side="cases.lyDoTamDinhChiVuAn updated", sev="High")

add("RED", "P0", "TdcBackfill", "PATCH với Case không tồn tại → 404 'Case not found'",
    steps="PATCH /cases/NOT_EXIST/tdc-backfill",
    data="-", ui="-", api="404", side="-", sev="High")

add("RED", "P1", "TdcBackfill", "PATCH lyDoTamDinhChiVuAn='INVALID' → 400/500 (validation cast)",
    steps="PATCH lyDoTamDinhChiVuAn='INVALID'",
    data="-", ui="-", api="500 do Prisma enum constraint (no DTO validation)",
    side="-", sev="Medium", notes="Gap: tdcBackfill DTO không validate enum")

add("RED", "P0", "TdcBackfill", "User không có write permission → 403",
    pre="Login viewer", steps="PATCH tdc-backfill",
    data="-", ui="-", api="403 PermissionsGuard write/Case", side="-", sev="High")

add("GREEN", "P1", "TdcBackfill", "Banner TdcBackfillBanner ẩn sau khi backfill thành công",
    steps="UI flow: thấy banner, click 'Backfill', nhập lý do, submit",
    data="-", ui="Banner disappear", api="Reload Case detail", side="-", sev="Medium")


# ============================================================
# MODULE 9: SECURITY OWASP TOP 10 (35 TC)
# ============================================================
# A01 Broken Access Control
add("SECURITY", "P0", "A01", "IDOR: User A trực tiếp GET /cases/<id-của-B> (URL guessing) → 403",
    steps="Login userA, GET /cases/<id-Case-của-userB-khác-team>",
    data="-", ui="-", api="403 ForbiddenException", side="-", sev="Critical")

add("SECURITY", "P0", "A01", "Horizontal privilege escalation: dieuTra-Q1 sửa Case-Q3 → 403",
    steps="PUT /cases/CASE-Q3", data="-", ui="-",
    api="403 checkWriteScope", side="-", sev="Critical")

add("SECURITY", "P0", "A01", "Vertical: VIEWER role thử POST /cases → 403",
    steps="VIEWER POST", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY", "P0", "A01", "DELETE Case của user khác (creator check) → 403",
    pre="CASE createdById=A, login B",
    steps="DELETE", data="reason='...'", ui="-", api="403", side="-", sev="Critical")

add("SECURITY", "P0", "A01", "Non-ADMIN restore → 403",
    steps="dieuTra1 POST restore", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY", "P0", "A01", "GET /cases/admin/deleted với non-ADMIN → 403",
    steps="dieuTra1 GET admin/deleted", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY", "P0", "A01", "Non-dispatcher PATCH /assign → 403 DispatchGuard",
    steps="dieuTra1 PATCH /assign", data="-", ui="-", api="403", side="-", sev="Critical")

# A02 Cryptographic Failures
add("SECURITY", "P0", "A02", "JWT là HS256 với secret strong (≥32 chars) — không yếu",
    steps="Decode JWT, check alg=HS256, secret length",
    data="-", ui="-", api="JWT verify OK, không alg=none",
    side="-", sev="Critical", notes="ASVS 6.2.3")

add("SECURITY", "P0", "A02", "API chạy trên HTTPS (production) — HTTP redirect 301",
    steps="curl http://171.244.40.245/api/v1/cases",
    data="-", ui="-", api="301 redirect to https",
    side="HSTS header strict-transport-security", sev="Critical",
    notes="Production deploy yêu cầu domain + cert")

# A03 Injection
add("SECURITY", "P0", "A03", "SQLi qua search param: ?search=' OR 1=1-- → vẫn an toàn",
    steps="GET /cases?search=' OR 1=1--",
    data="search=\"' OR 1=1--\"",
    ui="Empty result (Prisma parametrized)", api="200 data=[] (no all-records leak)",
    side="-", sev="Critical", notes="Prisma uses parameterized queries")

add("SECURITY", "P0", "A03", "SQLi qua sortBy: ?sortBy=name; DROP TABLE cases-- → whitelist filter",
    steps="GET /cases?sortBy=name; DROP TABLE cases--",
    data="sortBy='evil'", ui="-",
    api="200 (whitelist allowedSortFields fallback createdAt)", side="Table không bị drop",
    sev="Critical")

add("SECURITY", "P0", "A03", "XSS reflected: name=<script>alert(1)</script> → React escape khi render",
    steps="POST name='<script>alert(1)</script>', xem detail",
    data="name='<script>alert(1)</script>'",
    ui="Tên hiển thị literal text, KHÔNG popup alert",
    api="201, data.name lưu nguyên (React handles escape ở render)",
    side="DB chứa raw — frontend phải escape",
    sev="Critical")

add("SECURITY", "P0", "A03", "XSS stored: crime=<img src=x onerror=alert(1)> render detail → escape",
    steps="POST crime với XSS payload",
    data="crime='<img src=x onerror=alert(1)>'",
    ui="Hiển thị literal text", api="data.crime save raw",
    side="React-safe render", sev="Critical")

add("SECURITY", "P0", "A03", "XSS DOM: search query có script trong URL → no eval",
    steps="GET /cases?search=<script>", data="-",
    ui="URL bar có script nhưng KHÔNG eval", api="200",
    side="-", sev="High")

add("SECURITY", "P0", "A03", "JSON injection vào metadata: metadata={__proto__:{isAdmin:true}}",
    steps="POST metadata với prototype pollution",
    data="metadata={__proto__:{isAdmin:true}}", ui="-",
    api="201 nhưng object không pollute global",
    side="Object frozen / JSON parse safe", sev="High",
    notes="Node.js modern JSON.parse safe")

# A04 Insecure Design
add("SECURITY", "P0", "A04", "Export rate limit ngăn data exfiltration",
    steps="6 export calls/60s", data="-", ui="-",
    api="6th = 429", side="Audit CASE_EXPORTED log all attempts",
    sev="High", notes="A04 - rate-limit hidden")

add("SECURITY", "P0", "A04", "Soft delete với reason mandatory ngăn data lost without trace",
    steps="DELETE", data="-", ui="-",
    api="reason ≥10 chars enforced", side="Audit CASE_DELETED ghi reason",
    sev="High")

add("SECURITY", "P0", "A04", "Restore window check (legacy NULL createdById → ADMIN-only)",
    steps="Try delete legacy", data="-", ui="-",
    api="403 cho non-ADMIN", side="-", sev="High")

# A05 Security Misconfiguration
add("SECURITY", "P0", "A05", "CORS header restrict origin (không *)",
    steps="curl -H 'Origin: https://evil.com' GET /cases",
    data="-", ui="-", api="No Access-Control-Allow-Origin: * (chỉ trusted origins)",
    side="-", sev="Critical")

add("SECURITY", "P0", "A05", "Response không có sensitive header X-Powered-By, Server version",
    steps="curl -I /cases", data="-", ui="-",
    api="No X-Powered-By header", side="-", sev="Medium")

add("SECURITY", "P0", "A05", "Security headers: HSTS, X-Content-Type-Options, X-Frame-Options",
    steps="Inspect response headers",
    data="-", ui="-", api="Strict-Transport-Security: max-age=...; X-Content-Type-Options: nosniff; X-Frame-Options: DENY",
    side="-", sev="High")

# A07 Auth Failures
add("SECURITY", "P0", "A07", "JWT hết hạn → 401, không refresh tự động infinite",
    steps="Gửi JWT exp=past", data="-", ui="Redirect login",
    api="401", side="-", sev="Critical")

add("SECURITY", "P0", "A07", "JWT signature tamper → 401",
    steps="Tamper signature part", data="-", ui="-", api="401", side="-", sev="Critical")

add("SECURITY", "P0", "A07", "JWT của user đã deactivated/locked → 401 hoặc 403",
    steps="User U001 disabled, gọi với JWT cũ",
    data="-", ui="-", api="401/403 (cần check user status mỗi request)",
    side="-", sev="High", notes="Cần verify backend check user.isActive")

# A08 Software & Data Integrity
add("SECURITY", "P0", "A08", "Optimistic lock prevent lost update qua expectedUpdatedAt",
    steps="2 user update cùng case", data="-", ui="-",
    api="1×200 + 1×409", side="No data lost", sev="Critical")

add("SECURITY", "P0", "A08", "FROM_PETITION race condition không double-link Petition",
    steps="2 user FROM_PETITION cùng PET",
    data="-", ui="-", api="1×201 + 1×409", side="Petition.linkedCaseId chỉ 1 giá trị", sev="Critical")

# A09 Logging Failures
add("SECURITY", "P0", "A09", "Audit log CASE_DELETED ghi đầy đủ user, IP, UA, reason",
    steps="DELETE", data="-", ui="-", api="-",
    side="audit_logs row {userId, action:'CASE_DELETED', subjectId, metadata:{reason, ...}, ipAddress, userAgent, createdAt}",
    sev="High")

add("SECURITY", "P0", "A09", "Audit không lưu sensitive data (password, JWT) trong metadata",
    steps="Inspect audit row content",
    data="-", ui="-", api="-", side="Metadata không có password/token field", sev="High")

add("SECURITY", "P0", "A09", "Audit retention ≥ 90 ngày (BLTTHS compliance)",
    steps="Check audit_logs oldest row", data="-", ui="-",
    api="-", side="Retention policy ≥90d", sev="Medium")

# A10 SSRF (out of scope nếu không fetch URL)
add("SECURITY", "P1", "A10", "Cases không fetch URL từ user input — N/A SSRF",
    steps="Search code 'fetch(' với user input",
    data="-", ui="-", api="-", side="-", sev="Low",
    notes="N/A — Cases không có flow fetch URL")

# Rate limiting
add("SECURITY", "P0", "RateLimit", "POST /cases brute force 100 req/s → throttle global",
    steps="100 req/s POST",
    data="-", ui="-", api="? — global throttle (need verify config)",
    side="-", sev="High", notes="Gap nếu chưa có global throttle cho mutation")

# CSRF
add("SECURITY", "P0", "CSRF", "Mutation POST/PUT/DELETE từ origin lạ không có cookie + custom header → reject CORS",
    steps="curl POST /cases from evil.com",
    data="-", ui="-", api="CORS reject preflight", side="-", sev="High")

# Mass assignment
add("SECURITY", "P0", "MassAssign", "POST kèm field 'createdById':'other-user' bị whitelist reject",
    steps="POST {name:..., createdById:'evil-id'}",
    data="createdById='evil-id'", ui="-",
    api="400 forbidNonWhitelisted (createdById không trong DTO)",
    side="-", sev="Critical")

add("SECURITY", "P0", "MassAssign", "POST kèm 'id':'fake-id' không cho phép override",
    steps="POST {id:'evil-id', name:...}",
    data="id='evil-id'", ui="-", api="400 hoặc id auto-generated",
    side="data.id = cuid generated, không phải 'evil-id'", sev="Critical")

add("SECURITY", "P0", "MassAssign", "POST kèm 'deletedAt':null override không cho phép",
    steps="POST {deletedAt:'2030-01-01', ...}", data="deletedAt='2030-01-01'",
    ui="-", api="400 forbidNonWhitelisted", side="-", sev="High")


# ============================================================
# MODULE 10: A11Y (WCAG 2.1 AA) (17 TC)
# ============================================================
add("A11Y", "P1", "Keyboard", "Tab qua đủ field trong CaseFormPage không bị trap",
    steps="Tab từ name → crime → status → ... cuối cùng đến nút Lưu",
    data="-", ui="Focus visible trên mỗi field, không skip", api="-", side="-", sev="Medium")

add("A11Y", "P1", "Keyboard", "Enter submit form khi focus ở input",
    steps="Focus name, type, Enter", data="-",
    ui="Form submit", api="POST trigger", side="-", sev="Medium")

add("A11Y", "P1", "Keyboard", "Esc đóng modal SuspensionModal",
    steps="Mở modal TĐC, nhấn Esc", data="-",
    ui="Modal close", api="-", side="-", sev="Medium")

add("A11Y", "P1", "Screenreader", "Input có aria-label hoặc label[for] gắn id",
    steps="Inspect <input id=name> có <label for=name>", data="-",
    ui="-", api="-", side="-", sev="High",
    notes="WCAG 1.3.1 Info & Relationships")

add("A11Y", "P1", "Screenreader", "Status badge có aria-label='Trạng thái Đang điều tra'",
    steps="VoiceOver/NVDA đọc badge",
    data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y", "P1", "Screenreader", "Error message gắn aria-describedby với input",
    steps="Nhập invalid name, inspect aria-describedby",
    data="-", ui="<input aria-describedby='name-error'> + <p id='name-error'>",
    api="-", side="-", sev="High")

add("A11Y", "P1", "Contrast", "Text trên background đạt 4.5:1 (WCAG AA)",
    steps="Inspect color of body text vs background",
    data="-", ui="-", api="-", side="-", sev="High",
    notes="Use axe-core tool")

add("A11Y", "P1", "Contrast", "Badge status có contrast đủ (text white trên red ≥ 4.5)",
    steps="Inspect status badge", data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y", "P1", "Focus", "Focus ring rõ ràng trên nút Lưu (outline 2px)",
    steps="Tab tới nút Lưu",
    data="-", ui="Focus visible với outline rõ", api="-", side="-", sev="High")

add("A11Y", "P2", "Zoom", "Zoom 200% không vỡ layout CaseListPage",
    steps="Chrome zoom 200%",
    data="-", ui="Table responsive, không overflow", api="-", side="-", sev="Medium",
    notes="WCAG 1.4.4 Resize Text")

add("A11Y", "P2", "Motion", "prefers-reduced-motion respect — animation tắt",
    steps="OS setting reduce motion",
    data="-", ui="Toast transition off", api="-", side="-", sev="Low",
    notes="WCAG 2.3.3")

add("A11Y", "P1", "Form", "Form error message tiếng Việt, không dùng chỉ màu để biểu thị error",
    steps="Submit invalid", data="-",
    ui="Border đỏ + icon + text 'Tên vụ án bắt buộc'", api="-", side="-", sev="High",
    notes="WCAG 1.4.1 Use of Color")

add("A11Y", "P1", "Heading", "Page có h1, h2 hierarchical",
    steps="Inspect heading order",
    data="-", ui="-", api="-", side="-", sev="Medium",
    notes="WCAG 2.4.6")

add("A11Y", "P1", "Image", "Icon button có aria-label (vd 'Xóa vụ án')",
    steps="Inspect <button aria-label='Xóa vụ án'>",
    data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y", "P2", "Lang", "<html lang='vi'> để screen reader phát âm tiếng Việt",
    steps="Inspect <html>", data="-", ui="-", api="-", side="-", sev="Low")

add("A11Y", "P1", "TableSemantics", "Bảng danh sách dùng <table><th scope='col'>",
    steps="Inspect CaseListPage table",
    data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y", "P1", "ModalFocus", "Modal mở thì focus trap inside; close trả focus về trigger",
    steps="Click 'Xóa', modal mở, Tab vòng quanh modal",
    data="-", ui="Focus không escape modal", api="-", side="-", sev="High")


# ============================================================
# MODULE 11: COMPAT (17 TC)
# ============================================================
add("COMPAT", "P1", "Browser", "Chrome 126 latest — toàn bộ flow OK",
    steps="Test Chrome 126", data="-", ui="-", api="-", side="-", sev="High")

add("COMPAT", "P1", "Browser", "Chrome 125 (latest-1) — backward compat",
    steps="Chrome 125", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Browser", "Firefox 127 latest",
    steps="Firefox 127", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Browser", "Safari 17 latest (macOS)",
    steps="Safari 17", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Browser", "Edge 126",
    steps="Edge 126", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P2", "Browser", "Chrome 100 (legacy older) — graceful degradation",
    steps="Chrome 100", data="-", ui="-", api="-", side="-", sev="Low")

add("COMPAT", "P2", "Browser", "IE11 — KHÔNG support (banner warning)",
    steps="IE11", data="-", ui="Banner 'Trình duyệt không hỗ trợ'", api="-", side="-", sev="Low")

add("COMPAT", "P1", "Mobile", "iOS Safari 17 trên iPhone 14 — list page responsive",
    steps="iPhone 14", data="-", ui="Layout responsive", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Mobile", "Android Chrome 126 trên Pixel 7",
    steps="Pixel 7", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Resolution", "1920x1080 desktop — layout standard",
    steps="Chrome 1920x1080", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Resolution", "1366x768 laptop common — không scroll horizontal",
    steps="Resize 1366x768", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Resolution", "768x1024 tablet portrait",
    steps="iPad portrait", data="-", ui="Responsive", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Resolution", "375x667 iPhone SE",
    steps="iPhone SE", data="-", ui="Compact layout", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "Network", "3G slow — page load < 5s và loading indicator",
    steps="DevTools throttle 3G slow",
    data="-", ui="Loading spinner xuất hiện", api="Timeout 30s server-side",
    side="-", sev="Medium")

add("COMPAT", "P2", "Network", "Offline — toast 'Mất kết nối', retry button",
    steps="DevTools offline",
    data="-", ui="Toast offline", api="Request fail with network error",
    side="-", sev="Low")

add("COMPAT", "P1", "OS", "Windows 11 + Chrome — OK",
    steps="Win 11 Chrome", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT", "P1", "OS", "macOS Sonoma + Safari — OK",
    steps="macOS Safari", data="-", ui="-", api="-", side="-", sev="Medium")


# ============================================================
# MODULE 12: PERFORMANCE (11 TC)
# ============================================================
add("PERFORMANCE", "P1", "List", "GET /cases?limit=20 response < 500ms với 10k row DB",
    pre="DB 10000 cases", steps="Time GET /cases?limit=20",
    data="-", ui="-", api="Response time p95 < 500ms",
    side="-", sev="Medium", notes="Indexed by createdAt, status, deletedAt")

add("PERFORMANCE", "P1", "Search", "GET /cases?search=trộm cắp < 1s với 10k row",
    steps="Time search",
    data="-", ui="-", api="p95 < 1s", side="-", sev="Medium",
    notes="Full-text search có thể cần tsvector index")

add("PERFORMANCE", "P1", "List", "Filter overdue=true + pagination < 800ms",
    steps="Time GET ?overdue=true&limit=50",
    data="-", ui="-", api="<800ms", side="-", sev="Medium")

add("PERFORMANCE", "P1", "Detail", "GET /cases/:id (include petitions + investigator) < 300ms",
    steps="Time GET /cases/X",
    data="-", ui="-", api="<300ms", side="-", sev="Medium")

add("PERFORMANCE", "P1", "Create", "POST /cases (FROM_PETITION transaction) < 600ms",
    steps="Time POST",
    data="-", ui="-", api="<600ms (gồm tx + audit)", side="-", sev="Medium")

add("PERFORMANCE", "P1", "Export", "Export 500 row Excel < 5s",
    steps="Time GET export với DB ≥500", data="-",
    ui="Download start < 5s", api="Stream response", side="-", sev="Medium")

add("PERFORMANCE", "P2", "Concurrent", "10 user đồng thời POST /cases — không deadlock",
    steps="10 parallel POST",
    data="-", ui="-", api="Tất cả 201, không Prisma deadlock", side="-", sev="Medium")

add("PERFORMANCE", "P2", "Concurrent", "50 user đồng thời GET list — không nghẽn",
    steps="50 parallel GET",
    data="-", ui="-", api="Tất cả 200 < 2s", side="-", sev="Low")

add("PERFORMANCE", "P1", "Pagination", "Deep pagination offset=5000 < 1s (with index)",
    steps="GET ?offset=5000&limit=20",
    data="-", ui="-", api="<1s", side="-", sev="Low",
    notes="Cursor pagination tốt hơn nếu nhiều")

add("PERFORMANCE", "P2", "Memory", "Export 500 row không OOM (workbook stream)",
    steps="Export, monitor heap",
    data="-", ui="-", api="-", side="Memory peak < 256MB", sev="Medium")

add("PERFORMANCE", "P1", "AuditWrite", "Audit log insert không block main response > 50ms",
    steps="POST /cases, profile audit insert",
    data="-", ui="-", api="-", side="Audit insert in tx, ≤50ms overhead", sev="Low")


# ============================================================
# MODULE 13: DATA / I18N (13 TC)
# ============================================================
add("DATA", "P1", "Unicode", "name có dấu tiếng Việt 'Vụ án Nguyễn Quỳnh Trâm'",
    steps="POST name='Vụ án Nguyễn Quỳnh Trâm'",
    data="name='Vụ án Nguyễn Quỳnh Trâm'", ui="Detail show đúng dấu",
    api="201", side="DB UTF-8 stored correct", sev="High")

add("DATA", "P1", "Unicode", "name có dấu tổ hợp (Unicode NFC vs NFD) — normalize",
    steps="POST name với 'ặ' NFD (2 codepoint) vs NFC (1 codepoint)",
    data="name='ặ' (NFD) vs name='ặ' (NFC)", ui="Hiển thị giống",
    api="201 both", side="Cần normalize NFC khi save (gap nếu thiếu)",
    sev="Medium", notes="Gap potential")

add("DATA", "P1", "Emoji", "name có emoji 'Vụ test 🎉' — 4-byte UTF-8",
    steps="POST name='Vụ test 🎉'",
    data="name='Vụ test 🎉'", ui="Hiển thị emoji",
    api="201", side="MySQL cần utf8mb4 — PostgreSQL OK", sev="Medium")

add("DATA", "P1", "Whitespace", "name='  Vụ ABC  ' leading/trailing trimmed",
    steps="POST '  Vụ ABC  '", data="name='  Vụ ABC  '",
    ui="Detail name='Vụ ABC'", api="201, data.name='Vụ ABC'",
    side="Transform trim apply", sev="Medium")

add("DATA", "P1", "Hidden", "name có zero-width space \\u200B → save raw nhưng có thể gây bug filter",
    steps="POST name='Vụ\\u200BABC'",
    data="name='Vụ​ABC'", ui="Hiển thị giống 'Vụ ABC'",
    api="201", side="Search 'Vụ ABC' không match (gap)", sev="Low")

add("DATA", "P1", "BOM", "name='\\uFEFFVụ' BOM character ở đầu",
    steps="POST", data="name='﻿Vụ'",
    ui="-", api="201 lưu nguyên (gap nếu cần strip)", side="-", sev="Low")

add("DATA", "P1", "HTML", "name='<b>Vụ</b>' tag HTML literal",
    steps="POST", data="name='<b>Vụ</b>'",
    ui="React escape → hiển thị '<b>Vụ</b>'", api="201",
    side="-", sev="Medium")

add("DATA", "P1", "Date", "ngayKhoiTo='2026-02-29' (năm 2026 không nhuận) → 400 hoặc 2026-03-01?",
    steps="POST ngayKhoiTo='2026-02-29'",
    data="ngayKhoiTo='2026-02-29'", ui="-",
    api="400 IsDateString strict hoặc auto-coerce — verify",
    side="-", sev="Medium", notes="Postgres date coerce 2026-03-01")

add("DATA", "P1", "Timezone", "ngayKhoiTo='2026-05-23T00:00:00+07:00' (GMT+7 Vietnam)",
    steps="POST ngayKhoiTo='2026-05-23T00:00:00+07:00'",
    data="-", ui="Detail show 23/05/2026",
    api="201, stored as UTC=2026-05-22T17:00:00Z",
    side="DB stored as UTC, frontend convert TZ", sev="Medium")

add("DATA", "P1", "Number", "subjectsCount=Number.MAX_SAFE_INTEGER → save hoặc 400",
    steps="POST subjectsCount=9007199254740991",
    data="-", ui="-", api="? — Int field PostgreSQL 32-bit hoặc bigint",
    side="-", sev="Low", notes="Cần check Prisma Int = int4")

add("DATA", "P1", "Encoding", "Multi-byte filename trong sourceDocumentNote",
    steps="POST sourceDocumentNote='Công văn số 123/CV-PC02 ngày 12/05/2026 — tiếng Việt'",
    data="-", ui="Detail OK", api="201", side="-", sev="Medium")

add("DATA", "P1", "SpecialChar", "name có '&', '<', '>', '\"', \"'\" — SQL escape",
    steps="POST name='Vụ A & B <test> \"quote\"'",
    data="-", ui="Hiển thị đúng", api="201", side="DB lưu raw, SQL safe (Prisma param)",
    sev="Medium")

add("DATA", "P1", "LongString", "metadata.note 5000 ký tự (JSONB không limit)",
    steps="POST metadata={note:'X'.repeat(5000)}",
    data="-", ui="-", api="201", side="JSONB stored", sev="Low")


# ============================================================
# MODULE 14: BOUNDARY (22 TC)
# ============================================================
add("BOUNDARY", "P0", "name", "name 1 ký tự 'A' (min) → pass",
    steps="POST name='A'", data="name='A' (length 1)",
    ui="-", api="201", side="-", sev="Medium")

add("BOUNDARY", "P0", "name", "name 500 ký tự (max) → pass",
    steps="POST name='X'.repeat(500)",
    data="length=500", ui="-", api="201", side="-", sev="Medium")

add("BOUNDARY", "P0", "name", "name 501 ký tự → 400",
    steps="POST", data="length=501", ui="-", api="400 MaxLength", side="-", sev="High")

add("BOUNDARY", "P0", "name", "name 499 ký tự → pass",
    steps="POST", data="length=499", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY", "P1", "crime", "crime 255 ký tự (max) → pass",
    steps="POST", data="length=255", ui="-", api="201", side="-", sev="Medium")

add("BOUNDARY", "P1", "crime", "crime 256 ký tự → 400",
    steps="POST", data="length=256", ui="-", api="400", side="-", sev="Medium")

add("BOUNDARY", "P1", "unit", "unit 255 ký tự → pass",
    steps="POST", data="length=255", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY", "P1", "unit", "unit 256 ký tự → 400",
    steps="POST", data="length=256", ui="-", api="400", side="-", sev="Low")

add("BOUNDARY", "P1", "reason", "Delete reason 10 ký tự (min) → pass",
    steps="DELETE reason='1234567890' (length 10)",
    data="length=10", ui="-", api="200", side="-", sev="Medium")

add("BOUNDARY", "P1", "reason", "Delete reason 9 ký tự → 400",
    steps="DELETE reason='123456789' (length 9)",
    data="length=9", ui="-", api="400 MinLength(10)", side="-", sev="Medium")

add("BOUNDARY", "P1", "reason", "Delete reason 500 ký tự (max) → pass",
    steps="DELETE", data="length=500", ui="-", api="200", side="-", sev="Medium")

add("BOUNDARY", "P1", "reason", "Delete reason 501 ký tự → 400",
    steps="DELETE", data="length=501", ui="-", api="400", side="-", sev="Medium")

add("BOUNDARY", "P1", "subC", "subjectsCount = 0 (min) → pass",
    steps="POST subjectsCount=0", data="0", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY", "P1", "subC", "subjectsCount = -1 → 400 @Min(0)",
    steps="POST subjectsCount=-1", data="-1", ui="-", api="400", side="-", sev="Medium")

add("BOUNDARY", "P1", "subC", "subjectsCount = 1 → pass",
    steps="POST subjectsCount=1", data="1", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY", "P1", "limit", "limit=1 (min) → pass",
    steps="GET ?limit=1", data="-", ui="1 row", api="200", side="-", sev="Low")

add("BOUNDARY", "P1", "limit", "limit=100 (max) → pass",
    steps="GET ?limit=100", data="-", ui="-", api="200 max 100", side="-", sev="Medium")

add("BOUNDARY", "P1", "limit", "limit=101 → 400",
    steps="GET ?limit=101", data="-", ui="-", api="400", side="-", sev="Medium")

add("BOUNDARY", "P1", "offset", "offset=0 (min) → pass",
    steps="GET ?offset=0", data="-", ui="-", api="200", side="-", sev="Low")

add("BOUNDARY", "P1", "offset", "offset=-1 → 400 @Min(0)",
    steps="GET ?offset=-1", data="-", ui="-", api="400", side="-", sev="Medium")

add("BOUNDARY", "P1", "srcDocNote", "sourceDocumentNote 1000 ký tự (max) → pass",
    steps="POST", data="length=1000", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY", "P1", "srcDocNote", "sourceDocumentNote 1001 → 400",
    steps="POST", data="length=1001", ui="-", api="400", side="-", sev="Medium")


# ============================================================
# MODULE 15: EP (Equivalence Partitioning) (10 TC)
# ============================================================
add("EP", "P1", "name-cls", "name class hợp lệ: chuỗi VN có dấu",
    steps="POST 'Vụ trộm cắp xe'", data="-", ui="-", api="201", side="-", sev="Low")

add("EP", "P1", "name-cls", "name class không hợp lệ: rỗng",
    steps="POST ''", data="-", ui="-", api="400", side="-", sev="Medium")

add("EP", "P1", "prov-cls", "Provenance class valid enum (DIRECT_DISCOVERY)",
    steps="POST DIRECT_DISCOVERY", data="-", ui="-", api="201", side="-", sev="Low")

add("EP", "P1", "prov-cls", "Provenance class invalid (string ngẫu nhiên)",
    steps="POST 'XXX'", data="-", ui="-", api="400", side="-", sev="Medium")

add("EP", "P1", "capDo-cls", "CapDoToiPham class IT_NGHIEM_TRONG",
    steps="POST IT_NGHIEM_TRONG", data="-", ui="-", api="201", side="-", sev="Low")

add("EP", "P1", "capDo-cls", "CapDoToiPham class NGHIEM_TRONG",
    steps="POST NGHIEM_TRONG", data="-", ui="-", api="201", side="-", sev="Low")

add("EP", "P1", "capDo-cls", "CapDoToiPham class RAT_NGHIEM_TRONG",
    steps="POST RAT_NGHIEM_TRONG", data="-", ui="-", api="201", side="-", sev="Low")

add("EP", "P1", "capDo-cls", "CapDoToiPham class DAC_BIET_NGHIEM_TRONG",
    steps="POST DAC_BIET_NGHIEM_TRONG", data="-", ui="-", api="201", side="-", sev="Low")

add("EP", "P1", "status-cls", "Status valid class TIEP_NHAN",
    steps="POST status=TIEP_NHAN", data="-", ui="-", api="201", side="-", sev="Low")

add("EP", "P1", "status-cls", "Status invalid class 'OPEN' (Anh)",
    steps="POST status='OPEN'", data="-", ui="-", api="400", side="-", sev="Medium")


# ============================================================
# MODULE 16: DECISION TABLE (14 TC)
# ============================================================
add("DECISION", "P0", "DataScope-C1", "ADMIN (dataScope=null) xem mọi Case",
    pre="admin@", steps="GET /cases/ANY",
    data="-", ui="200", api="200", side="-", sev="Critical",
    notes="Decision C1: dataScope=null bypass")

add("DECISION", "P0", "DataScope-C2", "Dispatcher (canDispatch=true) xem mọi Case",
    pre="dispatcher@", steps="GET /cases/ANY",
    data="-", ui="200", api="200", side="-", sev="Critical")

add("DECISION", "P0", "DataScope-C3", "Owner (investigatorId match userIds) xem Case mình",
    pre="dieuTra1 = investigator của CASE-001",
    steps="GET /cases/CASE-001", data="-", ui="200", api="200",
    side="-", sev="High", notes="ownerMatch")

add("DECISION", "P0", "DataScope-C4", "Same team (assignedTeamId in teamIds) xem Case đồng nghiệp",
    pre="dieuTra1 cùng Team-Q1 với CASE-002",
    steps="GET /cases/CASE-002", data="-", ui="200", api="200",
    side="-", sev="High", notes="teamMatch")

add("DECISION", "P0", "DataScope-C5", "Unassigned Case + user có team (teamIds.length>0)",
    pre="CASE-UA assignedTeamId=null, dieuTra1 thuộc Team-Q1",
    steps="GET /cases/CASE-UA",
    data="-", ui="200", api="200", side="-", sev="Medium",
    notes="unassignedMatch")

add("DECISION", "P0", "DataScope-C6", "User khác team + không owner → 403",
    pre="dieuTra1-Q1, CASE-Q3 thuộc Team-Q3",
    steps="GET /cases/CASE-Q3", data="-", ui="403", api="403",
    side="-", sev="Critical", notes="Default deny")

add("DECISION", "P0", "WriteScope-C1", "Owner write Case mình → success",
    pre="-", steps="PUT mình", data="-", ui="200", api="200", side="-", sev="High")

add("DECISION", "P0", "WriteScope-C2", "Same writableTeam write → success",
    pre="-", steps="PUT", data="-", ui="200", api="200", side="-", sev="High")

add("DECISION", "P0", "WriteScope-C3", "Different team write → 403",
    pre="-", steps="PUT", data="-", ui="403", api="403", side="-", sev="Critical")

add("DECISION", "P0", "Delete-Decision", "Decision matrix delete: TIEP_NHAN + creator + within 72h → success",
    pre="-", steps="DELETE", data="-", ui="200", api="200", side="-", sev="High")

add("DECISION", "P0", "Delete-Decision", "Decision: TIEP_NHAN + creator + >72h + non-ADMIN → 400",
    pre="-", steps="DELETE", data="-", ui="-", api="400", side="-", sev="High")

add("DECISION", "P0", "Delete-Decision", "Decision: TIEP_NHAN + non-creator + non-ADMIN → 403",
    pre="-", steps="DELETE", data="-", ui="-", api="403", side="-", sev="High")

add("DECISION", "P0", "Delete-Decision", "Decision: ≠TIEP_NHAN + ADMIN → 400 (status check first)",
    pre="-", steps="DELETE", data="-", ui="-", api="400 status check",
    side="-", sev="High", notes="Status check trước creator check")

add("DECISION", "P0", "Delete-Decision", "Decision: TIEP_NHAN + ADMIN + creator NULL + within window → success",
    pre="-", steps="DELETE", data="-", ui="200", api="200", side="-", sev="Medium")


# ============================================================
# MODULE 17: INTEGRATION (E2E) (8 TC)
# ============================================================
add("INTEGRATION", "P0", "E2E", "Flow: Petition → Khởi tố vụ án → Thêm subject → Update status → Kết luận",
    steps="1. Tạo Petition\n2. Khởi tố thành Case (FROM_PETITION)\n3. Thêm Subject\n4. Update status DA_XAC_MINH → DANG_DIEU_TRA\n5. Tạo Conclusion\n6. Update DA_KET_LUAN",
    data="full flow", ui="Mọi bước success",
    api="Mỗi POST/PUT 201/200",
    side="Petition.linkedCaseId set, Subject linked, History 3 entries, Conclusion created",
    sev="Critical")

add("INTEGRATION", "P0", "E2E", "Flow: Incident → khởi tố Case → Assign → Delete fail → Restore",
    steps="Create Incident → Case FROM_INCIDENT → Assign team → DELETE (fail vì có Incident link) → ADMIN restore",
    data="-", ui="Toast workflow", api="-",
    side="Audit trail đầy đủ", sev="High")

add("INTEGRATION", "P0", "E2E", "Bulk create Case + sequential STT trên Petition (DT-2026-NNNNN)",
    steps="Tạo 3 Petition liên tiếp, check stt",
    data="-", ui="STT increment",
    api="DT-2026-00001, DT-2026-00002, DT-2026-00003", side="generateStt no skip", sev="High")

add("INTEGRATION", "P1", "E2E", "Cross-feature: KPI dashboard reload khi Case mới capDoToiPham=DBNT tạo",
    steps="Tạo Case ĐBNT, reload KPI-4",
    data="capDoToiPham='DAC_BIET_NGHIEM_TRONG'",
    ui="KPI-4 count +1", api="-", side="-", sev="Medium")

add("INTEGRATION", "P1", "E2E", "Update Case sync Petition.petitionType",
    steps="PUT Case metadata.petitionType='TO_GIAC', verify Petition record",
    data="-", ui="-", api="-",
    side="Petition.petitionType updated (v0.37.2.5)", sev="High")

add("INTEGRATION", "P1", "E2E", "Assign Case ward → cross-ward → audit event chuỗi",
    steps="Assign WARD → CENTRAL → check audit log",
    data="-", ui="-", api="-",
    side="2 audit events: CASE_ASSIGNED + CASE_ESCALATED_FROM_WARD", sev="Medium")

add("INTEGRATION", "P1", "E2E", "Soft delete → list deleted → restore → list active",
    steps="DELETE → admin/deleted → restore → /cases",
    data="-", ui="Case round-trip", api="-", side="audit 2 events", sev="Medium")

add("INTEGRATION", "P1", "E2E", "Multi-user race: A update + B delete đồng thời",
    steps="2 user thao tác cùng case",
    data="-", ui="1 success, 1 P2025/409", api="-",
    side="Atomic guards work", sev="High")


# ============================================================
# MODULE 18: RECOVERY (6 TC)
# ============================================================
add("RECOVERY", "P1", "Cancel", "User đóng tab giữa form Create — KHÔNG tạo Case partial",
    steps="Mở form, nhập half, đóng tab",
    data="-", ui="-", api="-", side="DB không có row partial",
    sev="Medium")

add("RECOVERY", "P1", "Cancel", "User refresh giữa form Create — clear state hoặc preserve draft?",
    steps="Nhập form, F5",
    data="-", ui="Form clear (hoặc warning 'Mất dữ liệu')",
    api="-", side="-", sev="Low")

add("RECOVERY", "P1", "Network", "Mất mạng giữa POST /cases — frontend retry hoặc toast error",
    steps="DevTools offline → POST",
    data="-", ui="Toast 'Lỗi kết nối, thử lại'",
    api="Network error", side="No partial create", sev="High")

add("RECOVERY", "P1", "Server500", "Server 500 giữa POST — Case không tạo, audit không log",
    steps="Mock prisma.case.create throw",
    data="-", ui="Toast 'Lỗi máy chủ'",
    api="500", side="Atomic: no row, no audit (tx rollback)", sev="High")

add("RECOVERY", "P1", "Timeout", "Request timeout 30s + retry → idempotency?",
    steps="Slow network, POST retry",
    data="-", ui="-", api="-",
    side="Có thể double-create (gap) nếu không idempotency-key",
    sev="High", notes="Cần idempotency-key cho mutation")

add("RECOVERY", "P1", "PartialDelete", "Audit fail giữa DELETE tx → rollback delete",
    steps="Mock audit.log throw",
    data="-", ui="Toast 'Xóa thất bại'",
    api="500", side="cases.deletedAt KHÔNG set (tx rollback)",
    sev="Critical", notes="Atomic transaction guarantee")


# ============================================================
# MODULE 19: AUDIT (7 TC)
# ============================================================
add("AUDIT", "P0", "Log", "CASE_CREATED log có userId, action, subject='Case', subjectId, metadata, ipAddress, userAgent, createdAt",
    steps="POST /cases, query audit_logs",
    data="-", ui="-", api="-",
    side="Row đủ 7 field", sev="High")

add("AUDIT", "P0", "Log", "CASE_UPDATED audit có diff before/after (wrapUpdate)",
    steps="PUT /cases, query audit",
    data="-", ui="-", api="-",
    side="metadata.diff={field:{before, after}, ...}", sev="High")

add("AUDIT", "P0", "Log", "CASE_STATUS_CHANGED audit riêng entry với fromStatus/toStatus/changedAt",
    steps="PUT status change",
    data="-", ui="-", api="-",
    side="2 audit entries: CASE_UPDATED + CASE_STATUS_CHANGED", sev="High")

add("AUDIT", "P0", "Log", "CASE_DELETED có reason + hoursAfterCreation",
    steps="DELETE",
    data="-", ui="-", api="-",
    side="metadata.reason, metadata.hoursAfterCreation = Math.round(...)",
    sev="High")

add("AUDIT", "P0", "Log", "CASE_RESTORED có hoursAfterDeletion",
    steps="POST restore", data="-", ui="-", api="-",
    side="metadata.hoursAfterDeletion", sev="High")

add("AUDIT", "P0", "Log", "CASE_ASSIGNED có fromTeamId/toTeamId/fromInvestigatorId/toInvestigatorId/dispatchedBy",
    steps="PATCH /assign", data="-", ui="-", api="-",
    side="metadata đủ 5 field", sev="High")

add("AUDIT", "P0", "Log", "CASE_EXPORTED có filters đầy đủ trong metadata",
    steps="GET /export/ward",
    data="-", ui="-", api="-",
    side="metadata={format,kind,filters:{...}}", sev="Medium",
    notes="Sprint 2 S2.1")

# ============================================================
# MODULE 20: SUBJECTS (Đối tượng) — sub-resource (70 TC)
# Resource gắn caseId, có status (INVESTIGATING/DETAINED/RELEASED/WANTED), type (SUSPECT/VICTIM/WITNESS)
# CRUD + scope qua Case
# ============================================================
add("GREEN","P0","Subjects","Tạo Subject với CCCD 12 chữ số hợp lệ",
    steps="POST /api/subjects {fullName, dateOfBirth, idNumber 12 chữ, address, caseId, crimeId}",
    data="fullName='Nguyễn Văn A', dateOfBirth='1990-01-15', idNumber='079090012345', address='12 Lê Lợi Q1', caseId='C001', crimeId='CRIME-173'",
    ui="Toast 'Tạo đối tượng thành công', detail show", api="201",
    side="DB row + audit SUBJECT_CREATED + cases.subjectsCount auto-increment", sev="Critical")

add("GREEN","P0","Subjects","Tạo Subject với CCCD 9 chữ số (CMND cũ)",
    steps="POST idNumber='079090123'", data="idNumber='079090123' (9 chữ)",
    ui="Success", api="201 (regex /^\\d{9}$|^\\d{12}$/ pass)", side="-", sev="High")

add("RED","P0","Subjects","CCCD 8 chữ số → 400 regex fail",
    steps="POST idNumber='07909012'", data="idNumber='07909012'",
    ui="Error 'Số CCCD/CMND phải có 9 hoặc 12 chữ số'", api="400", side="-", sev="High")

add("RED","P0","Subjects","CCCD 13 chữ số → 400",
    steps="POST idNumber='0790900123456'", data="idNumber 13 chars",
    ui="-", api="400", side="-", sev="High")

add("RED","P0","Subjects","CCCD có chữ cái 'ABC079090123' → 400 regex",
    steps="POST idNumber='ABC079090123'", data="idNumber='ABC079090123'", ui="-", api="400", side="-", sev="High")

add("RED","P0","Subjects","CCCD rỗng → 400 IsNotEmpty",
    steps="POST idNumber=''", data="idNumber=''", ui="Error 'Số CCCD/CMND không được để trống'", api="400", side="-", sev="High")

add("RED","P0","Subjects","fullName rỗng → 400",
    steps="POST fullName=''", data="fullName=''", ui="Error 'Họ tên không được để trống'", api="400", side="-", sev="High")

add("RED","P0","Subjects","dateOfBirth rỗng → 400",
    steps="POST dateOfBirth=''", data="-", ui="-", api="400 IsNotEmpty + IsDateString", side="-", sev="High")

add("RED","P0","Subjects","dateOfBirth='15/01/1990' không ISO → 400",
    steps="POST dateOfBirth='15/01/1990'", data="-", ui="-", api="400 'Ngày sinh không hợp lệ'", side="-", sev="High")

add("RED","P0","Subjects","dateOfBirth='2030-01-01' tương lai → ? (gap)",
    steps="POST dateOfBirth='2030-01-01'", data="-", ui="-",
    api="201 (không validate future date)", side="-", sev="Medium", notes="Gap: nên reject")

add("RED","P0","Subjects","address rỗng → 400",
    steps="POST address=''", data="-", ui="-", api="400 IsNotEmpty", side="-", sev="High")

add("RED","P0","Subjects","caseId rỗng → 400",
    steps="POST caseId=''", data="-", ui="-", api="400 'Vụ án không được để trống'", side="-", sev="High")

add("RED","P0","Subjects","caseId không tồn tại → 400 FK invalid",
    steps="POST caseId='NOT_EXIST'", data="-", ui="-", api="400 (FK P2003 wrapped)", side="-", sev="High")

add("RED","P0","Subjects","caseId của Case soft-deleted → 400",
    steps="POST caseId của CASE-DEL", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Subjects","crimeId rỗng → 400",
    steps="POST crimeId=''", data="-", ui="-", api="400 'Tội danh không được để trống'", side="-", sev="High")

add("RED","P0","Subjects","crimeId không tồn tại trong directory → 400",
    steps="POST crimeId='CRIME-NOT-EXIST'", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P1","Subjects","gender='UNKNOWN' không trong enum → 400",
    steps="POST gender='UNKNOWN'", data="-", ui="-", api="400 'Giới tính không hợp lệ'", side="-", sev="Medium")

add("GREEN","P1","Subjects","gender bỏ trống → default MALE",
    steps="POST không kèm gender", data="-", ui="-", api="201, data.gender='MALE'", side="-", sev="Medium")

add("GREEN","P1","Subjects","type=VICTIM (Bị hại) — không phải SUSPECT default",
    steps="POST type='VICTIM'", data="-", ui="Detail show 'Bị hại'", api="201", side="-", sev="High")

add("GREEN","P1","Subjects","type=WITNESS (Nhân chứng)",
    steps="POST type='WITNESS'", data="-", ui="-", api="201", side="-", sev="Medium")

add("RED","P1","Subjects","type='INVALID' → 400",
    steps="POST type='INVALID'", data="-", ui="-", api="400", side="-", sev="Medium")

add("GREEN","P1","Subjects","status=DETAINED (Đang tạm giam)",
    steps="POST status='DETAINED'", data="-", ui="Badge 'Đang tạm giam'", api="201", side="-", sev="High")

add("GREEN","P1","Subjects","status=RELEASED khi đã thả",
    steps="PUT subject {status:'RELEASED'}", data="-", ui="Badge update", api="200", side="-", sev="Medium")

add("GREEN","P1","Subjects","status=WANTED (Truy nã)",
    steps="PUT status='WANTED'", data="-", ui="Badge đỏ 'Truy nã'", api="200", side="-", sev="High")

add("GREEN","P0","Subjects","GET /subjects?caseId=C001 trả subjects của Case",
    pre="C001 có 3 subjects", steps="GET ?caseId=C001",
    data="-", ui="Table 3 row", api="200 data=[3 items]", side="-", sev="High")

add("GREEN","P0","Subjects","GET /subjects/:id detail include lawyers liên kết",
    steps="GET /subjects/S001", data="-", ui="Detail show lawyers tab",
    api="200 data.lawyers=[...]", side="-", sev="High")

add("RED","P0","Subjects","GET /subjects/:id Subject ngoài scope → 403",
    pre="User Q1, Subject thuộc Case Q3", steps="GET", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Subjects","GET /subjects/NOT_EXIST → 404",
    steps="GET", data="-", ui="-", api="404", side="-", sev="High")

add("GREEN","P0","Subjects","PUT update fullName của Subject",
    steps="PUT /subjects/S001 {fullName:'Tên đã sửa'}", data="-", ui="Toast success", api="200",
    side="Audit SUBJECT_UPDATED diff", sev="High")

add("RED","P0","Subjects","PUT Subject ngoài write scope → 403",
    steps="PUT subject của case khác team", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Subjects","PUT Subject soft-deleted → 404",
    pre="Subject deletedAt set", steps="PUT", data="-", ui="-", api="404", side="-", sev="High")

add("GREEN","P0","Subjects","DELETE Subject soft delete + Case.subjectsCount giảm",
    steps="DELETE /subjects/S001", data="-",
    ui="Toast 'Xóa đối tượng thành công', row mất khỏi list",
    api="200", side="subjects.deletedAt=now() + cases.subjectsCount-1 + audit", sev="Critical")

add("RED","P0","Subjects","DELETE Subject ngoài scope → 403",
    steps="DELETE", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Subjects","DELETE Subject không tồn tại → 404",
    steps="DELETE", data="-", ui="-", api="404", side="-", sev="High")

add("RED","P0","Subjects","DELETE Subject đã soft-deleted (idempotent) → 404 hoặc 200",
    steps="DELETE 2 lần", data="-", ui="-", api="Lần 2: 404", side="-", sev="Medium")

add("SECURITY","P0","Subjects","IDOR: POST subject với caseId của Case khác user → 403/400",
    steps="dieuTra-Q1 POST subject với caseId thuộc Case-Q3",
    data="caseId='CASE-Q3'", ui="-", api="? — cần verify scope check",
    side="Service phải check Case.assignedTeamId của caseId nằm trong writableTeamIds",
    sev="Critical", notes="Subject scope phụ thuộc Case parent scope")

add("SECURITY","P0","Subjects","XSS qua fullName='<script>alert(1)</script>' → React escape",
    steps="POST fullName='<script>alert(1)</script>'", data="-",
    ui="Hiển thị literal", api="201", side="-", sev="Critical")

add("SECURITY","P0","Subjects","SQL injection qua idNumber bypass regex (impossible vì regex strict)",
    steps="POST idNumber='123 OR 1=1'", data="-", ui="-", api="400 regex fail", side="-", sev="High")

add("DATA","P1","Subjects","fullName tiếng Việt có dấu 'Nguyễn Quỳnh Trâm'",
    steps="POST", data="-", ui="Detail show đúng dấu", api="201", side="-", sev="Medium")

add("DATA","P1","Subjects","fullName 200 ký tự (long name)",
    steps="POST fullName 'X'*200", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Subjects","address Unicode + multi-line",
    steps="POST address='Số 12\\nLê Lợi, Quận 1\\nTP.HCM'", data="-", ui="Detail preserve newline",
    api="201", side="-", sev="Low")

add("BOUNDARY","P1","Subjects","CCCD đúng 9 chữ → pass min",
    steps="POST idNumber='079090123'", data="-", ui="-", api="201", side="-", sev="Medium")

add("BOUNDARY","P1","Subjects","CCCD đúng 12 chữ → pass max",
    steps="POST idNumber 12 chars", data="-", ui="-", api="201", side="-", sev="Medium")

add("BOUNDARY","P1","Subjects","CCCD 10 chữ → 400 (regex chỉ accept 9 hoặc 12)",
    steps="POST idNumber 10 chars", data="-", ui="-", api="400 regex", side="-", sev="High")

add("BOUNDARY","P1","Subjects","CCCD 11 chữ → 400",
    steps="POST idNumber 11 chars", data="-", ui="-", api="400", side="-", sev="High")

add("STATE","P0","Subjects","Transition INVESTIGATING → DETAINED (bắt tạm giam)",
    steps="PUT status='DETAINED'", data="-", ui="Badge change", api="200",
    side="Audit status change", sev="High")

add("STATE","P0","Subjects","Transition DETAINED → RELEASED (thả)",
    steps="PUT status='RELEASED'", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Subjects","Transition INVESTIGATING → WANTED (chuyển truy nã)",
    steps="PUT status='WANTED'", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P1","Subjects","Transition WANTED → DETAINED (bắt được rồi)",
    steps="PUT", data="-", ui="-", api="200", side="-", sev="Medium")

add("A11Y","P1","Subjects","Form Subject input có label gắn id",
    steps="Inspect form", data="-", ui="<label for=fullName>", api="-", side="-", sev="Medium")

add("A11Y","P1","Subjects","Date picker dateOfBirth keyboard accessible",
    steps="Tab vào date picker, dùng arrow keys", data="-", ui="-", api="-", side="-", sev="Medium")

add("PERFORMANCE","P1","Subjects","GET /subjects?caseId=X với Case có 50 subjects < 500ms",
    steps="GET", data="-", ui="-", api="<500ms", side="-", sev="Medium")

add("RED","P0","Subjects","Duplicate idNumber + caseId + type (constraint unique per type per case)",
    steps="POST 2 lần cùng idNumber+caseId+type", data="-",
    ui="Toast 'Đối tượng đã tồn tại'", api="409 hoặc 400 (P2002 unique)",
    side="-", sev="High")

add("GREEN","P1","Subjects","Cùng idNumber khác type (SUSPECT vs VICTIM) trong cùng Case OK",
    steps="POST 2 Subject idNumber giống type khác",
    data="-", ui="-", api="201 cả 2 (unique constraint per type)", side="-", sev="Medium")

add("AUDIT","P0","Subjects","DELETE Subject ghi audit với name + reason",
    steps="DELETE", data="-", ui="-", api="-",
    side="audit row SUBJECT_DELETED metadata", sev="High")

add("RED","P1","Subjects","PUT thay đổi caseId (chuyển vụ án) → có cho phép?",
    steps="PUT caseId='OTHER_CASE'", data="-", ui="-",
    api="? — verify business rule. Cần block hoặc audit", side="-", sev="Medium",
    notes="Gap: nên freeze caseId sau create")

add("RED","P1","Subjects","occupationId không tồn tại directory → 400",
    steps="POST occupationId='OCC-NOT-EXIST'", data="-", ui="-", api="400 FK", side="-", sev="Medium")

add("RED","P1","Subjects","nationalityId không tồn tại → 400",
    steps="POST nationalityId='NAT-NOT-EXIST'", data="-", ui="-", api="400", side="-", sev="Medium")

add("RED","P1","Subjects","wardId không tồn tại → 400",
    steps="POST wardId='WARD-NOT-EXIST'", data="-", ui="-", api="400", side="-", sev="Medium")

add("GREEN","P1","Subjects","districtName denormalized preserve sau cải cách hành chính",
    steps="POST districtName='Quận 1'", data="-",
    ui="Detail show 'Quận 1' kể cả khi đơn vị hành chính đã đổi",
    api="201", side="districtName lưu raw, không update khi directory đổi", sev="Medium")

add("GREEN","P1","Subjects","Subject Filter by status=DETAINED",
    steps="GET /subjects?status=DETAINED", data="-",
    ui="-", api="data[].status=DETAINED", side="-", sev="Medium")

add("GREEN","P1","Subjects","Subject Filter by type=SUSPECT",
    steps="GET ?type=SUSPECT", data="-", ui="-", api="data[].type=SUSPECT", side="-", sev="Medium")

add("RED","P0","Subjects","User VIEWER không có write/Subject → 403",
    pre="viewer", steps="POST /subjects", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Subjects","JWT thiếu → 401",
    steps="POST không token", data="-", ui="-", api="401", side="-", sev="Critical")

add("BOUNDARY","P1","Subjects","fullName 1 ký tự 'A'",
    steps="POST fullName='A'", data="-", ui="-", api="201 (no min length)", side="-", sev="Low")

add("BOUNDARY","P1","Subjects","fullName 1000 ký tự (no max)",
    steps="POST fullName 'X'*1000", data="-", ui="-", api="201 (no MaxLength constraint — gap)", side="-", sev="Low",
    notes="Gap: nên có MaxLength để chống DoS")

add("DATA","P1","Subjects","phone number format VN '0901234567'",
    steps="POST phone='0901234567'", data="-", ui="-", api="201 (no validation — gap)", side="-", sev="Medium")

add("DATA","P1","Subjects","phone với ký tự đặc biệt '+84 901 234 567'",
    steps="POST phone='+84 901 234 567'", data="-", ui="-", api="201 raw", side="-", sev="Low")

add("INTEGRATION","P1","Subjects","Subject + Lawyer assign: thêm Lawyer cho 1 Subject cụ thể",
    steps="POST Lawyer với subjectId=S001", data="-", ui="-", api="201 lawyer.subjectId=S001",
    side="-", sev="Medium")

add("INTEGRATION","P1","Subjects","Delete Subject có Lawyer link — Lawyer.subjectId=NULL (SetNull)",
    steps="DELETE Subject có 1 Lawyer", data="-", ui="-",
    api="200 subject deleted", side="Lawyer.subjectId=NULL (Prisma onDelete: SetNull)", sev="High")

add("RECOVERY","P1","Subjects","Atomic Subject create rollback nếu audit fail",
    steps="Mock audit throw", data="-", ui="-", api="500", side="No subject row created", sev="High")

add("AUDIT","P0","Subjects","SUBJECT_CREATED log có caseId trong metadata",
    steps="POST", data="-", ui="-", api="-",
    side="metadata.caseId, fullName, idNumber preserved", sev="High")


# ============================================================
# MODULE 21: LAWYERS (Luật sư) — sub-resource (45 TC)
# ============================================================
add("GREEN","P0","Lawyers","Tạo Lawyer với barNumber unique",
    steps="POST /api/lawyers {fullName, barNumber, caseId, lawFirm, phone}",
    data="fullName='Luật sư Trần Văn B', barNumber='LS-2026-12345', caseId='C001', lawFirm='VP Luật ABC', phone='0901234567'",
    ui="Toast 'Tạo luật sư thành công'", api="201", side="DB row + audit", sev="High")

add("GREEN","P0","Lawyers","Tạo Lawyer gắn subjectId (bào chữa cho subject cụ thể)",
    steps="POST với subjectId='S001'", data="subjectId='S001'",
    ui="Detail show 'Bào chữa cho Nguyễn Văn A'", api="201", side="-", sev="High")

add("GREEN","P1","Lawyers","Lawyer không gắn subjectId (bào chữa chung)",
    steps="POST không subjectId", data="-", ui="Detail 'Bào chữa chung'", api="201 subjectId=null", side="-", sev="Medium")

add("RED","P0","Lawyers","fullName rỗng → 400",
    steps="POST fullName=''", data="-", ui="Error 'Họ tên luật sư không được để trống'", api="400", side="-", sev="High")

add("RED","P0","Lawyers","barNumber rỗng → 400",
    steps="POST barNumber=''", data="-", ui="Error 'Số thẻ luật sư không được để trống'", api="400", side="-", sev="High")

add("RED","P0","Lawyers","barNumber duplicate (đã tồn tại) → 409 unique constraint",
    pre="LS-2026-12345 đã tồn tại",
    steps="POST barNumber='LS-2026-12345'", data="-",
    ui="Toast 'Số thẻ luật sư đã tồn tại'", api="409 (P2002)", side="-", sev="High")

add("RED","P0","Lawyers","caseId rỗng → 400",
    steps="POST caseId=''", data="-", ui="-", api="400 'Vụ án không được để trống'", side="-", sev="High")

add("RED","P0","Lawyers","caseId không tồn tại → 400 FK",
    steps="POST caseId='NOT_EXIST'", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Lawyers","subjectId không tồn tại trong DB → 400 FK",
    steps="POST subjectId='NOT_EXIST'", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P1","Lawyers","subjectId không cùng caseId (cross-case) → 400 business rule",
    steps="POST caseId='C001', subjectId='S-of-C002'", data="-",
    ui="-", api="400 'Đối tượng không thuộc vụ án này'",
    side="-", sev="High", notes="Cần verify service business check")

add("GREEN","P0","Lawyers","GET /lawyers?caseId=C001 trả lawyers của Case",
    steps="GET", data="-", ui="Table list", api="200 data filtered by caseId", side="-", sev="High")

add("GREEN","P0","Lawyers","GET /lawyers?subjectId=S001 trả lawyers của subject",
    steps="GET ?subjectId=S001", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P0","Lawyers","GET /lawyers/:id detail include subject info",
    steps="GET", data="-", ui="Detail show subject linked", api="200 data.subject=...", side="-", sev="High")

add("RED","P0","Lawyers","GET /lawyers/NOT_EXIST → 404",
    steps="GET", data="-", ui="-", api="404", side="-", sev="High")

add("RED","P0","Lawyers","GET Lawyer ngoài scope (Case không thuộc team mình) → 403",
    steps="dieuTra-Q1 GET lawyer của Case-Q3", data="-", ui="-", api="403", side="-", sev="Critical")

add("GREEN","P0","Lawyers","PUT update lawFirm + phone",
    steps="PUT /lawyers/L001 {lawFirm:'VP mới', phone:'0987654321'}",
    data="-", ui="Toast success", api="200", side="Audit LAWYER_UPDATED diff", sev="High")

add("RED","P0","Lawyers","PUT barNumber duplicate → 409",
    steps="PUT barNumber khớp với lawyer khác", data="-", ui="-", api="409", side="-", sev="High")

add("RED","P0","Lawyers","PUT Lawyer ngoài write scope → 403",
    steps="PUT lawyer của Case khác team", data="-", ui="-", api="403", side="-", sev="Critical")

add("GREEN","P0","Lawyers","DELETE Lawyer soft delete",
    steps="DELETE /lawyers/L001", data="-",
    ui="Toast 'Xóa luật sư thành công'", api="200",
    side="lawyers.deletedAt set + audit LAWYER_DELETED", sev="High")

add("RED","P0","Lawyers","DELETE Lawyer không tồn tại → 404",
    steps="DELETE", data="-", ui="-", api="404", side="-", sev="High")

add("RED","P0","Lawyers","DELETE Lawyer ngoài scope → 403",
    steps="DELETE", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY","P0","Lawyers","IDOR: POST Lawyer với caseId ngoài team → 403",
    steps="POST caseId của Case khác team",
    data="-", ui="-", api="403 (scope check Case parent)", side="-", sev="Critical")

add("SECURITY","P0","Lawyers","XSS qua fullName='<svg onload=alert(1)>'",
    steps="POST fullName='<svg onload=alert(1)>'", data="-",
    ui="Literal text", api="201", side="-", sev="Critical")

add("SECURITY","P0","Lawyers","SQL injection qua barNumber",
    steps="POST barNumber=\"' OR 1=1--\"", data="-",
    ui="-", api="201 lưu literal (Prisma param) hoặc 409 nếu collision",
    side="No DB injection", sev="High")

add("DATA","P1","Lawyers","fullName tiếng Việt 'Luật sư Đỗ Thị Thanh Mai'",
    steps="POST", data="-", ui="Hiển thị dấu đúng", api="201", side="-", sev="Medium")

add("DATA","P1","Lawyers","lawFirm Unicode 'Văn phòng Luật sư Hà Nội & Cộng sự'",
    steps="POST", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Lawyers","phone số Quốc tế '+84 901 234 567'",
    steps="POST phone='+84 901 234 567'", data="-", ui="-", api="201", side="-", sev="Low")

add("RED","P1","Lawyers","barNumber chứa whitespace 'LS 2026 12345' → save raw (gap)",
    steps="POST", data="-", ui="-", api="201 raw", side="-", sev="Low",
    notes="Gap: nên normalize barNumber (strip spaces)")

add("STATE","P1","Lawyers","Lawyer được assign sang Subject khác (re-assign)",
    steps="PUT subjectId='S002'", data="-", ui="-", api="200", side="-", sev="Medium")

add("STATE","P1","Lawyers","Unassign Lawyer khỏi Subject (subjectId=null)",
    steps="PUT subjectId=null", data="-", ui="-", api="200", side="-", sev="Medium")

add("INTEGRATION","P1","Lawyers","Soft-delete Subject → Lawyer.subjectId auto null (onDelete SetNull)",
    steps="DELETE Subject có Lawyer link", data="-", ui="-",
    api="-", side="Lawyer.subjectId=null", sev="High")

add("A11Y","P1","Lawyers","Form barNumber có pattern hint",
    steps="Inspect form", data="-", ui="placeholder='LS-YYYY-XXXXX'", api="-", side="-", sev="Low")

add("PERFORMANCE","P1","Lawyers","GET /lawyers với 100 lawyer DB < 500ms",
    steps="GET", data="-", ui="-", api="<500ms", side="-", sev="Medium")

add("RED","P0","Lawyers","User VIEWER POST → 403",
    pre="viewer", steps="POST", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Lawyers","JWT thiếu → 401",
    steps="POST không token", data="-", ui="-", api="401", side="-", sev="Critical")

add("AUDIT","P0","Lawyers","LAWYER_CREATED log có barNumber + caseId",
    steps="POST", data="-", ui="-", api="-", side="metadata đầy đủ", sev="High")

add("BOUNDARY","P1","Lawyers","fullName 1 ký tự",
    steps="POST fullName='A'", data="-", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY","P1","Lawyers","barNumber 1 ký tự",
    steps="POST barNumber='X'", data="-", ui="-", api="201 (no min length — gap)", side="-", sev="Low")

add("BOUNDARY","P1","Lawyers","fullName 500 ký tự",
    steps="POST", data="-", ui="-", api="201 (no max)", side="-", sev="Low")

add("RED","P1","Lawyers","POST với forbidNonWhitelisted field 'evil':'x' → 400",
    steps="POST {evil:'x',...}", data="-", ui="-", api="400", side="-", sev="Medium")

add("RED","P1","Lawyers","phone format không validate (gap)",
    steps="POST phone='ABCDEF'", data="-", ui="-", api="201 (no IsPhoneNumber validation)", side="-", sev="Low",
    notes="Gap: nên validate format")

add("GREEN","P1","Lawyers","Filter search by fullName",
    steps="GET ?search='Trần'", data="-", ui="-", api="200 data có name LIKE 'Trần'", side="-", sev="Medium")

add("GREEN","P1","Lawyers","Pagination limit/offset",
    steps="GET ?limit=10&offset=20", data="-", ui="-", api="200", side="-", sev="Medium")

add("RED","P1","Lawyers","limit=200 → ? (max validation cần check)",
    steps="GET ?limit=200", data="-", ui="-", api="Verify DTO @Max", side="-", sev="Low")


# ============================================================
# MODULE 22: CONCLUSIONS (Kết luận điều tra) (40 TC)
# ============================================================
add("GREEN","P0","Conclusions","Tạo Conclusion với type+content+caseId",
    steps="POST /api/conclusions {caseId, type:'KET_LUAN_DE_NGHI_TRUY_TO', content:'Nội dung kết luận chi tiết...'}",
    data="caseId='C001', type='KET_LUAN_DE_NGHI_TRUY_TO', content='Đề nghị truy tố theo Đ.173 BLHS'",
    ui="Toast 'Tạo kết luận thành công'", api="201",
    side="conclusions row + audit", sev="Critical")

add("RED","P0","Conclusions","caseId thiếu → 400 IsString",
    steps="POST không caseId", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Conclusions","caseId không tồn tại → 400 FK",
    steps="POST", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Conclusions","type rỗng → 400",
    steps="POST type=''", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Conclusions","content rỗng → 400",
    steps="POST content=''", data="-", ui="-", api="400", side="-", sev="High")

add("GREEN","P0","Conclusions","Tạo Conclusion với approvedById",
    steps="POST approvedById='<truong-don-vi>'", data="-",
    ui="Detail show 'Phê duyệt bởi: ...'", api="201", side="-", sev="High")

add("RED","P0","Conclusions","approvedById không tồn tại → 400 FK",
    steps="POST approvedById='NOT_EXIST'", data="-", ui="-", api="400", side="-", sev="High")

add("GREEN","P0","Conclusions","Default status khi POST không kèm",
    steps="POST", data="-", ui="-", api="201 status=DRAFT (default)", side="-", sev="Medium")

add("RED","P1","Conclusions","status='INVALID' → 400 IsEnum",
    steps="POST status='INVALID'", data="-", ui="-", api="400", side="-", sev="Medium")

add("GREEN","P0","Conclusions","GET /conclusions?caseId=C001 list",
    steps="GET", data="-", ui="Table show conclusions", api="200", side="-", sev="High")

add("GREEN","P0","Conclusions","GET /conclusions/:id detail",
    steps="GET", data="-", ui="Detail show approvedBy info", api="200", side="-", sev="High")

add("RED","P0","Conclusions","GET conclusion ngoài scope (Case khác team) → 403",
    steps="GET", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Conclusions","GET /conclusions/NOT_EXIST → 404",
    steps="GET", data="-", ui="-", api="404", side="-", sev="High")

add("GREEN","P0","Conclusions","PUT update content",
    steps="PUT /conclusions/CON-001 {content:'Sửa kết luận'}",
    data="-", ui="Success", api="200", side="Audit diff", sev="High")

add("RED","P0","Conclusions","PUT conclusion đã APPROVED không cho sửa",
    pre="Conclusion status=APPROVED",
    steps="PUT", data="-", ui="-", api="400 'Kết luận đã phê duyệt không thể sửa'",
    side="-", sev="High", notes="Cần verify business rule")

add("GREEN","P0","Conclusions","DELETE conclusion soft delete",
    steps="DELETE", data="-", ui="Toast success", api="200",
    side="deletedAt + audit", sev="High")

add("RED","P0","Conclusions","DELETE conclusion đã APPROVED → 400",
    pre="status=APPROVED", steps="DELETE", data="-", ui="-",
    api="400 'Không thể xóa kết luận đã phê duyệt'", side="-", sev="High")

add("STATE","P0","Conclusions","Transition DRAFT → SUBMITTED (gửi đi phê duyệt)",
    steps="PUT status='SUBMITTED'", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Conclusions","Transition SUBMITTED → APPROVED (truong don vi duyet)",
    pre="user role TRUONG_DON_VI",
    steps="PUT status='APPROVED' approvedById=<self>", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Conclusions","Transition SUBMITTED → REJECTED",
    steps="PUT status='REJECTED'", data="-", ui="-", api="200", side="-", sev="Medium")

add("STATE","P0","Conclusions","Transition REJECTED → DRAFT (chỉnh sửa lại)",
    steps="PUT status='DRAFT'", data="-", ui="-", api="200", side="-", sev="Medium")

add("RED","P0","Conclusions","APPROVED → DRAFT (downgrade) → block",
    pre="status=APPROVED", steps="PUT status='DRAFT'", data="-", ui="-",
    api="400 'Không thể downgrade conclusion đã phê duyệt'", side="-", sev="High",
    notes="State machine constraint")

add("SECURITY","P0","Conclusions","User thường không có quyền APPROVE (không phải TRUONG_DON_VI) → 403",
    steps="dieuTra1 PUT status='APPROVED'", data="-", ui="-",
    api="403 hoặc 400", side="-", sev="Critical")

add("SECURITY","P0","Conclusions","IDOR: POST conclusion với caseId của team khác",
    steps="POST", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY","P0","Conclusions","XSS qua content='<script>'",
    steps="POST", data="-", ui="React escape", api="201", side="-", sev="Critical")

add("DATA","P1","Conclusions","content rất dài (10K characters)",
    steps="POST content='X'*10000", data="-", ui="-", api="201 (text field)", side="-", sev="Low")

add("DATA","P1","Conclusions","content có format Markdown",
    steps="POST content với **bold** *italic*", data="-",
    ui="Detail render markdown nếu support", api="201 lưu raw", side="-", sev="Low")

add("INTEGRATION","P0","Conclusions","Conclusion APPROVED → Case status auto-update DA_KET_LUAN",
    steps="APPROVE conclusion", data="-",
    ui="Case badge → 'Đã kết luận'", api="200",
    side="Case.status=DA_KET_LUAN + history entry", sev="Critical",
    notes="Verify auto-trigger logic")

add("AUDIT","P0","Conclusions","CONCLUSION_APPROVED log có approvedById + timestamp",
    steps="APPROVE", data="-", ui="-", api="-",
    side="audit row đủ field", sev="High")

add("A11Y","P1","Conclusions","Form content textarea có aria-label",
    steps="Inspect", data="-", ui="-", api="-", side="-", sev="Low")

add("PERFORMANCE","P1","Conclusions","Save conclusion với content 5K chars < 1s",
    steps="POST", data="-", ui="-", api="<1s", side="-", sev="Medium")

add("BOUNDARY","P1","Conclusions","content 1 ký tự → pass",
    steps="POST content='X'", data="-", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY","P1","Conclusions","content 100K ký tự → ? (no max limit)",
    steps="POST content 'X'*100000", data="-", ui="-", api="? — verify limit",
    side="-", sev="Low", notes="Gap: nên có max")

add("RED","P0","Conclusions","User VIEWER POST → 403",
    steps="POST", data="-", ui="-", api="403", side="-", sev="High")

add("RED","P0","Conclusions","JWT thiếu → 401",
    steps="POST", data="-", ui="-", api="401", side="-", sev="High")

add("GREEN","P1","Conclusions","Filter status=DRAFT",
    steps="GET ?status=DRAFT", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P1","Conclusions","notes optional bỏ trống",
    steps="POST không notes", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Conclusions","type tiếng Việt 'Kết luận đề nghị truy tố'",
    steps="POST type='Kết luận đề nghị truy tố'", data="-", ui="-", api="201 (free string)", side="-", sev="Low",
    notes="Type field không phải enum — free string")

add("INTEGRATION","P1","Conclusions","Delete Case bị block khi có Conclusion linked",
    steps="DELETE Case có Conclusion", data="-",
    ui="'Không thể xóa: vụ án có 1 kết luận điều tra'", api="400", side="-", sev="High")


# ============================================================
# MODULE 23: DOCUMENTS (Upload tài liệu) (60 TC)
# ============================================================
add("GREEN","P0","Documents","Upload PDF 5MB qua POST /documents",
    steps="POST multipart/form-data file=test.pdf 5MB title='Hồ sơ vụ án' caseId='C001'",
    data="file PDF 5MB", ui="Progress bar, Toast success",
    api="201, data.filePath set", side="File lưu /uploads/, DB row + audit", sev="Critical")

add("GREEN","P0","Documents","Upload Word .docx",
    steps="POST file=report.docx", data="-", ui="Success", api="201 mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document", side="-", sev="High")

add("GREEN","P0","Documents","Upload image JPG",
    steps="POST file=evidence.jpg", data="-", ui="-", api="201", side="-", sev="High")

add("GREEN","P0","Documents","Upload PNG",
    steps="POST file=screenshot.png", data="-", ui="-", api="201", side="-", sev="High")

add("RED","P0","Documents","Upload file > 10MB (mặc định limit) → 413",
    steps="POST file 15MB", data="-", ui="Error 'File quá lớn'", api="413 PayloadTooLarge", side="-", sev="High")

add("RED","P0","Documents","Upload .exe → block by mimetype",
    steps="POST file=malware.exe", data="-", ui="Error 'Loại file không hỗ trợ'",
    api="400 mimetype rejected", side="-", sev="Critical",
    notes="Multer filter cần whitelist mime")

add("RED","P0","Documents","Upload .sh script → block",
    steps="POST file=evil.sh", data="-", ui="-", api="400", side="-", sev="Critical")

add("RED","P0","Documents","Upload .js → block",
    steps="POST file=evil.js", data="-", ui="-", api="400", side="-", sev="Critical")

add("SECURITY","P0","Documents","Upload PDF nhưng đổi extension thành .pdf (magic byte check)",
    steps="Upload file MZ header (PE/exe) đổi tên .pdf",
    data="-", ui="-", api="? — cần verify magic byte check",
    side="-", sev="Critical", notes="Gap: cần magic byte check")

add("SECURITY","P0","Documents","Path traversal qua originalName '../../../etc/passwd'",
    steps="POST originalName='../../../etc/passwd'",
    data="-", ui="-", api="? — verify multer normalize",
    side="File path normalized, không escape uploads dir", sev="Critical")

add("SECURITY","P0","Documents","Filename có null byte 'evil\\0.jpg'",
    steps="POST originalName='evil\\0.jpg'", data="-",
    ui="-", api="400 hoặc strip null byte", side="-", sev="High")

add("SECURITY","P0","Documents","ZIP slip nếu support upload .zip",
    steps="Upload zip có '../../../evil.txt' inside",
    data="-", ui="-", api="-", side="-", sev="High",
    notes="Skip nếu không support zip")

add("RED","P0","Documents","title rỗng → 400",
    steps="POST title=''", data="-", ui="Error 'Tiêu đề tài liệu không được để trống'", api="400", side="-", sev="High")

add("GREEN","P0","Documents","caseId optional — không kèm cũng OK (general document)",
    steps="POST không caseId", data="-", ui="-", api="201", side="-", sev="Medium")

add("GREEN","P0","Documents","incidentId thay vì caseId (gắn với Incident)",
    steps="POST incidentId='INC-001'", data="-", ui="-", api="201", side="-", sev="Medium")

add("RED","P0","Documents","Cả caseId VÀ incidentId → 400 'Chỉ chọn 1'",
    steps="POST caseId + incidentId", data="-", ui="-",
    api="? — verify business rule", side="-", sev="Medium", notes="Gap: chưa enforce")

add("RED","P1","Documents","documentType='INVALID' enum → 400",
    steps="POST documentType='INVALID'", data="-", ui="-", api="400 'Loại tài liệu không hợp lệ'", side="-", sev="Medium")

add("GREEN","P0","Documents","GET /documents?caseId=C001 list documents của Case",
    steps="GET", data="-", ui="-", api="200", side="-", sev="High")

add("GREEN","P0","Documents","GET /documents/:id metadata only (chưa download file)",
    steps="GET", data="-", ui="-", api="200 data có filePath/fileName/size", side="-", sev="High")

add("GREEN","P0","Documents","GET /documents/:id/download trả file binary",
    steps="GET download", data="-",
    ui="Browser download file", api="200 Content-Type theo mimeType, Content-Disposition attachment",
    side="-", sev="Critical")

add("RED","P0","Documents","Download document ngoài scope → 403",
    steps="GET download của Case khác team", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Documents","Download document đã soft-deleted → 404",
    pre="deletedAt set", steps="GET", data="-", ui="-", api="404", side="-", sev="High")

add("RED","P0","Documents","Download bằng GET /uploads/file.pdf trực tiếp → 401/403",
    steps="GET /uploads/file.pdf không qua API auth",
    data="-", ui="-", api="? — cần verify static serve có auth",
    side="-", sev="Critical", notes="Nếu serve raw upload → IDOR")

add("GREEN","P0","Documents","DELETE document soft delete",
    steps="DELETE", data="-", ui="Toast success", api="200",
    side="deletedAt + audit + file vẫn còn (soft)", sev="High")

add("RED","P0","Documents","DELETE document ngoài scope → 403",
    steps="DELETE", data="-", ui="-", api="403", side="-", sev="Critical")

add("GREEN","P0","Documents","PUT update title + description",
    steps="PUT", data="-", ui="Success", api="200", side="Audit diff", sev="High")

add("RED","P0","Documents","PUT thay đổi fileName/filePath bị forbidNonWhitelisted reject",
    steps="PUT {fileName:'evil.pdf'}", data="-", ui="-",
    api="400 (whitelist update DTO không có fileName)", side="-", sev="High",
    notes="Verify UpdateDocumentDto không có file fields")

add("SECURITY","P0","Documents","XSS qua originalName '<script>alert</script>.pdf'",
    steps="POST originalName='<script>alert</script>.pdf'",
    data="-", ui="Hiển thị escape", api="201", side="-", sev="High")

add("SECURITY","P0","Documents","CSV injection qua title '=cmd|calc'",
    steps="POST title='=cmd|calc'", data="-", ui="Hiển thị raw",
    api="201", side="Export Excel sau này cần escape '='", sev="Medium",
    notes="CSV/Excel injection nếu export sau")

add("DATA","P1","Documents","title tiếng Việt có dấu",
    steps="POST title='Hồ sơ vụ án Nguyễn'", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Documents","filename Unicode 'tài liệu công văn.pdf'",
    steps="-", data="-", ui="-", api="201", side="DB preserve UTF-8", sev="Medium")

add("DATA","P1","Documents","filename emoji '📄report.pdf'",
    steps="POST", data="-", ui="-", api="201 hoặc normalize", side="-", sev="Low")

add("BOUNDARY","P1","Documents","File 0 byte (empty) → 400",
    steps="POST file empty", data="-", ui="-", api="400 'File rỗng'", side="-", sev="Medium")

add("BOUNDARY","P1","Documents","File 1 byte (smallest non-empty) → 201",
    steps="POST file 1 byte", data="-", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY","P1","Documents","File đúng limit 10MB → 201",
    steps="POST file 10MB", data="-", ui="-", api="201", side="-", sev="Medium")

add("BOUNDARY","P1","Documents","File 10MB+1 byte → 413",
    steps="POST file 10485761 bytes", data="-", ui="-", api="413", side="-", sev="Medium")

add("PERFORMANCE","P1","Documents","Upload 5MB < 5s",
    steps="-", data="-", ui="-", api="<5s", side="-", sev="Medium")

add("PERFORMANCE","P1","Documents","Download 5MB streaming không OOM",
    steps="GET download", data="-", ui="-", api="-", side="Memory peak < 100MB", sev="Medium")

add("RECOVERY","P1","Documents","Upload bị interrupt giữa chừng → no partial file",
    steps="Disconnect during upload", data="-", ui="-",
    api="Multer cleanup partial", side="No orphan file", sev="High")

add("RECOVERY","P1","Documents","Disk full khi upload → 500 cleanup",
    steps="Mock disk full", data="-", ui="-", api="500", side="No orphan + audit fail", sev="High")

add("SECURITY","P0","Documents","Quota: user upload nhiều file → check storage limit",
    steps="Upload 100 file 10MB", data="-", ui="-",
    api="? — verify storage quota", side="-", sev="High",
    notes="Gap: không có quota → DoS")

add("AUDIT","P0","Documents","DOCUMENT_CREATED có fileName + size + mimeType",
    steps="POST", data="-", ui="-", api="-", side="metadata đủ", sev="High")

add("AUDIT","P0","Documents","DOCUMENT_DOWNLOADED audit mỗi lần download",
    steps="GET download", data="-", ui="-", api="-",
    side="audit row DOCUMENT_DOWNLOADED với userId + ip + ua", sev="High",
    notes="PII access tracking")

add("AUDIT","P0","Documents","DOCUMENT_DELETED có original fileName",
    steps="DELETE", data="-", ui="-", api="-", side="-", sev="High")

add("A11Y","P1","Documents","File input có aria-label",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("A11Y","P1","Documents","Upload progress có aria-live='polite' announce",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT","P1","Documents","Drag-drop upload trên Chrome",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT","P1","Documents","File picker mobile (iOS Safari)",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("RED","P0","Documents","Multi-file upload (nếu hỗ trợ) — concurrent",
    steps="POST 5 file cùng lúc", data="-", ui="-", api="201 cho mỗi", side="-", sev="Medium")

add("RED","P1","Documents","File trùng tên (cùng originalName) → vẫn lưu (fileName generated unique)",
    steps="POST 2 file cùng tên", data="-", ui="-", api="2x201 với fileName khác", side="-", sev="Medium")

add("INTEGRATION","P0","Documents","Delete Case bị block khi có Document linked",
    steps="DELETE Case", data="-",
    ui="'Không thể xóa: vụ án có 3 tài liệu đính kèm'", api="400", side="-", sev="High")

add("GREEN","P1","Documents","Filter documentType=COURT_DECISION",
    steps="GET ?documentType=COURT_DECISION", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P1","Documents","Filter by uploadedById",
    steps="GET ?uploadedById=<userId>", data="-", ui="-", api="200", side="-", sev="Low")

add("RED","P0","Documents","VIEWER không có write/Document → 403 POST",
    steps="-", data="-", ui="-", api="403", side="-", sev="High")

add("RED","P0","Documents","JWT thiếu POST → 401",
    steps="-", data="-", ui="-", api="401", side="-", sev="High")

add("SECURITY","P1","Documents","Content-Sniffing: response header X-Content-Type-Options: nosniff",
    steps="GET download", data="-", ui="-", api="Header present", side="-", sev="High")

add("DATA","P1","Documents","mimeType validate against extension consistency",
    steps="POST .pdf với mimeType=image/png",
    data="-", ui="-", api="201 raw (gap)", side="-", sev="Medium")

add("INTEGRATION","P1","Documents","Document gắn cả Subject (nếu schema cho phép)",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low",
    notes="Check schema if Document.subjectId exists")


# ============================================================
# MODULE 24: PROPOSALS (Đề xuất) (35 TC)
# ============================================================
add("GREEN","P0","Proposals","Tạo Proposal với proposalNumber + content",
    steps="POST /api/proposals {proposalNumber:'DX-2026-001', relatedCaseId, content, unit}",
    data="-", ui="Success", api="201", side="-", sev="High")

add("RED","P0","Proposals","proposalNumber rỗng → 400",
    steps="POST proposalNumber=''", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Proposals","content rỗng → 400",
    steps="POST content=''", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Proposals","proposalNumber duplicate → 409 unique",
    steps="POST 2 lần cùng proposalNumber", data="-", ui="-",
    api="409 hoặc 400", side="-", sev="High", notes="Verify unique constraint")

add("GREEN","P1","Proposals","relatedCaseId optional bỏ trống (general proposal)",
    steps="POST không relatedCaseId", data="-", ui="-", api="201", side="-", sev="Medium")

add("RED","P0","Proposals","relatedCaseId không tồn tại → 400 FK",
    steps="POST", data="-", ui="-", api="400", side="-", sev="High")

add("GREEN","P0","Proposals","Tạo Proposal với sentDate",
    steps="POST sentDate='2026-05-23'", data="-", ui="-", api="201", side="-", sev="Medium")

add("RED","P1","Proposals","sentDate format invalid → 400",
    steps="POST sentDate='23/05/2026'", data="-", ui="-", api="? — verify IsDateString",
    side="-", sev="Medium", notes="DTO dùng IsString — gap, cần IsDateString")

add("GREEN","P0","Proposals","GET /proposals list paginated",
    steps="GET", data="-", ui="-", api="200", side="-", sev="High")

add("GREEN","P0","Proposals","GET /proposals/:id detail",
    steps="GET", data="-", ui="-", api="200", side="-", sev="High")

add("RED","P0","Proposals","GET proposal ngoài scope → 403",
    steps="GET", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Proposals","GET /proposals/NOT_EXIST → 404",
    steps="GET", data="-", ui="-", api="404", side="-", sev="High")

add("GREEN","P0","Proposals","PUT update response + responseDate",
    steps="PUT {response, responseDate}", data="-", ui="-", api="200", side="Audit diff", sev="High")

add("GREEN","P0","Proposals","DELETE soft delete",
    steps="DELETE", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Proposals","Transition PENDING → SENT → RESPONDED",
    steps="2x PUT status", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Proposals","Transition SENT → CANCELLED",
    steps="PUT status='CANCELLED'", data="-", ui="-", api="200", side="-", sev="Medium")

add("RED","P1","Proposals","status='INVALID' → 400 IsEnum",
    steps="-", data="-", ui="-", api="400", side="-", sev="Medium")

add("SECURITY","P0","Proposals","IDOR: POST relatedCaseId của team khác → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY","P0","Proposals","XSS qua content",
    steps="POST content='<script>'", data="-", ui="Escape", api="201", side="-", sev="High")

add("DATA","P1","Proposals","content rất dài (50K chars)",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Proposals","content tiếng Việt có dấu",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("AUDIT","P0","Proposals","PROPOSAL_CREATED audit log",
    steps="POST", data="-", ui="-", api="-", side="metadata.proposalNumber", sev="High")

add("AUDIT","P0","Proposals","PROPOSAL_RESPONDED log với response timestamp",
    steps="PUT", data="-", ui="-", api="-", side="-", sev="High")

add("BOUNDARY","P1","Proposals","proposalNumber 1 ký tự",
    steps="POST proposalNumber='X'", data="-", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY","P1","Proposals","proposalNumber 500 ký tự",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("PERFORMANCE","P1","Proposals","List 100 proposals < 500ms",
    steps="-", data="-", ui="-", api="<500ms", side="-", sev="Medium")

add("A11Y","P1","Proposals","Form input có label",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("COMPAT","P1","Proposals","Chrome mobile OK",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("INTEGRATION","P1","Proposals","Proposal sent → notification gửi đến receiver",
    steps="PUT status='SENT'", data="-", ui="-", api="-",
    side="Notification dispatched (nếu có integration)", sev="Medium",
    notes="Verify workflow")

add("RED","P0","Proposals","VIEWER POST → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="High")

add("RED","P0","Proposals","JWT thiếu → 401",
    steps="-", data="-", ui="-", api="401", side="-", sev="High")

add("RECOVERY","P1","Proposals","Atomic rollback nếu audit fail",
    steps="-", data="-", ui="-", api="500", side="No partial", sev="High")

add("GREEN","P1","Proposals","Filter status=PENDING",
    steps="GET ?status=PENDING", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P1","Proposals","Pagination",
    steps="GET ?limit=10&offset=20", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P1","Proposals","Filter relatedCaseId",
    steps="GET ?relatedCaseId=C001", data="-", ui="-", api="200", side="-", sev="Medium")


# ============================================================
# MODULE 25: DELEGATIONS (Ủy thác điều tra) (35 TC)
# ============================================================
add("GREEN","P0","Delegations","Tạo Delegation với delegationNumber + receivingUnit",
    steps="POST /api/delegations {delegationNumber:'UT-2026-001', receivingUnit:'PC02-Hà Nội', content}",
    data="-", ui="Success", api="201", side="-", sev="High")

add("RED","P0","Delegations","delegationNumber rỗng → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Delegations","receivingUnit rỗng → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Delegations","content rỗng → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Delegations","delegationNumber duplicate → 409",
    steps="-", data="-", ui="-", api="409", side="-", sev="High")

add("GREEN","P0","Delegations","relatedCaseId optional",
    steps="-", data="-", ui="-", api="201", side="-", sev="Medium")

add("RED","P0","Delegations","relatedCaseId không tồn tại → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("GREEN","P0","Delegations","GET list paginated",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("GREEN","P0","Delegations","GET detail",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("RED","P0","Delegations","GET ngoài scope → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Delegations","GET NOT_EXIST → 404",
    steps="-", data="-", ui="-", api="404", side="-", sev="High")

add("GREEN","P0","Delegations","PUT update content + completedDate",
    steps="-", data="-", ui="-", api="200", side="Audit", sev="High")

add("GREEN","P0","Delegations","DELETE soft delete",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Delegations","Transition PENDING → IN_PROGRESS",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Delegations","Transition IN_PROGRESS → COMPLETED",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","Delegations","Transition any → CANCELLED",
    steps="-", data="-", ui="-", api="200", side="-", sev="Medium")

add("RED","P0","Delegations","COMPLETED → PENDING (downgrade) → block",
    steps="-", data="-", ui="-", api="400", side="-", sev="High",
    notes="State machine constraint")

add("SECURITY","P0","Delegations","IDOR relatedCaseId team khác",
    steps="-", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY","P0","Delegations","XSS content",
    steps="-", data="-", ui="-", api="201 escape", side="-", sev="High")

add("DATA","P1","Delegations","receivingUnit tiếng Việt 'Phòng Cảnh sát Hà Nội'",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Delegations","content nhiều paragraph",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Delegations","delegationDate ISO format",
    steps="-", data="-", ui="-", api="201", side="-", sev="Medium")

add("RED","P1","Delegations","delegationDate format invalid → 400 (nếu IsDateString)",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium",
    notes="DTO dùng IsString — verify gap")

add("AUDIT","P0","Delegations","DELEGATION_CREATED log",
    steps="-", data="-", ui="-", api="-", side="metadata", sev="High")

add("AUDIT","P0","Delegations","DELEGATION_COMPLETED log với completedDate",
    steps="-", data="-", ui="-", api="-", side="-", sev="High")

add("BOUNDARY","P1","Delegations","delegationNumber 1 ký tự",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY","P1","Delegations","content 100K ký tự",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("PERFORMANCE","P1","Delegations","List 50 delegations < 500ms",
    steps="-", data="-", ui="-", api="<500ms", side="-", sev="Medium")

add("A11Y","P1","Delegations","Form A11Y compliant",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("COMPAT","P1","Delegations","Form mobile responsive",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("INTEGRATION","P1","Delegations","Delegation cùng caseId hiển thị trong Case detail tab",
    steps="GET /cases/X (include delegations)", data="-", ui="Tab show", api="-", side="-", sev="Medium")

add("RED","P0","Delegations","VIEWER POST → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="High")

add("RED","P0","Delegations","JWT thiếu → 401",
    steps="-", data="-", ui="-", api="401", side="-", sev="High")

add("GREEN","P1","Delegations","Filter status=PENDING",
    steps="-", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P1","Delegations","Filter by receivingUnit",
    steps="-", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P1","Delegations","Pagination",
    steps="-", data="-", ui="-", api="200", side="-", sev="Medium")


# ============================================================
# MODULE 26: INVESTIGATION SUPPLEMENTS (Bổ sung điều tra) (30 TC)
# ============================================================
add("GREEN","P0","Supplements","Tạo Supplement caseId + decisionNumber + reason + deadline",
    steps="POST /api/investigation-supplements",
    data="caseId, type='Gia hạn điều tra', decisionNumber:'GH-2026-001', reason:'Cần thêm thời gian', deadline='2026-09-23'",
    ui="-", api="201", side="-", sev="High")

add("RED","P0","Supplements","caseId rỗng → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Supplements","type rỗng → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Supplements","decisionNumber rỗng → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","Supplements","reason rỗng → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P1","Supplements","decisionDate sai ISO → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="Medium")

add("RED","P1","Supplements","deadline sai ISO → 400",
    steps="-", data="-", ui="-", api="400", side="-", sev="Medium")

add("RED","P1","Supplements","deadline < decisionDate (deadline trước quyết định)",
    steps="-", data="-", ui="-", api="? — verify business",
    side="-", sev="Medium", notes="Gap")

add("GREEN","P0","Supplements","GET list paginated",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("GREEN","P0","Supplements","GET detail",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("RED","P0","Supplements","GET ngoài scope → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","Supplements","GET NOT_EXIST → 404",
    steps="-", data="-", ui="-", api="404", side="-", sev="High")

add("GREEN","P0","Supplements","PUT update reason",
    steps="-", data="-", ui="-", api="200", side="Audit", sev="High")

add("GREEN","P0","Supplements","DELETE soft delete",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("INTEGRATION","P0","Supplements","Tạo supplement → Case.soLanGiaHan auto-increment",
    steps="POST supplement type='Gia hạn'", data="-", ui="-",
    api="201", side="Case.soLanGiaHan +1", sev="High",
    notes="Verify business logic")

add("INTEGRATION","P0","Supplements","Tạo supplement với deadline mới → Case.deadline update",
    steps="POST với deadline xa hơn", data="-", ui="-",
    api="201", side="Case.deadline = supplement.deadline mới", sev="High",
    notes="Verify integration")

add("SECURITY","P0","Supplements","IDOR caseId team khác → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="Critical")

add("SECURITY","P0","Supplements","XSS reason",
    steps="-", data="-", ui="-", api="201 escape", side="-", sev="High")

add("DATA","P1","Supplements","reason tiếng Việt long text",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("DATA","P1","Supplements","decisionNumber format 'XYZ-2026-001'",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("AUDIT","P0","Supplements","SUPPLEMENT_CREATED log",
    steps="-", data="-", ui="-", api="-", side="metadata", sev="High")

add("BOUNDARY","P1","Supplements","decisionNumber 1 ký tự",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY","P1","Supplements","reason 50K ký tự",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("PERFORMANCE","P1","Supplements","List < 500ms",
    steps="-", data="-", ui="-", api="<500ms", side="-", sev="Medium")

add("A11Y","P1","Supplements","Form A11Y",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("COMPAT","P1","Supplements","Mobile responsive",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("RED","P0","Supplements","VIEWER POST → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="High")

add("RED","P0","Supplements","JWT thiếu → 401",
    steps="-", data="-", ui="-", api="401", side="-", sev="High")

add("GREEN","P1","Supplements","Filter by caseId",
    steps="-", data="-", ui="-", api="200", side="-", sev="Medium")

add("GREEN","P1","Supplements","Filter by type",
    steps="-", data="-", ui="-", api="200", side="-", sev="Medium")


# ============================================================
# MODULE 27: PETITION → CASE FLOW (sub-feature integration) (35 TC)
# ============================================================
add("GREEN","P0","PetitionFlow","Petition convertToCase (POST /petitions/:id/convert)",
    steps="POST /api/petitions/PET-001/convert",
    data="-", ui="Redirect /cases/<newCaseId>",
    api="201, Petition.linkedCaseId set, status=DA_CHUYEN_VU_AN", side="-", sev="Critical")

add("RED","P0","PetitionFlow","convertToCase Petition đã linked → 400 'Đã khởi tố rồi'",
    pre="PET-002 có linkedCaseId", steps="POST convert",
    data="-", ui="-", api="400 hoặc 409", side="-", sev="High")

add("RED","P0","PetitionFlow","convertToCase ngoài scope → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="Critical")

add("RED","P0","PetitionFlow","convertToCase Petition soft-deleted → 404",
    steps="-", data="-", ui="-", api="404", side="-", sev="High")

add("STATE","P0","PetitionFlow","Petition.status transition MOI_TIEP_NHAN → DA_CHUYEN_VU_AN (convert)",
    steps="-", data="-", ui="-", api="-", side="auto on convert", sev="High")

add("STATE","P0","PetitionFlow","Petition.status MOI_TIEP_NHAN → DANG_XU_LY (manual)",
    steps="PUT petition status", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","PetitionFlow","Petition.status DANG_XU_LY → CHO_PHE_DUYET",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","PetitionFlow","Petition.status CHO_PHE_DUYET → DA_GIAI_QUYET",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","PetitionFlow","Petition.status any → DA_LUU_DON (lưu đơn)",
    steps="-", data="-", ui="-", api="200", side="-", sev="Medium")

add("STATE","P0","PetitionFlow","Petition.status → DA_CHUYEN_VU_VIEC (chuyển vụ việc)",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("RED","P0","PetitionFlow","Petition DA_CHUYEN_VU_AN không sửa được",
    pre="status=DA_CHUYEN_VU_AN",
    steps="PUT petition", data="-", ui="-", api="400", side="-", sev="High")

add("INTEGRATION","P0","PetitionFlow","Cascade: Update Case.metadata.petitionType → sync Petition.petitionType",
    steps="PUT Case.metadata.petitionType='KHIEU_NAI'", data="-", ui="-",
    api="-", side="Petition.petitionType updated automatically (v0.37.2.5)", sev="High")

add("INTEGRATION","P0","PetitionFlow","Update Case không có Petition link KHÔNG tạo phantom Petition",
    steps="PUT Case metadata.petitionType, không có linkedPetition",
    data="-", ui="-", api="200",
    side="No new Petition created (v0.37.2.5 BLTTHS Đ.143)", sev="Critical")

add("GREEN","P0","PetitionFlow","STT auto-generate format DT-YYYY-NNNNN",
    steps="POST 3 petition liên tiếp",
    data="-", ui="-", api="stt = DT-2026-00001, 00002, 00003", side="-", sev="High")

add("RED","P0","PetitionFlow","STT race condition: 2 concurrent create không tạo duplicate STT",
    steps="2 parallel POST", data="-", ui="-",
    api="2 stt khác nhau", side="generateStt + unique constraint", sev="Critical")

add("RED","P0","PetitionFlow","convertToCase Petition status không phải MOI_TIEP_NHAN/DANG_XU_LY → 400",
    pre="status=DA_LUU_DON", steps="POST convert", data="-", ui="-", api="400",
    side="-", sev="High", notes="Verify state guard")

add("AUDIT","P0","PetitionFlow","PETITION_CONVERTED log với linkedCaseId",
    steps="POST convert", data="-", ui="-", api="-",
    side="audit row PETITION_CONVERTED metadata.caseId", sev="High")

add("SECURITY","P0","PetitionFlow","convertToCase atomic — race 2 user → 1 conflict",
    steps="-", data="-", ui="-", api="1×201 + 1×409", side="-", sev="Critical")

add("DATA","P1","PetitionFlow","Petition senderName tiếng Việt có dấu",
    steps="-", data="-", ui="-", api="201", side="-", sev="Low")

add("BOUNDARY","P1","PetitionFlow","stt cuối cùng năm 99999 → tràn?",
    steps="POST khi đã có DT-2026-99999",
    data="-", ui="-", api="? — verify overflow handling", side="-", sev="Low",
    notes="Gap: padStart 5 — 100000 sẽ thành 100000 (6 chars)")

add("INTEGRATION","P0","PetitionFlow","Delete Petition KHÔNG delete linked Case (Restrict)",
    steps="DELETE Petition có linkedCase",
    data="-", ui="-", api="400 hoặc Restrict block", side="-", sev="High",
    notes="onDelete: Restrict")

add("INTEGRATION","P0","PetitionFlow","Delete Case → Petition.linkedCaseId vẫn giữ (Restrict)",
    steps="DELETE Case (status TIEP_NHAN không có Petition link)",
    data="-", ui="-", api="-", side="No FK cascade", sev="High")

add("PERFORMANCE","P1","PetitionFlow","convertToCase < 1s",
    steps="-", data="-", ui="-", api="<1s", side="-", sev="Medium")

add("RED","P0","PetitionFlow","convertToCase VIEWER → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="High")

add("RED","P0","PetitionFlow","convertToCase JWT thiếu → 401",
    steps="-", data="-", ui="-", api="401", side="-", sev="High")

add("GREEN","P1","PetitionFlow","Petition tab trong Case detail show linked petitions[]",
    steps="GET /cases/X", data="-", ui="Tab show petitions",
    api="data.petitions=[{stt, petitionType, status, receivedDate, ...}]", side="-", sev="High")

add("GREEN","P1","PetitionFlow","Multiple petitions linked to same Case (1-to-many)",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium",
    notes="Petition.linkedCaseId not unique")

add("STATE","P0","PetitionFlow","CaseProvenance=FROM_PETITION → Case có linkedPetitionId set",
    steps="POST Case FROM_PETITION", data="-", ui="-",
    api="data.linkedPetitionId='PET-001'", side="-", sev="Critical")

add("STATE","P0","PetitionFlow","CaseProvenance ≠ FROM_PETITION → linkedPetitionId=null",
    steps="POST DIRECT_DISCOVERY", data="-", ui="-",
    api="data.linkedPetitionId=null", side="-", sev="Critical")

add("DATA","P1","PetitionFlow","petitionType enum: TO_GIAC, KHIEU_NAI, TIN_BAO, ...",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("RED","P1","PetitionFlow","petitionType='Vietnamese label' → 400 (v0.37.2.4 BUG)",
    steps="POST petitionType='Tố giác'",
    data="-", ui="-", api="400 phải dùng enum value",
    side="-", sev="High", notes="Root cause v0.37.2.4 P0")

add("GREEN","P1","PetitionFlow","petitionType='TO_GIAC' enum value pass",
    steps="-", data="-", ui="-", api="201", side="-", sev="High")

add("INTEGRATION","P0","PetitionFlow","Petition convertToCase preserve provenance traceability",
    steps="-", data="-", ui="Case detail show 'Khởi tố từ Petition PET-001'",
    api="data.linkedPetition included", side="-", sev="High")

add("INTEGRATION","P0","PetitionFlow","E2E: Tạo Petition → review → convert Case → assign team",
    steps="Full flow E2E", data="-", ui="Mọi bước OK", api="-",
    side="Audit trail đủ 4 events", sev="Critical")

add("RECOVERY","P1","PetitionFlow","convertToCase fail giữa tx → Petition vẫn nguyên",
    steps="Mock fail in tx", data="-", ui="-", api="500",
    side="Petition.status không đổi, linkedCaseId vẫn null", sev="Critical")


# ============================================================
# MODULE 28: INCIDENT → CASE FLOW (30 TC)
# ============================================================
add("GREEN","P0","IncidentFlow","Incident convertToCase",
    steps="POST /api/incidents/INC-001/convert",
    data="-", ui="-", api="201", side="-", sev="Critical")

add("RED","P0","IncidentFlow","Incident đã linked → 400",
    pre="-", steps="-", data="-", ui="-", api="400", side="-", sev="High")

add("RED","P0","IncidentFlow","Incident ngoài scope → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="Critical")

add("STATE","P0","IncidentFlow","Incident.status MOI_TIEP_NHAN → DANG_XAC_MINH",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","IncidentFlow","Incident → TAM_DINH_CHI",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","IncidentFlow","Incident → PHUC_HOI_NGUON_TIN",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("STATE","P0","IncidentFlow","Incident TAM_DINH_CHI → DANG_XAC_MINH (phục hồi)",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("INTEGRATION","P0","IncidentFlow","Incident → Case keep linkage (Incident.linkedCaseId)",
    steps="POST Case FROM_INCIDENT", data="-",
    ui="-", api="-", side="Incident.linkedCaseId=newCaseId", sev="Critical")

add("INTEGRATION","P0","IncidentFlow","Delete Incident có linkedCase Restrict",
    steps="DELETE Incident có linkedCase",
    data="-", ui="-", api="Restrict block", side="-", sev="High")

add("GREEN","P0","IncidentFlow","CaseProvenance=FROM_INCIDENT → linkedIncidentId set",
    steps="-", data="-", ui="-", api="-", side="-", sev="Critical")

add("RED","P0","IncidentFlow","FROM_INCIDENT thiếu expectedIncidentUpdatedAt → 400",
    steps="POST Case FROM_INCIDENT không expectedIncidentUpdatedAt",
    data="-", ui="-", api="400", side="-", sev="High")

add("SECURITY","P0","IncidentFlow","Race convertToCase 2 user same Incident → 1×409",
    steps="-", data="-", ui="-", api="-", side="-", sev="Critical")

add("AUDIT","P0","IncidentFlow","INCIDENT_CONVERTED audit",
    steps="-", data="-", ui="-", api="-", side="metadata.caseId", sev="High")

add("DATA","P1","IncidentFlow","Incident có deadlineRuleVersionId tracked",
    steps="-", data="-", ui="-", api="-",
    side="THOI_HAN_XAC_MINH rule version snapshot", sev="Medium",
    notes="DeadlineRules feature")

add("INTEGRATION","P1","IncidentFlow","E2E: Tạo Incident → assign → convert Case → KPI dashboard update",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("PERFORMANCE","P1","IncidentFlow","convertToCase < 1s",
    steps="-", data="-", ui="-", api="<1s", side="-", sev="Medium")

add("RECOVERY","P1","IncidentFlow","convertToCase fail giữa tx → Incident nguyên",
    steps="-", data="-", ui="-", api="500", side="-", sev="High")

add("RED","P0","IncidentFlow","VIEWER convert → 403",
    steps="-", data="-", ui="-", api="403", side="-", sev="High")

add("RED","P0","IncidentFlow","JWT thiếu → 401",
    steps="-", data="-", ui="-", api="401", side="-", sev="High")

add("STATE","P0","IncidentFlow","Incident TAM_DINH_CHI_LAI (lần 2 trở đi)",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("GREEN","P1","IncidentFlow","Incident detail show ketQuaXacMinh + ngayPhucHoi",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("DATA","P1","IncidentFlow","Incident kết quả phục hồi enum khác Case",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("BOUNDARY","P1","IncidentFlow","Incident deadline override Case deadline?",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("INTEGRATION","P0","IncidentFlow","Multiple Incidents linked to same Case (1-to-many)",
    steps="-", data="-", ui="-", api="-",
    side="Incident.linkedCaseId multiple rows for same Case",
    sev="High", notes="linkedIncidents in Case schema")

add("INTEGRATION","P0","IncidentFlow","Delete Case có linkedIncidents → block 400",
    steps="DELETE Case có Incident link",
    data="-", ui="'Không thể xóa: vụ án đang liên kết N vụ việc'", api="400",
    side="-", sev="High")

add("STATE","P0","IncidentFlow","Incident status transitions match BLTTHS",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("SECURITY","P0","IncidentFlow","IDOR convertToCase với Incident ID team khác",
    steps="-", data="-", ui="-", api="404 (IDOR-safe)", side="-", sev="Critical")

add("INTEGRATION","P0","IncidentFlow","Convert Incident → Case → Subject (E2E)",
    steps="-", data="-", ui="-", api="-", side="-", sev="High")

add("RED","P0","IncidentFlow","convertToCase Incident soft-deleted → 404",
    steps="-", data="-", ui="-", api="404", side="-", sev="High")

add("AUDIT","P0","IncidentFlow","INCIDENT_STATUS_CHANGED audit có fromStatus/toStatus",
    steps="-", data="-", ui="-", api="-", side="-", sev="High")


# ============================================================
# MODULE 29: ADDITIONAL STATE/DECISION + FINAL EDGE CASES (35 TC)
# ============================================================
add("STATE","P0","Extra","Update status TIEP_NHAN → DA_KET_LUAN skip middle steps",
    steps="-", data="-", ui="-", api="? — verify state machine", side="-", sev="High",
    notes="Gap nếu cho phép skip")

add("STATE","P0","Extra","Update status với 5 lần TAM_DINH_CHI ↔ DANG_DIEU_TRA",
    steps="2 lần phục hồi + 2 lần TĐC",
    data="-", ui="-", api="200", side="soLanTamDinhChi=2", sev="High")

add("STATE","P0","Extra","Update concurrent: 2 user đổi status khác nhau",
    steps="A→DANG_DIEU_TRA, B→TAM_DINH_CHI cùng lúc",
    data="-", ui="-", api="1 success, 1 P2025/409 if expectedUpdatedAt",
    side="-", sev="Critical")

add("DECISION","P0","Extra","Combination: ADMIN + Case DELETED 1 năm trước → restore OK",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("DECISION","P0","Extra","Combination: dispatcher xem case ward → bypass scope",
    steps="-", data="-", ui="-", api="200", side="-", sev="High")

add("DECISION","P0","Extra","Combination: ward officer + assignedTeamId override",
    steps="-", data="-", ui="-", api="201 with override", side="-", sev="High")

add("DECISION","P0","Extra","User MULTI-TEAM (thuộc 2 teams) — scope union",
    steps="dieuTra-X thuộc Team-Q1 và Team-Q2, GET cases",
    data="-", ui="-", api="data có case của cả 2 team", side="-", sev="High")

add("DECISION","P0","Extra","User has writableTeamIds ⊂ teamIds (read-only some)",
    steps="-", data="-", ui="-", api="-", side="-", sev="High",
    notes="DataScope split: read vs write")

add("RED","P0","Extra","forbidNonWhitelisted strict cho mọi DTO update",
    steps="PUT {evilField:'x'}", data="-", ui="-", api="400", side="-", sev="High")

add("SECURITY","P0","Extra","Privilege escalation: change own role qua DTO mass-assign",
    steps="-", data="-", ui="-", api="400 forbidNonWhitelisted",
    side="-", sev="Critical")

add("SECURITY","P0","Extra","XSS reflected qua URL search → sanitize",
    steps="GET /cases?search=<script>", data="-", ui="-",
    api="200 (Prisma escape)", side="-", sev="High")

add("SECURITY","P0","Extra","Open redirect: ?returnUrl=https://evil.com",
    steps="-", data="-", ui="-", api="-", side="-", sev="High",
    notes="N/A nếu app không dùng returnUrl")

add("SECURITY","P0","Extra","CSP header restrict inline script",
    steps="-", data="-", ui="-", api="Header set", side="-", sev="High")

add("SECURITY","P0","Extra","Referrer-Policy: strict-origin-when-cross-origin",
    steps="-", data="-", ui="-", api="Header", side="-", sev="Medium")

add("PERFORMANCE","P1","Extra","Cold start API after restart < 5s first request",
    steps="-", data="-", ui="-", api="<5s", side="-", sev="Low")

add("PERFORMANCE","P1","Extra","DB connection pool exhaustion test",
    steps="50 concurrent slow query", data="-", ui="-",
    api="Connection pool wait, no timeout", side="-", sev="Medium")

add("PERFORMANCE","P1","Extra","Memory leak test: 100 sequential create",
    steps="-", data="-", ui="-", api="-", side="Heap not growing", sev="Medium")

add("PERFORMANCE","P1","Extra","Audit log không slow main response",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("PERFORMANCE","P1","Extra","Index hit on overdue+status query",
    steps="EXPLAIN ANALYZE", data="-", ui="-",
    api="-", side="Index usage on @@index([deadline, status])", sev="Low")

add("A11Y","P1","Extra","CaseListPage table có scope='col' th",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y","P1","Extra","Pagination buttons có aria-label",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y","P1","Extra","Sort indicator aria-sort='ascending|descending'",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y","P1","Extra","Toast notification có role='alert' aria-live",
    steps="-", data="-", ui="-", api="-", side="-", sev="High")

add("A11Y","P1","Extra","Skip-to-main-content link",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("A11Y","P1","Extra","Form fieldset/legend cho group",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("A11Y","P1","Extra","Color contrast cho disabled state ≥ 3:1",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("COMPAT","P1","Extra","Chrome incognito mode — cookies/localStorage",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT","P1","Extra","Safari iOS pinch-zoom enabled",
    steps="-", data="-", ui="-", api="-", side="-", sev="Medium")

add("COMPAT","P1","Extra","High DPI display Retina — text crisp",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low")

add("DATA","P1","Extra","UTF-8 BOM handling trong file upload (CSV import)",
    steps="-", data="-", ui="-", api="-", side="-", sev="Low",
    notes="N/A nếu không support CSV upload")

add("DATA","P1","Extra","Date timezone conversion cross-timezone view",
    steps="User UTC view case từ +07:00",
    data="-", ui="-", api="-", side="DB UTC stored", sev="Medium")

add("RECOVERY","P1","Extra","Page refresh giữa edit Case → unsaved changes warning",
    steps="Edit form, F5",
    data="-", ui="Browser warn 'You have unsaved changes'", api="-",
    side="beforeunload listener", sev="Medium")

add("RECOVERY","P1","Extra","Token expired during form edit → re-login flow without losing data",
    steps="JWT exp giữa edit, submit fail 401, re-login",
    data="-", ui="Form data preserved", api="401", side="-", sev="High")

add("AUDIT","P0","Extra","Audit log không expose internal trace/stack",
    steps="-", data="-", ui="-", api="-",
    side="Production error sanitize", sev="Critical")

add("INTEGRATION","P0","Extra","Cross-feature: tạo Case → KPI dashboard refresh count",
    steps="-", data="-", ui="-", api="-", side="-", sev="High")


# end
print(f"Total TC generated: {len(tcs)}")
print(f"Type breakdown:")
from collections import Counter
type_counter = Counter(t['type'] for t in tcs)
pri_counter = Counter(t['priority'] for t in tcs)
for k, v in sorted(type_counter.items()):
    print(f"  {k}: {v}")
print(f"Priority breakdown: {dict(pri_counter)}")

# Build final JSON
data = {
    "feature_name": "Quản lý vụ việc / vụ án (Case Management) — toàn bộ chức năng",
    "complexity": "complex",
    "scope": {
        "in_scope": [
            "CRUD vụ án (tạo / xem / sửa / xóa mềm / khôi phục) qua API + UI",
            "10 trạng thái CaseStatus (TIEP_NHAN, DANG_XAC_MINH, DA_XAC_MINH, DANG_DIEU_TRA, TAM_DINH_CHI, DINH_CHI, DA_KET_LUAN, DANG_TRUY_TO, DANG_XET_XU, DA_LUU_TRU) + chuyển trạng thái + lưu CaseStatusHistory",
            "CaseProvenance — FROM_PETITION/FROM_INCIDENT/DIRECT_DISCOVERY/TRANSFERRED/OTHER_LEGAL_SOURCE (BLTTHS Đ.143)",
            "Optimistic lock qua expectedUpdatedAt + expectedPetitionUpdatedAt + expectedIncidentUpdatedAt",
            "DataScope team-based access control (investigator + team + dispatcher + ADMIN + ward officer)",
            "Soft delete với reason 10-500 chars + ràng buộc status=TIEP_NHAN + 8-step validation chain + TOCTOU guard + restore ADMIN-only",
            "Assign / re-assign dispatcher-only + ward → non-ward escalation audit (v0.35a)",
            "Search / filter (status, investigator, unit, date range, overdue, district/ward, capDoToiPham, wardTeamId)",
            "Export Excel theo phường/xã + theo phân loại khác (rate-limited 5 req/60s) + audit CASE_EXPORTED",
            "TĐC tracking: lyDoTamDinhChiVuAn (Đ.229 BLTTHS), auto-set ngayTamDinhChi + soLanTamDinhChi increment; phục hồi với daRaSoat + ketQuaPhucHoiVuAn",
            "TDC backfill cho legacy data (PATCH /tdc-backfill)",
            "Status history view với changedBy + changedAt",
            "Audit log đầy đủ: CASE_CREATED, CASE_UPDATED, CASE_STATUS_CHANGED, CASE_DELETED, CASE_RESTORED, CASE_ASSIGNED, CASE_ESCALATED_FROM_WARD, CASE_EXPORTED",
            "BUG-001/002/004 (v0.37.2.7): trim + reject empty/whitespace-only cho name"
        ],
        "out_of_scope": [
            "Penetration test full (giao team Security)",
            "Load test >1000 concurrent user (dùng JMeter riêng)",
            "KPI Dashboard chi tiết — test trong feature KPI",
            "Comprehensive list / Initial cases / Cases Tdc Backfill page — đã tách feature",
            "Module Petition / Incident sâu — test riêng",
            "Sub-resources detail: Subject CRUD, Lawyer CRUD, Conclusion CRUD, Document upload — test riêng",
            "Auto-deadline calculation logic chi tiết theo SystemSetting — test riêng module Settings",
            "VKS meetings, Action Plans, Delegations, Proposals sub-modules — test riêng"
        ],
        "exit_criteria": "100% TC P0 PASS; ≥95% P1 PASS; ≥85% P2 PASS; 0 defect Critical/High mở; ≤5 defect Medium mở; tất cả SECURITY case PASS; A11Y axe-core 0 violation Level A"
    },
    "test_cases": tcs,
    "test_data": {
        "accounts": [
            {"id":"U001","email":"admin@pc02.local","password":"Admin@2026!","role":"ADMIN","status":"Active","purpose":"Test ADMIN-only restore + listDeleted + bypass scope","notes":"Quyền cao nhất"},
            {"id":"U002","email":"dispatcher@pc02.local","password":"Disp@2026!","role":"DISPATCHER","status":"Active","purpose":"Test PATCH /assign + canDispatch bypass","notes":"canDispatch=true"},
            {"id":"U003","email":"dieuTra1@pc02.local","password":"DTV@2026!","role":"INVESTIGATOR","status":"Active","purpose":"Owner + same-team test, creator delete","notes":"Thuộc Team-Q1"},
            {"id":"U004","email":"dieuTra2@pc02.local","password":"DTV@2026!","role":"INVESTIGATOR","status":"Active","purpose":"Same-team với U003 (Team-Q1)","notes":""},
            {"id":"U005","email":"dieuTra3-Q3@pc02.local","password":"DTV@2026!","role":"INVESTIGATOR","status":"Active","purpose":"Different team (Team-Q3) — test scope reject","notes":""},
            {"id":"U006","email":"wardOfficer1@pc02.local","password":"WO@2026!","role":"WARD_OFFICER","status":"Active","purpose":"Test isWardOfficer auto-set assignedTeamId override","notes":"Thuộc Team-WARD-01"},
            {"id":"U007","email":"viewer@pc02.local","password":"View@2026!","role":"VIEWER","status":"Active","purpose":"Test 403 cho write/delete/restore","notes":"Chỉ read"},
            {"id":"U008","email":"locked@pc02.local","password":"-","role":"INVESTIGATOR","status":"Locked","purpose":"Test JWT của user locked","notes":""}
        ],
        "boundary_values": [
            {"field":"name","value":"A","type":"min","expected":"PASS","notes":"1 ký tự min"},
            {"field":"name","value":"X×500","type":"max","expected":"PASS","notes":"500 ký tự max"},
            {"field":"name","value":"X×501","type":"max+1","expected":"FAIL","notes":"vượt MaxLength(500)"},
            {"field":"name","value":"","type":"empty","expected":"FAIL","notes":"IsNotEmpty"},
            {"field":"name","value":"   ","type":"whitespace","expected":"FAIL","notes":"Transform trim → ''"},
            {"field":"crime","value":"X×255","type":"max","expected":"PASS","notes":""},
            {"field":"crime","value":"X×256","type":"max+1","expected":"FAIL","notes":""},
            {"field":"unit","value":"X×255","type":"max","expected":"PASS","notes":""},
            {"field":"unit","value":"X×256","type":"max+1","expected":"FAIL","notes":""},
            {"field":"subjectsCount","value":"0","type":"min","expected":"PASS","notes":""},
            {"field":"subjectsCount","value":"-1","type":"min-1","expected":"FAIL","notes":"@Min(0)"},
            {"field":"delete-reason","value":"X×10","type":"min","expected":"PASS","notes":"MinLength(10)"},
            {"field":"delete-reason","value":"X×9","type":"min-1","expected":"FAIL","notes":""},
            {"field":"delete-reason","value":"X×500","type":"max","expected":"PASS","notes":""},
            {"field":"delete-reason","value":"X×501","type":"max+1","expected":"FAIL","notes":""},
            {"field":"sourceDocumentNote","value":"X×1000","type":"max","expected":"PASS","notes":""},
            {"field":"sourceDocumentNote","value":"X×1001","type":"max+1","expected":"FAIL","notes":""},
            {"field":"limit","value":"1","type":"min","expected":"PASS","notes":""},
            {"field":"limit","value":"100","type":"max","expected":"PASS","notes":""},
            {"field":"limit","value":"101","type":"max+1","expected":"FAIL","notes":"@Max(100)"},
            {"field":"limit","value":"0","type":"min-1","expected":"FAIL","notes":"@Min(1)"},
            {"field":"offset","value":"0","type":"min","expected":"PASS","notes":""},
            {"field":"offset","value":"-1","type":"min-1","expected":"FAIL","notes":""}
        ],
        "payloads": [
            {"target":"search","payload":"' OR 1=1--","attack_type":"SQL Injection","expected":"200 data=[] (Prisma parameterized)","owasp_ref":"A03:2021"},
            {"target":"sortBy","payload":"name; DROP TABLE cases--","attack_type":"SQL Injection via orderBy","expected":"200 fallback createdAt (whitelist)","owasp_ref":"A03:2021"},
            {"target":"name","payload":"<script>alert(1)</script>","attack_type":"XSS reflected","expected":"201 lưu raw, React escape ở render","owasp_ref":"A03:2021"},
            {"target":"crime","payload":"<img src=x onerror=alert(1)>","attack_type":"XSS stored","expected":"201, không exec JS khi render","owasp_ref":"A03:2021"},
            {"target":"metadata","payload":"{\"__proto__\":{\"isAdmin\":true}}","attack_type":"Prototype Pollution","expected":"201 nhưng object không pollute","owasp_ref":"A03:2021"},
            {"target":"linkedPetitionId","payload":"<id-thuộc-team-khác>","attack_type":"IDOR","expected":"404 (no enumeration leak)","owasp_ref":"A01:2021"},
            {"target":"GET /cases/<id-team-khác>","payload":"-","attack_type":"Horizontal privilege","expected":"403","owasp_ref":"A01:2021"},
            {"target":"PATCH /assign","payload":"non-dispatcher token","attack_type":"Vertical privilege","expected":"403 DispatchGuard","owasp_ref":"A01:2021"},
            {"target":"POST /cases","payload":"{createdById:'evil', id:'fake', deletedAt:'2030'}","attack_type":"Mass assignment","expected":"400 forbidNonWhitelisted","owasp_ref":"A08:2021"},
            {"target":"Authorization","payload":"<expired JWT>","attack_type":"Token expiry","expected":"401","owasp_ref":"A07:2021"},
            {"target":"Authorization","payload":"<tampered signature JWT>","attack_type":"Token tamper","expected":"401","owasp_ref":"A07:2021"},
            {"target":"GET /export/ward","payload":"6 req/60s","attack_type":"Rate limit bypass","expected":"6th=429","owasp_ref":"A04:2021"},
            {"target":"Origin","payload":"https://evil.com","attack_type":"CORS bypass","expected":"Reject preflight","owasp_ref":"A05:2021"},
            {"target":"Content-Type","payload":"text/plain (mismatch)","attack_type":"Content type bypass","expected":"400 nếu mong JSON","owasp_ref":"A05:2021"}
        ]
    }
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"Wrote {OUT}")
