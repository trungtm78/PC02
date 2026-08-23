# UAT Test Cases — Untitled Feature

**Generated**: 23/08/2026 14:02  
**Complexity**: `medium`  
**Total TC**: 198  
**Companion Excel**: file `.xlsx` cùng tên trong thư mục này

## 🤖 Hướng dẫn cho Claude Code

File này được thiết kế để Claude Code đọc khi cần **fix bug** từ kết quả UAT.

**Workflow**:
1. Đọc section `## TC-XXX` của TC bị fail để hiểu context
2. Đọc `### 🔧 Fix Context` để biết khu vực code cần kiểm tra
3. Edit code → chạy lại test → đánh dấu `**Status**: Verified` trong Bug Report
4. File `.xlsx` companion được update bởi runner — KHÔNG edit thủ công

**Quy ước parsing**:
- TC ID nằm trong heading `## TC-XXX` (anchor-able)
- Bug report ở format YAML trong code fence
- Checklist `- [ ]` có thể tick bằng cách thay thành `- [x]`
- Test Data ở section riêng — load 1 lần dùng cho nhiều TC

## 🔍 Self-Audit

**Tổng số TC**: 198

**Phân bố loại**:
- `GREEN`: 43
- `RED`: 34
- `UX`: 21
- `E2E`: 13
- `DECISION`: 12
- `EP`: 10
- `BOUNDARY`: 9
- `SECURITY`: 9
- `EDGE`: 8
- `INTEGRATION`: 7
- `DATA`: 7
- `STATE`: 7
- `AUDIT`: 6
- `REGRESSION`: 3
- `A11Y`: 3
- `METAMORPHIC`: 2
- `PERFORMANCE`: 2
- `RECOVERY`: 1
- `EXPLORATORY`: 1

**Phân bố priority**:
- 🔴 `P0`: 118
- 🟠 `P1`: 63
- 🟡 `P2`: 17

**Phân bố severity nếu fail**:
-  `S1`: 95
-  `S2`: 68
-  `S3`: 30
-  `S4`: 5

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

## 🗂️ Data Maturity Matrix

> Data fixtures được runner tự động seed trước test, KHÔNG cần human chạy SQL.
> Mỗi fixture có ID format `<entity>.<state>.<lifecycle>.<shape>`.

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `new` | **Lifecycle**: `D0` | **Shape**: `empty`

**Setup** (api):
```json
"POST /api/v1/cases với trường bắt buộc tối thiểu; name='UAT-CF-{{random}}'"
```

**Cleanup**:
```json
"DELETE /api/v1/cases/{{case_id}}"
```

**Outputs**: `case_id`, `case_code`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `canonical-populated` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"POST /api/v1/cases rồi PUT đặt giá trị cho các cột chuẩn (tenCungCap, cccdCungCap, sdtCungCap, diaChiCungCap, moTaChiTiet, noiXayRa) + statistic"
```

**Cleanup**:
```json
"DELETE /api/v1/cases/{{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `legacy-meta-only` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: tạo case rồi UPDATE cases SET metadata = jsonb_build_object('tenCungCap','UAT-META-{{random}}','noiXayRa','UAT-NOI-{{random}}'), \"tenCungCap\"=NULL, \"noiXayRa\"=NULL WHERE id={{case_id}}"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `col-differs-from-meta` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"SQL: UPDATE cases SET \"noiXayRa\"='GIATRI-MOI-{{random}}', metadata=metadata||jsonb_build_object('noiXayRa','GIATRI-CU-{{random}}') WHERE id={{case_id}}"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `legacy-consolidated` | **Lifecycle**: `D30` | **Shape**: `full`

**Setup** (api):
```json
"Chọn hồ sơ THẬT có soHoSoCu IS NOT NULL và cột chuẩn đã có giá trị: SELECT id FROM cases WHERE \"soHoSoCu\" IS NOT NULL AND \"tenCungCap\" IS NOT NULL LIMIT 1"
```

**Cleanup**:
```json
"KHÔNG XOÁ — dữ liệu thật, chỉ đọc; nếu test có sửa thì khôi phục giá trị đã chụp trước đó"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `legacy-many-fields` | **Lifecycle**: `D30` | **Shape**: `full`

**Setup** (api):
```json
"SELECT id FROM cases WHERE jsonb_array_length(COALESCE(jsonb_path_query_array(metadata,'$.keyvalue()'),'[]'))>20 LIMIT 1 — hồ sơ nhiều trường hệ cũ nhất"
```

**Cleanup**:
```json
"KHÔNG XOÁ — chỉ đọc/khôi phục"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `meta-empty-string` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: metadata = jsonb_build_object('noiXayRa','   ','tenCungCap',''); cột tương ứng NULL"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `no-statistic-row` | **Lifecycle**: `D0` | **Shape**: `empty`

**Setup** (api):
```json
"POST /api/v1/cases KHÔNG kèm statistic; xác nhận SELECT count(*) FROM case_statistics WHERE case_id={{case_id}} = 0"
```

**Cleanup**:
```json
"DELETE /api/v1/cases/{{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `has-statistic-row` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"POST /api/v1/cases kèm statistic.soTienBiThietHai=1000000"
```

**Cleanup**:
```json
"DELETE /api/v1/cases/{{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `damage-meta-only` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: metadata=jsonb_build_object('damageAmount','2500000'); KHÔNG có dòng case_statistics"
```

**Cleanup**:
```json
"DELETE FROM case_statistics WHERE case_id={{case_id}}; DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `damage-3-sources-differ` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: metadata=jsonb_build_object('damageAmount','1000000','stat_damageAmount','2000000'); case_statistics.soTienBiThietHai=3000000"
```

**Cleanup**:
```json
"DELETE FROM case_statistics WHERE case_id={{case_id}}; DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `dob-year-only` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: metadata=jsonb_build_object('sinhNamCungCap','1985'); \"reporterDateOfBirth\"=NULL, \"reporterDateOfBirthPrecision\"=NULL"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `dob-impossible-date` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: metadata=jsonb_build_object('sinhNamCungCap','31/02/1985')"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `dob-epoch-garbage` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: metadata=jsonb_build_object('sinhNamCungCap','1970-01-01') và một bản khác với giá trị '0'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `dob-invalid-year` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: hai bản ghi với metadata sinhNamCungCap = '19855' và '0000'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id IN ({{ids}})"
```

**Outputs**: `case_ids`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `has-bihai` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"SQL/API: đặt biHai='BIHAI-{{random}}' và diaChiCungCap='DIACHI-{{random}}'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `has-specific-address-meta` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: metadata=jsonb_build_object('specificAddress','SPEC-{{random}}')"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `has-nghivan-note` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"API: đặt nghiVanDoiTuong='NGHIVAN-{{random}}'; chưa có Subject nào"
```

**Cleanup**:
```json
"DELETE /api/v1/cases/{{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `has-secondary-crime` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"API: đặt tội danh phụ = 'TDPHU-{{random}}'"
```

**Cleanup**:
```json
"DELETE /api/v1/cases/{{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `has-legacy-investigator-text` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"SQL/API: \"dieuTraVien\"='Trần Văn Cũ {{random}}' đồng thời investigatorId trỏ tới một user có thật"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `legacy-investigator-no-user` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: \"dieuTraVien\"='KHONG-CO-TAI-KHOAN-{{random}}', investigatorId=NULL"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `has-dexuat-column` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"SQL: \"deXuat\"='DEXUAT-CU-{{random}}'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `backfill-DR1` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: cột NULL, metadata chỉ có khoá native (vd 'reporter')"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `backfill-DR2` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: cột NULL, metadata chỉ có khoá hệ cũ (vd 'tenCungCap')"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `backfill-DR3` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: cột NULL, metadata có CẢ 'reporter'='NATIVE-VAL' và 'tenCungCap'='OLD-VAL'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `backfill-DR4` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: cột NULL, metadata damageAmount='không rõ', sinhNamCungCap='ngày xưa'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `backfill-DR5` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"SQL: cột và metadata cùng giá trị 'GIONG-NHAU-{{random}}'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `backfill-DR6` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"SQL: cột='GIATRI-MOI', metadata='GIATRI-CU'"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `backfill-DR7` | **Lifecycle**: `D0` | **Shape**: `empty`

**Setup** (api):
```json
"SQL: cột NULL, metadata không có khoá tương ứng"
```

**Cleanup**:
```json
"DELETE FROM cases WHERE id={{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `in-reject-list` | **Lifecycle**: `D30` | **Shape**: `with_holes`

**Setup** (api):
```json
"Lấy từ danh sách từ chối thật của đợt chuẩn hoá (20 bản ghi đã ghi nhận)"
```

**Cleanup**:
```json
"KHÔNG XOÁ — chỉ đọc"
```

**Outputs**: `case_ids`

---

### ``

**Mô tả**: 
**Entity**: `Case` | **State**: `owned-by-other-team` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"Tạo hồ sơ gán assignedTeamId = tổ B (khác tổ của tài khoản thử)"
```

**Cleanup**:
```json
"DELETE /api/v1/cases/{{case_id}}"
```

**Outputs**: `case_id`

---

### ``

**Mô tả**: 
**Entity**: `Dataset` | **State**: `post-backfill` | **Lifecycle**: `D0` | **Shape**: `large`

**Setup** (api):
```json
"Chụp số liệu: đếm hồ sơ non-null theo từng cột, đếm dòng bảng xung đột và bảng từ chối, đếm dòng case_statistics"
```

**Cleanup**:
```json
"Không cần — chỉ đọc"
```

**Outputs**: `snapshot`

---

### ``

**Mô tả**: 
**Entity**: `Dataset` | **State**: `production-like` | **Lifecycle**: `D365` | **Shape**: `large`

**Setup** (api):
```json
"Bản sao dữ liệu di trú đầy đủ (cases + petitions + incidents) trên môi trường thử"
```

**Cleanup**:
```json
"Khôi phục từ bản sao lưu sau đợt kiểm thử"
```

---

### ``

**Mô tả**: 
**Entity**: `Petition` | **State**: `new` | **Lifecycle**: `D0` | **Shape**: `empty`

**Setup** (api):
```json
"POST /api/v1/petitions với trường bắt buộc; senderName='UAT-DT-{{random}}'"
```

**Cleanup**:
```json
"DELETE /api/v1/petitions/{{petition_id}}"
```

**Outputs**: `petition_id`

---

### ``

**Mô tả**: 
**Entity**: `Petition` | **State**: `fully-filled` | **Lifecycle**: `D0` | **Shape**: `full`

**Setup** (api):
```json
"POST /api/v1/petitions điền mọi trường thuộc phạm vi epic, mỗi trường một dấu nhận dạng riêng"
```

**Cleanup**:
```json
"DELETE /api/v1/petitions/{{petition_id}} (và hồ sơ sinh ra từ chuyển đổi)"
```

**Outputs**: `petition_id`

---

### ``

**Mô tả**: 
**Entity**: `Petition` | **State**: `migrated` | **Lifecycle**: `D365` | **Shape**: `full`

**Setup** (api):
```json
"SELECT id FROM petitions WHERE \"soHoSoCu\" IS NOT NULL LIMIT 1"
```

**Cleanup**:
```json
"KHÔNG XOÁ — chỉ đọc/khôi phục"
```

**Outputs**: `petition_id`

---

### ``

**Mô tả**: 
**Entity**: `Incident` | **State**: `phase-receive` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"Tạo vụ việc và đặt trạng thái thuộc giai đoạn Tiếp nhận"
```

**Cleanup**:
```json
"DELETE /api/v1/incidents/{{incident_id}}"
```

**Outputs**: `incident_id`

---

### ``

**Mô tả**: 
**Entity**: `Incident` | **State**: `phase-verify` | **Lifecycle**: `D7` | **Shape**: `normal`

**Setup** (api):
```json
"Tạo vụ việc và chuyển trạng thái sang giai đoạn Xác minh"
```

**Cleanup**:
```json
"DELETE /api/v1/incidents/{{incident_id}}"
```

**Outputs**: `incident_id`

---

### ``

**Mô tả**: 
**Entity**: `Incident` | **State**: `phase-result` | **Lifecycle**: `D30` | **Shape**: `normal`

**Setup** (api):
```json
"Tạo vụ việc và chuyển trạng thái sang giai đoạn Kết quả"
```

**Cleanup**:
```json
"DELETE /api/v1/incidents/{{incident_id}}"
```

**Outputs**: `incident_id`

---

### ``

**Mô tả**: 
**Entity**: `Incident` | **State**: `phase-suspended` | **Lifecycle**: `D30` | **Shape**: `normal`

**Setup** (api):
```json
"Tạo vụ việc và chuyển trạng thái sang Tạm đình chỉ"
```

**Cleanup**:
```json
"DELETE /api/v1/incidents/{{incident_id}}"
```

**Outputs**: `incident_id`

---

### ``

**Mô tả**: 
**Entity**: `Incident` | **State**: `status-not-in-phase-map` | **Lifecycle**: `D0` | **Shape**: `with_holes`

**Setup** (api):
```json
"SQL: UPDATE incidents SET status=NULL (hoặc giá trị không thuộc bản đồ giai đoạn) WHERE id={{incident_id}}"
```

**Cleanup**:
```json
"DELETE FROM incidents WHERE id={{incident_id}}"
```

**Outputs**: `incident_id`

---

### ``

**Mô tả**: 
**Entity**: `Incident` | **State**: `migrated` | **Lifecycle**: `D365` | **Shape**: `full`

**Setup** (api):
```json
"SELECT id FROM incidents WHERE \"soHoSoCu\" IS NOT NULL LIMIT 1"
```

**Cleanup**:
```json
"KHÔNG XOÁ — chỉ đọc/khôi phục"
```

**Outputs**: `incident_id`

---

### ``

**Mô tả**: 
**Entity**: `User` | **State**: `scoped-to-team-A` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"Dùng tài khoản điều tra viên có phạm vi dữ liệu giới hạn ở một tổ"
```

**Cleanup**:
```json
"Không cần"
```

**Outputs**: `token`

---

### ``

**Mô tả**: 
**Entity**: `User` | **State**: `read-only-role` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"Tài khoản có vai trò chỉ đọc (không có quyền ghi trên hồ sơ)"
```

**Cleanup**:
```json
"Không cần"
```

**Outputs**: `token`

---

### 📋 Bảng tóm tắt

| Fixture ID | Entity | State | Lifecycle | TC dùng |
|------------|--------|-------|-----------|---------|
| `` | Case | new | D0 |  |
| `` | Case | canonical-populated | D0 |  |
| `` | Case | legacy-meta-only | D0 |  |
| `` | Case | col-differs-from-meta | D0 |  |
| `` | Case | legacy-consolidated | D30 |  |
| `` | Case | legacy-many-fields | D30 |  |
| `` | Case | meta-empty-string | D0 |  |
| `` | Case | no-statistic-row | D0 |  |
| `` | Case | has-statistic-row | D0 |  |
| `` | Case | damage-meta-only | D0 |  |
| `` | Case | damage-3-sources-differ | D0 |  |
| `` | Case | dob-year-only | D0 |  |
| `` | Case | dob-impossible-date | D0 |  |
| `` | Case | dob-epoch-garbage | D0 |  |
| `` | Case | dob-invalid-year | D0 |  |
| `` | Case | has-bihai | D0 |  |
| `` | Case | has-specific-address-meta | D0 |  |
| `` | Case | has-nghivan-note | D0 |  |
| `` | Case | has-secondary-crime | D0 |  |
| `` | Case | has-legacy-investigator-text | D0 |  |
| `` | Case | legacy-investigator-no-user | D0 |  |
| `` | Case | has-dexuat-column | D0 |  |
| `` | Case | backfill-DR1 | D0 |  |
| `` | Case | backfill-DR2 | D0 |  |
| `` | Case | backfill-DR3 | D0 |  |
| `` | Case | backfill-DR4 | D0 |  |
| `` | Case | backfill-DR5 | D0 |  |
| `` | Case | backfill-DR6 | D0 |  |
| `` | Case | backfill-DR7 | D0 |  |
| `` | Case | in-reject-list | D30 |  |
| `` | Case | owned-by-other-team | D0 |  |
| `` | Dataset | post-backfill | D0 |  |
| `` | Dataset | production-like | D365 |  |
| `` | Petition | new | D0 |  |
| `` | Petition | fully-filled | D0 |  |
| `` | Petition | migrated | D365 |  |
| `` | Incident | phase-receive | D0 |  |
| `` | Incident | phase-verify | D7 |  |
| `` | Incident | phase-result | D30 |  |
| `` | Incident | phase-suspended | D30 |  |
| `` | Incident | status-not-in-phase-map | D0 |  |
| `` | Incident | migrated | D365 |  |
| `` | User | scoped-to-team-A | D0 |  |
| `` | User | read-only-role | D0 |  |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: tên người tố cáo được lưu vào cột chính thức, không chỉ nằm trong dữ liệu phụ |  S1 |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: số CCCD người tố cáo lưu vào cột chính thức |  S1 |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: số điện thoại người tố cáo lưu vào cột chính thức |  S2 |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: địa chỉ người tố cáo lưu vào cột chính thức |  S2 |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: tóm tắt nội dung lưu vào cột chính thức |  S2 |
| [TC-006](#tc-006) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: ngày tiếp nhận lưu vào cột mới `receiveDate` |  S1 |
| [TC-009](#tc-009) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: tội danh ban đầu lưu vào cột riêng, không đụng tội danh phụ |  S1 |
| [TC-010](#tc-010) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới: ngày sinh người tố cáo lưu kiểu ngày + cờ độ chính xác ở cột |  S1 |
| [TC-011](#tc-011) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới có thiệt hại: số tiền vào bảng thống kê, tự tạo bản ghi nếu chưa có |  S1 |
| [TC-012](#tc-012) | 🔴 P0 | `GREEN` |  | Tạo vụ án mới có số bị hại: lưu vào bảng thống kê |  S2 |
| [TC-013](#tc-013) | 🔴 P0 | `RED` |  | Hồi quy chốt chặn: tạo vụ án điền đủ cụm tiếp nhận — KHÔNG cột nào bị bỏ trống |  S1 |
| [TC-017](#tc-017) | 🔴 P0 | `GREEN` |  | Sau khi tạo, mở lại hồ sơ: mọi ô hiển thị đúng giá trị lấy từ cột |  S1 |
| [TC-018](#tc-018) | 🔴 P0 | `E2E` |  | E2E: cán bộ tiếp nhận tạo trọn một vụ án qua giao diện, mỗi khái niệm chỉ điền một lần |  S1 |
| [TC-019](#tc-019) | 🔴 P0 | `GREEN` |  | Hồ sơ đã chuẩn hoá: form hiển thị giá trị lấy từ cột |  S1 |
| [TC-020](#tc-020) | 🔴 P0 | `EDGE` |  | Hồ sơ chưa chuẩn hoá: form vẫn hiển thị dữ liệu cũ nhờ cơ chế dự phòng |  S1 |
| [TC-021](#tc-021) | 🔴 P0 | `DECISION` |  | Cột và dữ liệu cũ khác nhau: cột là nguồn hiển thị |  S1 |
| [TC-022](#tc-022) | 🔴 P0 | `GREEN` |  | Sửa giá trị trên form: cột được cập nhật |  S1 |
| [TC-024](#tc-024) | 🔴 P0 | `RED` |  | Xoá trắng một ô đã có dữ liệu: giá trị cũ không tự sống lại |  S2 |
| [TC-025](#tc-025) | 🔴 P0 | `RED` |  | Mở rồi lưu lại mà không sửa gì: hồ sơ không tự biến đổi |  S1 |
| [TC-026](#tc-026) | 🔴 P0 | `RED` |  | Sửa hai lần liên tiếp: giá trị không quay ngược về bản hệ cũ |  S1 |
| [TC-027](#tc-027) | 🔴 P0 | `UX` |  | Trường đã lên form chính không xuất hiện lần nữa ở khu dữ liệu hệ cũ |  S2 |
| [TC-030](#tc-030) | 🔴 P0 | `E2E` |  | E2E: điều tra viên mở hồ sơ đã di trú, sửa một thông tin và thấy kết quả bền vững |  S1 |
| [TC-031](#tc-031) | 🔴 P0 | `GREEN` |  | Nhập thiệt hại ở tab Thông tin: tab Thống kê hiện đúng số ngay |  S1 |
| [TC-032](#tc-032) | 🔴 P0 | `GREEN` |  | Nhập thiệt hại ở tab Thống kê: tab Thông tin hiện đúng số (chiều ngược lại) |  S1 |
| [TC-033](#tc-033) | 🔴 P0 | `GREEN` |  | Số bị hại đồng bộ hai chiều giữa hai tab |  S2 |
| [TC-034](#tc-034) | 🔴 P0 | `EDGE` |  | Vụ chưa từng có số liệu thống kê: nhập thiệt hại lần đầu vẫn thành công |  S1 |
| [TC-035](#tc-035) | 🔴 P0 | `RED` |  | Vụ đã có số liệu: cập nhật chứ không sinh bản ghi thống kê thứ hai |  S1 |
| [TC-036](#tc-036) | 🔴 P0 | `EDGE` |  | Vụ cũ có thiệt hại trong dữ liệu phụ: hiển thị đúng ở cả hai tab |  S1 |
| [TC-037](#tc-037) | 🔴 P0 | `DECISION` |  | Hai nguồn thiệt hại cũ mâu thuẫn: hệ thống không trưng ra hai con số khác nhau |  S1 |
| [TC-042](#tc-042) | 🔴 P0 | `RED` |  | Thiệt hại nhập bằng chữ 'không rõ': từ chối, không bịa số 0 |  S1 |
| [TC-046](#tc-046) | 🔴 P0 | `RED` |  | Xoá trắng thiệt hại: cả hai tab cùng trống, không còn số cũ ở tab kia |  S1 |
| [TC-047](#tc-047) | 🔴 P0 | `INTEGRATION` |  | Màn hình tổng hợp/báo cáo lấy số liệu cùng nguồn với form |  S1 |
| [TC-048](#tc-048) | 🔴 P0 | `E2E` |  | E2E: cán bộ thống kê nhập thiệt hại và số bị hại, kiểm chứng khớp trên tab Thống kê |  S1 |
| [TC-049](#tc-049) | 🔴 P0 | `GREEN` |  | Ngày sinh đầy đủ: lưu kiểu ngày, độ chính xác không bị đánh dấu là chỉ-năm |  S2 |
| [TC-050](#tc-050) | 🔴 P0 | `EDGE` |  | Dữ liệu cũ chỉ có năm sinh: lưu ngày 01/01 kèm cờ đánh dấu chỉ-năm |  S1 |
| [TC-053](#tc-053) | 🔴 P0 | `RED` |  | Vòng đi-về: mở hồ sơ chỉ-năm rồi lưu lại không sửa gì, vẫn là chỉ-năm |  S1 |
| [TC-055](#tc-055) | 🔴 P0 | `BOUNDARY` |  | Ngày không tồn tại (31/02): từ chối, không tự nắn về ngày khác |  S1 |
| [TC-056](#tc-056) | 🔴 P0 | `BOUNDARY` |  | Giá trị rác dạng mốc thời gian gốc (01/01/1970): không nhận là ngày sinh |  S1 |
| [TC-058](#tc-058) | 🔴 P0 | `DATA` |  | Ngày không kèm giờ không bị lệch một ngày khi lưu và đọc lại |  S1 |
| [TC-059](#tc-059) | 🔴 P0 | `DATA` |  | Các trường ngày khác cũng không lệch: ngày tiếp nhận, ngày cấp CCCD, ngày phiếu chuyển |  S1 |
| [TC-061](#tc-061) | 🔴 P0 | `DATA` |  | Kiểm đếm đầy đủ: cả 22 trường hệ cũ đã thăng đều có ô trên form và lưu được vào cột |  S1 |
| [TC-065](#tc-065) | 🔴 P0 | `GREEN` |  | Nhóm văn bản – phân loại hồ sơ nội bộ, nơi xảy ra, phương thức thủ đoạn, phân loại tội phạm, nghi vấn đối tượng lưu vào cột |  S2 |
| [TC-073](#tc-073) | 🔴 P0 | `GREEN` |  | Số hồ sơ hệ cũ hiển thị, lưu và tra cứu được |  S1 |
| [TC-078](#tc-078) | 🔴 P0 | `RED` |  | Dữ liệu đề xuất đã có từ trước không bị mất khi form dùng tên mới |  S1 |
| [TC-080](#tc-080) | 🔴 P0 | `DATA` |  | Sáu cột mới nhận và trả lại giá trị đầy đủ |  S1 |
| [TC-083](#tc-083) | 🔴 P0 | `INTEGRATION` |  | Hợp đồng API – trường loại C: gửi lên rồi đọc lại còn nguyên |  S1 |
| [TC-084](#tc-084) | 🔴 P0 | `INTEGRATION` |  | Hợp đồng API – trường loại S (thống kê): gửi lên rồi đọc lại còn nguyên |  S1 |
| [TC-085](#tc-085) | 🔴 P0 | `INTEGRATION` |  | Hợp đồng API – trường loại N (cột mới): gửi lên rồi đọc lại còn nguyên |  S1 |
| [TC-089](#tc-089) | 🔴 P0 | `RED` |  | Sửa một trường: các cột khác không bị xoá |  S1 |
| [TC-090](#tc-090) | 🔴 P0 | `INTEGRATION` |  | Dữ liệu chi tiết trả về đủ cột chuẩn và khối thống kê để giao diện dùng |  S1 |
| [TC-091](#tc-091) | 🔴 P0 | `RED` |  | Bị hại giữ ô riêng, không bị nối vào địa chỉ người tố cáo |  S1 |
| [TC-092](#tc-092) | 🔴 P0 | `RED` |  | Nhập đồng thời bị hại và địa chỉ: hai giá trị độc lập, không lẫn nhau |  S1 |
| [TC-093](#tc-093) | 🔴 P0 | `RED` |  | Nơi xảy ra không bị địa chỉ hành chính ghi đè |  S1 |
| [TC-097](#tc-097) | 🔴 P0 | `GREEN` |  | Ghi chú nghi vấn đối tượng và danh sách đối tượng có cấu trúc cùng tồn tại |  S1 |
| [TC-098](#tc-098) | 🔴 P0 | `RED` |  | Thêm đối tượng có cấu trúc: ghi chú nghi vấn không bị xoá |  S1 |
| [TC-099](#tc-099) | 🔴 P0 | `GREEN` |  | Tội danh ban đầu và tội danh phụ là hai ô khác nhau |  S1 |
| [TC-100](#tc-100) | 🔴 P0 | `RED` |  | Đặt tội danh ban đầu: tội danh phụ không thay đổi |  S1 |
| [TC-101](#tc-101) | 🔴 P0 | `GREEN` |  | Cán bộ thụ lý (liên kết người dùng) và điều tra viên hệ cũ (tên tự do) cùng tồn tại |  S1 |
| [TC-102](#tc-102) | 🔴 P0 | `RED` |  | Tên điều tra viên hệ cũ không khớp người dùng nào: vẫn hiển thị, không mất |  S1 |
| [TC-103](#tc-103) | 🔴 P0 | `RED` |  | Gán cán bộ thụ lý: tên điều tra viên hệ cũ không bị ghi đè |  S1 |
| [TC-106](#tc-106) | 🔴 P0 | `DECISION` |  | Chuẩn hoá – cột trống, dữ liệu cũ có giá trị native hợp lệ: ghi vào cột |  S1 |
| [TC-107](#tc-107) | 🔴 P0 | `DECISION` |  | Chuẩn hoá – cột trống, chỉ có giá trị hệ cũ: ghi vào cột |  S1 |
| [TC-108](#tc-108) | 🔴 P0 | `DECISION` |  | Chuẩn hoá – có cả hai khoá khác giá trị: ưu tiên khoá native |  S1 |
| [TC-109](#tc-109) | 🔴 P0 | `RED` |  | Chuẩn hoá – giá trị không phân tích được: cột để trống và ghi vào danh sách từ chối |  S1 |
| [TC-111](#tc-111) | 🔴 P0 | `RED` |  | Chuẩn hoá – cột đã có giá trị KHÁC dữ liệu cũ: KHÔNG ghi đè, ghi vào danh sách xung đột |  S1 |
| [TC-114](#tc-114) | 🔴 P0 | `RED` |  | Chạy chuẩn hoá lần thứ hai: kết quả không đổi |  S1 |
| [TC-115](#tc-115) | 🔴 P0 | `DATA` |  | Không mất dữ liệu: độ phủ theo SỐ HỒ SƠ cho từng cột đạt yêu cầu |  S1 |
| [TC-116](#tc-116) | 🔴 P0 | `AUDIT` |  | Danh sách xung đột đọc được và đủ thông tin để rà soát |  S2 |
| [TC-117](#tc-117) | 🔴 P0 | `AUDIT` |  | Danh sách từ chối đọc được và giải thích được lý do |  S2 |
| [TC-118](#tc-118) | 🔴 P0 | `AUDIT` |  | Đối chiếu tuyên bố của kế hoạch với thực tế: số hồ sơ chuẩn hoá, số xung đột, số từ chối |  S2 |
| [TC-119](#tc-119) | 🔴 P0 | `DECISION` |  | Chuẩn hoá thiệt hại/bị hại: tạo bản ghi thống kê khi thiếu, cập nhật khi đã có |  S1 |
| [TC-120](#tc-120) | 🔴 P0 | `AUDIT` |  | Sau chuẩn hoá, dữ liệu gốc hệ cũ vẫn còn trong hệ thống |  S1 |
| [TC-121](#tc-121) | 🔴 P0 | `RECOVERY` |  | Có bản sao lưu trước khi chạy chuẩn hoá |  S1 |
| [TC-122](#tc-122) | 🔴 P0 | `RED` |  | Bản ghi bị từ chối vẫn giữ giá trị gốc để xử lý tay |  S1 |
| [TC-123](#tc-123) | 🔴 P0 | `GREEN` |  | Bảng dữ liệu gốc hệ cũ hiển thị đầy đủ bản gốc của hồ sơ |  S1 |
| [TC-124](#tc-124) | 🔴 P0 | `GREEN` |  | Số thứ tự và số hồ sơ hệ cũ hiển thị trên màn hình chi tiết |  S2 |
| [TC-125](#tc-125) | 🔴 P0 | `RED` |  | Sau khi thăng trường lên form chính, bảng gốc không bị rỗng đi |  S1 |
| [TC-127](#tc-127) | 🔴 P0 | `UX` |  | Trường đã thăng không xuất hiện lần hai như ô nhập ở khu bổ sung |  S2 |
| [TC-129](#tc-129) | 🔴 P0 | `RED` |  | Sửa trường trên form chính: bản gốc trong bảng dữ liệu gốc KHÔNG đổi theo |  S1 |
| [TC-130](#tc-130) | 🔴 P0 | `E2E` |  | E2E: đối chiếu hồ sơ di trú — bản gốc, cột chuẩn và ô trên màn hình khớp nhau |  S1 |
| [TC-139](#tc-139) | 🔴 P0 | `UX` |  | Quét toàn form: không còn cặp ô trùng nghĩa nào trong 8 cặp đã gộp |  S1 |
| [TC-142](#tc-142) | 🔴 P0 | `UX` |  | Lưu thành công và lưu thất bại đều có phản hồi rõ ràng |  S2 |
| [TC-147](#tc-147) | 🔴 P0 | `GREEN` |  | Tìm hồ sơ theo tên người tố cáo |  S2 |
| [TC-148](#tc-148) | 🔴 P0 | `GREEN` |  | Tìm hồ sơ theo số CCCD |  S2 |
| [TC-149](#tc-149) | 🔴 P0 | `GREEN` |  | Tìm hồ sơ theo số thứ tự hoặc số hồ sơ hệ cũ |  S1 |
| [TC-151](#tc-151) | 🔴 P0 | `RED` |  | Hồ sơ chưa chuẩn hoá vẫn tìm thấy nhờ cơ chế dự phòng |  S1 |
| [TC-153](#tc-153) | 🔴 P0 | `SECURITY` |  | Từ khoá chứa ký tự đặc biệt và dấu tiếng Việt: an toàn, không lộ lỗi hệ thống |  S1 |
| [TC-155](#tc-155) | 🔴 P0 | `SECURITY` |  | Người dùng ngoài phạm vi không đọc được hồ sơ qua đường dẫn trực tiếp |  S1 |
| [TC-156](#tc-156) | 🔴 P0 | `SECURITY` |  | Tìm kiếm không trả hồ sơ ngoài phạm vi dữ liệu |  S1 |
| [TC-157](#tc-157) | 🔴 P0 | `SECURITY` |  | Trường dữ liệu cá nhân mới không lộ cho vai trò không được phép |  S1 |
| [TC-158](#tc-158) | 🔴 P0 | `SECURITY` |  | Không có phiên đăng nhập hợp lệ: bị từ chối, không rò dữ liệu |  S1 |
| [TC-159](#tc-159) | 🔴 P0 | `SECURITY` |  | Vai trò chỉ đọc không sửa được cột chuẩn |  S1 |
| [TC-160](#tc-160) | 🔴 P0 | `SECURITY` |  | Nội dung tấn công nhập vào ô văn bản mới: lưu an toàn, không thực thi khi hiển thị |  S1 |
| [TC-162](#tc-162) | 🔴 P0 | `AUDIT` |  | Nhật ký thay đổi vẫn ghi nhận đúng sau khi đổi nơi lưu dữ liệu |  S1 |
| [TC-163](#tc-163) | 🔴 P0 | `UX` |  | Form Đơn thư: mỗi khái niệm chỉ một ô, không còn cặp trùng nghĩa |  S2 |
| [TC-164](#tc-164) | 🔴 P0 | `GREEN` |  | Trường thông tin người gửi đơn lưu và đọc lại đúng |  S1 |
| [TC-166](#tc-166) | 🔴 P0 | `RED` |  | Đơn thư: tội danh ban đầu và tội danh chính là hai trường độc lập |  S1 |
| [TC-167](#tc-167) | 🔴 P0 | `GREEN` |  | Tạo Đơn thư mới: đọc lại đủ mọi trường vừa nhập |  S1 |
| [TC-168](#tc-168) | 🔴 P0 | `RED` |  | Sửa Đơn thư đã di trú: không mất trường hệ cũ |  S1 |
| [TC-172](#tc-172) | 🔴 P0 | `E2E` |  | E2E: tiếp nhận trọn một Đơn thư qua giao diện và mở lại kiểm chứng |  S1 |
| [TC-173](#tc-173) | 🔴 P0 | `STATE` |  | Mở vụ việc đang ở giai đoạn Tiếp nhận: đúng phần giai đoạn đó tự mở |  S2 |
| [TC-174](#tc-174) | 🔴 P0 | `STATE` |  | Mở vụ việc đang ở giai đoạn Xác minh: đúng phần giai đoạn đó tự mở |  S2 |
| [TC-175](#tc-175) | 🔴 P0 | `STATE` |  | Mở vụ việc đang ở giai đoạn Kết quả: đúng phần giai đoạn đó tự mở |  S2 |
| [TC-178](#tc-178) | 🔴 P0 | `STATE` |  | Tạo vụ việc mới: không lỗi do chưa có trạng thái |  S2 |
| [TC-180](#tc-180) | 🔴 P0 | `E2E` |  | E2E: mở vụ việc đang xác minh, sửa và lưu trong đúng phần giai đoạn |  S2 |
| [TC-181](#tc-181) | 🔴 P0 | `E2E` |  | Tích hợp: chuyển Đơn thư thành Vụ việc — thông tin người và nội dung không mất |  S1 |
| [TC-182](#tc-182) | 🔴 P0 | `E2E` |  | Tích hợp: chuyển Đơn thư thành Vụ án — giá trị vào đúng ô chuẩn |  S1 |
| [TC-183](#tc-183) | 🔴 P0 | `E2E` |  | Tích hợp trọn vòng: Đơn thư → Vụ việc → Vụ án → Thống kê → Truy nguyên trong một phiên |  S1 |
| [TC-184](#tc-184) | 🔴 P0 | `INTEGRATION` |  | Tích hợp: thiệt hại nhập ở Vụ án hiện đúng trên màn hình tổng hợp toàn hệ thống |  S1 |
| [TC-185](#tc-185) | 🔴 P0 | `E2E` |  | Tích hợp: từ tìm kiếm theo số hệ cũ đến đối chiếu bản gốc |  S1 |
| [TC-186](#tc-186) | 🔴 P0 | `E2E` |  | Tích hợp đa vai: cán bộ tạo, điều tra viên sửa, lãnh đạo xem — không ai thấy dữ liệu lệch |  S1 |
| [TC-187](#tc-187) | 🔴 P0 | `REGRESSION` |  | Hồi quy: danh sách, phân trang và bộ lọc sẵn có vẫn hoạt động |  S2 |
| [TC-188](#tc-188) | 🔴 P0 | `REGRESSION` |  | Hồi quy: in và xuất chứng từ lấy đúng giá trị sau khi đổi nơi lưu |  S1 |
| [TC-191](#tc-191) | 🔴 P0 | `METAMORPHIC` |  | Quan hệ biến đổi: sửa rồi sửa ngược lại thì hồ sơ trở về trạng thái ban đầu |  S1 |
| [TC-192](#tc-192) | 🔴 P0 | `E2E` |  | Kiểm tra nhanh sau triển khai: hệ thống sống, đăng nhập được, ba biểu mở được |  S1 |
| [TC-196](#tc-196) | 🔴 P0 | `RED` |  | Nghi vấn DRIFT-1: hai ô cùng ghi một cột — xác định ô nào thắng khi giá trị khác nhau |  S1 |
| [TC-197](#tc-197) | 🔴 P0 | `RED` |  | Nghi vấn DRIFT-2: năm sinh hệ cũ và ngày sinh có còn là hai ô riêng không |  S1 |
| [TC-198](#tc-198) | 🔴 P0 | `RED` |  | Nghi vấn DRIFT-3: nguồn thiệt hại thứ ba có còn đọc dữ liệu phụ không |  S1 |
| [TC-007](#tc-007) | 🟠 P1 | `GREEN` |  | Tạo vụ án mới: phân loại vụ án lưu vào cột mới `caseClassification` |  S2 |
| [TC-008](#tc-008) | 🟠 P1 | `GREEN` |  | Tạo vụ án mới: tình trạng lưu vào cột mới `tinhTrang` |  S2 |
| [TC-014](#tc-014) | 🟠 P1 | `RED` |  | Tạo vụ án chỉ với thông tin tối thiểu: không lỗi hệ thống, không sinh dữ liệu rác |  S2 |
| [TC-015](#tc-015) | 🟠 P1 | `SECURITY` |  | Gửi trường không được khai báo: hệ thống phản ứng có kiểm soát, không nuốt im lặng |  S2 |
| [TC-016](#tc-016) | 🟠 P1 | `EDGE` |  | Lưu hai lần cùng nội dung: không nhân đôi bản ghi thống kê |  S2 |
| [TC-023](#tc-023) | 🟠 P1 | `RED` |  | Sửa hồ sơ: đo xem có phát sinh khoá dữ liệu phụ mới cho khái niệm đã chuyển lên cột |  S3 |
| [TC-028](#tc-028) | 🟠 P1 | `EDGE` |  | Hai phiên cùng sửa một hồ sơ: không mất thay đổi âm thầm |  S2 |
| [TC-038](#tc-038) | 🟠 P1 | `BOUNDARY` |  | Biên: thiệt hại bằng 0 được chấp nhận và phân biệt với bỏ trống |  S3 |
| [TC-039](#tc-039) | 🟠 P1 | `BOUNDARY` |  | Biên âm: thiệt hại số âm bị từ chối, không lưu |  S2 |
| [TC-040](#tc-040) | 🟠 P1 | `BOUNDARY` |  | Biên lớn: thiệt hại rất lớn lưu chính xác, không tràn không làm tròn |  S2 |
| [TC-041](#tc-041) | 🟠 P1 | `EP` |  | Thiệt hại nhập kèm ký tự tiền tệ: hoặc hiểu đúng, hoặc từ chối rõ — không lưu sai thầm lặng |  S2 |
| [TC-045](#tc-045) | 🟠 P1 | `BOUNDARY` |  | Số bị hại âm hoặc lẻ: bị từ chối |  S3 |
| [TC-051](#tc-051) | 🟠 P1 | `UX` |  | Hiển thị ngày sinh chỉ-năm: giao diện không khẳng định ngày 01/01 là thật |  S2 |
| [TC-052](#tc-052) | 🟠 P1 | `DATA` |  | Cờ độ chính xác nằm ở cột, không phải trong khối dữ liệu phụ |  S2 |
| [TC-054](#tc-054) | 🟠 P1 | `STATE` |  | Chuyển từ chỉ-năm sang ngày đầy đủ: cờ độ chính xác được nâng cấp |  S2 |
| [TC-057](#tc-057) | 🟠 P1 | `BOUNDARY` |  | Ngày sinh ở tương lai: bị chặn hoặc cảnh báo rõ |  S3 |
| [TC-060](#tc-060) | 🟠 P1 | `EP` |  | Năm phi lý trong dữ liệu cũ ('19855', '0000'): từ chối có ghi nhận |  S2 |
| [TC-062](#tc-062) | 🟠 P1 | `GREEN` |  | Nhóm văn bản – nguồn đơn, phiếu chuyển, nơi cấp CCCD lưu vào cột |  S2 |
| [TC-063](#tc-063) | 🟠 P1 | `GREEN` |  | Nhóm văn bản – ghi chú trùng đơn, lãnh đạo tố tụng, nhận xét lưu vào cột |  S2 |
| [TC-064](#tc-064) | 🟠 P1 | `GREEN` |  | Nhóm văn bản – yêu cầu bổ sung, kết quả xử lý khác, đồ vật tài liệu kèm theo lưu vào cột |  S2 |
| [TC-066](#tc-066) | 🟠 P1 | `GREEN` |  | Nhóm ngày – ngày phiếu chuyển và ngày giao đơn vị giải quyết lưu vào cột đúng ngày |  S2 |
| [TC-067](#tc-067) | 🟠 P1 | `GREEN` |  | Nhóm ngày – ngày đề xuất và ngày viết đơn lưu vào cột đúng ngày |  S3 |
| [TC-068](#tc-068) | 🟠 P1 | `GREEN` |  | Nhóm ngày – ngày cấp CCCD lưu vào cột và nằm cạnh số CCCD |  S3 |
| [TC-069](#tc-069) | 🟠 P1 | `DECISION` |  | Trường đúng/sai – báo cáo Ban giám đốc đặt ở trạng thái 'có' |  S3 |
| [TC-070](#tc-070) | 🟠 P1 | `DECISION` |  | Trường đúng/sai – đặt lại về 'không' được lưu, không bị coi là bỏ trống |  S2 |
| [TC-072](#tc-072) | 🟠 P1 | `GREEN` |  | Số thứ tự hệ cũ hiển thị và lưu đúng |  S2 |
| [TC-074](#tc-074) | 🟠 P1 | `EP` |  | Trường văn bản rất dài: lưu đủ hoặc báo giới hạn rõ, không cắt âm thầm |  S2 |
| [TC-075](#tc-075) | 🟠 P1 | `DATA` |  | Trường văn bản có ký tự đặc biệt và dấu tiếng Việt: lưu nguyên vẹn |  S2 |
| [TC-077](#tc-077) | 🟠 P1 | `UX` |  | Đề xuất xử lý: chỉ còn MỘT ô, lưu vào cột đề xuất |  S2 |
| [TC-079](#tc-079) | 🟠 P1 | `GREEN` |  | Điều tra viên hệ cũ hiển thị dưới nhãn tham chiếu, lưu vào cột điều tra viên |  S2 |
| [TC-081](#tc-081) | 🟠 P1 | `EP` |  | Cột mới nhận giá trị sai kiểu: phản ứng có kiểm soát, không phá dữ liệu |  S2 |
| [TC-086](#tc-086) | 🟠 P1 | `INTEGRATION` |  | Hợp đồng API – trường loại R (tên đã thống nhất): gửi lên rồi đọc lại còn nguyên |  S2 |
| [TC-087](#tc-087) | 🟠 P1 | `RED` |  | Gửi tên trường cũ đã bỏ: không lưu nhầm, không gây lỗi máy chủ |  S2 |
| [TC-088](#tc-088) | 🟠 P1 | `RED` |  | Gửi sai kiểu dữ liệu: báo lỗi rõ ràng, không lưu méo, không lỗi máy chủ |  S2 |
| [TC-094](#tc-094) | 🟠 P1 | `EDGE` |  | Địa chỉ cụ thể trong dữ liệu cũ được gom về ô Nơi xảy ra, không mất |  S2 |
| [TC-095](#tc-095) | 🟠 P1 | `GREEN` |  | Phương thức thủ đoạn tồn tại như một ô riêng, không bị coi là trùng và bỏ đi |  S2 |
| [TC-096](#tc-096) | 🟠 P1 | `DECISION` |  | Phân loại tội phạm/lĩnh vực: form chính và tab thống kê cùng một giá trị |  S2 |
| [TC-104](#tc-104) | 🟠 P1 | `EP` |  | Tổ hợp có/không của bị hại × địa chỉ × nơi xảy ra: không tổ hợp nào gây lẫn dữ liệu |  S2 |
| [TC-105](#tc-105) | 🟠 P1 | `EP` |  | Tổ hợp có/không của điều tra viên hệ cũ × cán bộ thụ lý × danh sách đối tượng |  S2 |
| [TC-110](#tc-110) | 🟠 P1 | `DECISION` |  | Chuẩn hoá – cột đã có giá trị GIỐNG dữ liệu cũ: giữ nguyên, không báo xung đột |  S3 |
| [TC-113](#tc-113) | 🟠 P1 | `EP` |  | Chuẩn hoá – nguồn là chuỗi rỗng hoặc khoảng trắng: coi như không có |  S2 |
| [TC-126](#tc-126) | 🟠 P1 | `GREEN` |  | Trường hệ cũ không thăng (đuôi dài) vẫn xem và sửa được |  S2 |
| [TC-131](#tc-131) | 🟠 P1 | `UX` |  | Cụm Định danh và tiếp nhận đứng đầu form và gom đủ nhóm trường |  S3 |
| [TC-132](#tc-132) | 🟠 P1 | `UX` |  | Mọi trường về con người nằm trong MỘT cụm chủ thể |  S3 |
| [TC-133](#tc-133) | 🟠 P1 | `UX` |  | Số CCCD, ngày cấp và nơi cấp nằm liền kề nhau |  S3 |
| [TC-135](#tc-135) | 🟠 P1 | `UX` |  | Tội danh chính, tội danh ban đầu và tội danh phụ đứng liền nhau |  S3 |
| [TC-137](#tc-137) | 🟠 P1 | `UX` |  | Cụm Kết quả và giai đoạn sau đứng SAU cụm tiếp nhận, không đảo trình tự tố tụng |  S3 |
| [TC-140](#tc-140) | 🟠 P1 | `UX` |  | Nhãn mỗi ô đúng như kế hoạch quy định |  S3 |
| [TC-143](#tc-143) | 🟠 P1 | `UX` |  | Thông báo lỗi chỉ đúng ô sai và diễn đạt hiểu được |  S3 |
| [TC-144](#tc-144) | 🟠 P1 | `A11Y` |  | Mọi ô mới có nhãn liên kết đúng cho công nghệ trợ giúp |  S3 |
| [TC-150](#tc-150) | 🟠 P1 | `GREEN` |  | Tìm hồ sơ theo nơi xảy ra |  S3 |
| [TC-161](#tc-161) | 🟠 P1 | `SECURITY` |  | Danh sách xung đột và từ chối không lộ qua đường dẫn công khai |  S2 |
| [TC-165](#tc-165) | 🟠 P1 | `UX` |  | Khu trường hệ cũ của Đơn thư không lặp lại ô đã có ở form chính |  S2 |
| [TC-169](#tc-169) | 🟠 P1 | `GREEN` |  | Tìm Đơn thư theo số hồ sơ hệ cũ |  S2 |
| [TC-170](#tc-170) | 🟠 P1 | `RED` |  | Bỏ trống trường bắt buộc của Đơn thư: báo rõ, không mất dữ liệu đã nhập |  S2 |
| [TC-171](#tc-171) | 🟠 P1 | `AUDIT` |  | Bảng dữ liệu gốc của Đơn thư còn nguyên |  S2 |
| [TC-176](#tc-176) | 🟠 P1 | `STATE` |  | Mở vụ việc đang Tạm đình chỉ: đúng phần giai đoạn đó tự mở |  S3 |
| [TC-177](#tc-177) | 🟠 P1 | `STATE` |  | Vụ việc có trạng thái rỗng hoặc lạ: không lỗi, mặc định hợp lý |  S2 |
| [TC-179](#tc-179) | 🟠 P1 | `UX` |  | Form Vụ việc: mỗi khái niệm một ô, khu trường hệ cũ không trùng |  S2 |
| [TC-189](#tc-189) | 🟠 P1 | `REGRESSION` |  | Hồi quy: bảng chỉ tiêu và biểu đồ không sai lệch sau hợp nhất |  S2 |
| [TC-190](#tc-190) | 🟠 P1 | `METAMORPHIC` |  | Quan hệ biến đổi: thêm điều kiện lọc thì tập kết quả phải thu hẹp |  S2 |
| [TC-194](#tc-194) | 🟠 P1 | `EDGE` |  | Hai người sửa hai hồ sơ khác nhau cùng lúc: dữ liệu không lẫn |  S1 |
| [TC-195](#tc-195) | 🟠 P1 | `E2E` |  | Dữ liệu nhập trong phiên vẫn đúng sau khi đăng xuất và đăng nhập lại |  S2 |
| [TC-029](#tc-029) | 🟡 P2 | `EP` |  | Dữ liệu cũ là chuỗi rỗng: hiển thị trống, không coi là giá trị |  S3 |
| [TC-043](#tc-043) | 🟡 P2 | `BOUNDARY` |  | Biên: số bị hại bằng 0 phân biệt với bỏ trống |  S3 |
| [TC-044](#tc-044) | 🟡 P2 | `BOUNDARY` |  | Biên: số bị hại bằng 1 (giá trị nhỏ nhất có ý nghĩa) |  S4 |
| [TC-071](#tc-071) | 🟡 P2 | `DECISION` |  | Trường đúng/sai – chưa từng đặt: phân biệt với 'không' |  S3 |
| [TC-076](#tc-076) | 🟡 P2 | `EP` |  | Trường văn bản chỉ chứa khoảng trắng: coi như bỏ trống, không ghi rác vào cột |  S3 |
| [TC-082](#tc-082) | 🟡 P2 | `EXPLORATORY` |  | Miền giá trị của phân loại và tình trạng: ghi nhận khoảng trống trong yêu cầu |  S4 |
| [TC-112](#tc-112) | 🟡 P2 | `DECISION` |  | Chuẩn hoá – không có dữ liệu nguồn: không làm gì |  S3 |
| [TC-128](#tc-128) | 🟡 P2 | `UX` |  | Giá trị ngày trong bảng gốc hiển thị dạng người đọc được |  S3 |
| [TC-134](#tc-134) | 🟡 P2 | `UX` |  | Cụm Sự việc và địa điểm gom đủ tiêu đề, mô tả, phương thức, nơi xảy ra, mốc thời gian |  S3 |
| [TC-136](#tc-136) | 🟡 P2 | `UX` |  | Cụm Phân công gom cán bộ thụ lý, điều tra viên hệ cũ, đơn vị, lãnh đạo, hạn xử lý |  S3 |
| [TC-138](#tc-138) | 🟡 P2 | `UX` |  | Cụm Thống kê và di trú nằm cuối |  S4 |
| [TC-141](#tc-141) | 🟡 P2 | `UX` |  | Trường bắt buộc nằm đầu mỗi cụm |  S4 |
| [TC-145](#tc-145) | 🟡 P2 | `A11Y` |  | Điều hướng bàn phím đi theo đúng trình tự cụm A đến G |  S3 |
| [TC-146](#tc-146) | 🟡 P2 | `A11Y` |  | Quét tiếp cận tự động trên form Vụ án |  S3 |
| [TC-152](#tc-152) | 🟡 P2 | `EP` |  | Từ khoá không tồn tại: không kết quả, không lỗi |  S4 |
| [TC-154](#tc-154) | 🟡 P2 | `PERFORMANCE` |  | Hiệu năng tìm kiếm theo cột mới trên dữ liệu thật |  S3 |
| [TC-193](#tc-193) | 🟡 P2 | `PERFORMANCE` |  | Tải danh sách trên khối dữ liệu di trú thật: không lỗi, thời gian chấp nhận được |  S3 |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-01`
- Oracle_source: PLAN §A1 hàng 1 — canonical = cột Case `tenCungCap`, nhãn 'Người tố cáo/Báo tin'; PLAN §B2 CREATE bắt buộc map cột intake
- Catches_bug: CREATE chỉ ghi metadata (bỏ map cột intake) → vụ mới không tìm được theo tên, thống kê thiếu

**Runner contract**:
- Coverage_ids: `COV-CR-01`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: tên người tố cáo được lưu vào cột chính thức, không chỉ nằm trong dữ liệu phụ

### Các bước kiểm thử
- [ ] Tạo vụ án mới với ô 'Người tố cáo/Báo tin' = 'Nguyễn Văn Kiểm Tra A'
- [ ] Lưu
- [ ] Đọc lại hồ sơ vừa tạo

### Kết quả mong đợi
- Giá trị nằm ở trường canonical của hồ sơ (cột `tenCungCap`) và đọc lại đúng nguyên văn. KHÔNG chấp nhận trường hợp chỉ tồn tại trong khối dữ liệu phụ (metadata).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-002

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-02`
- Oracle_source: PLAN §A1 hàng 2 — canonical `cccdCungCap`, nhãn 'Số CCCD'
- Catches_bug: Số CCCD chỉ vào metadata → tra cứu định danh không ra

**Runner contract**:
- Coverage_ids: `COV-CR-02`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: số CCCD người tố cáo lưu vào cột chính thức

### Các bước kiểm thử
- [ ] Tạo vụ án với Số CCCD = '079123456789' (12 chữ số theo Luật Căn cước)
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `cccdCungCap` = '079123456789'; đọc lại đúng 12 chữ số, không bị cắt/đổi kiểu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-04`
- Oracle_source: PLAN §A1 hàng 4 — canonical `sdtCungCap`, nhãn 'Số điện thoại'
- Catches_bug: SĐT rơi vào metadata → không liên hệ được người báo tin từ hồ sơ

**Runner contract**:
- Coverage_ids: `COV-CR-03`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: số điện thoại người tố cáo lưu vào cột chính thức

### Các bước kiểm thử
- [ ] Tạo vụ án với Số điện thoại = '0901234567'
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `sdtCungCap` = '0901234567', giữ nguyên số 0 đứng đầu (không bị hiểu thành số học).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-004

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-05`
- Oracle_source: PLAN §A1 hàng 5 — canonical `diaChiCungCap`, nhãn 'Địa chỉ'
- Catches_bug: Địa chỉ ghi nhầm sang trường khác hoặc chỉ vào metadata

**Runner contract**:
- Coverage_ids: `COV-CR-04`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: địa chỉ người tố cáo lưu vào cột chính thức

### Các bước kiểm thử
- [ ] Tạo vụ án với Địa chỉ = '123 Nguyễn Trãi, Phường 5, Quận 5, TP.HCM'
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `diaChiCungCap` giữ nguyên chuỗi có dấu tiếng Việt và dấu phẩy; không bị cắt.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-06`
- Oracle_source: PLAN §A1 hàng 6 — canonical `moTaChiTiet`, nhãn 'Tóm tắt nội dung'
- Catches_bug: Mô tả vụ việc lưu 2 nơi lệch nhau (description vs moTaChiTiet)

**Runner contract**:
- Coverage_ids: `COV-CR-05`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: tóm tắt nội dung lưu vào cột chính thức

### Các bước kiểm thử
- [ ] Tạo vụ án, ô 'Tóm tắt nội dung' nhập đoạn mô tả nhiều dòng
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `moTaChiTiet` chứa đúng nội dung kể cả xuống dòng; chỉ tồn tại MỘT trường mô tả, không có bản sao thứ hai mang giá trị khác.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-006

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-N`
- Oracle_source: PLAN §A2 (N) — thêm cột `receiveDate`(Date); PLAN §A0 defaults: receiveDate là cột RIÊNG, không tái dùng ngayTiepNhan của UTDT
- Catches_bug: receiveDate vẫn nằm ở metadata → không lọc/thống kê được theo ngày tiếp nhận

**Runner contract**:
- Coverage_ids: `COV-CR-06`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: ngày tiếp nhận lưu vào cột mới `receiveDate`

### Các bước kiểm thử
- [ ] Tạo vụ án với Ngày tiếp nhận = 15/08/2026
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `receiveDate` = 2026-08-15 (date-only, không lệch sang 14/08 hay 16/08). Trường này TÁCH BIỆT với ngày tiếp nhận của Ủy thác điều tra.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-009

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R6`
- Oracle_source: PLAN §A3 R6 — THÊM cột `toiDanhBanDau`, đặt cạnh cụm tội danh; CẤM merge `criminalSecondaryType`
- Catches_bug: toiDanhBanDau bị gộp vào tội danh phụ → sai bản chất tố tụng của hồ sơ

**Runner contract**:
- Coverage_ids: `COV-CR-09`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: tội danh ban đầu lưu vào cột riêng, không đụng tội danh phụ

### Các bước kiểm thử
- [ ] Tạo vụ án: nhập Tội danh ban đầu = 'Trộm cắp tài sản' VÀ Tội danh phụ = 'Tiêu thụ tài sản do người khác phạm tội mà có'
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Hai giá trị nằm ở hai trường độc lập; `toiDanhBanDau` = 'Trộm cắp tài sản' và tội danh phụ giữ nguyên giá trị riêng. Không trường nào ghi đè trường kia.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-010

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-03`
- Oracle_source: PLAN §A1 hàng 3 — canonical `reporterDateOfBirth` kiểu Date (kiểu native), cờ năm-only ở cột `reporterDateOfBirthPrecision`, KHÔNG dùng cờ metadata
- Catches_bug: Ngày sinh lưu dạng chuỗi năm (kiểu cũ) → không so sánh/lọc theo tuổi được

**Runner contract**:
- Coverage_ids: `COV-CR-10`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: ngày sinh người tố cáo lưu kiểu ngày + cờ độ chính xác ở cột

### Các bước kiểm thử
- [ ] Tạo vụ án, nhập Ngày sinh = 20/05/1985
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `reporterDateOfBirth` = 1985-05-20 kiểu ngày; `reporterDateOfBirthPrecision` KHÔNG mang giá trị 'year' (vì đây là ngày đầy đủ). Cả hai đều là CỘT, không phải khoá metadata.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-011

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-07`
- Oracle_source: PLAN §A1 hàng 7 — canonical = `case_statistics.soTienBiThietHai`; ghi qua `payload.statistic.*`; tạo row nếu vụ chưa có
- Catches_bug: Vụ mới chưa có bản ghi thống kê → ghi thiệt hại thất bại im lặng hoặc lỗi 500

**Runner contract**:
- Coverage_ids: `COV-CR-11`, `COV-ST-04`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới có thiệt hại: số tiền vào bảng thống kê, tự tạo bản ghi nếu chưa có

### Các bước kiểm thử
- [ ] Tạo vụ án mới, nhập Số tiền thiệt hại = 1500000
- [ ] Lưu
- [ ] Đọc lại hồ sơ và phần thống kê

### Kết quả mong đợi
- Bản ghi thống kê của vụ được tạo với `soTienBiThietHai` = 1500000. Giá trị KHÔNG nằm ở metadata của hồ sơ như một nguồn thứ hai.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-012

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-08`
- Oracle_source: PLAN §A1 hàng 8 — canonical = `case_statistics.soLuongBiHai`
- Catches_bug: Số bị hại lưu ở metadata → báo cáo tổng hợp đếm thiếu

**Runner contract**:
- Coverage_ids: `COV-CR-12`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới có số bị hại: lưu vào bảng thống kê

### Các bước kiểm thử
- [ ] Tạo vụ án mới, nhập Số bị hại = 3
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- `case_statistics.soLuongBiHai` = 3; đọc lại từ bảng thống kê.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-013

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B2`
- Oracle_source: PLAN §B2 — 'CREATE bắt buộc bổ sung map cột intake (hiện chỉ UPDATE có) — P1 blocker'
- Catches_bug: Đường tạo mới thiếu ánh xạ cột: người dùng nhập đủ nhưng hồ sơ mới rỗng cột, chỉ UPDATE mới ghi được — mất dữ liệu ở đúng bước đầu tiên

**Runner contract**:
- Coverage_ids: `COV-CR-13`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Hồi quy chốt chặn: tạo vụ án điền đủ cụm tiếp nhận — KHÔNG cột nào bị bỏ trống

### Các bước kiểm thử
- [ ] Tạo vụ án MỚI điền đồng thời: người tố cáo, CCCD, SĐT, địa chỉ, tóm tắt, ngày tiếp nhận, phân loại, tình trạng, tội danh ban đầu, ngày sinh
- [ ] Lưu (KHÔNG sửa lại lần nào)
- [ ] Đọc lại toàn bộ hồ sơ

### Kết quả mong đợi
- TẤT CẢ trường trên đều có giá trị ở cột ngay sau lần lưu ĐẦU TIÊN. Nếu bất kỳ trường nào chỉ có giá trị sau khi sửa lần 2 → FAIL (lỗ hổng đường tạo mới).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-017

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V3`
- Oracle_source: PLAN §Verification 3 — 'reload hiện đúng từ cột; CREATE vụ mới → cột có data'
- Catches_bug: Giao diện đọc từ metadata nên vẫn 'trông đúng' dù cột rỗng — che giấu lỗi mất dữ liệu

**Runner contract**:
- Coverage_ids: `COV-CR-17`
- Backend_policy: `live`
- Locator_hint: `form Vụ án — cụm 'Người tố cáo/Báo tin'`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Sau khi tạo, mở lại hồ sơ: mọi ô hiển thị đúng giá trị lấy từ cột

### Các bước kiểm thử
- [ ] Tạo vụ án đầy đủ như TC-013 trên giao diện
- [ ] Tải lại trang chi tiết
- [ ] Đối chiếu từng ô với giá trị đã nhập
- [ ] Đối chiếu tiếp với giá trị đọc trực tiếp từ cột

### Kết quả mong đợi
- Giá trị trên màn hình = giá trị đã nhập = giá trị trong cột. Ba nguồn khớp nhau.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-018

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `ONE-FIELD-ONE-BOX`
- Oracle_source: PLAN mục tiêu cuối — 'mỗi khái niệm = 1 ô form (nhãn native) ↔ 1 cột typed ↔ 0 metadata trùng'
- Catches_bug: Form vẫn còn ô trùng nghĩa: người nhập điền một ô, ô kia rỗng, hồ sơ ra kết quả nửa vời

**Runner contract**:
- Coverage_ids: `COV-CR-18`, `COV-UI-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`

**Gherkin**:
```gherkin
Given cán bộ tiếp nhận đăng nhập
When tạo một vụ án và điền mỗi thông tin đúng MỘT lần
Then hồ sơ lưu thành công và mở lại hiển thị đủ, không ô nào rỗng vì đã điền nhầm ô song trùng
```

**Tiêu đề**: E2E: cán bộ tiếp nhận tạo trọn một vụ án qua giao diện, mỗi khái niệm chỉ điền một lần

### Các bước kiểm thử
- [ ] Đăng nhập vai cán bộ tiếp nhận
- [ ] Mở form tạo vụ án
- [ ] Rà toàn bộ form: với 8 khái niệm của mục A1 (người tố cáo, CCCD, ngày sinh, SĐT, địa chỉ, tóm tắt, thiệt hại, số bị hại) đếm số ô nhập ứng với mỗi khái niệm
- [ ] Điền mỗi khái niệm một lần, lưu
- [ ] Mở lại hồ sơ

### Kết quả mong đợi
- Mỗi khái niệm chỉ có ĐÚNG 1 ô nhập trên toàn form (kể cả các tab). Lưu thành công. Mở lại đủ giá trị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-019

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — 'mergeCaseApiToFormData: đọc apiData.<col> (+ statistic), fallback meta.<key>'
- Catches_bug: Form vẫn đọc metadata trước → sửa xong lưu vào cột nhưng màn hình hiện giá trị cũ

**Runner contract**:
- Coverage_ids: `COV-UP-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Hồ sơ đã chuẩn hoá: form hiển thị giá trị lấy từ cột

### Các bước kiểm thử
- [ ] Chọn một vụ đã được chuẩn hoá (cột có giá trị)
- [ ] Mở form sửa
- [ ] Đối chiếu ô hiển thị với giá trị trong cột

### Kết quả mong đợi
- Ô hiển thị đúng giá trị của CỘT.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-020

**Meta**:
- Loại: `EDGE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — 'fallback meta.<key> cho vụ chưa backfill'
- Catches_bug: Bỏ fallback → hồ sơ chưa chuẩn hoá hiện trắng trơn, cán bộ tưởng mất dữ liệu và nhập đè lên

**Runner contract**:
- Coverage_ids: `COV-UP-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Hồ sơ chưa chuẩn hoá: form vẫn hiển thị dữ liệu cũ nhờ cơ chế dự phòng

### Các bước kiểm thử
- [ ] Chọn vụ có cột rỗng nhưng dữ liệu cũ còn trong khối metadata
- [ ] Mở form sửa
- [ ] Quan sát các ô tương ứng

### Kết quả mong đợi
- Ô hiển thị giá trị cũ (từ metadata), KHÔNG rỗng. Người dùng không bị hiểu nhầm là mất dữ liệu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-021

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 + memory epic: 'dual-write hiện an toàn — cột thắng khi đọc'
- Catches_bug: Metadata cũ thắng → sửa xong màn hình quay về giá trị cũ, người dùng sửa đi sửa lại

**Runner contract**:
- Coverage_ids: `COV-UP-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Cột và dữ liệu cũ khác nhau: cột là nguồn hiển thị

### Các bước kiểm thử
- [ ] Chuẩn bị vụ có cột = 'GIÁ TRỊ MỚI' và metadata cùng khái niệm = 'GIÁ TRỊ CŨ'
- [ ] Mở form sửa

### Kết quả mong đợi
- Ô hiển thị 'GIÁ TRỊ MỚI' (cột thắng). Không hiển thị đồng thời hai giá trị mâu thuẫn ở hai ô khác nhau.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-022

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V3`
- Oracle_source: PLAN §Verification 3 — 'sửa 1 vụ trên FE mới → giá trị vào cột/statistic (SELECT cột đổi)'
- Catches_bug: Form vẫn gửi vào metadata → cột không đổi, tìm kiếm/thống kê dùng số liệu cũ

**Runner contract**:
- Coverage_ids: `COV-UP-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Sửa giá trị trên form: cột được cập nhật

### Các bước kiểm thử
- [ ] Mở vụ, đổi ô 'Người tố cáo/Báo tin' sang giá trị mới có dấu thời gian
- [ ] Lưu
- [ ] Đọc lại cột

### Kết quả mong đợi
- Cột `tenCungCap` mang giá trị mới.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-024

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — lọc key đã thăng khỏi re-merge legacyMetadata; nếu không, mỗi lần sửa vẫn re-write metadata cũ
- Catches_bug: Cơ chế gộp lại dữ liệu cũ khiến ô vừa xoá bị điền lại bằng giá trị hệ cũ — người dùng không xoá được thông tin sai

**Runner contract**:
- Coverage_ids: `COV-UP-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Xoá trắng một ô đã có dữ liệu: giá trị cũ không tự sống lại

### Các bước kiểm thử
- [ ] Mở vụ đã di trú có giá trị ở ô 'Nơi xảy ra'
- [ ] Xoá trắng ô đó, lưu
- [ ] Tải lại trang

### Kết quả mong đợi
- Ô vẫn trống sau khi tải lại. Giá trị cũ KHÔNG quay lại từ dữ liệu hệ cũ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-025

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: AUTH-01 (BLTTHS 2015 — hồ sơ không được thay đổi ngầm); PLAN §Verification 2
- Catches_bug: Thao tác lưu vô hại làm rơi trường không nằm trong form, hoặc chuẩn hoá lại giá trị (cắt khoảng trắng, đổi định dạng ngày) làm sai bản gốc

**Runner contract**:
- Coverage_ids: `COV-UP-07`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Mở rồi lưu lại mà không sửa gì: hồ sơ không tự biến đổi

### Các bước kiểm thử
- [ ] Chụp toàn bộ dữ liệu hồ sơ (mọi cột + metadata + thống kê) TRƯỚC
- [ ] Mở form sửa, không thay đổi gì, bấm Lưu
- [ ] Chụp lại toàn bộ dữ liệu SAU
- [ ] So sánh từng trường

### Kết quả mong đợi
- Không trường nào thay đổi giá trị, không trường nào biến mất. Chỉ dấu thời gian cập nhật được phép đổi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-026

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — 'Lọc key đã thăng khỏi legacyMetadata re-merge — nếu không, mỗi lần sửa vẫn re-write metadata cũ (P1 codex)'
- Catches_bug: Vòng lặp gộp lại dữ liệu cũ: sửa lần 2 ghi đè lần 1 bằng giá trị hệ cũ

**Runner contract**:
- Coverage_ids: `COV-UP-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Sửa hai lần liên tiếp: giá trị không quay ngược về bản hệ cũ

### Các bước kiểm thử
- [ ] Sửa ô 'Nơi xảy ra' thành 'LAN-1', lưu, tải lại
- [ ] Sửa ô 'Tóm tắt nội dung' (một ô KHÁC) thành 'LAN-2', lưu, tải lại
- [ ] Kiểm tra ô 'Nơi xảy ra'

### Kết quả mong đợi
- Ô 'Nơi xảy ra' vẫn là 'LAN-1'. Không bị khôi phục về giá trị hệ cũ do lần lưu thứ hai.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-027

**Meta**:
- Loại: `UX`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `ONE-FIELD-ONE-BOX`
- Oracle_source: PLAN §B4 — 'field đã vào form chính phải gỡ khỏi parityState... tránh 2 nguồn cùng ghi 1 cột'; mục tiêu 1 ô/khái niệm
- Catches_bug: Hai ô cùng ghi một cột, thứ tự ghi đè quyết định giá trị cuối → kết quả phụ thuộc may rủi

**Runner contract**:
- Coverage_ids: `COV-UP-09`, `COV-TRC-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Trường đã lên form chính không xuất hiện lần nữa ở khu dữ liệu hệ cũ

### Các bước kiểm thử
- [ ] Mở form sửa một vụ đã di trú
- [ ] Liệt kê tên trường ở khu 'trường hệ cũ'/panel bổ sung
- [ ] Đối chiếu với danh sách trường đã lên form chính (22 trường mục A2-C + 8 cặp A1)

### Kết quả mong đợi
- Không trường nào xuất hiện ở CẢ hai nơi dưới dạng ô nhập được. Nếu có → chỉ rõ trường trùng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-030

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V3`
- Oracle_source: PLAN §Verification 3 — một nơi lưu duy nhất, reload hiện đúng từ cột
- Catches_bug: Chuỗi đọc-sửa-ghi bị đứt ở một mắt xích (đọc metadata / ghi metadata / re-merge) khiến kết quả không bền

**Runner contract**:
- Coverage_ids: `COV-UP-12`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`, `db-readback`

**Gherkin**:
```gherkin
Given một vụ án đã di trú từ hệ cũ
When điều tra viên sửa thông tin nơi xảy ra và lưu
Then giá trị mới bền vững qua tải lại trang, đăng xuất và đăng nhập lại
```

**Tiêu đề**: E2E: điều tra viên mở hồ sơ đã di trú, sửa một thông tin và thấy kết quả bền vững

### Các bước kiểm thử
- [ ] Đăng nhập vai điều tra viên
- [ ] Tìm vụ theo số hồ sơ cũ
- [ ] Mở, sửa 'Nơi xảy ra', lưu
- [ ] Tải lại trang
- [ ] Đăng xuất, đăng nhập lại, mở lại vụ

### Kết quả mong đợi
- Giá trị mới hiển thị ở cả 3 lần kiểm tra và nằm trong cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-031

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: PLAN §A3 R1 — 'metadata.damageAmount + metadata.stat_damageAmount + tab TK đọc/ghi CÙNG cột statistic'
- Catches_bug: Hai tab đọc hai nguồn khác nhau → lãnh đạo và cán bộ thống kê nhìn hai con số khác nhau cho cùng một vụ

**Runner contract**:
- Coverage_ids: `COV-ST-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nhập thiệt hại ở tab Thông tin: tab Thống kê hiện đúng số ngay

### Các bước kiểm thử
- [ ] Mở vụ án, tab Thông tin: nhập Số tiền thiệt hại = 2500000
- [ ] Lưu
- [ ] Chuyển sang tab Thống kê

### Kết quả mong đợi
- Tab Thống kê hiển thị 2500000. Hai tab dùng chung một nguồn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-032

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: PLAN §A3 R1 — cùng cột, hai chiều
- Catches_bug: Đồng bộ chỉ một chiều: sửa ở Thống kê không hiện ở Thông tin, cán bộ nhập lại lần nữa gây ghi đè

**Runner contract**:
- Coverage_ids: `COV-ST-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nhập thiệt hại ở tab Thống kê: tab Thông tin hiện đúng số (chiều ngược lại)

### Các bước kiểm thử
- [ ] Mở vụ, tab Thống kê: đổi Số tiền thiệt hại = 3700000
- [ ] Lưu
- [ ] Quay lại tab Thông tin

### Kết quả mong đợi
- Tab Thông tin hiển thị 3700000.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-033

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-08`
- Oracle_source: PLAN §A1 hàng 8 + §A3 R1
- Catches_bug: Số bị hại lệch giữa hai tab → thống kê ngành sai

**Runner contract**:
- Coverage_ids: `COV-ST-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Số bị hại đồng bộ hai chiều giữa hai tab

### Các bước kiểm thử
- [ ] Đặt Số bị hại = 5 ở tab Thông tin, lưu, kiểm tra tab Thống kê
- [ ] Đổi thành 7 ở tab Thống kê, lưu, kiểm tra tab Thông tin

### Kết quả mong đợi
- Bước 1 tab Thống kê = 5; bước 2 tab Thông tin = 7.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-034

**Meta**:
- Loại: `EDGE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-07`
- Oracle_source: PLAN §A1 hàng 7 — 'SQL trên case_statistics (tạo row nếu thiếu)'; §B3 upsert ON CONFLICT
- Catches_bug: Chỉ cập nhật mà không tạo bản ghi → vụ chưa có thống kê thì thao tác thất bại im lặng

**Runner contract**:
- Coverage_ids: `COV-ST-04`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Vụ chưa từng có số liệu thống kê: nhập thiệt hại lần đầu vẫn thành công

### Các bước kiểm thử
- [ ] Chọn vụ chưa có bản ghi thống kê
- [ ] Nhập Số tiền thiệt hại = 900000, lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Bản ghi thống kê được tạo, giá trị = 900000, không lỗi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-035

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-07`
- Oracle_source: PLAN §B3 — upsert ON CONFLICT (case_id)
- Catches_bug: Sinh nhiều bản ghi thống kê cho một vụ → tổng hợp cộng trùng, số liệu báo cáo phóng đại

**Runner contract**:
- Coverage_ids: `COV-ST-05`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Vụ đã có số liệu: cập nhật chứ không sinh bản ghi thống kê thứ hai

### Các bước kiểm thử
- [ ] Chọn vụ đã có bản ghi thống kê
- [ ] Đổi thiệt hại 3 lần liên tiếp và lưu mỗi lần
- [ ] Đếm số bản ghi thống kê của vụ

### Kết quả mong đợi
- Luôn đúng MỘT bản ghi; giá trị = lần nhập cuối.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-036

**Meta**:
- Loại: `EDGE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — backfill damage từ metadata.damageAmount/stat_damageAmount; §B4 fallback
- Catches_bug: Vụ chưa chuẩn hoá hiện thiệt hại = 0 → lãnh đạo kết luận vụ không thiệt hại

**Runner contract**:
- Coverage_ids: `COV-ST-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Vụ cũ có thiệt hại trong dữ liệu phụ: hiển thị đúng ở cả hai tab

### Các bước kiểm thử
- [ ] Chọn vụ cũ có thiệt hại nằm trong khối dữ liệu phụ, chưa lên bảng thống kê
- [ ] Xem tab Thông tin và tab Thống kê

### Kết quả mong đợi
- Cả hai tab đều hiển thị số thiệt hại cũ, KHÔNG hiển thị 0 hay trống.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-037

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: PLAN §Context 4 — 'Damage/victim hiện có 3 nơi... Phải hợp nhất cả 3'; §A3 R1 tắt đường metadata trùng
- Catches_bug: Ba nguồn tồn tại song song → mỗi màn hình lấy một nguồn, không ai biết số nào đúng

**Runner contract**:
- Coverage_ids: `COV-ST-07`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Hai nguồn thiệt hại cũ mâu thuẫn: hệ thống không trưng ra hai con số khác nhau

### Các bước kiểm thử
- [ ] Chuẩn bị vụ có hai giá trị thiệt hại khác nhau trong hai khoá dữ liệu phụ
- [ ] Mở tab Thông tin, tab Thống kê và màn hình danh sách/tổng hợp
- [ ] Ghi lại con số ở từng nơi

### Kết quả mong đợi
- Mọi nơi hiển thị CÙNG một con số. Nếu có mâu thuẫn dữ liệu gốc, mâu thuẫn phải được ghi nhận (bảng xung đột), không phải hiển thị tuỳ nơi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-042

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-FABRICATION`
- Oracle_source: PLAN §B3 — 'Giá trị không parse được → bảng reject, null cột — không bịa'; AUTH-06
- Catches_bug: Chuỗi không phải số bị ép thành 0 → hồ sơ khẳng định 'không thiệt hại' trong khi thực tế chưa xác định

**Runner contract**:
- Coverage_ids: `COV-ST-12`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Thiệt hại nhập bằng chữ 'không rõ': từ chối, không bịa số 0

### Các bước kiểm thử
- [ ] Nhập 'không rõ' vào ô Số tiền thiệt hại
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Từ chối hoặc giữ trống. KHÔNG được lưu 0. Phân biệt rõ 'chưa xác định' với 'bằng không'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-046

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: PLAN §A3 R1 — tắt đường metadata trùng, một nguồn duy nhất
- Catches_bug: Xoá ở một nguồn nhưng nguồn còn lại giữ số cũ → số 'ma' tiếp tục vào báo cáo

**Runner contract**:
- Coverage_ids: `COV-ST-16`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Xoá trắng thiệt hại: cả hai tab cùng trống, không còn số cũ ở tab kia

### Các bước kiểm thử
- [ ] Chọn vụ có thiệt hại hiển thị ở cả hai tab
- [ ] Xoá trắng ở tab Thông tin, lưu
- [ ] Kiểm tra tab Thống kê và màn hình tổng hợp

### Kết quả mong đợi
- Mọi nơi đều trống. Không nơi nào còn số cũ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-047

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: PLAN §A3 R1 — 'tab TK đọc/ghi CÙNG cột statistic'
- Catches_bug: Báo cáo đọc metadata cũ trong khi form ghi vào cột → báo cáo trình lãnh đạo sai số

**Runner contract**:
- Coverage_ids: `COV-ST-17`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Màn hình tổng hợp/báo cáo lấy số liệu cùng nguồn với form

### Các bước kiểm thử
- [ ] Ghi lại số thiệt hại của một vụ trên màn hình tổng hợp
- [ ] Sửa thiệt hại trên form vụ đó, lưu
- [ ] Xem lại màn hình tổng hợp

### Kết quả mong đợi
- Số trên màn hình tổng hợp thay đổi theo giá trị mới.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-048

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `SINGLE-STORE-SYNC`
- Oracle_source: PLAN §A3 R1 — một nguồn duy nhất cho thiệt hại/bị hại
- Catches_bug: Chuỗi nhập-lưu-đọc qua hai tab đứt ở một mắt xích khiến số liệu phân kỳ

**Runner contract**:
- Coverage_ids: `COV-ST-18`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`, `db-readback`

**Gherkin**:
```gherkin
Given một vụ án mới
When cán bộ thống kê nhập số tiền thiệt hại và số bị hại
Then cả tab Thông tin, tab Thống kê và màn hình tổng hợp đều hiển thị cùng con số
```

**Tiêu đề**: E2E: cán bộ thống kê nhập thiệt hại và số bị hại, kiểm chứng khớp trên tab Thống kê

### Các bước kiểm thử
- [ ] Đăng nhập vai cán bộ thống kê
- [ ] Tạo/mở vụ, nhập thiệt hại 4200000 và số bị hại 2
- [ ] Lưu, tải lại
- [ ] Kiểm tra tab Thông tin, tab Thống kê, màn hình tổng hợp

### Kết quả mong đợi
- Ba nơi cùng hiển thị 4200000 và 2.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-049

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-03`
- Oracle_source: PLAN §A1 hàng 3 — lệch kiểu → chuyển về kiểu native (Date)
- Catches_bug: Ngày đầy đủ bị đánh dấu chỉ-năm → hồ sơ mất thông tin ngày tháng thật

**Runner contract**:
- Coverage_ids: `COV-DOB-01`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Ngày sinh đầy đủ: lưu kiểu ngày, độ chính xác không bị đánh dấu là chỉ-năm

### Các bước kiểm thử
- [ ] Nhập Ngày sinh = 03/11/1978, lưu
- [ ] Đọc lại cả giá trị ngày và cờ độ chính xác

### Kết quả mong đợi
- Ngày = 1978-11-03; cờ độ chính xác KHÔNG phải 'year'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-050

**Meta**:
- Loại: `EDGE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-03`
- Oracle_source: PLAN §A1 hàng 3 — 'năm-only cũ → YYYY-01-01 + cột reporterDateOfBirthPrecision=year'
- Catches_bug: Chuyển năm '1985' thành ngày 01/01/1985 mà không đánh dấu → hồ sơ khẳng định ngày sinh không có thật

**Runner contract**:
- Coverage_ids: `COV-DOB-02`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Dữ liệu cũ chỉ có năm sinh: lưu ngày 01/01 kèm cờ đánh dấu chỉ-năm

### Các bước kiểm thử
- [ ] Chọn vụ có dữ liệu cũ năm sinh = '1985' (chỉ năm)
- [ ] Đọc giá trị ngày sinh và cờ độ chính xác sau chuẩn hoá

### Kết quả mong đợi
- Ngày = 1985-01-01 VÀ cờ độ chính xác = 'year'. Thiếu cờ = FAIL.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-053

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PRECISION-EXPLICIT`
- Oracle_source: PLAN §A1 hàng 3; codex fix ghi nhận 'DOB precision round-trip' là P0
- Catches_bug: Form đọc ngày 01/01/1985 rồi ghi lại như ngày chính xác, cờ chỉ-năm biến mất — hồ sơ âm thầm 'chính xác hoá' một dữ liệu không có thật

**Runner contract**:
- Coverage_ids: `COV-DOB-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Vòng đi-về: mở hồ sơ chỉ-năm rồi lưu lại không sửa gì, vẫn là chỉ-năm

### Các bước kiểm thử
- [ ] Ghi lại ngày sinh + cờ độ chính xác
- [ ] Mở form sửa, KHÔNG chạm ô ngày sinh, sửa một ô khác, lưu
- [ ] Đọc lại ngày sinh + cờ

### Kết quả mong đợi
- Ngày = 1985-01-01 và cờ vẫn là 'year'. Cờ mất đi = FAIL nghiêm trọng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-055

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-FABRICATION`
- Oracle_source: PLAN §B3 — giá trị không parse được → reject; codex fix 'impossible-date reject' là P0
- Catches_bug: 31/02/1985 bị tự nắn thành 03/03/1985 → hồ sơ mang ngày sinh do máy bịa ra

**Runner contract**:
- Coverage_ids: `COV-DOB-07`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Ngày không tồn tại (31/02): từ chối, không tự nắn về ngày khác

### Các bước kiểm thử
- [ ] Cho dữ liệu ngày sinh cũ = '31/02/1985'
- [ ] Chuẩn hoá/nhập
- [ ] Đọc lại cột ngày sinh và bảng từ chối

### Kết quả mong đợi
- Cột để trống + bản ghi được ghi vào danh sách từ chối kèm giá trị gốc. TUYỆT ĐỐI không xuất hiện ngày 03/03 hay 28/02.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-056

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-FABRICATION`
- Oracle_source: PLAN §B3 + codex fix 'epoch reject' P0
- Catches_bug: Số 0 hoặc chuỗi rỗng bị đổi thành 01/01/1970 → hàng loạt hồ sơ có ngày sinh giả giống hệt nhau

**Runner contract**:
- Coverage_ids: `COV-DOB-08`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Giá trị rác dạng mốc thời gian gốc (01/01/1970): không nhận là ngày sinh

### Các bước kiểm thử
- [ ] Cho dữ liệu cũ có giá trị 0 / '1970-01-01' ở trường ngày sinh
- [ ] Chuẩn hoá
- [ ] Đọc lại và đếm số hồ sơ có ngày sinh 01/01/1970

### Kết quả mong đợi
- Không hồ sơ nào nhận ngày sinh 01/01/1970 từ giá trị rác; các bản này nằm ở danh sách từ chối.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-058

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `World`
- Rule_ref: `DATE-NO-DRIFT`
- Oracle_source: PLAN §B1 — 'Ngày = quy ước date-only (lưu 00:00 giờ VN, tránh off-by-one)'; AUTH-07
- Catches_bug: Lưu theo giờ quốc tế khiến 01/01 hiển thị thành 31/12 năm trước — sai năm sinh, sai mốc tố tụng

**Runner contract**:
- Coverage_ids: `COV-DOB-10`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Ngày không kèm giờ không bị lệch một ngày khi lưu và đọc lại

### Các bước kiểm thử
- [ ] Nhập Ngày sinh = 01/01/1990 (mốc dễ lệch năm)
- [ ] Lưu, tải lại trang, đọc trên màn hình
- [ ] Đọc trực tiếp giá trị lưu trữ

### Kết quả mong đợi
- Cả màn hình và giá trị lưu trữ đều là 01/01/1990. Không xuất hiện 31/12/1989.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-059

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `World`
- Rule_ref: `PLAN-B1`
- Oracle_source: PLAN §B1 — quy ước date-only áp cho mọi cột ngày
- Catches_bug: Chỉ một trường ngày được xử lý đúng múi giờ, các trường khác lệch → mốc tố tụng sai một ngày, ảnh hưởng tính thời hạn

**Runner contract**:
- Coverage_ids: `COV-DOB-11`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Các trường ngày khác cũng không lệch: ngày tiếp nhận, ngày cấp CCCD, ngày phiếu chuyển

### Các bước kiểm thử
- [ ] Nhập cùng lúc: Ngày tiếp nhận = 01/01/2026, Ngày cấp CCCD = 01/01/2020, Ngày phiếu chuyển = 01/01/2026
- [ ] Lưu, tải lại
- [ ] Đối chiếu cả ba trên màn hình và trong lưu trữ

### Kết quả mong đợi
- Cả ba đều giữ đúng ngày 01/01, không trường nào lùi về 31/12.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-061

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) — danh sách 22 trường 'đã có cột Case, chỉ rebind + đặt chỗ'
- Catches_bug: Một vài trường bị bỏ quên khi rebind → người dùng không nhập được, hoặc nhập xong không lưu vào cột

**Runner contract**:
- Coverage_ids: `COV-PROMO-ALL`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Kiểm đếm đầy đủ: cả 22 trường hệ cũ đã thăng đều có ô trên form và lưu được vào cột

### Các bước kiểm thử
- [ ] Mở form sửa vụ án
- [ ] Với TỪNG tên trong danh sách 22: nguonDon, soPhieuChuyen, ngayPhieuChuyen, ngayGiaoDonViGiaiQuyet, ngayDeXuat, ngayVietDon, ngayCapCccd, noiCapCccd, ghiChuTrungDon, baoCaoBanGiamDoc, lanhDaoToTung, nhanXet, yeuCauBoSung, ketQuaXuLyKhac, doVatTaiLieuKemTheo, phanLoaiHoSoNoiBo, noiXayRa, phuongThucThuDoan, phanLoaiToiPhamLinhVuc, nghiVanDoiTuong, sttCu, soHoSoCu — xác định có ô nhập tương ứng hay không
- [ ] Nhập giá trị nhận dạng được cho từng ô, lưu
- [ ] Đọc lại từng cột

### Kết quả mong đợi
- Đủ 22 trường: có ô + lưu được vào cột + đọc lại đúng. Báo cáo phải LIỆT KÊ tên từng trường kèm kết quả — thiếu bất kỳ tên nào trong danh sách = FAIL, không được ghi 'các trường còn lại tương tự'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-065

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) + §A3 R2/R3/R4/R5 — các trường này giữ cột riêng
- Catches_bug: Nhóm trường nghiệp vụ điều tra bị gộp nhầm hoặc rơi

**Runner contract**:
- Coverage_ids: `COV-PROMO-TXT`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Nhóm văn bản – phân loại hồ sơ nội bộ, nơi xảy ra, phương thức thủ đoạn, phân loại tội phạm, nghi vấn đối tượng lưu vào cột

### Các bước kiểm thử
- [ ] Nhập phanLoaiHoSoNoiBo, noiXayRa, phuongThucThuDoan, phanLoaiToiPhamLinhVuc, nghiVanDoiTuong với 5 giá trị phân biệt được
- [ ] Lưu, đọc lại từng cột

### Kết quả mong đợi
- Năm cột mang đúng năm giá trị riêng biệt, không giá trị nào lẫn sang cột khác.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-073

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) — `soHoSoCu`; yêu cầu truy nguyên hệ cũ
- Catches_bug: Mất số hồ sơ gốc → đứt liên kết giữa hồ sơ điện tử và hồ sơ giấy đang lưu trữ

**Runner contract**:
- Coverage_ids: `COV-PROMO-ID`, `COV-TRC-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Số hồ sơ hệ cũ hiển thị, lưu và tra cứu được

### Các bước kiểm thử
- [ ] Mở vụ đã di trú, ghi lại Số hồ sơ hệ cũ
- [ ] Dùng số đó tìm kiếm
- [ ] Kiểm tra vụ có trong kết quả

### Kết quả mong đợi
- Số hiển thị đúng và tìm ra đúng vụ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-078

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: PLAN §A2 (R) reconcile tên; AUTH-01 không mất nội dung hồ sơ
- Catches_bug: Đổi tên khoá form làm giá trị cũ trong cột không được nạp lên → lưu lần sau ghi rỗng đè lên

**Runner contract**:
- Coverage_ids: `COV-PROMO-R1N`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Dữ liệu đề xuất đã có từ trước không bị mất khi form dùng tên mới

### Các bước kiểm thử
- [ ] Chọn vụ đã có giá trị trong cột đề xuất
- [ ] Mở form, quan sát ô đề xuất
- [ ] Sửa một ô KHÁC, lưu
- [ ] Đọc lại cột đề xuất

### Kết quả mong đợi
- Ô hiển thị giá trị cũ ở bước 2; sau bước 3 cột đề xuất vẫn giữ nguyên giá trị, không bị xoá.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-080

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-N`
- Oracle_source: PLAN §A2 (N) + §B1 — 6 cột mới: receiveDate, caseClassification, tinhTrang, toiDanhBanDau, reporterDateOfBirth, reporterDateOfBirthPrecision
- Catches_bug: Cột được tạo trong lược đồ nhưng chưa nối vào đường ghi/đọc → nhận dữ liệu rồi trả về rỗng

**Runner contract**:
- Coverage_ids: `COV-PROMO-N`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Sáu cột mới nhận và trả lại giá trị đầy đủ

### Các bước kiểm thử
- [ ] Tạo vụ gửi đồng thời giá trị cho cả 6 cột mới
- [ ] Đọc lại chi tiết vụ
- [ ] Đọc trực tiếp giá trị lưu trữ

### Kết quả mong đợi
- Cả 6 cột nhận đúng giá trị và trả về đúng trong dữ liệu chi tiết. Liệt kê kết quả từng cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-083

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V4`
- Oracle_source: PLAN §Verification 4 — 'test create/update integration API cho ≥1 field mỗi loại C/S/N/R'
- Catches_bug: Lớp kiểm tra hợp lệ loại bỏ trường im lặng → giao diện báo lưu thành công nhưng dữ liệu không tới nơi

**Runner contract**:
- Coverage_ids: `COV-API-01`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Hợp đồng API – trường loại C: gửi lên rồi đọc lại còn nguyên

### Các bước kiểm thử
- [ ] Tạo vụ với `noiXayRa` (loại C)
- [ ] Đọc lại chi tiết
- [ ] Sửa `noiXayRa` sang giá trị khác, đọc lại

### Kết quả mong đợi
- Cả hai lần đọc lại đều trả đúng giá trị vừa gửi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-084

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V4`
- Oracle_source: PLAN §Verification 4 + §A1 hàng 7 — ghi qua `payload.statistic.*`
- Catches_bug: Khối thống kê bị loại khỏi dữ liệu gửi lên → thiệt hại không bao giờ lưu được qua API

**Runner contract**:
- Coverage_ids: `COV-API-02`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Hợp đồng API – trường loại S (thống kê): gửi lên rồi đọc lại còn nguyên

### Các bước kiểm thử
- [ ] Tạo vụ kèm khối thống kê chứa số tiền thiệt hại và số bị hại
- [ ] Đọc lại chi tiết vụ
- [ ] Sửa và đọc lại

### Kết quả mong đợi
- Dữ liệu chi tiết trả về khối thống kê với đúng giá trị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-085

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V4`
- Oracle_source: PLAN §Verification 4 — cột mới phải qua được lớp kiểm tra hợp lệ
- Catches_bug: Cột mới chưa khai báo ở lớp hợp lệ → bị loại bỏ, tính năng coi như không tồn tại

**Runner contract**:
- Coverage_ids: `COV-API-03`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Hợp đồng API – trường loại N (cột mới): gửi lên rồi đọc lại còn nguyên

### Các bước kiểm thử
- [ ] Tạo vụ với `tinhTrang` và `toiDanhBanDau`
- [ ] Đọc lại
- [ ] Sửa cả hai, đọc lại

### Kết quả mong đợi
- Hai trường trả về đúng ở cả hai lần.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-089

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: AUTH-01/AUTH-05 — sửa một phần không được xoá phần khác của hồ sơ
- Catches_bug: Cập nhật gửi toàn bộ đối tượng: trường không nằm trong biểu bị ghi rỗng đè lên — đây là cách mất dữ liệu phổ biến nhất sau khi đổi biểu nhập

**Runner contract**:
- Coverage_ids: `COV-API-07`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Sửa một trường: các cột khác không bị xoá

### Các bước kiểm thử
- [ ] Chụp toàn bộ cột của một vụ giàu dữ liệu
- [ ] Gửi yêu cầu sửa CHỈ một trường
- [ ] Chụp lại toàn bộ cột và so sánh

### Kết quả mong đợi
- Chỉ trường được sửa thay đổi. Mọi cột khác giữ nguyên giá trị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-090

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — 'mergeCaseApiToFormData: đọc apiData.<col> (+ apiData.statistic.<col>)'
- Catches_bug: Máy chủ không trả cột → giao diện buộc phải quay về đọc dữ liệu phụ, phá vỡ nguyên tắc một nơi lưu

**Runner contract**:
- Coverage_ids: `COV-API-08`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Dữ liệu chi tiết trả về đủ cột chuẩn và khối thống kê để giao diện dùng

### Các bước kiểm thử
- [ ] Đọc chi tiết một vụ đã chuẩn hoá
- [ ] Kiểm tra có mặt các cột chuẩn của 8 cặp (mục A1) và 6 cột mới (mục N)
- [ ] Kiểm tra có khối thống kê kèm số tiền thiệt hại và số bị hại

### Kết quả mong đợi
- Dữ liệu trả về chứa đủ các cột trên và khối thống kê. Liệt kê trường nào thiếu (nếu có).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-091

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A1-05`
- Oracle_source: PLAN §A1 hàng 5 — 'KHÔNG gộp biHai — biHai=Bị hại (tên/đối tượng), không phải địa chỉ → corruption. biHai giữ riêng (cluster B)'
- Catches_bug: Gộp nhầm hai khái niệm khác nhau: tên bị hại bị nối vào chuỗi địa chỉ → hồ sơ ghi sai cả bị hại lẫn địa chỉ, không tách lại được

**Runner contract**:
- Coverage_ids: `COV-SEM-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Bị hại giữ ô riêng, không bị nối vào địa chỉ người tố cáo

### Các bước kiểm thử
- [ ] Mở vụ có giá trị ở trường Bị hại
- [ ] Xác định ô hiển thị giá trị đó và ô Địa chỉ người tố cáo
- [ ] Đọc lại hai cột tương ứng

### Kết quả mong đợi
- Bị hại nằm ở ô riêng với nhãn riêng; nội dung KHÔNG xuất hiện trong ô/cột địa chỉ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-092

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `SEMANTIC-SEPARATION`
- Oracle_source: PLAN §A1 hàng 5
- Catches_bug: Một trong hai trường ghi đè trường kia khi lưu

**Runner contract**:
- Coverage_ids: `COV-SEM-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nhập đồng thời bị hại và địa chỉ: hai giá trị độc lập, không lẫn nhau

### Các bước kiểm thử
- [ ] Nhập Bị hại = 'BIHAI-MARK-01', Địa chỉ = 'DIACHI-MARK-01'
- [ ] Lưu, tải lại
- [ ] Đọc hai cột

### Kết quả mong đợi
- Mỗi cột giữ đúng dấu nhận dạng của mình, không cột nào chứa dấu của cột kia.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-093

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R2`
- Oracle_source: PLAN §A3 R2 — 'giữ cột noiXayRa. KHÔNG merge vào specificAddress/criminalLocation (khác ngữ cảnh)'
- Catches_bug: Nơi xảy ra vụ việc bị thay bằng địa chỉ hành chính của người tố cáo hoặc địa điểm phạm tội → sai hiện trường trong hồ sơ

**Runner contract**:
- Coverage_ids: `COV-SEM-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nơi xảy ra không bị địa chỉ hành chính ghi đè

### Các bước kiểm thử
- [ ] Nhập Nơi xảy ra = 'NOIXAYRA-MARK', địa chỉ cụ thể (tỉnh/huyện/xã + số nhà) = 'DIACHIHC-MARK', địa điểm phạm tội = 'DIADIEMPT-MARK'
- [ ] Lưu, tải lại
- [ ] Đọc từng cột

### Kết quả mong đợi
- Ba giá trị tồn tại độc lập; `noiXayRa` giữ đúng 'NOIXAYRA-MARK'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-097

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R5`
- Oracle_source: PLAN §A3 R5 — 'giữ cột text (ghi chú nhanh). KHÔNG merge Subjects (thực thể có cấu trúc) — giữ cả hai'
- Catches_bug: Gộp ghi chú tự do vào danh sách đối tượng → mất ghi chú, hoặc sinh đối tượng giả từ một dòng ghi chú

**Runner contract**:
- Coverage_ids: `COV-SEM-07`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Ghi chú nghi vấn đối tượng và danh sách đối tượng có cấu trúc cùng tồn tại

### Các bước kiểm thử
- [ ] Mở vụ có ghi chú nghi vấn đối tượng
- [ ] Xác định ô ghi chú và khu danh sách đối tượng
- [ ] Đọc cột ghi chú

### Kết quả mong đợi
- Cả hai cùng tồn tại; ghi chú ở ô riêng, danh sách đối tượng ở khu riêng; không bên nào sinh ra từ bên kia.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-098

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PLAN-A3-R5`
- Oracle_source: PLAN §A3 R5 — giữ cả hai; AUTH-01 không mất nội dung hồ sơ
- Catches_bug: Thao tác thêm đối tượng dọn ô ghi chú vì cho là đã được thay thế

**Runner contract**:
- Coverage_ids: `COV-SEM-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Thêm đối tượng có cấu trúc: ghi chú nghi vấn không bị xoá

### Các bước kiểm thử
- [ ] Ghi lại nội dung ô nghi vấn đối tượng
- [ ] Thêm một đối tượng có cấu trúc, lưu
- [ ] Đọc lại ô nghi vấn và cột tương ứng

### Kết quả mong đợi
- Ghi chú giữ nguyên nội dung ban đầu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-099

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R6`
- Oracle_source: PLAN §A3 R6 — 'THÊM cột toiDanhBanDau... KHÔNG merge criminalSecondaryType'
- Catches_bug: Hai khái niệm tố tụng khác nhau dùng chung một ô → hồ sơ ghi sai tội danh khởi điểm

**Runner contract**:
- Coverage_ids: `COV-SEM-09`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tội danh ban đầu và tội danh phụ là hai ô khác nhau

### Các bước kiểm thử
- [ ] Trên form, xác định ô Tội danh ban đầu và ô tội danh phụ
- [ ] Kiểm tra chúng là hai ô riêng

### Kết quả mong đợi
- Hai ô riêng biệt, có nhãn phân biệt được, cùng nằm trong cụm tội danh.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-100

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R6`
- Oracle_source: PLAN §A3 R6 — cấm merge
- Catches_bug: Ghi tội danh ban đầu vào cùng cột với tội danh phụ → mất tội danh phụ

**Runner contract**:
- Coverage_ids: `COV-SEM-10`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Đặt tội danh ban đầu: tội danh phụ không thay đổi

### Các bước kiểm thử
- [ ] Chọn vụ đã có tội danh phụ, ghi lại giá trị
- [ ] Nhập Tội danh ban đầu = 'TDBD-MARK', lưu
- [ ] Đọc lại cả hai

### Kết quả mong đợi
- Tội danh phụ giữ nguyên; tội danh ban đầu = 'TDBD-MARK'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-101

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R7`
- Oracle_source: PLAN §A3 R7 — 'KHÔNG merge. handler=investigatorId FK (chính); dieuTraVien=tên tự do hệ cũ. Giữ cả 2'
- Catches_bug: Gộp hai trường → khi tên hệ cũ không khớp người dùng nào thì tên bị mất, hồ sơ không còn ai chịu trách nhiệm ghi nhận

**Runner contract**:
- Coverage_ids: `COV-SEM-11`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Cán bộ thụ lý (liên kết người dùng) và điều tra viên hệ cũ (tên tự do) cùng tồn tại

### Các bước kiểm thử
- [ ] Mở vụ có cả cán bộ thụ lý và tên điều tra viên hệ cũ
- [ ] Xác định hai ô riêng và nhãn của chúng

### Kết quả mong đợi
- Hai ô riêng: một ô chọn người dùng (phân công), một ô tham chiếu tên hệ cũ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-102

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PLAN-A3-R7`
- Oracle_source: PLAN §A3 R7 — 'Merge sẽ mất data khi không match user'; AUTH-01
- Catches_bug: Chuyển tên tự do sang liên kết người dùng: tên không khớp bị bỏ trắng — mất thông tin điều tra viên của hàng nghìn hồ sơ cũ

**Runner contract**:
- Coverage_ids: `COV-SEM-12`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Tên điều tra viên hệ cũ không khớp người dùng nào: vẫn hiển thị, không mất

### Các bước kiểm thử
- [ ] Chọn vụ có tên điều tra viên hệ cũ KHÔNG tương ứng tài khoản nào
- [ ] Mở form, tìm tên đó
- [ ] Lưu form (không sửa gì), đọc lại cột

### Kết quả mong đợi
- Tên vẫn hiển thị trước và sau khi lưu; cột `dieuTraVien` giữ nguyên chuỗi gốc.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-103

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R7`
- Oracle_source: PLAN §A3 R7 — giữ cả hai, độc lập
- Catches_bug: Gán người thụ lý mới ghi đè lên tên điều tra viên cũ → mất dấu vết ai từng thụ lý

**Runner contract**:
- Coverage_ids: `COV-SEM-13`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Gán cán bộ thụ lý: tên điều tra viên hệ cũ không bị ghi đè

### Các bước kiểm thử
- [ ] Ghi lại tên điều tra viên hệ cũ
- [ ] Gán cán bộ thụ lý là một tài khoản khác, lưu
- [ ] Đọc lại cả hai trường

### Kết quả mong đợi
- Tên hệ cũ giữ nguyên; cán bộ thụ lý là tài khoản mới gán.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-106

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 quy tắc DR-1 — COALESCE(metadata native, metadata cũ), chỉ khi cột NULL
- Catches_bug: Bỏ sót nhánh này → dữ liệu cũ không bao giờ lên cột, tính năng hợp nhất vô hiệu

**Runner contract**:
- Coverage_ids: `COV-BF-01`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – cột trống, dữ liệu cũ có giá trị native hợp lệ: ghi vào cột

### Các bước kiểm thử
- [ ] Dựng hồ sơ: cột trống, dữ liệu phụ có khoá native hợp lệ
- [ ] Chạy chuẩn hoá trên bản sao
- [ ] Đọc cột

### Kết quả mong đợi
- Cột nhận đúng giá trị của khoá native.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-107

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 quy tắc DR-2
- Catches_bug: Chỉ đọc khoá native → hồ sơ di trú thuần (chỉ có khoá cũ) bị bỏ qua hoàn toàn

**Runner contract**:
- Coverage_ids: `COV-BF-02`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – cột trống, chỉ có giá trị hệ cũ: ghi vào cột

### Các bước kiểm thử
- [ ] Dựng hồ sơ: cột trống, chỉ có khoá hệ cũ
- [ ] Chạy chuẩn hoá
- [ ] Đọc cột

### Kết quả mong đợi
- Cột nhận giá trị của khoá hệ cũ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-108

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §A1 — 'Backfill cột từ CẢ metadata (meta.<native> ưu tiên, else meta.<old>)'
- Catches_bug: Chọn sai thứ tự ưu tiên → giá trị người dùng nhập gần đây bị giá trị di trú cũ hơn đè lên

**Runner contract**:
- Coverage_ids: `COV-BF-03`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – có cả hai khoá khác giá trị: ưu tiên khoá native

### Các bước kiểm thử
- [ ] Dựng hồ sơ có khoá native = 'NATIVE-VAL' và khoá cũ = 'OLD-VAL', cột trống
- [ ] Chạy chuẩn hoá
- [ ] Đọc cột

### Kết quả mong đợi
- Cột = 'NATIVE-VAL'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-109

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-FABRICATION`
- Oracle_source: PLAN §B3 — 'Giá trị không parse được → bảng reject, null cột, log anh xem — không bịa'; AUTH-06
- Catches_bug: Ép kiểu thất bại trả về giá trị mặc định (0, ngày epoch, chuỗi rỗng) và ghi vào hồ sơ như dữ liệu thật

**Runner contract**:
- Coverage_ids: `COV-BF-04`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – giá trị không phân tích được: cột để trống và ghi vào danh sách từ chối

### Các bước kiểm thử
- [ ] Dựng hồ sơ có giá trị rác ở trường số và trường ngày
- [ ] Chạy chuẩn hoá
- [ ] Đọc cột và danh sách từ chối

### Kết quả mong đợi
- Cột vẫn trống; mỗi giá trị rác có một dòng trong danh sách từ chối kèm nguyên văn. Không giá trị mặc định nào được ghi vào cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-111

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-SILENT-OVERWRITE`
- Oracle_source: PLAN §B3 — 'Conflict (cột đã có giá trị KHÁC metadata) → không đè, ghi migration_conflict. Anh review'; AUTH-06
- Catches_bug: Chuẩn hoá ghi đè giá trị cán bộ vừa nhập bằng giá trị di trú cũ → mất công sức nhập liệu và sai nội dung hồ sơ, không có dấu vết

**Runner contract**:
- Coverage_ids: `COV-BF-06`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – cột đã có giá trị KHÁC dữ liệu cũ: KHÔNG ghi đè, ghi vào danh sách xung đột

### Các bước kiểm thử
- [ ] Dựng hồ sơ có cột = 'GIATRI-MOI' và dữ liệu cũ = 'GIATRI-CU'
- [ ] Chạy chuẩn hoá
- [ ] Đọc cột và danh sách xung đột

### Kết quả mong đợi
- Cột VẪN là 'GIATRI-MOI'; có đúng một dòng xung đột ghi cả hai giá trị cùng mã hồ sơ và tên trường.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-114

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §Verification 7 — 'SQL idempotent'; PLAN §B2 idempotent
- Catches_bug: Chạy lại làm hỏng dữ liệu (cộng dồn, tạo trùng bản ghi thống kê, xoá cột) → thảm hoạ khi vận hành chạy lại vì tưởng lần đầu lỗi

**Runner contract**:
- Coverage_ids: `COV-BF-09`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chạy chuẩn hoá lần thứ hai: kết quả không đổi

### Các bước kiểm thử
- [ ] Chụp toàn bộ số liệu sau lần chuẩn hoá thứ nhất (số hồ sơ mỗi cột, số dòng xung đột, số dòng từ chối, số bản ghi thống kê)
- [ ] Chạy chuẩn hoá lần hai trên cùng dữ liệu
- [ ] Chụp lại và so sánh

### Kết quả mong đợi
- Mọi con số giống hệt lần một. Không phát sinh bản ghi thống kê trùng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-115

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PLAN-V2`
- Oracle_source: PLAN §Verification 2 — '#rows có cột non-null sau ≥ #rows có (metadata native ∪ old) non-null trước − #conflict − #reject'
- Catches_bug: Một phần hồ sơ rơi khỏi mẻ chuẩn hoá (điều kiện lọc sai, phân trang thiếu) mà không ai phát hiện vì tổng giá trị vẫn 'trông hợp lý'

**Runner contract**:
- Coverage_ids: `COV-BF-10`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Không mất dữ liệu: độ phủ theo SỐ HỒ SƠ cho từng cột đạt yêu cầu

### Các bước kiểm thử
- [ ] Với MỖI cột trong phạm vi: đếm số hồ sơ có nguồn (khoá native hoặc khoá cũ) khác rỗng
- [ ] Đếm số hồ sơ có cột khác rỗng sau chuẩn hoá
- [ ] Đếm số dòng xung đột và số dòng từ chối của cột đó
- [ ] Kiểm bất đẳng thức cho từng cột

### Kết quả mong đợi
- Với mọi cột: (số sau) ≥ (số nguồn) − (xung đột) − (từ chối). Báo cáo dạng bảng từng cột, KHÔNG được gộp thành một con số tổng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-116

**Meta**:
- Loại: `AUDIT`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — 'ghi migration_conflict (case_id, field, col_value, meta_value). Anh review'
- Catches_bug: Xung đột được ghi nhận nhưng thiếu giá trị đối chiếu → không ai quyết được giá trị nào đúng, dữ liệu treo vĩnh viễn

**Runner contract**:
- Coverage_ids: `COV-BF-11`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Danh sách xung đột đọc được và đủ thông tin để rà soát

### Các bước kiểm thử
- [ ] Mở danh sách xung đột
- [ ] Kiểm mỗi dòng có: mã hồ sơ, tên trường, giá trị ở cột, giá trị ở dữ liệu cũ
- [ ] Chọn ngẫu nhiên 3 dòng, mở hồ sơ tương ứng đối chiếu

### Kết quả mong đợi
- Mỗi dòng đủ 4 thông tin và trỏ đúng hồ sơ có thật.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-117

**Meta**:
- Loại: `AUDIT`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — bảng reject + log
- Catches_bug: Bản ghi bị từ chối im lặng → dữ liệu không lên cột và không ai biết để xử lý tay

**Runner contract**:
- Coverage_ids: `COV-BF-12`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Danh sách từ chối đọc được và giải thích được lý do

### Các bước kiểm thử
- [ ] Mở danh sách từ chối
- [ ] Với mỗi dòng, xác định mã hồ sơ, tên trường, giá trị gốc và lý do
- [ ] Kiểm lý do có tự giải thích được không

### Kết quả mong đợi
- Mỗi dòng cho biết vì sao giá trị không dùng được (đa giá trị, không phải số, ngày không tồn tại...) và giá trị gốc còn nguyên để xử lý tay.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-118

**Meta**:
- Loại: `AUDIT`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `CL-2`
- Oracle_source: Ghi nhận thực thi của epic: '1866 vụ, 0 conflict, 20 reject' — con số này là TUYÊN BỐ, phải kiểm chứng độc lập
- Catches_bug: Báo cáo thực thi không khớp trạng thái thật (chạy thiếu, chạy trên tập con, đếm sai) → quyết định nghiệm thu dựa trên số liệu sai

**Runner contract**:
- Coverage_ids: `COV-BF-13`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Đối chiếu tuyên bố của kế hoạch với thực tế: số hồ sơ chuẩn hoá, số xung đột, số từ chối

### Các bước kiểm thử
- [ ] Đếm số hồ sơ đã được chuẩn hoá
- [ ] Đếm số dòng xung đột và số dòng từ chối
- [ ] So với con số đã công bố

### Kết quả mong đợi
- Ba con số khớp với công bố, hoặc chênh lệch được giải thích được (vd có hồ sơ mới phát sinh sau đợt chạy). Chênh lệch không giải thích được = FAIL.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-119

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — 'INSERT INTO case_statistics … ON CONFLICT (case_id) DO UPDATE (tạo row nếu thiếu)'
- Catches_bug: Chỉ cập nhật → hồ sơ chưa có bản ghi thống kê mất luôn số thiệt hại; hoặc chỉ chèn → sinh bản ghi trùng

**Runner contract**:
- Coverage_ids: `COV-BF-14`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá thiệt hại/bị hại: tạo bản ghi thống kê khi thiếu, cập nhật khi đã có

### Các bước kiểm thử
- [ ] Dựng hai hồ sơ: một chưa có bản ghi thống kê, một đã có; cả hai có thiệt hại trong dữ liệu cũ
- [ ] Chạy chuẩn hoá
- [ ] Đếm bản ghi thống kê và đọc giá trị của từng hồ sơ

### Kết quả mong đợi
- Hồ sơ thứ nhất: có bản ghi mới với đúng giá trị. Hồ sơ thứ hai: vẫn đúng một bản ghi, giá trị được xử lý theo quy tắc chỉ-khi-rỗng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-120

**Meta**:
- Loại: `AUDIT`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `TRACE-PRESERVED`
- Oracle_source: PLAN §B6 — 'KHÔNG xóa metadata cũ trong DB (lưới an toàn tham chiếu)'; §Verification 2 — 'metadata+cột+legacyRaw còn trong DB'; AUTH-01
- Catches_bug: Dọn dẹp quá tay xoá bản gốc → không còn đối chiếu được khi phát hiện chuẩn hoá sai, mất khả năng khôi phục

**Runner contract**:
- Coverage_ids: `COV-BF-15`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Sau chuẩn hoá, dữ liệu gốc hệ cũ vẫn còn trong hệ thống

### Các bước kiểm thử
- [ ] Chọn hồ sơ đã chuẩn hoá
- [ ] Kiểm tra khối dữ liệu phụ còn giữ giá trị gốc
- [ ] Kiểm tra bản ghi gốc hệ cũ còn truy cập được

### Kết quả mong đợi
- Cả ba lớp cùng tồn tại: cột chuẩn, dữ liệu phụ gốc, bản ghi gốc hệ cũ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-121

**Meta**:
- Loại: `RECOVERY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — 'pg_dump backup trước'; §Verification 7
- Catches_bug: Chạy chuẩn hoá trên dữ liệu thật không có đường lùi → sai một bước là mất hồ sơ pháp lý vĩnh viễn

**Runner contract**:
- Coverage_ids: `COV-BF-16`
- Backend_policy: `live`
- Evidence_required: `console-log`

**Tiêu đề**: Có bản sao lưu trước khi chạy chuẩn hoá

### Các bước kiểm thử
- [ ] Xác định tệp sao lưu được tạo trước đợt chuẩn hoá
- [ ] Kiểm tra thời điểm tạo sớm hơn thời điểm chạy
- [ ] Kiểm tra kích thước hợp lý và tệp đọc được

### Kết quả mong đợi
- Tồn tại bản sao lưu trước thời điểm chạy, còn truy cập được.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-122

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-FABRICATION`
- Oracle_source: PLAN §B3 — giá trị đa-giá-trị/rác 'giữ metadata'; AUTH-01 không mất nội dung
- Catches_bug: Từ chối rồi xoá luôn nguồn → dữ liệu biến mất khỏi cả cột lẫn bản gốc, không ai sửa tay được nữa

**Runner contract**:
- Coverage_ids: `COV-BF-17`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Bản ghi bị từ chối vẫn giữ giá trị gốc để xử lý tay

### Các bước kiểm thử
- [ ] Lấy danh sách hồ sơ bị từ chối
- [ ] Mở từng hồ sơ trên giao diện
- [ ] Tìm giá trị gốc trong bảng dữ liệu gốc

### Kết quả mong đợi
- Với mọi hồ sơ bị từ chối, giá trị gốc vẫn xem được trên giao diện để cán bộ nhập tay.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-123

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `TRACE-PRESERVED`
- Oracle_source: PLAN §Verification 5 — 'LegacyRawPanel hiện bản gốc'; §B6 giữ nguyên; AUTH-01
- Catches_bug: Đợt gộp làm hỏng bảng gốc → mất đối chiếu với hồ sơ giấy

**Runner contract**:
- Coverage_ids: `COV-TRC-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Bảng dữ liệu gốc hệ cũ hiển thị đầy đủ bản gốc của hồ sơ

### Các bước kiểm thử
- [ ] Mở chi tiết một hồ sơ di trú
- [ ] Mở bảng dữ liệu gốc hệ cũ
- [ ] Đối chiếu số trường hiển thị với dữ liệu gốc lưu trong hệ thống

### Kết quả mong đợi
- Bảng hiển thị đầy đủ trường gốc, không rỗng, không cắt bớt.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-124

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-C-G`
- Oracle_source: PLAN §C cluster G — 'sttCu/soHoSoCu + LegacyRawPanel cuối'
- Catches_bug: Mất định danh hệ cũ → không tra được hồ sơ giấy tương ứng

**Runner contract**:
- Coverage_ids: `COV-TRC-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Số thứ tự và số hồ sơ hệ cũ hiển thị trên màn hình chi tiết

### Các bước kiểm thử
- [ ] Mở chi tiết hồ sơ di trú
- [ ] Tìm số thứ tự và số hồ sơ hệ cũ

### Kết quả mong đợi
- Cả hai hiển thị, khớp giá trị lưu trong cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-125

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B6`
- Oracle_source: PLAN §B6 — 'LegacyRawPanel giữ nguyên'; không xoá metadata cũ
- Catches_bug: Lọc trường đã thăng khỏi bảng gốc làm bảng gốc mất luôn giá trị đối chiếu

**Runner contract**:
- Coverage_ids: `COV-TRC-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Sau khi thăng trường lên form chính, bảng gốc không bị rỗng đi

### Các bước kiểm thử
- [ ] Chọn hồ sơ có trường đã thăng (vd tenCungCap) với giá trị gốc
- [ ] Mở bảng dữ liệu gốc
- [ ] Tìm giá trị gốc của trường đó

### Kết quả mong đợi
- Giá trị gốc vẫn xem được trong bảng gốc dù trường đã lên form chính.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-127

**Meta**:
- Loại: `UX`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `ONE-FIELD-ONE-BOX`
- Oracle_source: PLAN §B4 — gỡ khỏi parityState, tránh 2 nguồn ghi 1 cột
- Catches_bug: Hai ô cùng ghi một cột: thứ tự ghi quyết định giá trị cuối, kết quả không đoán trước được

**Runner contract**:
- Coverage_ids: `COV-TRC-05`, `COV-UP-09`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Trường đã thăng không xuất hiện lần hai như ô nhập ở khu bổ sung

### Các bước kiểm thử
- [ ] Mở form sửa
- [ ] Liệt kê mọi ô NHẬP ĐƯỢC ở khu bổ sung/parity
- [ ] Giao với danh sách 30 khái niệm đã thăng (8 cặp + 22 trường)

### Kết quả mong đợi
- Giao rỗng. Nếu không rỗng, liệt kê tên trường trùng và chỉ rõ ô nào ghi thắng khi hai ô khác giá trị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-129

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `TRACE-PRESERVED`
- Oracle_source: PLAN §B6 — bản gốc là lưới an toàn tham chiếu; AUTH-01 truy nguyên
- Catches_bug: Bản gốc bị ghi đè theo giá trị mới → mất khả năng chứng minh dữ liệu ban đầu là gì, hỏng chức năng truy nguyên

**Runner contract**:
- Coverage_ids: `COV-TRC-07`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Sửa trường trên form chính: bản gốc trong bảng dữ liệu gốc KHÔNG đổi theo

### Các bước kiểm thử
- [ ] Ghi lại giá trị gốc của một trường trong bảng dữ liệu gốc
- [ ] Sửa trường đó trên form chính sang giá trị mới, lưu
- [ ] Mở lại bảng dữ liệu gốc

### Kết quả mong đợi
- Bảng gốc vẫn hiện giá trị BAN ĐẦU, không đổi theo giá trị mới.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-130

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `TRACE-PRESERVED`
- Oracle_source: PLAN §Verification 2 + 5 — ba lớp cùng tồn tại và nhất quán
- Catches_bug: Ba lớp phân kỳ mà không lớp nào báo lỗi — dạng hỏng thầm lặng nguy hiểm nhất của đợt di trú

**Runner contract**:
- Coverage_ids: `COV-TRC-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Gherkin**:
```gherkin
Given một hồ sơ đã di trú và đã chuẩn hoá
When điều tra viên mở chi tiết và bảng dữ liệu gốc
Then giá trị trên ô nhập, trong cột chuẩn và trong bản gốc là nhất quán hoặc chênh lệch được giải thích
```

**Tiêu đề**: E2E: đối chiếu hồ sơ di trú — bản gốc, cột chuẩn và ô trên màn hình khớp nhau

### Các bước kiểm thử
- [ ] Chọn 3 hồ sơ di trú ngẫu nhiên
- [ ] Với mỗi hồ sơ, lấy 5 trường thuộc phạm vi và ghi giá trị ở ba nơi
- [ ] Lập bảng đối chiếu

### Kết quả mong đợi
- Với mọi trường: ô = cột. Nếu cột ≠ bản gốc thì phải có dòng xung đột tương ứng hoặc lý do (đã sửa tay sau di trú). Chênh lệch không giải thích được = FAIL.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-130
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-139

**Meta**:
- Loại: `UX`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `ONE-FIELD-ONE-BOX`
- Oracle_source: PLAN mục tiêu cuối — 'mỗi khái niệm = 1 ô form'; §A1 bảng 8 cặp
- Catches_bug: Còn sót ô song trùng — chính vấn đề mà cả epic sinh ra để giải quyết

**Runner contract**:
- Coverage_ids: `COV-UI-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Quét toàn form: không còn cặp ô trùng nghĩa nào trong 8 cặp đã gộp

### Các bước kiểm thử
- [ ] Mở form, duyệt HẾT các tab
- [ ] Với từng khái niệm trong 8 cặp: người tố cáo, số CCCD, ngày sinh, số điện thoại, địa chỉ, tóm tắt nội dung, số tiền thiệt hại, số bị hại — đếm số ô nhập được
- [ ] Lập bảng: khái niệm | số ô | vị trí

### Kết quả mong đợi
- Mỗi khái niệm đúng 1 ô. Bảng phải liệt kê đủ 8 dòng — không được ghi 'các cặp còn lại tương tự'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-139
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-142

**Meta**:
- Loại: `UX`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `AUTH-08`
- Oracle_source: Nielsen #1 visibility of system status; ISO 9241-11 effectiveness
- Catches_bug: Lưu thất bại im lặng — người dùng tưởng đã lưu, dữ liệu hồ sơ mất

**Runner contract**:
- Coverage_ids: `COV-UI-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Lưu thành công và lưu thất bại đều có phản hồi rõ ràng

### Các bước kiểm thử
- [ ] Lưu hợp lệ, quan sát phản hồi
- [ ] Lưu với dữ liệu vi phạm (vd thiệt hại âm), quan sát phản hồi

### Kết quả mong đợi
- Trường hợp 1 có xác nhận thành công; trường hợp 2 có thông báo lỗi nêu rõ vấn đề. Không trường hợp nào im lặng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-142
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-147

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — 'cases.service search: query cột (giữ fallback metadata)'
- Catches_bug: Chuyển sang cột nhưng quên nối vào tìm kiếm → giá trị lưu đúng mà không tra ra

**Runner contract**:
- Coverage_ids: `COV-SRCH-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tìm hồ sơ theo tên người tố cáo

### Các bước kiểm thử
- [ ] Tạo/chọn hồ sơ có tên người tố cáo nhận dạng được
- [ ] Tìm theo tên đó

### Kết quả mong đợi
- Hồ sơ xuất hiện trong kết quả.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-147
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-148

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — thêm index cho cột hay lọc (reporter name, cccd, sttCu, noiXayRa)
- Catches_bug: Tra cứu theo định danh không hoạt động → không xác minh được người tố cáo trùng lặp

**Runner contract**:
- Coverage_ids: `COV-SRCH-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tìm hồ sơ theo số CCCD

### Các bước kiểm thử
- [ ] Tìm theo số CCCD đã nhập ở hồ sơ thử

### Kết quả mong đợi
- Hồ sơ xuất hiện trong kết quả.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-148
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-149

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 search theo cột đã thăng; yêu cầu truy nguyên hệ cũ
- Catches_bug: Không tra được theo số cũ → cán bộ cầm hồ sơ giấy không tìm ra bản điện tử

**Runner contract**:
- Coverage_ids: `COV-SRCH-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tìm hồ sơ theo số thứ tự hoặc số hồ sơ hệ cũ

### Các bước kiểm thử
- [ ] Lấy số hồ sơ hệ cũ của một vụ di trú
- [ ] Tìm theo số đó

### Kết quả mong đợi
- Đúng vụ đó xuất hiện trong kết quả.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-149
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-151

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — 'giữ fallback metadata cho vụ chưa backfill'
- Catches_bug: Chuyển tìm kiếm sang cột mà bỏ dự phòng → toàn bộ hồ sơ chưa chuẩn hoá biến mất khỏi kết quả tra cứu, dạng mất dữ liệu nhìn từ phía người dùng

**Runner contract**:
- Coverage_ids: `COV-SRCH-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Hồ sơ chưa chuẩn hoá vẫn tìm thấy nhờ cơ chế dự phòng

### Các bước kiểm thử
- [ ] Chọn hồ sơ có cột rỗng, giá trị chỉ nằm ở dữ liệu cũ
- [ ] Tìm theo giá trị đó

### Kết quả mong đợi
- Hồ sơ vẫn xuất hiện trong kết quả.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-151
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-153

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-04`
- Oracle_source: OWASP A03 Injection; NĐ 13/2023 bảo vệ dữ liệu cá nhân
- Catches_bug: Ghép chuỗi truy vấn khi thêm điều kiện tìm theo cột mới → lộ hoặc phá dữ liệu hồ sơ

**Runner contract**:
- Coverage_ids: `COV-SRCH-07`, `COV-SEC-06`
- Backend_policy: `live`
- Evidence_required: `api-response`, `screenshot-final`

**Tiêu đề**: Từ khoá chứa ký tự đặc biệt và dấu tiếng Việt: an toàn, không lộ lỗi hệ thống

### Các bước kiểm thử
- [ ] Tìm với chuỗi chứa dấu nháy đơn, ký tự phần trăm, dấu chấm phẩy và mệnh đề luôn đúng
- [ ] Tìm với chuỗi có thẻ kịch bản
- [ ] Quan sát phản hồi và tình trạng dữ liệu

### Kết quả mong đợi
- Không lỗi máy chủ, không lộ dấu vết nội bộ, dữ liệu không bị thay đổi, chuỗi không được thực thi khi hiển thị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-153
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-155

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `SCOPE-ENFORCED`
- Oracle_source: NĐ 13/2023 bảo vệ dữ liệu cá nhân; OWASP A01 Broken Access Control
- Catches_bug: Thêm cột mới vào dữ liệu trả về mà bỏ qua kiểm tra phạm vi → lộ dữ liệu cá nhân của hồ sơ đơn vị khác

**Runner contract**:
- Coverage_ids: `COV-SEC-01`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Người dùng ngoài phạm vi không đọc được hồ sơ qua đường dẫn trực tiếp

### Các bước kiểm thử
- [ ] Đăng nhập tài khoản chỉ có phạm vi tổ A
- [ ] Gọi chi tiết một hồ sơ thuộc tổ B bằng mã trực tiếp

### Kết quả mong đợi
- Bị từ chối; không trả bất kỳ trường dữ liệu nào của hồ sơ đó.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-155
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-156

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `SCOPE-ENFORCED`
- Oracle_source: NĐ 13/2023; nguyên tắc phạm vi dữ liệu theo tổ/điều tra viên của hệ thống
- Catches_bug: Điều kiện tìm theo cột mới được thêm ngoài bộ lọc phạm vi → tra tên là ra hồ sơ đơn vị khác

**Runner contract**:
- Coverage_ids: `COV-SEC-02`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Tìm kiếm không trả hồ sơ ngoài phạm vi dữ liệu

### Các bước kiểm thử
- [ ] Đặt giá trị nhận dạng được vào hồ sơ của tổ B
- [ ] Đăng nhập tài khoản phạm vi tổ A
- [ ] Tìm theo giá trị đó qua từng tiêu chí mới (tên, CCCD, số hệ cũ, nơi xảy ra)

### Kết quả mong đợi
- Không tiêu chí nào trả về hồ sơ tổ B.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-156
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-157

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-04`
- Oracle_source: NĐ 13/2023 — ngày sinh, CCCD, SĐT, địa chỉ là dữ liệu cá nhân
- Catches_bug: Cột mới (ngày sinh) được thêm vào mọi dữ liệu trả về, kể cả các đường dẫn thống kê/xuất dữ liệu vốn không cần dữ liệu cá nhân

**Runner contract**:
- Coverage_ids: `COV-SEC-03`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Trường dữ liệu cá nhân mới không lộ cho vai trò không được phép

### Các bước kiểm thử
- [ ] Gọi các đường dẫn thống kê/tổng hợp/xuất dữ liệu
- [ ] Kiểm tra có xuất hiện ngày sinh, CCCD, SĐT, địa chỉ của người tố cáo không

### Kết quả mong đợi
- Đường dẫn tổng hợp không kèm dữ liệu cá nhân không cần thiết. Liệt kê đường dẫn nào có.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-157
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-158

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-04`
- Oracle_source: OWASP A07; NĐ 13/2023
- Catches_bug: Đường dẫn mới quên gắn bảo vệ xác thực

**Runner contract**:
- Coverage_ids: `COV-SEC-04`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Không có phiên đăng nhập hợp lệ: bị từ chối, không rò dữ liệu

### Các bước kiểm thử
- [ ] Gọi chi tiết hồ sơ, danh sách, thống kê mà không kèm phiên hợp lệ
- [ ] Gọi lại với phiên đã hết hạn

### Kết quả mong đợi
- Cả hai bị từ chối; phản hồi không chứa dữ liệu hồ sơ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-158
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-159

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `SCOPE-ENFORCED`
- Oracle_source: OWASP A01; nguyên tắc phân quyền của hệ thống
- Catches_bug: Đường ghi cột mới bỏ qua kiểm tra quyền → ai đọc được cũng sửa được hồ sơ tố tụng

**Runner contract**:
- Coverage_ids: `COV-SEC-05`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Vai trò chỉ đọc không sửa được cột chuẩn

### Các bước kiểm thử
- [ ] Đăng nhập vai chỉ đọc
- [ ] Thử sửa một cột chuẩn và một trường thống kê

### Kết quả mong đợi
- Bị từ chối; giá trị không đổi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-159
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-160

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-04`
- Oracle_source: OWASP A03 Injection / XSS
- Catches_bug: Ô mới hiển thị nội dung thô → chiếm phiên của cán bộ khác khi họ mở hồ sơ

**Runner contract**:
- Coverage_ids: `COV-SEC-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nội dung tấn công nhập vào ô văn bản mới: lưu an toàn, không thực thi khi hiển thị

### Các bước kiểm thử
- [ ] Nhập chuỗi chứa thẻ kịch bản và chuỗi chứa mệnh đề truy vấn vào các ô văn bản mới (tình trạng, tội danh ban đầu, nơi xảy ra)
- [ ] Lưu, mở lại hồ sơ ở một phiên khác

### Kết quả mong đợi
- Chuỗi hiển thị nguyên văn như văn bản, không được thực thi; dữ liệu khác không bị ảnh hưởng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-160
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-162

**Meta**:
- Loại: `AUDIT`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `quan-tri`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-01`
- Oracle_source: BLTTHS 2015 — mọi thay đổi trong hồ sơ phải truy nguyên được; AUTH-05 traceability
- Catches_bug: Ghi vào cột thay vì dữ liệu phụ khiến lớp ghi nhật ký không bắt được thay đổi → sửa hồ sơ tố tụng mà không để lại dấu vết

**Runner contract**:
- Coverage_ids: `COV-SEC-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Nhật ký thay đổi vẫn ghi nhận đúng sau khi đổi nơi lưu dữ liệu

### Các bước kiểm thử
- [ ] Sửa một trường đã chuyển lên cột, lưu
- [ ] Mở nhật ký hoạt động/hành trình hồ sơ
- [ ] Kiểm có bản ghi thay đổi kèm người thực hiện và thời điểm

### Kết quả mong đợi
- Thay đổi được ghi nhận với người thực hiện, thời điểm và trường bị sửa.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-162
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-163

**Meta**:
- Loại: `UX`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A4-01`
- Oracle_source: PLAN §A4 — 'Chạy A0 riêng cho từng schema... Đa số THĂNG + sắp xếp'; mục tiêu 1 ô/khái niệm áp cho cả 3 form
- Catches_bug: Đơn thư bị bỏ lại phía sau: vẫn 2 ô trùng trong khi Vụ án đã gộp — người nhập phải nhớ quy tắc khác nhau giữa hai màn hình

**Runner contract**:
- Coverage_ids: `COV-PET-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Form Đơn thư: mỗi khái niệm chỉ một ô, không còn cặp trùng nghĩa

### Các bước kiểm thử
- [ ] Mở form tạo Đơn thư, duyệt hết các tab
- [ ] Liệt kê các khái niệm có nhiều hơn một ô nhập
- [ ] Lập bảng khái niệm | số ô | vị trí

### Kết quả mong đợi
- Không khái niệm nào có quá một ô. Nếu có, liệt kê đủ tên.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-163
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-164

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-04`
- Oracle_source: PLAN §A4 — 'Petition/Incident: person fields vốn là cột native (senderName/benVu…)'
- Catches_bug: Đợt hợp nhất chạm nhầm sang Đơn thư và làm hỏng đường ghi vốn đang đúng

**Runner contract**:
- Coverage_ids: `COV-PET-02`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Trường thông tin người gửi đơn lưu và đọc lại đúng

### Các bước kiểm thử
- [ ] Tạo Đơn thư với đầy đủ thông tin người gửi (họ tên, CCCD, SĐT, địa chỉ)
- [ ] Đọc lại chi tiết

### Kết quả mong đợi
- Mọi trường trả về đúng giá trị đã nhập.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-164
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-166

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-02`
- Oracle_source: PLAN §A4 — 'Cặp GỘP cần soát: Đơn thư toiDanhBanDau vs crimeChinhId'
- Catches_bug: Gộp hai trường có bản chất khác nhau (chữ tự do và tham chiếu danh mục) → hoặc mất chữ tự do, hoặc phá liên kết danh mục tội danh

**Runner contract**:
- Coverage_ids: `COV-PET-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Đơn thư: tội danh ban đầu và tội danh chính là hai trường độc lập

### Các bước kiểm thử
- [ ] Đặt tội danh chính bằng cách chọn từ danh mục
- [ ] Nhập tội danh ban đầu bằng chữ tự do 'TDBD-DT-MARK'
- [ ] Lưu, đọc lại cả hai

### Kết quả mong đợi
- Hai giá trị cùng tồn tại độc lập; chọn danh mục không xoá chữ tự do và ngược lại.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-166
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-167

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-01`
- Oracle_source: PLAN §A4 — milestone riêng, service/DTO/backfill đầy đủ
- Catches_bug: Đường tạo mới của Đơn thư thiếu ánh xạ giống lỗi đã gặp ở Vụ án

**Runner contract**:
- Coverage_ids: `COV-PET-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Tạo Đơn thư mới: đọc lại đủ mọi trường vừa nhập

### Các bước kiểm thử
- [ ] Tạo Đơn thư điền đủ các cụm trên form
- [ ] Lưu, mở lại chi tiết
- [ ] Đối chiếu từng ô

### Kết quả mong đợi
- Mọi trường đã nhập đều hiện lại đúng sau lần lưu đầu tiên.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-167
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-168

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: PLAN §A4-04; AUTH-01
- Catches_bug: Lưu Đơn thư ghi rỗng đè lên trường không nằm trong biểu nhập

**Runner contract**:
- Coverage_ids: `COV-PET-06`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Sửa Đơn thư đã di trú: không mất trường hệ cũ

### Các bước kiểm thử
- [ ] Chụp toàn bộ dữ liệu của một Đơn thư di trú
- [ ] Sửa một trường, lưu
- [ ] Chụp lại và so từng trường

### Kết quả mong đợi
- Chỉ trường được sửa thay đổi; không trường nào biến mất.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-168
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-172

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A4-01`
- Oracle_source: PLAN §A4 milestone Đơn thư; mục tiêu 1 ô/khái niệm
- Catches_bug: Chuỗi tiếp nhận đơn đứt ở một mắt xích sau khi đổi biểu nhập

**Runner contract**:
- Coverage_ids: `COV-PET-10`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`

**Gherkin**:
```gherkin
Given cán bộ tiếp nhận đăng nhập
When tiếp nhận một đơn thư đầy đủ thông tin người gửi và nội dung
Then đơn được lưu và mở lại hiển thị đúng toàn bộ thông tin
```

**Tiêu đề**: E2E: tiếp nhận trọn một Đơn thư qua giao diện và mở lại kiểm chứng

### Các bước kiểm thử
- [ ] Đăng nhập
- [ ] Tạo Đơn thư đầy đủ
- [ ] Lưu, tải lại, mở lại chi tiết
- [ ] Đối chiếu

### Kết quả mong đợi
- Toàn bộ thông tin bền vững qua tải lại.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-172
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-173

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-03`
- Oracle_source: PLAN §A4 — 'Fix bug kèm: IncidentFormPage getPhaseForStatus(status)→d.status'
- Catches_bug: Dùng biến trạng thái còn rỗng lúc dựng màn hình → luôn mở nhầm phần đầu tiên bất kể hồ sơ đang ở giai đoạn nào

**Runner contract**:
- Coverage_ids: `COV-INC-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Mở vụ việc đang ở giai đoạn Tiếp nhận: đúng phần giai đoạn đó tự mở

### Các bước kiểm thử
- [ ] Mở vụ việc có trạng thái thuộc giai đoạn Tiếp nhận
- [ ] Quan sát phần nào đang mở sẵn

### Kết quả mong đợi
- Phần Tiếp nhận mở sẵn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-173
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-174

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-03`
- Oracle_source: PLAN §A4-03
- Catches_bug: Cán bộ phải tự mở đúng phần mỗi lần vào hồ sơ; dễ nhập nhầm vào phần giai đoạn khác

**Runner contract**:
- Coverage_ids: `COV-INC-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Mở vụ việc đang ở giai đoạn Xác minh: đúng phần giai đoạn đó tự mở

### Các bước kiểm thử
- [ ] Mở vụ việc có trạng thái thuộc giai đoạn Xác minh
- [ ] Quan sát phần mở sẵn

### Kết quả mong đợi
- Phần Xác minh mở sẵn, không phải phần Tiếp nhận.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-174
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-175

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-03`
- Oracle_source: PLAN §A4-03
- Catches_bug: Như trên, ở giai đoạn cuối

**Runner contract**:
- Coverage_ids: `COV-INC-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Mở vụ việc đang ở giai đoạn Kết quả: đúng phần giai đoạn đó tự mở

### Các bước kiểm thử
- [ ] Mở vụ việc có trạng thái thuộc giai đoạn Kết quả
- [ ] Quan sát phần mở sẵn

### Kết quả mong đợi
- Phần Kết quả mở sẵn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-175
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-178

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A4-03`
- Oracle_source: PLAN §A4-03 — sửa lỗi phải an toàn cho cả chế độ tạo mới
- Catches_bug: Sửa lỗi bằng cách đọc trạng thái của bản ghi vừa tải: ở chế độ tạo mới chưa có bản ghi nào, gây lỗi truy cập giá trị rỗng

**Runner contract**:
- Coverage_ids: `COV-INC-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `console-log`

**Tiêu đề**: Tạo vụ việc mới: không lỗi do chưa có trạng thái

### Các bước kiểm thử
- [ ] Mở form tạo vụ việc mới
- [ ] Quan sát màn hình và bảng điều khiển lỗi

### Kết quả mong đợi
- Form mở bình thường, không lỗi trên bảng điều khiển.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-178
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-180

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-03`
- Oracle_source: PLAN §A4-03 + §Verification 6 — 'bug IncidentFormPage hết'
- Catches_bug: Sửa lỗi chỉ đúng lúc tải trang nhưng hỏng sau khi lưu (phần lại đóng/mở nhầm)

**Runner contract**:
- Coverage_ids: `COV-INC-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`

**Gherkin**:
```gherkin
Given một vụ việc đang ở giai đoạn xác minh
When điều tra viên mở hồ sơ, nhập kết quả xác minh và lưu
Then phần giai đoạn xác minh mở sẵn từ đầu và dữ liệu lưu đúng
```

**Tiêu đề**: E2E: mở vụ việc đang xác minh, sửa và lưu trong đúng phần giai đoạn

### Các bước kiểm thử
- [ ] Mở vụ việc đang xác minh
- [ ] Xác nhận phần Xác minh mở sẵn
- [ ] Nhập một trường trong phần đó, lưu
- [ ] Tải lại và kiểm tra lại cả hai điều trên

### Kết quả mong đợi
- Phần đúng mở sẵn ở cả hai lần; dữ liệu lưu bền vững.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-180
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-181

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: AUTH-01 toàn vẹn hồ sơ + AUTH-02 trình tự TT28; PLAN mục tiêu không sót data
- Catches_bug: Đổi nơi lưu ở Vụ án nhưng bước chuyển đổi vẫn đọc nơi cũ → thông tin người tố cáo rơi đúng lúc hồ sơ sang giai đoạn mới

**Runner contract**:
- Coverage_ids: `COV-E2E-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Gherkin**:
```gherkin
Given một đơn thư đã nhập đủ thông tin người gửi và nội dung
When cán bộ chuyển đơn thành vụ việc
Then vụ việc mới mang đủ thông tin đó, không trường nào rỗng đi
```

**Tiêu đề**: Tích hợp: chuyển Đơn thư thành Vụ việc — thông tin người và nội dung không mất

### Các bước kiểm thử
- [ ] Tạo Đơn thư với dấu nhận dạng riêng ở mọi trường thuộc phạm vi epic
- [ ] Thực hiện chuyển thành Vụ việc
- [ ] Mở Vụ việc vừa tạo, đối chiếu từng trường

### Kết quả mong đợi
- Mọi trường mang dấu nhận dạng đều xuất hiện ở Vụ việc; lập bảng đối chiếu trường-theo-trường, liệt kê trường nào rơi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-181
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-182

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `COL-IS-CANONICAL`
- Oracle_source: PLAN D1 — cột typed là nơi lưu chuẩn; áp cho cả dữ liệu sinh ra từ chuyển đổi
- Catches_bug: Bước chuyển đổi vẫn ghi vào khối dữ liệu phụ → vụ án tạo bằng chuyển đổi có cột rỗng trong khi vụ tạo tay thì đầy đủ, sinh ra hai lớp dữ liệu khác nhau

**Runner contract**:
- Coverage_ids: `COV-E2E-02`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tích hợp: chuyển Đơn thư thành Vụ án — giá trị vào đúng ô chuẩn

### Các bước kiểm thử
- [ ] Tạo Đơn thư đầy đủ
- [ ] Chuyển thành Vụ án
- [ ] Đọc trực tiếp các cột chuẩn của Vụ án vừa tạo

### Kết quả mong đợi
- Giá trị nằm ở CỘT chuẩn (không chỉ ở khối dữ liệu phụ), giống hệt vụ án tạo tay.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-182
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-183

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `J-E2E-01`
- Oracle_source: AUTH-02 vòng đời hồ sơ TT28; PLAN mục tiêu một khái niệm một nơi lưu xuyên suốt
- Catches_bug: Từng module đúng riêng lẻ nhưng dữ liệu phân kỳ khi đi qua ranh giới module — dạng lỗi chỉ lộ ra ở kiểm thử xuyên suốt

**Runner contract**:
- Coverage_ids: `COV-E2E-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`, `db-readback`

**Gherkin**:
```gherkin
Given một tin báo mới của công dân
When cán bộ tiếp nhận đơn, chuyển thành vụ việc, nâng lên vụ án, nhập thiệt hại và tra lại nguồn gốc
Then thông tin nhận dạng đi suốt chuỗi mà không biến dạng
```

**Tiêu đề**: Tích hợp trọn vòng: Đơn thư → Vụ việc → Vụ án → Thống kê → Truy nguyên trong một phiên

### Các bước kiểm thử
- [ ] Tạo Đơn thư với dấu nhận dạng duy nhất trong phiên
- [ ] Chuyển thành Vụ việc, kiểm dấu nhận dạng
- [ ] Nâng lên/chuyển thành Vụ án, kiểm dấu nhận dạng
- [ ] Nhập thiệt hại và số bị hại, kiểm ở tab Thống kê
- [ ] Mở bảng dữ liệu gốc và số hồ sơ hệ cũ (nếu có)
- [ ] Tìm kiếm theo dấu nhận dạng, xác nhận ra đúng hồ sơ ở mỗi chặng

### Kết quả mong đợi
- Dấu nhận dạng còn nguyên ở mọi chặng; số liệu thống kê khớp; tra cứu ra đúng hồ sơ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-183
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-184

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: PLAN §A3 R1 — một nguồn duy nhất cho thiệt hại
- Catches_bug: Màn hình tổng hợp toàn hệ thống còn đọc nguồn cũ → số trình lãnh đạo khác số trong hồ sơ

**Runner contract**:
- Coverage_ids: `COV-E2E-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tích hợp: thiệt hại nhập ở Vụ án hiện đúng trên màn hình tổng hợp toàn hệ thống

### Các bước kiểm thử
- [ ] Ghi số thiệt hại tổng của một tiêu chí trên màn hình tổng hợp
- [ ] Sửa thiệt hại của một vụ trong tiêu chí đó
- [ ] Xem lại tổng

### Kết quả mong đợi
- Tổng thay đổi đúng bằng mức chênh lệch vừa sửa.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-184
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-185

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `TRACE-PRESERVED`
- Oracle_source: PLAN §C cluster G + §Verification 5; AUTH-01
- Catches_bug: Chuỗi truy nguyên đứt: tra được số cũ nhưng mở ra không thấy bản gốc, hoặc ngược lại

**Runner contract**:
- Coverage_ids: `COV-E2E-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`

**Tiêu đề**: Tích hợp: từ tìm kiếm theo số hệ cũ đến đối chiếu bản gốc

### Các bước kiểm thử
- [ ] Tìm theo số hồ sơ hệ cũ
- [ ] Mở chi tiết từ kết quả
- [ ] Mở bảng dữ liệu gốc
- [ ] Đối chiếu 5 trường giữa ô chuẩn và bản gốc

### Kết quả mong đợi
- Đi trọn chuỗi không đứt; đối chiếu nhất quán hoặc chênh lệch có lý do.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-185
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-186

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `SINGLE-STORE-SYNC`
- Oracle_source: PLAN mục tiêu — một nơi lưu duy nhất cho mỗi khái niệm
- Catches_bug: Mỗi vai mở một màn hình đọc một nguồn khác nhau → ba người nhìn ba con số cho cùng một hồ sơ

**Runner contract**:
- Coverage_ids: `COV-E2E-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `trace`

**Tiêu đề**: Tích hợp đa vai: cán bộ tạo, điều tra viên sửa, lãnh đạo xem — không ai thấy dữ liệu lệch

### Các bước kiểm thử
- [ ] Vai cán bộ tiếp nhận tạo vụ với dấu nhận dạng
- [ ] Vai điều tra viên mở, sửa thiệt hại và nơi xảy ra
- [ ] Vai lãnh đạo mở chi tiết, tab thống kê và màn hình tổng hợp
- [ ] Đối chiếu giá trị ở cả ba vai

### Kết quả mong đợi
- Ba vai thấy cùng một giá trị cho mỗi trường.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-186
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-187

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `History`
- Rule_ref: `REGRESSION`
- Oracle_source: Oracle History (FEW HICCUPPS) — chức năng đang chạy trước epic phải tiếp tục chạy
- Catches_bug: Thêm điều kiện tìm theo cột mới làm hỏng phân trang hoặc bộ lọc sẵn có

**Runner contract**:
- Coverage_ids: `COV-E2E-07`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Hồi quy: danh sách, phân trang và bộ lọc sẵn có vẫn hoạt động

### Các bước kiểm thử
- [ ] Mở danh sách Vụ án, Đơn thư, Vụ việc
- [ ] Chuyển trang, đổi số dòng mỗi trang
- [ ] Áp từng bộ lọc sẵn có

### Kết quả mong đợi
- Ba màn hình hoạt động bình thường; số lượng kết quả nhất quán giữa các trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-187
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-188

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `History`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: Oracle History + AUTH-01 — văn bản in ra là sản phẩm pháp lý, sai một trường là sai văn bản tố tụng
- Catches_bug: Bộ sinh văn bản vẫn đọc khối dữ liệu phụ → hồ sơ mới nhập in ra để trống mục người tố cáo, thiệt hại

**Runner contract**:
- Coverage_ids: `COV-E2E-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Hồi quy: in và xuất chứng từ lấy đúng giá trị sau khi đổi nơi lưu

### Các bước kiểm thử
- [ ] Tạo hồ sơ mới nhập qua giao diện mới với dấu nhận dạng ở các trường thuộc phạm vi
- [ ] Thực hiện in/xuất chứng từ
- [ ] Mở văn bản kết quả, tìm dấu nhận dạng

### Kết quả mong đợi
- Văn bản chứa đúng giá trị vừa nhập, không để trống mục tương ứng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-188
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-191

**Meta**:
- Loại: `METAMORPHIC`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Comparable`
- Rule_ref: `METAMORPHIC-ROUNDTRIP`
- Oracle_source: Tính khả nghịch của thao tác sửa — không cần biết giá trị đúng tuyệt đối
- Catches_bug: Mỗi lần lưu làm dữ liệu trôi một chút (chuẩn hoá chuỗi, cắt khoảng trắng, đổi định dạng ngày, gộp lại dữ liệu cũ) — trôi tích luỹ qua nhiều lần sửa

**Runner contract**:
- Coverage_ids: `COV-E2E-11`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Quan hệ biến đổi: sửa rồi sửa ngược lại thì hồ sơ trở về trạng thái ban đầu

### Các bước kiểm thử
- [ ] Chụp toàn bộ dữ liệu hồ sơ
- [ ] Sửa một trường sang giá trị khác, lưu
- [ ] Sửa ngược lại giá trị ban đầu, lưu
- [ ] Chụp lại và so từng trường

### Kết quả mong đợi
- Mọi trường trở về giá trị ban đầu; không trường phụ nào bị biến đổi kèm.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-191
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-192

**Meta**:
- Loại: `E2E`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `quan-tri`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V7`
- Oracle_source: PLAN §Verification 7 — triển khai kèm kiểm tra sức khoẻ
- Catches_bug: Thay đổi lược đồ khiến ứng dụng không khởi động hoặc một biểu nhập lỗi trắng

**Runner contract**:
- Coverage_ids: `COV-E2E-12`
- Backend_policy: `live`
- Evidence_required: `api-response`, `screenshot-final`

**Tiêu đề**: Kiểm tra nhanh sau triển khai: hệ thống sống, đăng nhập được, ba biểu mở được

### Các bước kiểm thử
- [ ] Kiểm tra điểm kiểm tra sức khoẻ của máy chủ
- [ ] Đăng nhập
- [ ] Mở form Đơn thư, Vụ việc, Vụ án

### Kết quả mong đợi
- Máy chủ báo bình thường; đăng nhập được; ba biểu mở không lỗi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-192
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-196

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — 'field đã vào form chính phải gỡ khỏi parityState... spread-order có thể đè. Tránh 2 nguồn cùng ghi 1 cột'
- Catches_bug: Hai ô nhập cùng trỏ vào một cột: kết quả cuối phụ thuộc thứ tự gộp dữ liệu chứ không phụ thuộc điều người dùng gõ — lỗi không tái hiện ổn định, rất khó truy

**Runner contract**:
- Coverage_ids: `COV-UI-01`, `COV-UP-09`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nghi vấn DRIFT-1: hai ô cùng ghi một cột — xác định ô nào thắng khi giá trị khác nhau

### Các bước kiểm thử
- [ ] Rà toàn form tìm mọi ô nhập mang nghĩa 'người tố cáo', 'số CCCD', 'số điện thoại', 'địa chỉ'
- [ ] Nếu tìm thấy hơn một ô cho cùng khái niệm: nhập hai giá trị KHÁC nhau vào hai ô
- [ ] Lưu, đọc cột
- [ ] Lặp lại với thứ tự nhập ngược lại

### Kết quả mong đợi
- Trường hợp mong muốn: chỉ có một ô, bước 2 không thực hiện được. Nếu có hai ô: FAIL — báo cáo phải nêu rõ ô nào thắng và kết quả có phụ thuộc thứ tự nhập không.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-196
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-197

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-03`
- Oracle_source: PLAN §A1 hàng 3 — hai ô GỘP thành một, canonical là ngày sinh kiểu ngày; lệch kiểu chuyển về kiểu native
- Catches_bug: Còn hai ô: cán bộ điền năm vào ô cũ, ngày vào ô mới, hai giá trị mâu thuẫn cùng tồn tại và không nguồn nào là chuẩn

**Runner contract**:
- Coverage_ids: `COV-UI-01`, `COV-DOB-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nghi vấn DRIFT-2: năm sinh hệ cũ và ngày sinh có còn là hai ô riêng không

### Các bước kiểm thử
- [ ] Rà toàn form tìm ô mang nghĩa 'năm sinh' và ô 'ngày sinh'
- [ ] Nếu có cả hai: nhập năm 1975 vào ô năm sinh và ngày 20/05/1985 vào ô ngày sinh
- [ ] Lưu, đọc cả hai cột và cờ độ chính xác

### Kết quả mong đợi
- Trường hợp mong muốn: chỉ một ô ngày sinh. Nếu còn hai ô: FAIL theo mục A1 hàng 3 — báo cáo nêu rõ giá trị nào được coi là ngày sinh của hồ sơ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-197
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-198

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: PLAN §Context 4 — damage có 3 nơi, 'phải hợp nhất cả 3'; §A3 R1 — cả ba đọc/ghi CÙNG cột, tắt đường metadata trùng
- Catches_bug: Nguồn thứ ba vẫn đọc dữ liệu phụ: sửa thiệt hại ở form thì màn hình/ô thứ ba giữ số cũ — số cũ tiếp tục chảy vào báo cáo mà không ai biết

**Runner contract**:
- Coverage_ids: `COV-ST-07`, `COV-ST-16`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nghi vấn DRIFT-3: nguồn thiệt hại thứ ba có còn đọc dữ liệu phụ không

### Các bước kiểm thử
- [ ] Chọn hồ sơ cũ có thiệt hại nằm trong dữ liệu phụ với hai khoá khác nhau
- [ ] Ghi lại số hiển thị ở MỌI nơi: tab Thông tin, tab Thống kê, danh sách, màn hình tổng hợp, văn bản in
- [ ] Sửa thiệt hại thành một số mới, lưu
- [ ] Ghi lại số ở toàn bộ những nơi trên lần nữa

### Kết quả mong đợi
- Sau bước 3, MỌI nơi cùng hiển thị số mới. Nơi nào còn giữ số cũ = FAIL, phải nêu đích danh nơi đó.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-198
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-007

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-N`
- Oracle_source: PLAN §A2 (N) — thêm cột `caseClassification`
- Catches_bug: Phân loại vụ án không lên cột → không lọc theo phân loại được

**Runner contract**:
- Coverage_ids: `COV-CR-07`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: phân loại vụ án lưu vào cột mới `caseClassification`

### Các bước kiểm thử
- [ ] Tạo vụ án, chọn/nhập Phân loại
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `caseClassification` mang đúng giá trị đã nhập, đọc lại từ cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-008

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-N`
- Oracle_source: PLAN §A2 (N) — thêm cột `tinhTrang`
- Catches_bug: tinhTrang còn là form-key/metadata → mất khi đổi form

**Runner contract**:
- Coverage_ids: `COV-CR-08`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án mới: tình trạng lưu vào cột mới `tinhTrang`

### Các bước kiểm thử
- [ ] Tạo vụ án, nhập Tình trạng
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Cột `tinhTrang` mang đúng giá trị; đọc lại từ cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-014

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-B2`
- Oracle_source: PLAN §B2 — dual-write idempotent; PLAN mục tiêu: hợp nhất không tạo bản ghi thừa
- Catches_bug: Dual-write ghi khoá rỗng vào metadata / tạo bản ghi thống kê rỗng cho mọi vụ

**Runner contract**:
- Coverage_ids: `COV-CR-14`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tạo vụ án chỉ với thông tin tối thiểu: không lỗi hệ thống, không sinh dữ liệu rác

### Các bước kiểm thử
- [ ] Tạo vụ án chỉ nhập trường bắt buộc, bỏ trống toàn bộ cụm tiếp nhận/chủ thể
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Lưu thành công. Các cột bỏ trống ở trạng thái rỗng thật (không phải chuỗi rỗng giả), không phát sinh bản ghi thống kê rỗng, không lỗi máy chủ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-015

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V4`
- Oracle_source: PLAN §Verification 4 — 'DTO whitelist: field mới qua class-validator (không bị strip)'; PLAN §Kiến trúc: forbidNonWhitelisted
- Catches_bug: Trường lạ được ghi thẳng vào hồ sơ (mass assignment) hoặc trường hợp lệ bị loại bỏ im lặng khiến người dùng tưởng đã lưu

**Runner contract**:
- Coverage_ids: `COV-CR-15`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Gửi trường không được khai báo: hệ thống phản ứng có kiểm soát, không nuốt im lặng

### Các bước kiểm thử
- [ ] Gửi yêu cầu tạo vụ án kèm một trường bịa đặt `khongTonTaiField` = 'x'
- [ ] Quan sát phản hồi
- [ ] Đọc lại hồ sơ

### Kết quả mong đợi
- Hệ thống từ chối rõ ràng HOẶC bỏ qua trường lạ nhưng KHÔNG lưu nó vào hồ sơ. Tuyệt đối không được ghi giá trị lạ vào dữ liệu hồ sơ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-016

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B2`
- Oracle_source: PLAN §B2 — 'ghi cả cột lẫn metadata (idempotent)'; PLAN §B3 — upsert ON CONFLICT
- Catches_bug: Mỗi lần lưu tạo thêm một bản ghi thống kê → tổng hợp cộng trùng, số liệu báo cáo phình lên

**Runner contract**:
- Coverage_ids: `COV-CR-16`, `COV-ST-05`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Lưu hai lần cùng nội dung: không nhân đôi bản ghi thống kê

### Các bước kiểm thử
- [ ] Tạo vụ án có thiệt hại 1000000
- [ ] Sửa và lưu lại đúng nội dung cũ 2 lần
- [ ] Đếm số bản ghi thống kê của vụ

### Kết quả mong đợi
- Đúng MỘT bản ghi thống kê cho vụ; giá trị vẫn 1000000.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-023

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4-b`
- Oracle_source: PLAN §B4 — 'NGỪNG ghi metadata.<promotedKey>'; §B6 — gỡ dual-write SAU khi ổn định. NOT-IN-SCOPE hiện tại: PR2c chưa làm ⇒ EXPECTED-DEFERRED
- Catches_bug: Nếu sau này tắt dual-write mà quên lọc, hoặc nếu metadata ghi giá trị KHÁC cột → hai nguồn phân kỳ

**Runner contract**:
- Coverage_ids: `COV-UP-05`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Sửa hồ sơ: đo xem có phát sinh khoá dữ liệu phụ mới cho khái niệm đã chuyển lên cột

### Các bước kiểm thử
- [ ] Ghi lại nội dung khối metadata của vụ TRƯỚC khi sửa
- [ ] Sửa một trường đã chuyển lên cột
- [ ] So sánh khối metadata SAU khi sửa

### Kết quả mong đợi
- TRẠNG THÁI KỲ VỌNG HIỆN TẠI (deferred): metadata có thể vẫn được ghi song song, NHƯNG giá trị metadata phải BẰNG giá trị cột — không được phân kỳ. FAIL nếu metadata mang giá trị khác cột. Ghi nhận riêng nếu metadata không còn được ghi (đã tiến tới B6).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-028

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: AUTH-01/AUTH-05 — toàn vẹn & nhất quán hồ sơ
- Catches_bug: Phiên sau gửi toàn bộ form cũ đè lên thay đổi của phiên trước

**Runner contract**:
- Coverage_ids: `COV-UP-10`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Hai phiên cùng sửa một hồ sơ: không mất thay đổi âm thầm

### Các bước kiểm thử
- [ ] Phiên A mở hồ sơ
- [ ] Phiên B mở cùng hồ sơ, sửa 'Nơi xảy ra', lưu
- [ ] Phiên A (chưa tải lại) sửa 'Tóm tắt nội dung', lưu
- [ ] Đọc lại hồ sơ

### Kết quả mong đợi
- Hoặc cả hai thay đổi cùng tồn tại, hoặc hệ thống báo xung đột rõ ràng. KHÔNG được im lặng nuốt thay đổi của phiên B.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-038

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A1-07`
- Oracle_source: PLAN §A1 hàng 7 — trường số tiền; ISO 25012 accuracy (0 ≠ không rõ)
- Catches_bug: 0 bị coi là rỗng (falsy) → vụ 'đã xác minh không thiệt hại' bị hiểu thành 'chưa nhập'

**Runner contract**:
- Coverage_ids: `COV-ST-08`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Biên: thiệt hại bằng 0 được chấp nhận và phân biệt với bỏ trống

### Các bước kiểm thử
- [ ] Nhập Số tiền thiệt hại = 0, lưu, đọc lại
- [ ] Xoá trắng ô, lưu, đọc lại
- [ ] So sánh hai trạng thái

### Kết quả mong đợi
- Trạng thái 1 lưu giá trị 0; trạng thái 2 lưu rỗng. Hai trạng thái PHÂN BIỆT được với nhau.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-039

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A1-07`
- Oracle_source: PLAN §B3 parse numeric + AUTH-05 accuracy — số tiền thiệt hại không thể âm
- Catches_bug: Thiệt hại âm lọt vào bảng thống kê → tổng hợp toàn đơn vị bị trừ đi

**Runner contract**:
- Coverage_ids: `COV-ST-09`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Biên âm: thiệt hại số âm bị từ chối, không lưu

### Các bước kiểm thử
- [ ] Nhập Số tiền thiệt hại = -1000
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Bị từ chối với thông báo rõ ràng; giá trị cũ giữ nguyên; không có -1000 trong bảng thống kê.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-040

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `World`
- Rule_ref: `PLAN-A1-07`
- Oracle_source: AUTH-05 accuracy — vụ án kinh tế thực tế có thiệt hại hàng nghìn tỷ đồng
- Catches_bug: Kiểu số dấu phẩy động làm tròn → hồ sơ ghi sai số tiền thiệt hại, ảnh hưởng định khung

**Runner contract**:
- Coverage_ids: `COV-ST-10`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Biên lớn: thiệt hại rất lớn lưu chính xác, không tràn không làm tròn

### Các bước kiểm thử
- [ ] Nhập Số tiền thiệt hại = 1234567890123 (hơn 1.234 tỷ)
- [ ] Lưu
- [ ] Đọc lại và so từng chữ số

### Kết quả mong đợi
- Đọc lại đúng 1234567890123, không mất chữ số cuối, không thành ký hiệu khoa học.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-041

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — 'text→numeric (bỏ ký tự tiền tệ)'
- Catches_bug: '1.500.000 đ' bị đọc thành 1.5 → thiệt hại 1,5 triệu thành 1,5 đồng

**Runner contract**:
- Coverage_ids: `COV-ST-11`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Thiệt hại nhập kèm ký tự tiền tệ: hoặc hiểu đúng, hoặc từ chối rõ — không lưu sai thầm lặng

### Các bước kiểm thử
- [ ] Nhập chuỗi '1.500.000 đ' vào ô Số tiền thiệt hại
- [ ] Lưu
- [ ] Đọc lại giá trị

### Kết quả mong đợi
- Hoặc lưu đúng 1500000, hoặc từ chối với thông báo. TUYỆT ĐỐI không được lưu một số khác (1.5 / 1500 / 0).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-045

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `World`
- Rule_ref: `PLAN-A1-08`
- Oracle_source: AUTH-05 accuracy — số người là số nguyên không âm
- Catches_bug: Lưu 2.5 bị hại hoặc -3 bị hại → tổng hợp vô nghĩa

**Runner contract**:
- Coverage_ids: `COV-ST-15`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Số bị hại âm hoặc lẻ: bị từ chối

### Các bước kiểm thử
- [ ] Thử Số bị hại = -3, lưu
- [ ] Thử Số bị hại = 2.5, lưu
- [ ] Đọc lại sau mỗi lần

### Kết quả mong đợi
- Cả hai bị từ chối; giá trị cũ không bị phá.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-051

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PRECISION-EXPLICIT`
- Oracle_source: PLAN §A1 hàng 3 (cờ precision) + AUTH-07 — độ chính xác thấp phải tường minh
- Catches_bug: Cán bộ đọc '01/01/1985' và ghi vào văn bản tố tụng như ngày sinh chính xác, trong khi hồ sơ gốc chỉ có năm

**Runner contract**:
- Coverage_ids: `COV-DOB-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Hiển thị ngày sinh chỉ-năm: giao diện không khẳng định ngày 01/01 là thật

### Các bước kiểm thử
- [ ] Mở vụ có ngày sinh chỉ-năm
- [ ] Quan sát cách hiển thị ô Ngày sinh

### Kết quả mong đợi
- Người dùng nhận biết được đây là 'chỉ có năm' (hiển thị năm, hoặc chú thích/nhãn phụ). Nếu chỉ hiện '01/01/1985' như ngày thường → phát hiện UX nghiêm trọng, ghi vào Bug Tracker.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-052

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-03`
- Oracle_source: PLAN §A1 hàng 3 — '(KHÔNG dùng cờ metadata)'
- Catches_bug: Cờ nằm ở metadata → không truy vấn/lọc được, và mất khi metadata bị dọn

**Runner contract**:
- Coverage_ids: `COV-DOB-04`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Cờ độ chính xác nằm ở cột, không phải trong khối dữ liệu phụ

### Các bước kiểm thử
- [ ] Đọc bản ghi có ngày sinh chỉ-năm
- [ ] Xác định nơi lưu cờ độ chính xác

### Kết quả mong đợi
- Cờ là một CỘT của hồ sơ. Không chấp nhận cờ chỉ tồn tại dưới dạng khoá trong khối dữ liệu phụ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-054

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1-03`
- Oracle_source: PLAN §A1 hàng 3 — cờ phản ánh độ chính xác thực tế
- Catches_bug: Cờ chỉ-năm dính vĩnh viễn → sau khi xác minh được ngày sinh thật, hệ thống vẫn nói 'chỉ biết năm'

**Runner contract**:
- Coverage_ids: `COV-DOB-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Chuyển từ chỉ-năm sang ngày đầy đủ: cờ độ chính xác được nâng cấp

### Các bước kiểm thử
- [ ] Mở vụ có ngày sinh chỉ-năm
- [ ] Nhập ngày sinh đầy đủ 15/07/1985, lưu
- [ ] Đọc lại ngày + cờ

### Kết quả mong đợi
- Ngày = 1985-07-15; cờ KHÔNG còn là 'year'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-057

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `World`
- Rule_ref: `PLAN-A1-03`
- Oracle_source: AUTH-05 accuracy — ngày sinh không thể ở tương lai
- Catches_bug: Gõ nhầm năm 2085 được lưu im lặng → hồ sơ có người tố cáo chưa sinh ra

**Runner contract**:
- Coverage_ids: `COV-DOB-09`
- Backend_policy: `live`
- Evidence_required: `api-response`, `screenshot-final`

**Tiêu đề**: Ngày sinh ở tương lai: bị chặn hoặc cảnh báo rõ

### Các bước kiểm thử
- [ ] Nhập Ngày sinh = 01/01/2085
- [ ] Lưu
- [ ] Đọc lại

### Kết quả mong đợi
- Bị chặn hoặc có cảnh báo rõ ràng trước khi lưu. Nếu lưu im lặng không cảnh báo → ghi nhận phát hiện.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-060

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-FABRICATION`
- Oracle_source: PLAN §B3 — 'Giá trị không parse được → bảng reject, null cột, log — không bịa'
- Catches_bug: Cắt bớt chữ số ('19855' → 1985) hoặc nhận '0000' thành năm 0 → dữ liệu bịa

**Runner contract**:
- Coverage_ids: `COV-DOB-12`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Năm phi lý trong dữ liệu cũ ('19855', '0000'): từ chối có ghi nhận

### Các bước kiểm thử
- [ ] Cho dữ liệu năm sinh cũ = '19855' và '0000'
- [ ] Chuẩn hoá
- [ ] Đọc cột + danh sách từ chối

### Kết quả mong đợi
- Cột để trống, mỗi giá trị vào danh sách từ chối kèm nguyên văn gốc. Không có suy đoán 1985 hay 2000.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-062

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) — nhóm trường văn bản đã có cột
- Catches_bug: Trường văn bản còn ghi vào metadata → mất khi ngừng dual-write

**Runner contract**:
- Coverage_ids: `COV-PROMO-TXT`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Nhóm văn bản – nguồn đơn, phiếu chuyển, nơi cấp CCCD lưu vào cột

### Các bước kiểm thử
- [ ] Nhập nguonDon, soPhieuChuyen, noiCapCccd
- [ ] Lưu, đọc lại từng cột

### Kết quả mong đợi
- Ba cột mang đúng giá trị đã nhập.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-063

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C)
- Catches_bug: Trường ý kiến/nhận xét mất khi lưu → mất cơ sở chỉ đạo trong hồ sơ

**Runner contract**:
- Coverage_ids: `COV-PROMO-TXT`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Nhóm văn bản – ghi chú trùng đơn, lãnh đạo tố tụng, nhận xét lưu vào cột

### Các bước kiểm thử
- [ ] Nhập ghiChuTrungDon, lanhDaoToTung, nhanXet
- [ ] Lưu, đọc lại từng cột

### Kết quả mong đợi
- Ba cột mang đúng giá trị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-064

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C)
- Catches_bug: Trường thuộc giai đoạn kết quả bị rơi khi lưu

**Runner contract**:
- Coverage_ids: `COV-PROMO-TXT`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Nhóm văn bản – yêu cầu bổ sung, kết quả xử lý khác, đồ vật tài liệu kèm theo lưu vào cột

### Các bước kiểm thử
- [ ] Nhập yeuCauBoSung, ketQuaXuLyKhac, doVatTaiLieuKemTheo
- [ ] Lưu, đọc lại

### Kết quả mong đợi
- Ba cột mang đúng giá trị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-066

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) + §B1 quy ước date-only
- Catches_bug: Mốc chuyển hồ sơ lệch ngày → tính sai thời hạn giải quyết

**Runner contract**:
- Coverage_ids: `COV-PROMO-DATE`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Nhóm ngày – ngày phiếu chuyển và ngày giao đơn vị giải quyết lưu vào cột đúng ngày

### Các bước kiểm thử
- [ ] Nhập ngayPhieuChuyen = 05/03/2026, ngayGiaoDonViGiaiQuyet = 06/03/2026
- [ ] Lưu, đọc lại

### Kết quả mong đợi
- Hai cột đúng ngày đã nhập, không lệch một ngày.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-067

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) + §B1
- Catches_bug: Ngày viết đơn (do công dân ghi) bị hệ thống thay bằng ngày nhập liệu

**Runner contract**:
- Coverage_ids: `COV-PROMO-DATE`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Nhóm ngày – ngày đề xuất và ngày viết đơn lưu vào cột đúng ngày

### Các bước kiểm thử
- [ ] Nhập ngayDeXuat = 10/02/2026, ngayVietDon = 01/02/2026
- [ ] Lưu, đọc lại

### Kết quả mong đợi
- Hai cột đúng ngày đã nhập; ngayVietDon không bị thay bằng ngày hôm nay.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-068

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PLAN-C-B`
- Oracle_source: PLAN §C cluster B — 'CCCD + ngày cấp + nơi cấp liền kề'; AUTH-03 Luật Căn cước
- Catches_bug: Ngày cấp nằm cách xa số CCCD → cán bộ nhập thiếu, cụm định danh không đầy đủ

**Runner contract**:
- Coverage_ids: `COV-PROMO-DATE`, `COV-ORD-B2`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Nhóm ngày – ngày cấp CCCD lưu vào cột và nằm cạnh số CCCD

### Các bước kiểm thử
- [ ] Trên form, xác định vị trí ba ô: số CCCD, ngày cấp, nơi cấp
- [ ] Nhập cả ba, lưu, đọc lại

### Kết quả mong đợi
- Ba ô nằm liền kề nhau trong cùng một cụm; cả ba lưu đúng vào cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-069

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) — `baoCaoBanGiamDoc`(bool)
- Catches_bug: Giá trị đúng/sai bị lưu thành chuỗi 'true' → lọc theo tiêu chí báo cáo sai

**Runner contract**:
- Coverage_ids: `COV-PROMO-BOOL`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Trường đúng/sai – báo cáo Ban giám đốc đặt ở trạng thái 'có'

### Các bước kiểm thử
- [ ] Bật ô 'Báo cáo Ban giám đốc'
- [ ] Lưu, đọc lại

### Kết quả mong đợi
- Cột mang giá trị đúng (true) đúng kiểu luận lý.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-070

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C); AUTH-05 accuracy — 'không' khác 'chưa xác định'
- Catches_bug: Tắt cờ bị coi là rỗng nên bỏ qua khi lưu → cờ mãi mãi bật, không sửa được

**Runner contract**:
- Coverage_ids: `COV-PROMO-BOOL`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Trường đúng/sai – đặt lại về 'không' được lưu, không bị coi là bỏ trống

### Các bước kiểm thử
- [ ] Bật cờ, lưu
- [ ] Tắt cờ, lưu
- [ ] Tải lại, đọc cột

### Kết quả mong đợi
- Cột chuyển về giá trị sai (false) và giữ nguyên sau khi tải lại.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-072

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) — `sttCu`; PLAN §C cluster G — nhóm di trú
- Catches_bug: Số thứ tự hệ cũ mất → không đối chiếu được hồ sơ giấy

**Runner contract**:
- Coverage_ids: `COV-PROMO-ID`, `COV-TRC-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Số thứ tự hệ cũ hiển thị và lưu đúng

### Các bước kiểm thử
- [ ] Mở vụ đã di trú
- [ ] Tìm ô/nhãn Số thứ tự hệ cũ, đối chiếu với cột

### Kết quả mong đợi
- Hiển thị đúng giá trị cột `sttCu`.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-074

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: AUTH-01 — nội dung hồ sơ không được mất; AUTH-05 completeness
- Catches_bug: Nội dung mô tả dài bị cắt cụt khi lưu → mất phần cuối lời khai/mô tả trong hồ sơ

**Runner contract**:
- Coverage_ids: `COV-PROMO-NEG`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Trường văn bản rất dài: lưu đủ hoặc báo giới hạn rõ, không cắt âm thầm

### Các bước kiểm thử
- [ ] Nhập vào ô Tóm tắt nội dung một đoạn 10.000 ký tự có dấu mốc ở đầu và cuối
- [ ] Lưu, đọc lại, so dấu mốc cuối

### Kết quả mong đợi
- Hoặc lưu trọn vẹn (dấu mốc cuối còn), hoặc báo vượt giới hạn TRƯỚC khi lưu. Cấm cắt cụt im lặng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-075

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `World`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: AUTH-05 accuracy; tên riêng và địa danh tiếng Việt có dấu là dữ liệu bắt buộc đúng
- Catches_bug: Mã hoá sai làm hỏng dấu tiếng Việt → tên người trong hồ sơ tố tụng bị sai

**Runner contract**:
- Coverage_ids: `COV-PROMO-NEG`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Trường văn bản có ký tự đặc biệt và dấu tiếng Việt: lưu nguyên vẹn

### Các bước kiểm thử
- [ ] Nhập tên 'Nguyễn Thị Ánh Nguyệt' và địa chỉ có ký tự & " ' < > %
- [ ] Lưu, đọc lại, so từng ký tự

### Kết quả mong đợi
- Chuỗi đọc lại giống hệt chuỗi nhập, dấu tiếng Việt nguyên vẹn, không bị đổi thành mã ký tự.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-077

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-R`
- Oracle_source: PLAN §A2 (R) — 'deXuat (dùng cột này, bỏ form-key deXuatXuLy)'. DRIFT-4: khoá form cũ vẫn tồn tại trong mã — cần xác minh ở tầng giao diện
- Catches_bug: Hai ô đề xuất cùng tồn tại → cán bộ ghi vào ô này, lãnh đạo đọc ô kia

**Runner contract**:
- Coverage_ids: `COV-PROMO-R1`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Đề xuất xử lý: chỉ còn MỘT ô, lưu vào cột đề xuất

### Các bước kiểm thử
- [ ] Rà toàn bộ form (mọi tab), đếm số ô mang nghĩa 'đề xuất xử lý'
- [ ] Nhập giá trị, lưu, đọc cột `deXuat`

### Kết quả mong đợi
- Đúng MỘT ô đề xuất trên toàn form; giá trị vào cột `deXuat`.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-079

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R7`
- Oracle_source: PLAN §A3 R7 — 'dieuTraVien = tên tự do hệ cũ... dòng tham chiếu ĐTV (hệ cũ)'
- Catches_bug: Tên điều tra viên hệ cũ bị trộn vào ô phân công chính → hiểu nhầm người đang thụ lý

**Runner contract**:
- Coverage_ids: `COV-PROMO-R2`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Điều tra viên hệ cũ hiển thị dưới nhãn tham chiếu, lưu vào cột điều tra viên

### Các bước kiểm thử
- [ ] Mở vụ có tên điều tra viên hệ cũ
- [ ] Quan sát nhãn của ô chứa tên đó
- [ ] Sửa và lưu, đọc cột `dieuTraVien`

### Kết quả mong đợi
- Ô mang nhãn thể hiện đây là dữ liệu hệ cũ/tham chiếu, tách khỏi ô phân công cán bộ thụ lý; giá trị lưu vào cột `dieuTraVien`.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-081

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V4`
- Oracle_source: PLAN §Verification 4 — field mới qua lớp kiểm tra hợp lệ
- Catches_bug: Chuỗi rác vào cột ngày làm hỏng bản ghi hoặc gây lỗi máy chủ

**Runner contract**:
- Coverage_ids: `COV-PROMO-NNEG`, `COV-API-06`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Cột mới nhận giá trị sai kiểu: phản ứng có kiểm soát, không phá dữ liệu

### Các bước kiểm thử
- [ ] Gửi `receiveDate` = 'hôm qua' và `reporterDateOfBirth` = 12345
- [ ] Quan sát phản hồi
- [ ] Đọc lại bản ghi

### Kết quả mong đợi
- Bị từ chối với thông báo lỗi rõ ràng (không phải lỗi máy chủ); bản ghi không bị tạo/đổi với dữ liệu méo.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-086

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-R`
- Oracle_source: PLAN §A2 (R) — quyết 1 tên cột, sửa form/merge/build theo
- Catches_bug: Giao diện gửi tên cũ, máy chủ chờ tên mới → dữ liệu rơi giữa đường

**Runner contract**:
- Coverage_ids: `COV-API-04`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Hợp đồng API – trường loại R (tên đã thống nhất): gửi lên rồi đọc lại còn nguyên

### Các bước kiểm thử
- [ ] Gửi giá trị cho `deXuat` và `dieuTraVien` theo đúng tên cột
- [ ] Đọc lại

### Kết quả mong đợi
- Hai trường trả về đúng giá trị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-087

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-R`
- Oracle_source: PLAN §A2 (R) — bỏ form-key thừa `deXuatXuLy`
- Catches_bug: Máy khách cũ còn gửi tên cũ: hoặc bị lỗi 500, hoặc ghi vào nơi khác gây phân kỳ dữ liệu

**Runner contract**:
- Coverage_ids: `COV-API-05`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Gửi tên trường cũ đã bỏ: không lưu nhầm, không gây lỗi máy chủ

### Các bước kiểm thử
- [ ] Gửi yêu cầu sửa dùng tên cũ `deXuatXuLy` = 'X'
- [ ] Quan sát phản hồi
- [ ] Đọc lại cột `deXuat`

### Kết quả mong đợi
- Không lỗi máy chủ. Hoặc từ chối rõ, hoặc ánh xạ đúng về cột `deXuat`. Cấm ghi vào nơi thứ ba.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-088

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-V4`
- Oracle_source: PLAN §Verification 4 — lớp kiểm tra hợp lệ
- Catches_bug: Chuỗi vào trường số/ngày làm hỏng bản ghi hoặc trả lỗi 500 lộ thông tin nội bộ

**Runner contract**:
- Coverage_ids: `COV-API-06`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Gửi sai kiểu dữ liệu: báo lỗi rõ ràng, không lưu méo, không lỗi máy chủ

### Các bước kiểm thử
- [ ] Gửi số tiền thiệt hại = 'abc'
- [ ] Gửi `receiveDate` = true
- [ ] Quan sát phản hồi và đọc lại bản ghi

### Kết quả mong đợi
- Cả hai bị từ chối bằng lỗi yêu cầu không hợp lệ, thông điệp hiểu được, không lộ dấu vết nội bộ; bản ghi giữ nguyên.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-094

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R2`
- Oracle_source: PLAN §A3 R2 — 'specificAddress (metadata) đang hiện → gộp về noiXayRa'
- Catches_bug: Bỏ ô cũ mà không chuyển dữ liệu → địa chỉ cụ thể của hiện trường biến mất khỏi giao diện

**Runner contract**:
- Coverage_ids: `COV-SEM-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Địa chỉ cụ thể trong dữ liệu cũ được gom về ô Nơi xảy ra, không mất

### Các bước kiểm thử
- [ ] Chọn vụ cũ có giá trị ở trường địa chỉ cụ thể trong dữ liệu phụ
- [ ] Mở form, tìm giá trị đó
- [ ] Đối chiếu với bảng dữ liệu gốc

### Kết quả mong đợi
- Giá trị vẫn nhìn thấy được trên form (ở ô Nơi xảy ra hoặc ô có nhãn tương ứng) và còn nguyên trong bảng dữ liệu gốc.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-095

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R3`
- Oracle_source: PLAN §A3 R3 — 'giữ cột (cluster C). Không có native tương đương → thăng'
- Catches_bug: Trường không có ô native tương ứng bị dọn nhầm trong đợt gộp → mất thông tin nghiệp vụ điều tra

**Runner contract**:
- Coverage_ids: `COV-SEM-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Phương thức thủ đoạn tồn tại như một ô riêng, không bị coi là trùng và bỏ đi

### Các bước kiểm thử
- [ ] Mở form sửa
- [ ] Tìm ô Phương thức thủ đoạn
- [ ] Nhập, lưu, đọc lại cột

### Kết quả mong đợi
- Ô tồn tại trên form chính, lưu được vào cột.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-096

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A3-R4`
- Oracle_source: PLAN §A3 R4 — 'giữ cột; stat_crimeField (nếu cùng nghĩa) đọc chung cột'
- Catches_bug: Hai nơi phân loại khác nhau → báo cáo theo lĩnh vực đếm nhầm nhóm

**Runner contract**:
- Coverage_ids: `COV-SEM-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Phân loại tội phạm/lĩnh vực: form chính và tab thống kê cùng một giá trị

### Các bước kiểm thử
- [ ] Đặt phân loại tội phạm/lĩnh vực ở form chính, lưu
- [ ] Mở tab thống kê, xem trường lĩnh vực tương ứng

### Kết quả mong đợi
- Hai nơi hiển thị cùng giá trị. Nếu lệch → nêu rõ hai nguồn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-104

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `SEMANTIC-SEPARATION`
- Oracle_source: PLAN §A1 hàng 5 + §A3 R2 — ba khái niệm địa lý/chủ thể độc lập
- Catches_bug: Logic dự phòng lấy giá trị trường này khi trường kia trống → điền nhầm chéo

**Runner contract**:
- Coverage_ids: `COV-SEM-14`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tổ hợp có/không của bị hại × địa chỉ × nơi xảy ra: không tổ hợp nào gây lẫn dữ liệu

### Các bước kiểm thử
- [ ] Lần lượt tạo/sửa vụ với 4 tổ hợp: (có bị hại, không địa chỉ), (không bị hại, có địa chỉ), (có cả hai, không nơi xảy ra), (không bị hại, có nơi xảy ra)
- [ ] Sau mỗi lần, đọc cả ba cột

### Kết quả mong đợi
- Ở mọi tổ hợp, cột trống vẫn trống — không bị điền bằng giá trị của cột khác.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-105

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `SEMANTIC-SEPARATION`
- Oracle_source: PLAN §A3 R5 + R7 — cấm merge, giữ cả hai
- Catches_bug: Logic dự phòng chéo giữa ba trường khiến giá trị nhảy sang trường khác khi một trường trống

**Runner contract**:
- Coverage_ids: `COV-SEM-15`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Tổ hợp có/không của điều tra viên hệ cũ × cán bộ thụ lý × danh sách đối tượng

### Các bước kiểm thử
- [ ] Lần lượt dựng 4 tổ hợp có/không của ba trường
- [ ] Sau mỗi lần đọc cả ba

### Kết quả mong đợi
- Không tổ hợp nào làm một trường nhận giá trị của trường khác.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-110

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 quy tắc DR-5 — chỉ-khi-cột-rỗng; xung đột chỉ khi giá trị KHÁC
- Catches_bug: Báo xung đột giả hàng loạt làm ngập danh sách rà soát, che mất xung đột thật

**Runner contract**:
- Coverage_ids: `COV-BF-05`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – cột đã có giá trị GIỐNG dữ liệu cũ: giữ nguyên, không báo xung đột

### Các bước kiểm thử
- [ ] Dựng hồ sơ có cột và dữ liệu cũ cùng giá trị
- [ ] Chạy chuẩn hoá
- [ ] Đọc cột và danh sách xung đột

### Kết quả mong đợi
- Cột không đổi; không có dòng xung đột nào cho hồ sơ này.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-113

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — NULLIF(btrim(...), '')
- Catches_bug: Chuỗi khoảng trắng được ghi vào cột → cột 'có giá trị' nhưng vô nghĩa, và lần chuẩn hoá sau bỏ qua vì không còn NULL

**Runner contract**:
- Coverage_ids: `COV-BF-08`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – nguồn là chuỗi rỗng hoặc khoảng trắng: coi như không có

### Các bước kiểm thử
- [ ] Dựng hồ sơ có dữ liệu cũ = '   ' và một hồ sơ có ''
- [ ] Chạy chuẩn hoá
- [ ] Đọc cột

### Kết quả mong đợi
- Cả hai cột vẫn rỗng thật, không chứa khoảng trắng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-126

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: PLAN mục tiêu — không sót data; §B6 giữ panel động
- Catches_bug: Chỉ chăm trường được thăng, hàng chục trường đuôi dài biến mất khỏi giao diện

**Runner contract**:
- Coverage_ids: `COV-TRC-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Trường hệ cũ không thăng (đuôi dài) vẫn xem và sửa được

### Các bước kiểm thử
- [ ] Mở hồ sơ giàu trường hệ cũ
- [ ] Mở khu trường bổ sung
- [ ] Sửa một trường đuôi dài, lưu, tải lại

### Kết quả mong đợi
- Trường đuôi dài hiển thị, sửa được, giá trị bền vững.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-131

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PLAN-C-A`
- Oracle_source: PLAN §C cluster A; AUTH-02 TT28 trình tự tiếp nhận trước
- Catches_bug: Trường tiếp nhận nằm rải rác → cán bộ bỏ sót ngay bước đầu quy trình

**Runner contract**:
- Coverage_ids: `COV-ORD-A`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Cụm Định danh và tiếp nhận đứng đầu form và gom đủ nhóm trường

### Các bước kiểm thử
- [ ] Mở form tạo vụ án
- [ ] Ghi lại thứ tự các cụm
- [ ] Kiểm cụm đầu có: mã hồ sơ, ngày tiếp nhận, đơn vị, nguồn, số/ngày phiếu chuyển, ngày giao đơn vị, ngày đề xuất/viết đơn

### Kết quả mong đợi
- Cụm định danh & tiếp nhận đứng đầu; liệt kê trường nào thiếu khỏi cụm.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-131
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-132

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-C-B`
- Oracle_source: PLAN §C cluster B — 'Chủ thể (mọi field người 1 chỗ)'; Nielsen #4 nhất quán
- Catches_bug: Thông tin một người rải ở nhiều nơi → cán bộ nhập thiếu, hoặc nhập lệch giữa các cụm

**Runner contract**:
- Coverage_ids: `COV-ORD-B`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Mọi trường về con người nằm trong MỘT cụm chủ thể

### Các bước kiểm thử
- [ ] Liệt kê mọi ô liên quan tới người: họ tên, ngày sinh, giới tính, CCCD, ngày/nơi cấp, SĐT, email, địa chỉ, quan hệ, bị hại, nghi vấn đối tượng
- [ ] Ghi lại chúng thuộc cụm nào

### Kết quả mong đợi
- Toàn bộ nằm trong một cụm chủ thể (đối tượng có cấu trúc được phép là khu con). Trường lạc cụm phải liệt kê tên.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-132
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-133

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PLAN-C-RULE`
- Oracle_source: PLAN §C nguyên tắc — 'CCCD số/ngày/nơi liền nhau'; AUTH-03 cụm định danh
- Catches_bug: Ba thành phần của một cụm định danh tách rời → nhập thiếu ngày/nơi cấp, giấy tờ không đủ căn cứ

**Runner contract**:
- Coverage_ids: `COV-ORD-B2`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Số CCCD, ngày cấp và nơi cấp nằm liền kề nhau

### Các bước kiểm thử
- [ ] Xác định vị trí ba ô CCCD trên form
- [ ] Đếm số ô xen giữa chúng

### Kết quả mong đợi
- Ba ô đứng liền nhau, không ô khác chen giữa.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-133
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-135

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-C-D`
- Oracle_source: PLAN §C cluster D — 'tội danh (chính + toiDanhBanDau + phụ liền nhau)'
- Catches_bug: Ba loại tội danh tách rời → nhập nhầm loại này sang loại kia

**Runner contract**:
- Coverage_ids: `COV-ORD-D`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tội danh chính, tội danh ban đầu và tội danh phụ đứng liền nhau

### Các bước kiểm thử
- [ ] Xác định vị trí ba ô tội danh
- [ ] Đếm ô xen giữa

### Kết quả mong đợi
- Ba ô liền nhau trong cụm Phân loại & tố tụng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-135
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-137

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `PLAN-C-RULE`
- Oracle_source: PLAN §C nguyên tắc — 'không để field giai-đoạn-sau trước tiếp-nhận'; AUTH-02 trình tự TT28
- Catches_bug: Ô quyết định khởi tố/bản án nằm trước ô tiếp nhận → biểu nhập chống lại trình tự nghiệp vụ, dễ nhập sai giai đoạn

**Runner contract**:
- Coverage_ids: `COV-ORD-F`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Cụm Kết quả và giai đoạn sau đứng SAU cụm tiếp nhận, không đảo trình tự tố tụng

### Các bước kiểm thử
- [ ] Ghi thứ tự xuất hiện của: ngày tiếp nhận, các quyết định tố tụng, kết quả xử lý, nhận xét/đề xuất
- [ ] So với trình tự A→F

### Kết quả mong đợi
- Không trường thuộc giai đoạn sau nào xuất hiện trước cụm tiếp nhận.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-137
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-140

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A1`
- Oracle_source: PLAN §A1 cột 'Nhãn form': Người tố cáo/Báo tin, Số CCCD, Ngày sinh, Số điện thoại, Địa chỉ, Tóm tắt nội dung, Số tiền thiệt hại (VND), Số bị hại
- Catches_bug: Giữ nhãn hệ cũ khó hiểu (vd 'Tên cung cấp') → người dùng không nhận ra ô cần điền

**Runner contract**:
- Coverage_ids: `COV-UI-02`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Nhãn mỗi ô đúng như kế hoạch quy định

### Các bước kiểm thử
- [ ] Ghi lại nhãn thực tế của 8 ô
- [ ] So với danh sách nhãn trong kế hoạch

### Kết quả mong đợi
- Nhãn khớp hoặc tương đương rõ nghĩa. Liệt kê nhãn lệch.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-140
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-143

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `AUTH-08`
- Oracle_source: Nielsen #9 help users recognize/diagnose/recover from errors
- Catches_bug: Lỗi chung chung khiến người dùng không biết sửa ô nào, thử mò rồi bỏ dở hồ sơ

**Runner contract**:
- Coverage_ids: `COV-UI-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Thông báo lỗi chỉ đúng ô sai và diễn đạt hiểu được

### Các bước kiểm thử
- [ ] Nhập một ngày không tồn tại vào ô ngày sinh và một số âm vào thiệt hại
- [ ] Lưu
- [ ] Quan sát vị trí và nội dung thông báo

### Kết quả mong đợi
- Thông báo neo vào đúng ô sai, mô tả bằng tiếng Việt hiểu được, không phải mã lỗi kỹ thuật.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-143
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-144

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-09`
- Oracle_source: WCAG 2.2 AA — 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions
- Catches_bug: Ô không có nhãn liên kết → người dùng trình đọc màn hình không biết đang nhập gì

**Runner contract**:
- Coverage_ids: `COV-A11Y-01`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Mọi ô mới có nhãn liên kết đúng cho công nghệ trợ giúp

### Các bước kiểm thử
- [ ] Với 6 ô mới (ngày tiếp nhận, phân loại, tình trạng, tội danh ban đầu, ngày sinh, độ chính xác ngày sinh) kiểm nhãn có liên kết chương trình với ô nhập

### Kết quả mong đợi
- Mọi ô có nhãn liên kết đúng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-144
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-150

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B4`
- Oracle_source: PLAN §B4 — index cho noiXayRa
- Catches_bug: Không lọc được theo địa bàn → không tổng hợp được vụ việc theo khu vực

**Runner contract**:
- Coverage_ids: `COV-SRCH-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tìm hồ sơ theo nơi xảy ra

### Các bước kiểm thử
- [ ] Tìm theo một phần chuỗi nơi xảy ra

### Kết quả mong đợi
- Hồ sơ tương ứng xuất hiện.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-150
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-161

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-04`
- Oracle_source: NĐ 13/2023 — các bảng này chứa giá trị dữ liệu cá nhân nguyên văn
- Catches_bug: Bảng phục vụ rà soát nội bộ bị phơi ra ngoài, chứa tên/CCCD/địa chỉ nguyên văn

**Runner contract**:
- Coverage_ids: `COV-SEC-07`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Danh sách xung đột và từ chối không lộ qua đường dẫn công khai

### Các bước kiểm thử
- [ ] Thử truy cập dữ liệu xung đột/từ chối khi chưa đăng nhập và khi đăng nhập vai thường

### Kết quả mong đợi
- Không truy cập được bằng vai không phải quản trị; không có đường dẫn công khai.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-161
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-165

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `ONE-FIELD-ONE-BOX`
- Oracle_source: PLAN §A4-04 + §B4 — tránh 2 nguồn ghi 1 cột
- Catches_bug: Hai ô cùng ghi một cột trên Đơn thư → kết quả phụ thuộc thứ tự ghi

**Runner contract**:
- Coverage_ids: `COV-PET-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Khu trường hệ cũ của Đơn thư không lặp lại ô đã có ở form chính

### Các bước kiểm thử
- [ ] Mở Đơn thư đã di trú
- [ ] Liệt kê ô nhập ở khu trường hệ cũ
- [ ] Giao với danh sách ô ở form chính

### Kết quả mong đợi
- Giao rỗng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-165
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-169

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: PLAN §A2 (C) — soHoSoCu; yêu cầu truy nguyên áp cho cả ba module
- Catches_bug: Chỉ Vụ án tra được theo số cũ, Đơn thư thì không → cán bộ không tìm ra đơn gốc

**Runner contract**:
- Coverage_ids: `COV-PET-07`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Tìm Đơn thư theo số hồ sơ hệ cũ

### Các bước kiểm thử
- [ ] Lấy số hồ sơ hệ cũ của một Đơn thư di trú
- [ ] Tìm theo số đó

### Kết quả mong đợi
- Đơn thư xuất hiện trong kết quả.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-169
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-170

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `AUTH-08`
- Oracle_source: Nielsen #5 error prevention + #9 error recovery
- Catches_bug: Lưu thất bại làm trắng cả biểu → cán bộ mất toàn bộ nội dung vừa gõ

**Runner contract**:
- Coverage_ids: `COV-PET-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Bỏ trống trường bắt buộc của Đơn thư: báo rõ, không mất dữ liệu đã nhập

### Các bước kiểm thử
- [ ] Điền gần đủ biểu, bỏ trống một trường bắt buộc
- [ ] Bấm lưu
- [ ] Quan sát biểu sau khi báo lỗi

### Kết quả mong đợi
- Thông báo chỉ đúng trường thiếu; toàn bộ nội dung đã nhập vẫn còn trên biểu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-170
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-171

**Meta**:
- Loại: `AUDIT`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-DT-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `TRACE-PRESERVED`
- Oracle_source: PLAN §B6 — không xoá dữ liệu gốc; áp cho cả ba module
- Catches_bug: Bản gốc của Đơn thư bị dọn trong khi Vụ án được giữ

**Runner contract**:
- Coverage_ids: `COV-PET-09`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Bảng dữ liệu gốc của Đơn thư còn nguyên

### Các bước kiểm thử
- [ ] Mở Đơn thư di trú
- [ ] Mở bảng dữ liệu gốc

### Kết quả mong đợi
- Bảng hiển thị đầy đủ trường gốc.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-171
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-176

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-A4-03`
- Oracle_source: PLAN §A4-03; 4 giai đoạn theo TT28
- Catches_bug: Giai đoạn ít gặp bị bỏ sót khi sửa lỗi

**Runner contract**:
- Coverage_ids: `COV-INC-04`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Mở vụ việc đang Tạm đình chỉ: đúng phần giai đoạn đó tự mở

### Các bước kiểm thử
- [ ] Mở vụ việc ở trạng thái Tạm đình chỉ
- [ ] Quan sát phần mở sẵn

### Kết quả mong đợi
- Phần tương ứng Tạm đình chỉ mở sẵn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-176
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-177

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A4-03`
- Oracle_source: PLAN §A4-03 — đường sneak: trạng thái không nằm trong bản đồ giai đoạn
- Catches_bug: Tra bản đồ giai đoạn với giá trị không có trong bảng gây lỗi trắng màn hình, hồ sơ không mở được

**Runner contract**:
- Coverage_ids: `COV-INC-05`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `console-log`

**Tiêu đề**: Vụ việc có trạng thái rỗng hoặc lạ: không lỗi, mặc định hợp lý

### Các bước kiểm thử
- [ ] Mở vụ việc có trạng thái không thuộc bản đồ giai đoạn (hoặc rỗng)
- [ ] Quan sát màn hình

### Kết quả mong đợi
- Màn hình mở bình thường, không lỗi trắng; chọn một mặc định hợp lý và nêu rõ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-177
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-179

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VV-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A4-01`
- Oracle_source: PLAN §A4 — áp phân loại và thăng trường cho Vụ việc
- Catches_bug: Vụ việc còn ô trùng trong khi Vụ án đã gộp

**Runner contract**:
- Coverage_ids: `COV-INC-07`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Form Vụ việc: mỗi khái niệm một ô, khu trường hệ cũ không trùng

### Các bước kiểm thử
- [ ] Mở form sửa Vụ việc di trú
- [ ] Liệt kê khái niệm có nhiều hơn một ô
- [ ] Giao ô form chính với ô khu trường hệ cũ

### Kết quả mong đợi
- Không khái niệm nào có quá một ô; giao rỗng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-179
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-189

**Meta**:
- Loại: `REGRESSION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `History`
- Rule_ref: `PLAN-A3-R1`
- Oracle_source: Oracle History — chỉ tiêu theo TT28 vốn đang đúng phải tiếp tục đúng
- Catches_bug: Chỉ tiêu đọc nguồn số liệu cũ trong khi form ghi nguồn mới → báo cáo chỉ tiêu sai

**Runner contract**:
- Coverage_ids: `COV-E2E-09`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Hồi quy: bảng chỉ tiêu và biểu đồ không sai lệch sau hợp nhất

### Các bước kiểm thử
- [ ] Ghi lại các số trên màn hình chỉ tiêu
- [ ] Đối chiếu vài số với đếm trực tiếp từ dữ liệu
- [ ] Kiểm biểu đồ hiển thị được

### Kết quả mong đợi
- Số trên màn hình khớp đếm trực tiếp; biểu đồ hiển thị bình thường.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-189
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-190

**Meta**:
- Loại: `METAMORPHIC`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Comparable`
- Rule_ref: `METAMORPHIC-FILTER`
- Oracle_source: Quan hệ toán học của phép lọc — không cần biết giá trị đúng tuyệt đối
- Catches_bug: Điều kiện tìm theo cột mới nối bằng phép hoặc thay vì phép và → thêm bộ lọc lại ra NHIỀU kết quả hơn

**Runner contract**:
- Coverage_ids: `COV-E2E-10`
- Backend_policy: `live`
- Evidence_required: `api-response`

**Tiêu đề**: Quan hệ biến đổi: thêm điều kiện lọc thì tập kết quả phải thu hẹp

### Các bước kiểm thử
- [ ] Lấy kết quả với một điều kiện lọc
- [ ] Thêm một điều kiện lọc thứ hai
- [ ] So hai tập kết quả

### Kết quả mong đợi
- Tập sau là tập con của tập trước; số lượng không tăng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-190
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-194

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `NO-DATA-LOSS`
- Oracle_source: AUTH-05 accuracy — thao tác đồng thời không được trộn dữ liệu giữa hồ sơ
- Catches_bug: Trạng thái dùng chung ở lớp ghi cột/thống kê khiến giá trị của hồ sơ này rơi sang hồ sơ kia

**Runner contract**:
- Coverage_ids: `COV-E2E-14`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Hai người sửa hai hồ sơ khác nhau cùng lúc: dữ liệu không lẫn

### Các bước kiểm thử
- [ ] Hai phiên đồng thời sửa hai hồ sơ khác nhau, mỗi hồ sơ một dấu nhận dạng riêng
- [ ] Đọc lại cả hai

### Kết quả mong đợi
- Mỗi hồ sơ chỉ mang dấu nhận dạng của mình.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-194
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-195

**Meta**:
- Loại: `E2E`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-E2E-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `COL-IS-CANONICAL`
- Oracle_source: PLAN D1 — dữ liệu nằm ở nơi lưu bền vững, không phải trạng thái tạm của trình duyệt
- Catches_bug: Giá trị chỉ tồn tại trong bộ nhớ đệm phía trình duyệt, mất khi phiên kết thúc

**Runner contract**:
- Coverage_ids: `COV-E2E-15`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Dữ liệu nhập trong phiên vẫn đúng sau khi đăng xuất và đăng nhập lại

### Các bước kiểm thử
- [ ] Nhập và lưu hồ sơ mới
- [ ] Đăng xuất, đóng trình duyệt
- [ ] Đăng nhập lại, mở hồ sơ

### Kết quả mong đợi
- Toàn bộ giá trị còn nguyên.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-195
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-029

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — 'NULLIF(btrim(...), '')' — chuỗi rỗng/khoảng trắng coi như không có giá trị
- Catches_bug: Chuỗi rỗng được coi là dữ liệu → cột bị ghi rỗng và chặn mất cơ hội điền giá trị thật sau này

**Runner contract**:
- Coverage_ids: `COV-UP-11`, `COV-BF-08`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`, `db-readback`

**Tiêu đề**: Dữ liệu cũ là chuỗi rỗng: hiển thị trống, không coi là giá trị

### Các bước kiểm thử
- [ ] Mở vụ có metadata chứa chuỗi rỗng hoặc chỉ khoảng trắng ở một khái niệm đã thăng
- [ ] Quan sát ô tương ứng

### Kết quả mong đợi
- Ô hiển thị trống. Cột KHÔNG bị ghi chuỗi rỗng/khoảng trắng như một giá trị hợp lệ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-043

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A1-08`
- Oracle_source: PLAN §A1 hàng 8; AUTH-05 accuracy
- Catches_bug: 0 bị coi là chưa nhập → thống kê bỏ sót vụ không có bị hại

**Runner contract**:
- Coverage_ids: `COV-ST-13`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Biên: số bị hại bằng 0 phân biệt với bỏ trống

### Các bước kiểm thử
- [ ] Nhập Số bị hại = 0, lưu, đọc lại
- [ ] Xoá trắng, lưu, đọc lại

### Kết quả mong đợi
- Hai trạng thái phân biệt được: 0 và rỗng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-044

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `api`
- Persona: `can-bo-thong-ke`
- Journey_ref: `J-VA-03`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `PLAN-A1-08`
- Oracle_source: PLAN §A1 hàng 8
- Catches_bug: Ràng buộc biên đặt sai (min = 2) chặn vụ có một bị hại

**Runner contract**:
- Coverage_ids: `COV-ST-14`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Biên: số bị hại bằng 1 (giá trị nhỏ nhất có ý nghĩa)

### Các bước kiểm thử
- [ ] Nhập Số bị hại = 1, lưu, đọc lại

### Kết quả mong đợi
- Lưu thành công, giá trị = 1.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-071

**Meta**:
- Loại: `DECISION`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `World`
- Rule_ref: `PLAN-A2-C`
- Oracle_source: AUTH-05 — completeness: chưa nhập ≠ đã xác định là không
- Catches_bug: Vụ chưa nhập bị hiểu là 'không báo cáo Ban giám đốc' → thống kê chấp hành sai

**Runner contract**:
- Coverage_ids: `COV-PROMO-BOOL`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Trường đúng/sai – chưa từng đặt: phân biệt với 'không'

### Các bước kiểm thử
- [ ] Tạo vụ mới không chạm ô 'Báo cáo Ban giám đốc'
- [ ] Đọc giá trị cột

### Kết quả mong đợi
- Ghi nhận trạng thái thật của cột. Nếu hệ thống ép mặc định 'không' thì phải nêu rõ trong báo cáo (ảnh hưởng thống kê), kèm khuyến nghị.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-076

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 — NULLIF(btrim(...),'')
- Catches_bug: Cột bị ghi chuỗi khoảng trắng → sau này chuẩn hoá bỏ qua vì 'cột đã có giá trị'

**Runner contract**:
- Coverage_ids: `COV-PROMO-NEG`
- Backend_policy: `live`
- Evidence_required: `api-response`, `db-readback`

**Tiêu đề**: Trường văn bản chỉ chứa khoảng trắng: coi như bỏ trống, không ghi rác vào cột

### Các bước kiểm thử
- [ ] Nhập ba dấu cách vào ô Nơi xảy ra
- [ ] Lưu, đọc cột

### Kết quả mong đợi
- Cột ở trạng thái rỗng thật, không chứa chuỗi khoảng trắng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-082

**Meta**:
- Loại: `EXPLORATORY`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `GAP`
- Rule_ref: `GAP-03`
- Oracle_source: Plan KHÔNG quy định tập giá trị hợp lệ cho `caseClassification`/`tinhTrang` → không có oracle để phán đạt/không đạt
- Catches_bug: Không phán xét — mục tiêu là phát hiện yêu cầu còn thiếu trước khi dữ liệu bị nhập lung tung

**Runner contract**:
- Coverage_ids: `COV-PROMO-GAP`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Miền giá trị của phân loại và tình trạng: ghi nhận khoảng trống trong yêu cầu

### Các bước kiểm thử
- [ ] Quan sát ô Phân loại và ô Tình trạng: là danh sách chọn hay ô nhập tự do?
- [ ] Nếu tự do, thử nhập giá trị bất kỳ và lưu
- [ ] Ghi nhận hành vi

### Kết quả mong đợi
- GHI NHẬN, không phán xét: mô tả kiểu nhập và tập giá trị thực tế; đề xuất chốt danh mục nếu đang tự do (rủi ro dữ liệu không thống nhất khi tổng hợp).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-112

**Meta**:
- Loại: `DECISION`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `quan-tri`
- Journey_ref: `J-ADM-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-B3`
- Oracle_source: PLAN §B3 quy tắc DR-7 — điều kiện WHERE nguồn IS NOT NULL
- Catches_bug: Ghi chuỗi rỗng/null tường minh vào cột, làm cột 'đã có giá trị' và chặn lần chuẩn hoá sau

**Runner contract**:
- Coverage_ids: `COV-BF-07`
- Backend_policy: `live`
- Evidence_required: `db-readback`

**Tiêu đề**: Chuẩn hoá – không có dữ liệu nguồn: không làm gì

### Các bước kiểm thử
- [ ] Dựng hồ sơ không có cả cột lẫn dữ liệu cũ
- [ ] Chạy chuẩn hoá
- [ ] Đọc cột

### Kết quả mong đợi
- Cột vẫn ở trạng thái rỗng thật; không dòng xung đột, không dòng từ chối.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-128

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `AUTH-07`
- Oracle_source: AUTH-07 ISO 8601 + nguyên tắc hiển thị dữ liệu cho người dùng; tiền lệ đã sửa: bảng gốc từng hiện số mốc thời gian thô
- Catches_bug: Ngày hiện dạng số nguyên → cán bộ không đối chiếu được với hồ sơ giấy

**Runner contract**:
- Coverage_ids: `COV-TRC-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Giá trị ngày trong bảng gốc hiển thị dạng người đọc được

### Các bước kiểm thử
- [ ] Mở bảng dữ liệu gốc
- [ ] Tìm các trường có bản chất là ngày
- [ ] Quan sát định dạng

### Kết quả mong đợi
- Hiển thị dạng ngày/tháng/năm đọc được, không phải chuỗi số thô.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-134

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-C-C`
- Oracle_source: PLAN §C cluster C
- Catches_bug: Mô tả và địa điểm tách xa nhau → mất mạch khi thuật lại sự việc

**Runner contract**:
- Coverage_ids: `COV-ORD-C`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Cụm Sự việc và địa điểm gom đủ tiêu đề, mô tả, phương thức, nơi xảy ra, mốc thời gian

### Các bước kiểm thử
- [ ] Xác định cụm Sự việc
- [ ] Kiểm có tiêu đề, tóm tắt nội dung, phương thức thủ đoạn, nơi xảy ra, ngày xảy ra/phát hiện

### Kết quả mong đợi
- Đủ các trường trên trong một cụm; liệt kê trường thiếu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-134
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-136

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `lanh-dao-doi`
- Journey_ref: `J-VA-02`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-C-E`
- Oracle_source: PLAN §C cluster E — 'Phân công (1 section)'
- Catches_bug: Thông tin phân công rải rác → lãnh đạo không nắm ai đang thụ lý

**Runner contract**:
- Coverage_ids: `COV-ORD-E`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Cụm Phân công gom cán bộ thụ lý, điều tra viên hệ cũ, đơn vị, lãnh đạo, hạn xử lý

### Các bước kiểm thử
- [ ] Xác định cụm Phân công
- [ ] Kiểm có: cán bộ thụ lý, điều tra viên hệ cũ (tham chiếu), đơn vị thụ lý, lãnh đạo tố tụng, cán bộ đề xuất, hạn xử lý

### Kết quả mong đợi
- Toàn bộ trong một cụm; liệt kê trường thiếu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-136
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-138

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-VA-04`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-C-G`
- Oracle_source: PLAN §C cluster G — 'LegacyRawPanel (tham chiếu) cuối'
- Catches_bug: Khu tham chiếu đặt trên đầu che mất trường nhập chính

**Runner contract**:
- Coverage_ids: `COV-ORD-G`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Cụm Thống kê và di trú nằm cuối

### Các bước kiểm thử
- [ ] Xác định vị trí khu thống kê, số hệ cũ và bảng dữ liệu gốc

### Kết quả mong đợi
- Nằm ở cuối, sau các cụm nhập liệu chính.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-138
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-141

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `PLAN-C-RULE`
- Oracle_source: PLAN §C nguyên tắc — 'required đầu section'
- Catches_bug: Trường bắt buộc nằm cuối cụm dài → người dùng cuộn qua, lưu bị chặn không rõ lý do

**Runner contract**:
- Coverage_ids: `COV-UI-03`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Trường bắt buộc nằm đầu mỗi cụm

### Các bước kiểm thử
- [ ] Với mỗi cụm, xác định trường bắt buộc và vị trí trong cụm

### Kết quả mong đợi
- Trường bắt buộc đứng đầu cụm chứa nó.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-141
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-145

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-09`
- Oracle_source: WCAG 2.2 AA — 2.4.3 Focus Order; 2.4.11 Focus Not Obscured
- Catches_bug: Sắp xếp lại giao diện làm thứ tự tiêu điểm nhảy lộn xộn → nhập bằng bàn phím trở nên bất khả

**Runner contract**:
- Coverage_ids: `COV-A11Y-02`
- Backend_policy: `live`
- Evidence_required: `trace`

**Tiêu đề**: Điều hướng bàn phím đi theo đúng trình tự cụm A đến G

### Các bước kiểm thử
- [ ] Đặt tiêu điểm vào ô đầu tiên
- [ ] Nhấn Tab liên tiếp qua toàn bộ form, ghi thứ tự
- [ ] Kiểm tiêu điểm luôn nhìn thấy được

### Kết quả mong đợi
- Thứ tự tiêu điểm theo đúng trình tự thị giác A→G; tiêu điểm không bị thanh cố định che.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-145
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-146

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `can-bo-tiep-nhan`
- Journey_ref: `J-VA-01`

**Oracle**:
- Oracle_type: `Statute`
- Rule_ref: `AUTH-09`
- Oracle_source: WCAG 2.2 A/AA
- Catches_bug: Vi phạm tương phản/nhãn/vai trò phát sinh khi đổi bố cục

**Runner contract**:
- Coverage_ids: `COV-A11Y-03`
- Backend_policy: `live`
- Evidence_required: `console-log`, `screenshot-final`

**Tiêu đề**: Quét tiếp cận tự động trên form Vụ án

### Các bước kiểm thử
- [ ] Chạy công cụ quét tự động trên form tạo và form sửa
- [ ] Phân loại kết quả theo mức A/AA
- [ ] Rà thủ công phần công cụ không kết luận được

### Kết quả mong đợi
- Không vi phạm mức A/AA nghiêm trọng. Báo cáo GHI RÕ giới hạn: quét tự động chỉ phát hiện khoảng 57% vấn đề, phần còn lại đã rà thủ công những mục nào.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-146
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-152

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `Purpose`
- Rule_ref: `AUTH-08`
- Oracle_source: Nielsen #1 — trạng thái rỗng phải nói rõ
- Catches_bug: Trang trắng hoặc quay vòng vô hạn khi không có kết quả

**Runner contract**:
- Coverage_ids: `COV-SRCH-06`
- Backend_policy: `live`
- Evidence_required: `screenshot-final`

**Tiêu đề**: Từ khoá không tồn tại: không kết quả, không lỗi

### Các bước kiểm thử
- [ ] Tìm chuỗi ngẫu nhiên chắc chắn không tồn tại

### Kết quả mong đợi
- Hiển thị trạng thái rỗng rõ ràng, không lỗi, không quay vòng mãi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-152
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-154

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `GAP`
- Rule_ref: `GAP-02`
- Oracle_source: Plan KHÔNG nêu ngưỡng hiệu năng → dùng so sánh tương đối, không phán ngưỡng tuyệt đối
- Catches_bug: Thiếu chỉ mục cho cột mới → tra cứu chậm dần theo khối lượng hồ sơ di trú

**Runner contract**:
- Coverage_ids: `COV-SRCH-08`
- Backend_policy: `live`
- Evidence_required: `console-log`

**Tiêu đề**: Hiệu năng tìm kiếm theo cột mới trên dữ liệu thật

### Các bước kiểm thử
- [ ] Đo thời gian phản hồi tìm theo mã hồ sơ (tiêu chí cũ) 5 lần
- [ ] Đo tìm theo tên người tố cáo, CCCD, số hệ cũ, nơi xảy ra mỗi loại 5 lần
- [ ] So trung vị

### Kết quả mong đợi
- GHI NHẬN số đo. Cảnh báo nếu tiêu chí mới chậm hơn tiêu chí cũ nhiều lần — đề xuất bổ sung chỉ mục. Không phán đạt/không đạt vì thiếu ngưỡng trong yêu cầu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-154
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-193

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `dieu-tra-vien`
- Journey_ref: `J-TIM-01`

**Oracle**:
- Oracle_type: `GAP`
- Rule_ref: `GAP-02`
- Oracle_source: Plan không nêu ngưỡng → đo và so tương đối
- Catches_bug: Thêm cột vào truy vấn danh sách làm chậm màn hình chính trên khối dữ liệu hàng chục nghìn hồ sơ

**Runner contract**:
- Coverage_ids: `COV-E2E-13`
- Backend_policy: `live`
- Evidence_required: `console-log`, `screenshot-final`

**Tiêu đề**: Tải danh sách trên khối dữ liệu di trú thật: không lỗi, thời gian chấp nhận được

### Các bước kiểm thử
- [ ] Mở danh sách Vụ án, Đơn thư, Vụ việc trên khối dữ liệu thật, đo thời gian tải
- [ ] Lặp 3 lần lấy trung vị

### Kết quả mong đợi
- Không lỗi, không hết thời gian chờ. GHI NHẬN số đo; cảnh báo nếu chậm bất thường.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-193
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## 🐛 Bug Reports (Claude Code điền khi fix bug)

> Mỗi bug được phát hiện sẽ thêm 1 block ở đây. Reference TC bằng ID.

> Template (copy + fill):


````markdown
### BUG-XXX

- **TC**: TC-XXX
- **Severity**: Critical | High | Medium | Low
- **Status**: Open | Fixing | Fixed | Verified | Closed | Reopened
- **Phát hiện**: DD/MM/YYYY
- **Module**: module name

**Reproduce**:
1. step 1
2. step 2

**Expected**: ...
**Actual**: ...

**Root cause**:
> Phân tích nguyên nhân gốc bởi Claude Code

**Fix**:
- [ ] File: `path/to/file.ts` line X-Y — thay đổi: ...
- [ ] Add test case mới nếu cần
- [ ] Update doc nếu cần

**Verify**: chạy lại TC-XXX → đặt Status = Verified
````

## ✅ Execution Checklist

> Claude Code tick khi hoàn thành từng TC. Mỗi line là 1 trạng thái có thể chuyển đổi.

- [ ] **TC-001** [P0] Tạo vụ án mới: tên người tố cáo được lưu vào cột chính thức, không chỉ nằm trong dữ liệu phụ
- [ ] **TC-002** [P0] Tạo vụ án mới: số CCCD người tố cáo lưu vào cột chính thức
- [ ] **TC-003** [P0] Tạo vụ án mới: số điện thoại người tố cáo lưu vào cột chính thức
- [ ] **TC-004** [P0] Tạo vụ án mới: địa chỉ người tố cáo lưu vào cột chính thức
- [ ] **TC-005** [P0] Tạo vụ án mới: tóm tắt nội dung lưu vào cột chính thức
- [ ] **TC-006** [P0] Tạo vụ án mới: ngày tiếp nhận lưu vào cột mới `receiveDate`
- [ ] **TC-009** [P0] Tạo vụ án mới: tội danh ban đầu lưu vào cột riêng, không đụng tội danh phụ
- [ ] **TC-010** [P0] Tạo vụ án mới: ngày sinh người tố cáo lưu kiểu ngày + cờ độ chính xác ở cột
- [ ] **TC-011** [P0] Tạo vụ án mới có thiệt hại: số tiền vào bảng thống kê, tự tạo bản ghi nếu chưa có
- [ ] **TC-012** [P0] Tạo vụ án mới có số bị hại: lưu vào bảng thống kê
- [ ] **TC-013** [P0] Hồi quy chốt chặn: tạo vụ án điền đủ cụm tiếp nhận — KHÔNG cột nào bị bỏ trống
- [ ] **TC-017** [P0] Sau khi tạo, mở lại hồ sơ: mọi ô hiển thị đúng giá trị lấy từ cột
- [ ] **TC-018** [P0] E2E: cán bộ tiếp nhận tạo trọn một vụ án qua giao diện, mỗi khái niệm chỉ điền một lần
- [ ] **TC-019** [P0] Hồ sơ đã chuẩn hoá: form hiển thị giá trị lấy từ cột
- [ ] **TC-020** [P0] Hồ sơ chưa chuẩn hoá: form vẫn hiển thị dữ liệu cũ nhờ cơ chế dự phòng
- [ ] **TC-021** [P0] Cột và dữ liệu cũ khác nhau: cột là nguồn hiển thị
- [ ] **TC-022** [P0] Sửa giá trị trên form: cột được cập nhật
- [ ] **TC-024** [P0] Xoá trắng một ô đã có dữ liệu: giá trị cũ không tự sống lại
- [ ] **TC-025** [P0] Mở rồi lưu lại mà không sửa gì: hồ sơ không tự biến đổi
- [ ] **TC-026** [P0] Sửa hai lần liên tiếp: giá trị không quay ngược về bản hệ cũ
- [ ] **TC-027** [P0] Trường đã lên form chính không xuất hiện lần nữa ở khu dữ liệu hệ cũ
- [ ] **TC-030** [P0] E2E: điều tra viên mở hồ sơ đã di trú, sửa một thông tin và thấy kết quả bền vững
- [ ] **TC-031** [P0] Nhập thiệt hại ở tab Thông tin: tab Thống kê hiện đúng số ngay
- [ ] **TC-032** [P0] Nhập thiệt hại ở tab Thống kê: tab Thông tin hiện đúng số (chiều ngược lại)
- [ ] **TC-033** [P0] Số bị hại đồng bộ hai chiều giữa hai tab
- [ ] **TC-034** [P0] Vụ chưa từng có số liệu thống kê: nhập thiệt hại lần đầu vẫn thành công
- [ ] **TC-035** [P0] Vụ đã có số liệu: cập nhật chứ không sinh bản ghi thống kê thứ hai
- [ ] **TC-036** [P0] Vụ cũ có thiệt hại trong dữ liệu phụ: hiển thị đúng ở cả hai tab
- [ ] **TC-037** [P0] Hai nguồn thiệt hại cũ mâu thuẫn: hệ thống không trưng ra hai con số khác nhau
- [ ] **TC-042** [P0] Thiệt hại nhập bằng chữ 'không rõ': từ chối, không bịa số 0
- [ ] **TC-046** [P0] Xoá trắng thiệt hại: cả hai tab cùng trống, không còn số cũ ở tab kia
- [ ] **TC-047** [P0] Màn hình tổng hợp/báo cáo lấy số liệu cùng nguồn với form
- [ ] **TC-048** [P0] E2E: cán bộ thống kê nhập thiệt hại và số bị hại, kiểm chứng khớp trên tab Thống kê
- [ ] **TC-049** [P0] Ngày sinh đầy đủ: lưu kiểu ngày, độ chính xác không bị đánh dấu là chỉ-năm
- [ ] **TC-050** [P0] Dữ liệu cũ chỉ có năm sinh: lưu ngày 01/01 kèm cờ đánh dấu chỉ-năm
- [ ] **TC-053** [P0] Vòng đi-về: mở hồ sơ chỉ-năm rồi lưu lại không sửa gì, vẫn là chỉ-năm
- [ ] **TC-055** [P0] Ngày không tồn tại (31/02): từ chối, không tự nắn về ngày khác
- [ ] **TC-056** [P0] Giá trị rác dạng mốc thời gian gốc (01/01/1970): không nhận là ngày sinh
- [ ] **TC-058** [P0] Ngày không kèm giờ không bị lệch một ngày khi lưu và đọc lại
- [ ] **TC-059** [P0] Các trường ngày khác cũng không lệch: ngày tiếp nhận, ngày cấp CCCD, ngày phiếu chuyển
- [ ] **TC-061** [P0] Kiểm đếm đầy đủ: cả 22 trường hệ cũ đã thăng đều có ô trên form và lưu được vào cột
- [ ] **TC-065** [P0] Nhóm văn bản – phân loại hồ sơ nội bộ, nơi xảy ra, phương thức thủ đoạn, phân loại tội phạm, nghi vấn đối tượng lưu vào cột
- [ ] **TC-073** [P0] Số hồ sơ hệ cũ hiển thị, lưu và tra cứu được
- [ ] **TC-078** [P0] Dữ liệu đề xuất đã có từ trước không bị mất khi form dùng tên mới
- [ ] **TC-080** [P0] Sáu cột mới nhận và trả lại giá trị đầy đủ
- [ ] **TC-083** [P0] Hợp đồng API – trường loại C: gửi lên rồi đọc lại còn nguyên
- [ ] **TC-084** [P0] Hợp đồng API – trường loại S (thống kê): gửi lên rồi đọc lại còn nguyên
- [ ] **TC-085** [P0] Hợp đồng API – trường loại N (cột mới): gửi lên rồi đọc lại còn nguyên
- [ ] **TC-089** [P0] Sửa một trường: các cột khác không bị xoá
- [ ] **TC-090** [P0] Dữ liệu chi tiết trả về đủ cột chuẩn và khối thống kê để giao diện dùng
- [ ] **TC-091** [P0] Bị hại giữ ô riêng, không bị nối vào địa chỉ người tố cáo
- [ ] **TC-092** [P0] Nhập đồng thời bị hại và địa chỉ: hai giá trị độc lập, không lẫn nhau
- [ ] **TC-093** [P0] Nơi xảy ra không bị địa chỉ hành chính ghi đè
- [ ] **TC-097** [P0] Ghi chú nghi vấn đối tượng và danh sách đối tượng có cấu trúc cùng tồn tại
- [ ] **TC-098** [P0] Thêm đối tượng có cấu trúc: ghi chú nghi vấn không bị xoá
- [ ] **TC-099** [P0] Tội danh ban đầu và tội danh phụ là hai ô khác nhau
- [ ] **TC-100** [P0] Đặt tội danh ban đầu: tội danh phụ không thay đổi
- [ ] **TC-101** [P0] Cán bộ thụ lý (liên kết người dùng) và điều tra viên hệ cũ (tên tự do) cùng tồn tại
- [ ] **TC-102** [P0] Tên điều tra viên hệ cũ không khớp người dùng nào: vẫn hiển thị, không mất
- [ ] **TC-103** [P0] Gán cán bộ thụ lý: tên điều tra viên hệ cũ không bị ghi đè
- [ ] **TC-106** [P0] Chuẩn hoá – cột trống, dữ liệu cũ có giá trị native hợp lệ: ghi vào cột
- [ ] **TC-107** [P0] Chuẩn hoá – cột trống, chỉ có giá trị hệ cũ: ghi vào cột
- [ ] **TC-108** [P0] Chuẩn hoá – có cả hai khoá khác giá trị: ưu tiên khoá native
- [ ] **TC-109** [P0] Chuẩn hoá – giá trị không phân tích được: cột để trống và ghi vào danh sách từ chối
- [ ] **TC-111** [P0] Chuẩn hoá – cột đã có giá trị KHÁC dữ liệu cũ: KHÔNG ghi đè, ghi vào danh sách xung đột
- [ ] **TC-114** [P0] Chạy chuẩn hoá lần thứ hai: kết quả không đổi
- [ ] **TC-115** [P0] Không mất dữ liệu: độ phủ theo SỐ HỒ SƠ cho từng cột đạt yêu cầu
- [ ] **TC-116** [P0] Danh sách xung đột đọc được và đủ thông tin để rà soát
- [ ] **TC-117** [P0] Danh sách từ chối đọc được và giải thích được lý do
- [ ] **TC-118** [P0] Đối chiếu tuyên bố của kế hoạch với thực tế: số hồ sơ chuẩn hoá, số xung đột, số từ chối
- [ ] **TC-119** [P0] Chuẩn hoá thiệt hại/bị hại: tạo bản ghi thống kê khi thiếu, cập nhật khi đã có
- [ ] **TC-120** [P0] Sau chuẩn hoá, dữ liệu gốc hệ cũ vẫn còn trong hệ thống
- [ ] **TC-121** [P0] Có bản sao lưu trước khi chạy chuẩn hoá
- [ ] **TC-122** [P0] Bản ghi bị từ chối vẫn giữ giá trị gốc để xử lý tay
- [ ] **TC-123** [P0] Bảng dữ liệu gốc hệ cũ hiển thị đầy đủ bản gốc của hồ sơ
- [ ] **TC-124** [P0] Số thứ tự và số hồ sơ hệ cũ hiển thị trên màn hình chi tiết
- [ ] **TC-125** [P0] Sau khi thăng trường lên form chính, bảng gốc không bị rỗng đi
- [ ] **TC-127** [P0] Trường đã thăng không xuất hiện lần hai như ô nhập ở khu bổ sung
- [ ] **TC-129** [P0] Sửa trường trên form chính: bản gốc trong bảng dữ liệu gốc KHÔNG đổi theo
- [ ] **TC-130** [P0] E2E: đối chiếu hồ sơ di trú — bản gốc, cột chuẩn và ô trên màn hình khớp nhau
- [ ] **TC-139** [P0] Quét toàn form: không còn cặp ô trùng nghĩa nào trong 8 cặp đã gộp
- [ ] **TC-142** [P0] Lưu thành công và lưu thất bại đều có phản hồi rõ ràng
- [ ] **TC-147** [P0] Tìm hồ sơ theo tên người tố cáo
- [ ] **TC-148** [P0] Tìm hồ sơ theo số CCCD
- [ ] **TC-149** [P0] Tìm hồ sơ theo số thứ tự hoặc số hồ sơ hệ cũ
- [ ] **TC-151** [P0] Hồ sơ chưa chuẩn hoá vẫn tìm thấy nhờ cơ chế dự phòng
- [ ] **TC-153** [P0] Từ khoá chứa ký tự đặc biệt và dấu tiếng Việt: an toàn, không lộ lỗi hệ thống
- [ ] **TC-155** [P0] Người dùng ngoài phạm vi không đọc được hồ sơ qua đường dẫn trực tiếp
- [ ] **TC-156** [P0] Tìm kiếm không trả hồ sơ ngoài phạm vi dữ liệu
- [ ] **TC-157** [P0] Trường dữ liệu cá nhân mới không lộ cho vai trò không được phép
- [ ] **TC-158** [P0] Không có phiên đăng nhập hợp lệ: bị từ chối, không rò dữ liệu
- [ ] **TC-159** [P0] Vai trò chỉ đọc không sửa được cột chuẩn
- [ ] **TC-160** [P0] Nội dung tấn công nhập vào ô văn bản mới: lưu an toàn, không thực thi khi hiển thị
- [ ] **TC-162** [P0] Nhật ký thay đổi vẫn ghi nhận đúng sau khi đổi nơi lưu dữ liệu
- [ ] **TC-163** [P0] Form Đơn thư: mỗi khái niệm chỉ một ô, không còn cặp trùng nghĩa
- [ ] **TC-164** [P0] Trường thông tin người gửi đơn lưu và đọc lại đúng
- [ ] **TC-166** [P0] Đơn thư: tội danh ban đầu và tội danh chính là hai trường độc lập
- [ ] **TC-167** [P0] Tạo Đơn thư mới: đọc lại đủ mọi trường vừa nhập
- [ ] **TC-168** [P0] Sửa Đơn thư đã di trú: không mất trường hệ cũ
- [ ] **TC-172** [P0] E2E: tiếp nhận trọn một Đơn thư qua giao diện và mở lại kiểm chứng
- [ ] **TC-173** [P0] Mở vụ việc đang ở giai đoạn Tiếp nhận: đúng phần giai đoạn đó tự mở
- [ ] **TC-174** [P0] Mở vụ việc đang ở giai đoạn Xác minh: đúng phần giai đoạn đó tự mở
- [ ] **TC-175** [P0] Mở vụ việc đang ở giai đoạn Kết quả: đúng phần giai đoạn đó tự mở
- [ ] **TC-178** [P0] Tạo vụ việc mới: không lỗi do chưa có trạng thái
- [ ] **TC-180** [P0] E2E: mở vụ việc đang xác minh, sửa và lưu trong đúng phần giai đoạn
- [ ] **TC-181** [P0] Tích hợp: chuyển Đơn thư thành Vụ việc — thông tin người và nội dung không mất
- [ ] **TC-182** [P0] Tích hợp: chuyển Đơn thư thành Vụ án — giá trị vào đúng ô chuẩn
- [ ] **TC-183** [P0] Tích hợp trọn vòng: Đơn thư → Vụ việc → Vụ án → Thống kê → Truy nguyên trong một phiên
- [ ] **TC-184** [P0] Tích hợp: thiệt hại nhập ở Vụ án hiện đúng trên màn hình tổng hợp toàn hệ thống
- [ ] **TC-185** [P0] Tích hợp: từ tìm kiếm theo số hệ cũ đến đối chiếu bản gốc
- [ ] **TC-186** [P0] Tích hợp đa vai: cán bộ tạo, điều tra viên sửa, lãnh đạo xem — không ai thấy dữ liệu lệch
- [ ] **TC-187** [P0] Hồi quy: danh sách, phân trang và bộ lọc sẵn có vẫn hoạt động
- [ ] **TC-188** [P0] Hồi quy: in và xuất chứng từ lấy đúng giá trị sau khi đổi nơi lưu
- [ ] **TC-191** [P0] Quan hệ biến đổi: sửa rồi sửa ngược lại thì hồ sơ trở về trạng thái ban đầu
- [ ] **TC-192** [P0] Kiểm tra nhanh sau triển khai: hệ thống sống, đăng nhập được, ba biểu mở được
- [ ] **TC-196** [P0] Nghi vấn DRIFT-1: hai ô cùng ghi một cột — xác định ô nào thắng khi giá trị khác nhau
- [ ] **TC-197** [P0] Nghi vấn DRIFT-2: năm sinh hệ cũ và ngày sinh có còn là hai ô riêng không
- [ ] **TC-198** [P0] Nghi vấn DRIFT-3: nguồn thiệt hại thứ ba có còn đọc dữ liệu phụ không
- [ ] **TC-007** [P1] Tạo vụ án mới: phân loại vụ án lưu vào cột mới `caseClassification`
- [ ] **TC-008** [P1] Tạo vụ án mới: tình trạng lưu vào cột mới `tinhTrang`
- [ ] **TC-014** [P1] Tạo vụ án chỉ với thông tin tối thiểu: không lỗi hệ thống, không sinh dữ liệu rác
- [ ] **TC-015** [P1] Gửi trường không được khai báo: hệ thống phản ứng có kiểm soát, không nuốt im lặng
- [ ] **TC-016** [P1] Lưu hai lần cùng nội dung: không nhân đôi bản ghi thống kê
- [ ] **TC-023** [P1] Sửa hồ sơ: đo xem có phát sinh khoá dữ liệu phụ mới cho khái niệm đã chuyển lên cột
- [ ] **TC-028** [P1] Hai phiên cùng sửa một hồ sơ: không mất thay đổi âm thầm
- [ ] **TC-038** [P1] Biên: thiệt hại bằng 0 được chấp nhận và phân biệt với bỏ trống
- [ ] **TC-039** [P1] Biên âm: thiệt hại số âm bị từ chối, không lưu
- [ ] **TC-040** [P1] Biên lớn: thiệt hại rất lớn lưu chính xác, không tràn không làm tròn
- [ ] **TC-041** [P1] Thiệt hại nhập kèm ký tự tiền tệ: hoặc hiểu đúng, hoặc từ chối rõ — không lưu sai thầm lặng
- [ ] **TC-045** [P1] Số bị hại âm hoặc lẻ: bị từ chối
- [ ] **TC-051** [P1] Hiển thị ngày sinh chỉ-năm: giao diện không khẳng định ngày 01/01 là thật
- [ ] **TC-052** [P1] Cờ độ chính xác nằm ở cột, không phải trong khối dữ liệu phụ
- [ ] **TC-054** [P1] Chuyển từ chỉ-năm sang ngày đầy đủ: cờ độ chính xác được nâng cấp
- [ ] **TC-057** [P1] Ngày sinh ở tương lai: bị chặn hoặc cảnh báo rõ
- [ ] **TC-060** [P1] Năm phi lý trong dữ liệu cũ ('19855', '0000'): từ chối có ghi nhận
- [ ] **TC-062** [P1] Nhóm văn bản – nguồn đơn, phiếu chuyển, nơi cấp CCCD lưu vào cột
- [ ] **TC-063** [P1] Nhóm văn bản – ghi chú trùng đơn, lãnh đạo tố tụng, nhận xét lưu vào cột
- [ ] **TC-064** [P1] Nhóm văn bản – yêu cầu bổ sung, kết quả xử lý khác, đồ vật tài liệu kèm theo lưu vào cột
- [ ] **TC-066** [P1] Nhóm ngày – ngày phiếu chuyển và ngày giao đơn vị giải quyết lưu vào cột đúng ngày
- [ ] **TC-067** [P1] Nhóm ngày – ngày đề xuất và ngày viết đơn lưu vào cột đúng ngày
- [ ] **TC-068** [P1] Nhóm ngày – ngày cấp CCCD lưu vào cột và nằm cạnh số CCCD
- [ ] **TC-069** [P1] Trường đúng/sai – báo cáo Ban giám đốc đặt ở trạng thái 'có'
- [ ] **TC-070** [P1] Trường đúng/sai – đặt lại về 'không' được lưu, không bị coi là bỏ trống
- [ ] **TC-072** [P1] Số thứ tự hệ cũ hiển thị và lưu đúng
- [ ] **TC-074** [P1] Trường văn bản rất dài: lưu đủ hoặc báo giới hạn rõ, không cắt âm thầm
- [ ] **TC-075** [P1] Trường văn bản có ký tự đặc biệt và dấu tiếng Việt: lưu nguyên vẹn
- [ ] **TC-077** [P1] Đề xuất xử lý: chỉ còn MỘT ô, lưu vào cột đề xuất
- [ ] **TC-079** [P1] Điều tra viên hệ cũ hiển thị dưới nhãn tham chiếu, lưu vào cột điều tra viên
- [ ] **TC-081** [P1] Cột mới nhận giá trị sai kiểu: phản ứng có kiểm soát, không phá dữ liệu
- [ ] **TC-086** [P1] Hợp đồng API – trường loại R (tên đã thống nhất): gửi lên rồi đọc lại còn nguyên
- [ ] **TC-087** [P1] Gửi tên trường cũ đã bỏ: không lưu nhầm, không gây lỗi máy chủ
- [ ] **TC-088** [P1] Gửi sai kiểu dữ liệu: báo lỗi rõ ràng, không lưu méo, không lỗi máy chủ
- [ ] **TC-094** [P1] Địa chỉ cụ thể trong dữ liệu cũ được gom về ô Nơi xảy ra, không mất
- [ ] **TC-095** [P1] Phương thức thủ đoạn tồn tại như một ô riêng, không bị coi là trùng và bỏ đi
- [ ] **TC-096** [P1] Phân loại tội phạm/lĩnh vực: form chính và tab thống kê cùng một giá trị
- [ ] **TC-104** [P1] Tổ hợp có/không của bị hại × địa chỉ × nơi xảy ra: không tổ hợp nào gây lẫn dữ liệu
- [ ] **TC-105** [P1] Tổ hợp có/không của điều tra viên hệ cũ × cán bộ thụ lý × danh sách đối tượng
- [ ] **TC-110** [P1] Chuẩn hoá – cột đã có giá trị GIỐNG dữ liệu cũ: giữ nguyên, không báo xung đột
- [ ] **TC-113** [P1] Chuẩn hoá – nguồn là chuỗi rỗng hoặc khoảng trắng: coi như không có
- [ ] **TC-126** [P1] Trường hệ cũ không thăng (đuôi dài) vẫn xem và sửa được
- [ ] **TC-131** [P1] Cụm Định danh và tiếp nhận đứng đầu form và gom đủ nhóm trường
- [ ] **TC-132** [P1] Mọi trường về con người nằm trong MỘT cụm chủ thể
- [ ] **TC-133** [P1] Số CCCD, ngày cấp và nơi cấp nằm liền kề nhau
- [ ] **TC-135** [P1] Tội danh chính, tội danh ban đầu và tội danh phụ đứng liền nhau
- [ ] **TC-137** [P1] Cụm Kết quả và giai đoạn sau đứng SAU cụm tiếp nhận, không đảo trình tự tố tụng
- [ ] **TC-140** [P1] Nhãn mỗi ô đúng như kế hoạch quy định
- [ ] **TC-143** [P1] Thông báo lỗi chỉ đúng ô sai và diễn đạt hiểu được
- [ ] **TC-144** [P1] Mọi ô mới có nhãn liên kết đúng cho công nghệ trợ giúp
- [ ] **TC-150** [P1] Tìm hồ sơ theo nơi xảy ra
- [ ] **TC-161** [P1] Danh sách xung đột và từ chối không lộ qua đường dẫn công khai
- [ ] **TC-165** [P1] Khu trường hệ cũ của Đơn thư không lặp lại ô đã có ở form chính
- [ ] **TC-169** [P1] Tìm Đơn thư theo số hồ sơ hệ cũ
- [ ] **TC-170** [P1] Bỏ trống trường bắt buộc của Đơn thư: báo rõ, không mất dữ liệu đã nhập
- [ ] **TC-171** [P1] Bảng dữ liệu gốc của Đơn thư còn nguyên
- [ ] **TC-176** [P1] Mở vụ việc đang Tạm đình chỉ: đúng phần giai đoạn đó tự mở
- [ ] **TC-177** [P1] Vụ việc có trạng thái rỗng hoặc lạ: không lỗi, mặc định hợp lý
- [ ] **TC-179** [P1] Form Vụ việc: mỗi khái niệm một ô, khu trường hệ cũ không trùng
- [ ] **TC-189** [P1] Hồi quy: bảng chỉ tiêu và biểu đồ không sai lệch sau hợp nhất
- [ ] **TC-190** [P1] Quan hệ biến đổi: thêm điều kiện lọc thì tập kết quả phải thu hẹp
- [ ] **TC-194** [P1] Hai người sửa hai hồ sơ khác nhau cùng lúc: dữ liệu không lẫn
- [ ] **TC-195** [P1] Dữ liệu nhập trong phiên vẫn đúng sau khi đăng xuất và đăng nhập lại
- [ ] **TC-029** [P2] Dữ liệu cũ là chuỗi rỗng: hiển thị trống, không coi là giá trị
- [ ] **TC-043** [P2] Biên: số bị hại bằng 0 phân biệt với bỏ trống
- [ ] **TC-044** [P2] Biên: số bị hại bằng 1 (giá trị nhỏ nhất có ý nghĩa)
- [ ] **TC-071** [P2] Trường đúng/sai – chưa từng đặt: phân biệt với 'không'
- [ ] **TC-076** [P2] Trường văn bản chỉ chứa khoảng trắng: coi như bỏ trống, không ghi rác vào cột
- [ ] **TC-082** [P2] Miền giá trị của phân loại và tình trạng: ghi nhận khoảng trống trong yêu cầu
- [ ] **TC-112** [P2] Chuẩn hoá – không có dữ liệu nguồn: không làm gì
- [ ] **TC-128** [P2] Giá trị ngày trong bảng gốc hiển thị dạng người đọc được
- [ ] **TC-134** [P2] Cụm Sự việc và địa điểm gom đủ tiêu đề, mô tả, phương thức, nơi xảy ra, mốc thời gian
- [ ] **TC-136** [P2] Cụm Phân công gom cán bộ thụ lý, điều tra viên hệ cũ, đơn vị, lãnh đạo, hạn xử lý
- [ ] **TC-138** [P2] Cụm Thống kê và di trú nằm cuối
- [ ] **TC-141** [P2] Trường bắt buộc nằm đầu mỗi cụm
- [ ] **TC-145** [P2] Điều hướng bàn phím đi theo đúng trình tự cụm A đến G
- [ ] **TC-146** [P2] Quét tiếp cận tự động trên form Vụ án
- [ ] **TC-152** [P2] Từ khoá không tồn tại: không kết quả, không lỗi
- [ ] **TC-154** [P2] Hiệu năng tìm kiếm theo cột mới trên dữ liệu thật
- [ ] **TC-193** [P2] Tải danh sách trên khối dữ liệu di trú thật: không lỗi, thời gian chấp nhận được

---

_Generated by `uat-test-writer` skill on 23/08/2026 14:02_