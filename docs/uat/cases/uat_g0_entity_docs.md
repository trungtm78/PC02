# UAT Test Cases — g0_entity_docs

**Generated**: 07/06/2026 23:12  
**Complexity**: `complex`  
**Total TC**: 320  
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

**Tổng số TC**: 320

**Phân bố loại**:
- `RED`: 128
- `GREEN`: 35
- `SECURITY`: 32
- `BOUNDARY`: 27
- `EP`: 21
- `A11Y`: 17
- `COMPAT`: 17
- `PERFORMANCE`: 10
- `STATE`: 8
- `DECISION`: 8
- `DATA`: 6
- `RECOVERY`: 4
- `EDGE`: 4
- `REGRESSION`: 3

**Phân bố priority**:
- 🔴 `P0`: 149
- 🟠 `P1`: 146
- 🟡 `P2`: 25

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 140
- ⚠️ `High`: 106
- ⚡ `Medium`: 59
- 📌 `Low`: 15

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Mo form upload khi nhan Tai len tai lieu | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Upload 1 file PDF hop le - xuat hien trong danh sach | 🚨 Critical |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Upload 2 file cung luc - ca 2 xuat hien (1)(2) | 🚨 Critical |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Upload 3 file - progress counter chinh xac | ⚠️ High |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Nhan Huy - form dong, queue xoa sach | 🚨 Critical |
| [TC-006](#tc-006) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Mo lai form sau Huy - sach hoan toan | 🚨 Critical |
| [TC-007](#tc-007) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Toggle button dong form - queue bi xoa | ⚠️ High |
| [TC-011](#tc-011) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Chon thu muc - tat ca file vao queue | 🚨 Critical |
| [TC-013](#tc-013) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Upload tu Case - gan caseId | 🚨 Critical |
| [TC-014](#tc-014) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Upload tu Incident - gan incidentId | 🚨 Critical |
| [TC-015](#tc-015) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | Guard message - petition chua luu | ⚠️ High |
| [TC-016](#tc-016) | 🔴 P0 | `RED` | Validation & Auth & Error | Upload khong tieu de - loi FE | 🚨 Critical |
| [TC-017](#tc-017) | 🔴 P0 | `RED` | Validation & Auth & Error | Upload khong chon file - loi FE | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `RED` | Validation & Auth & Error | Upload file EXE - reject MIME | 🚨 Critical |
| [TC-019](#tc-019) | 🔴 P0 | `RED` | Validation & Auth & Error | Upload file >10MB - reject size | 🚨 Critical |
| [TC-020](#tc-020) | 🔴 P0 | `RED` | Validation & Auth & Error | Upload file PDF gia mao EXE content - magic-byte fail | 🚨 Critical |
| [TC-021](#tc-021) | 🔴 P0 | `RED` | Validation & Auth & Error | 1 file fail trong batch - file con lai van upload | 🚨 Critical |
| [TC-022](#tc-022) | 🔴 P0 | `RED` | Validation & Auth & Error | Tat ca file fail - form khong dong | ⚠️ High |
| [TC-023](#tc-023) | 🔴 P0 | `RED` | Validation & Auth & Error | Upload khong JWT - 401 | 🚨 Critical |
| [TC-024](#tc-024) | 🔴 P0 | `RED` | Validation & Auth & Error | Upload HTML gia PDF - magic-byte fail | 🚨 Critical |
| [TC-031](#tc-031) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | IDOR - upload document vao petition cua user khac | 🚨 Critical |
| [TC-032](#tc-032) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | IDOR - doc GET cua user khac | 🚨 Critical |
| [TC-033](#tc-033) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | IDOR - DELETE doc cua user khac | 🚨 Critical |
| [TC-034](#tc-034) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | XSS trong title - render HTML escaping | 🚨 Critical |
| [TC-035](#tc-035) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | XSS trong description - render escaping | 🚨 Critical |
| [TC-036](#tc-036) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | Path traversal trong filename - ../etc/passwd | 🚨 Critical |
| [TC-037](#tc-037) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SQL Injection trong title parameter | 🚨 Critical |
| [TC-038](#tc-038) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | JWT cu da het han - 401 | 🚨 Critical |
| [TC-039](#tc-039) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | JWT tampered signature - reject | 🚨 Critical |
| [TC-040](#tc-040) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | Throttle - 11 upload trong 60s - request 11 bi block | 🚨 Critical |
| [TC-041](#tc-041) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | Upload file PHP script - reject MIME | 🚨 Critical |
| [TC-045](#tc-045) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | Content-Type header giong allowed nhung magic bytes khac | 🚨 Critical |
| [TC-046](#tc-046) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - file size = 0 bytes | 🚨 Critical |
| [TC-047](#tc-047) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - file size = 10MB chinh xac | 🚨 Critical |
| [TC-048](#tc-048) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - file size = 10MB + 1 byte | 🚨 Critical |
| [TC-052](#tc-052) | 🔴 P0 | `EP` | Equivalence Partition | EP - file PDF (application/pdf) - valid MIME | 🚨 Critical |
| [TC-056](#tc-056) | 🔴 P0 | `EP` | Equivalence Partition | EP - file application/x-python (.py) - invalid | ⚠️ High |
| [TC-057](#tc-057) | 🔴 P0 | `EP` | Equivalence Partition | EP - file text/html (.html) - invalid | ⚠️ High |
| [TC-061](#tc-061) | 🔴 P0 | `STATE` | State Transition | STATE - form hidden -> open -> upload -> success | 🚨 Critical |
| [TC-062](#tc-062) | 🔴 P0 | `STATE` | State Transition | STATE - form open -> cancel -> hidden | ⚠️ High |
| [TC-063](#tc-063) | 🔴 P0 | `STATE` | State Transition | STATE - uploading disabled button | 🚨 Critical |
| [TC-064](#tc-064) | 🔴 P0 | `STATE` | State Transition | STATE - upload thanh cong -> fetch docs moi | 🚨 Critical |
| [TC-065](#tc-065) | 🔴 P0 | `STATE` | State Transition | STATE - upload fail -> form van mo, error hien | 🚨 Critical |
| [TC-066](#tc-066) | 🔴 P0 | `STATE` | State Transition | STATE - partial success -> form dong, error partial | 🚨 Critical |
| [TC-067](#tc-067) | 🔴 P0 | `DECISION` | Decision Table | DECISION - title empty + file co - FE stop | 🚨 Critical |
| [TC-068](#tc-068) | 🔴 P0 | `DECISION` | Decision Table | DECISION - title co + file empty - FE stop | 🚨 Critical |
| [TC-069](#tc-069) | 🔴 P0 | `DECISION` | Decision Table | DECISION - title co + file co + entityId undefined - goi guardMessage | 🚨 Critical |
| [TC-070](#tc-070) | 🔴 P0 | `DECISION` | Decision Table | DECISION - file type allowed + magic bytes match - accept | 🚨 Critical |
| [TC-071](#tc-071) | 🔴 P0 | `DECISION` | Decision Table | DECISION - file type allowed + magic bytes mismatch - reject + cleanup | 🚨 Critical |
| [TC-072](#tc-072) | 🔴 P0 | `DECISION` | Decision Table | DECISION - file type text/plain + bat ky noi dung - accept (bypass magic) | ⚠️ High |
| [TC-073](#tc-073) | 🔴 P0 | `DATA` | Data & i18n | DATA - tieu de Unicode tieng Viet co dau | 🚨 Critical |
| [TC-074](#tc-074) | 🔴 P0 | `DATA` | Data & i18n | DATA - filename Unicode tieng Bien ban.pdf | 🚨 Critical |
| [TC-078](#tc-078) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - download document sau upload | 🚨 Critical |
| [TC-079](#tc-079) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - mo document trong tab moi | ⚠️ High |
| [TC-080](#tc-080) | 🔴 P0 | `RED` | Validation & Auth & Error | INTEGRATION - xoa document voi confirm | 🚨 Critical |
| [TC-083](#tc-083) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - upload tren Case, xem tai Case | 🚨 Critical |
| [TC-086](#tc-086) | 🔴 P0 | `RED` | Validation & Auth & Error | INTEGRATION - xoa doc, file vat ly bi xoa khoi disk | ⚠️ High |
| [TC-087](#tc-087) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - refresh page - doc van con | 🚨 Critical |
| [TC-088](#tc-088) | 🔴 P0 | `REGRESSION` | Regression | REGRESSION - upload Enter key khong submit outer form | 🚨 Critical |
| [TC-089](#tc-089) | 🔴 P0 | `REGRESSION` | Regression | REGRESSION - Enter key trong Mo ta khong submit outer form | 🚨 Critical |
| [TC-090](#tc-090) | 🔴 P0 | `REGRESSION` | Regression | REGRESSION - button type=button khong trigger form submit | 🚨 Critical |
| [TC-095](#tc-095) | 🔴 P0 | `A11Y` | Accessibility | A11Y - keyboard navigation: Tab qua cac button, Enter/Space activate | 🚨 Critical |
| [TC-100](#tc-100) | 🔴 P0 | `A11Y` | Accessibility | A11Y - form label dung htmlFor + input id | 🚨 Critical |
| [TC-101](#tc-101) | 🔴 P0 | `COMPAT` | Compatibility | COMPAT - Chrome 120+ (Windows 11): upload thanh cong | 🚨 Critical |
| [TC-113](#tc-113) | 🔴 P0 | `PERFORMANCE` | Hiệu năng | PERF - upload 11 file lien tiep - file thu 11 nhan 429 | 🚨 Critical |
| [TC-121](#tc-121) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload EXE content voi .pdf extension - backend reject | 🚨 Critical |
| [TC-122](#tc-122) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload ZIP content voi .docx extension - backend reject | 🚨 Critical |
| [TC-124](#tc-124) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - missing title (empty string) - 400 | 🚨 Critical |
| [TC-127](#tc-127) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - khong co file trong request - 400 | 🚨 Critical |
| [TC-128](#tc-128) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - file > 10MB - multer reject | 🚨 Critical |
| [TC-129](#tc-129) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - unauth (no token) - 401 | 🚨 Critical |
| [TC-130](#tc-130) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - token het han - 401 | 🚨 Critical |
| [TC-131](#tc-131) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - petitionId khong ton tai - 404 | 🚨 Critical |
| [TC-132](#tc-132) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - caseId thuoc team khac - 403 | 🚨 Critical |
| [TC-133](#tc-133) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - DELETE doc cua nguoi khac (officer khac) - 403 | 🚨 Critical |
| [TC-134](#tc-134) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - GET /documents/:id/download doc cua entity khac scope - 403 | 🚨 Critical |
| [TC-139](#tc-139) | 🔴 P0 | `RECOVERY` | Recovery & Resilience | RECOVERY - 429 throttle - FE hien message that bai, khong crash | 🚨 Critical |
| [TC-145](#tc-145) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | DATA - filename SQL injection attempt - sanitize | 🚨 Critical |
| [TC-146](#tc-146) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SECURITY - IDOR: xem doc list cua petition khac via query param | 🚨 Critical |
| [TC-147](#tc-147) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SECURITY - path traversal trong filename khi download | 🚨 Critical |
| [TC-148](#tc-148) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SECURITY - upload HTML file + XSS payload | 🚨 Critical |
| [TC-149](#tc-149) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SECURITY - Content-Type header spoofing: PDF file voi Content-Type: image/jpeg | 🚨 Critical |
| [TC-154](#tc-154) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | GREEN - download file: Content-Disposition filename encoded | 🚨 Critical |
| [TC-155](#tc-155) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - download soft-deleted doc - 404 | 🚨 Critical |
| [TC-156](#tc-156) | 🔴 P0 | `DECISION` | Decision Table | DECISION - petitionId + caseId cu the trong 1 request - BE reject | 🚨 Critical |
| [TC-157](#tc-157) | 🔴 P0 | `DECISION` | Decision Table | DECISION - doc khong co entityId nao - 400 | 🚨 Critical |
| [TC-158](#tc-158) | 🔴 P0 | `STATE` | State Transition | STATE - queue: xoa file khoi queue bang X button | 🚨 Critical |
| [TC-159](#tc-159) | 🔴 P0 | `STATE` | State Transition | STATE - queue empty sau xoa het → button Tai len disabled | 🚨 Critical |
| [TC-160](#tc-160) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload file MP4 video > 10MB - reject | 🚨 Critical |
| [TC-161](#tc-161) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - file exacty 10MB (10485760 bytes) - accept | 🚨 Critical |
| [TC-162](#tc-162) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - file 10485761 bytes (10MB + 1) - reject | 🚨 Critical |
| [TC-168](#tc-168) | 🔴 P0 | `EP` | Equivalence Partition | EP - MIME group: documents (pdf doc docx xls xlsx) - accept | 🚨 Critical |
| [TC-169](#tc-169) | 🔴 P0 | `EP` | Equivalence Partition | EP - MIME rejected: .zip .rar .bat .exe .php - 400 | 🚨 Critical |
| [TC-170](#tc-170) | 🔴 P0 | `GREEN` | Tải lên tài liệu - Happy path | GREEN - incident upload doc + list + download full flow | 🚨 Critical |
| [TC-172](#tc-172) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload file JFIF (JPEG variant) dat theo .png - magic byte mismatch | 🚨 Critical |
| [TC-173](#tc-173) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload PDF dat theo .xls - magic byte mismatch | 🚨 Critical |
| [TC-174](#tc-174) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload PNG dat theo .mp3 - magic byte mismatch | 🚨 Critical |
| [TC-175](#tc-175) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload .gif dat theo .docx - magic byte mismatch | 🚨 Critical |
| [TC-176](#tc-176) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - multer fileFilter: extension .exe bi reject truoc magic byte check | 🚨 Critical |
| [TC-177](#tc-177) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload file .rar (archive) - reject | 🚨 Critical |
| [TC-178](#tc-178) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload file .bat (script) - reject | 🚨 Critical |
| [TC-179](#tc-179) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload file .svg (SVG co the co JS) - reject | 🚨 Critical |
| [TC-180](#tc-180) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - JWT tampered (signature invalid) - 401 | 🚨 Critical |
| [TC-181](#tc-181) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - JWT algorithm none attack - 401 | 🚨 Critical |
| [TC-182](#tc-182) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload nhieu file vuot gioi han: 11 file dong thoi trong folder - thu 11 nhan 429 | 🚨 Critical |
| [TC-183](#tc-183) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - form submit voi queue rong (JS bypass) - FE block | 🚨 Critical |
| [TC-184](#tc-184) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - petitionId la SQL injection payload - 400 hoac 422 | 🚨 Critical |
| [TC-186](#tc-186) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - caseId + incidentId + petitionId cung luc - 400 | 🚨 Critical |
| [TC-187](#tc-187) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - file name dat PathInfo attack: file.pdf/.php - BE sanitize | 🚨 Critical |
| [TC-188](#tc-188) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload file blank title sau strip (all spaces) - FE reject | 🚨 Critical |
| [TC-190](#tc-190) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - file null content (fake FormData khong co file binary) - 400 | 🚨 Critical |
| [TC-191](#tc-191) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - download bi delete (doc.deletedAt != null) - 404 | 🚨 Critical |
| [TC-193](#tc-193) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - title co HTML tags - luu literal, khong render | 🚨 Critical |
| [TC-198](#tc-198) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - GET /documents theo entityId khong thuoc scope - empty (khong 403) | 🚨 Critical |
| [TC-199](#tc-199) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload voi petitionId hop le + title hop le + sai MIME - 400 | 🚨 Critical |
| [TC-203](#tc-203) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - ROLE VIEWER (read-only) upload doc - 403 | 🚨 Critical |
| [TC-209](#tc-209) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - tai len tu incident scope khi caseId duoc dung - 403 | 🚨 Critical |
| [TC-211](#tc-211) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - DELETE doc ma minhduoc xoa (admin) - khong xoa dc doc cua entity ngoai scope | 🚨 Critical |
| [TC-216](#tc-216) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload khi entityId = empty string - 400 | 🚨 Critical |
| [TC-220](#tc-220) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload response chua truong 'id' cua doc moi - verify response shape | 🚨 Critical |
| [TC-225](#tc-225) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload API tra ve 500 (BE crash) - FE error message khong leak stack | 🚨 Critical |
| [TC-227](#tc-227) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload theo batch: 1 file fail magic check, rest thanh cong | 🚨 Critical |
| [TC-228](#tc-228) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - tai len khi khong co quyen (da dang xuat giua chung) - FE redirect login | 🚨 Critical |
| [TC-230](#tc-230) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload file truoc khi nhap title: FE validate order | 🚨 Critical |
| [TC-232](#tc-232) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - FE: button type submit trong form upload - khong ton tai | 🚨 Critical |
| [TC-233](#tc-233) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - 2 files queue: upload → 2 titles (title, title (2)) | 🚨 Critical |
| [TC-234](#tc-234) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - 10 files queue: titles (1)..(10) | 🚨 Critical |
| [TC-235](#tc-235) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - 1 file queue: title khong co index | 🚨 Critical |
| [TC-255](#tc-255) | 🔴 P0 | `A11Y` | Accessibility | A11Y - upload error co role=alert (screen reader doc ngay) | 🚨 Critical |
| [TC-270](#tc-270) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SECURITY - file scanning: upload eicar test string (vi-rus test) - detect va reject | 🚨 Critical |
| [TC-272](#tc-272) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SECURITY - upload doc chi de test SSRF via filename URL | 🚨 Critical |
| [TC-280](#tc-280) | 🔴 P0 | `SECURITY` | Bảo mật & IDOR | SECURITY - download file: Content-Type phai match file content | 🚨 Critical |
| [TC-283](#tc-283) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload qua API voi Content-Type sai (application/json) - 400 | 🚨 Critical |
| [TC-288](#tc-288) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload 3 files, ca 3 fail - form van mo, loi hien ro | 🚨 Critical |
| [TC-289](#tc-289) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload voi session bi revoke (server-side logout) - 401 | 🚨 Critical |
| [TC-290](#tc-290) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - file input 'accept' attribute bi bo qua boi user (bypass FE filter) - BE nhan | 🚨 Critical |
| [TC-292](#tc-292) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload doc co file path chua null bytes (path injection) - BE reject | 🚨 Critical |
| [TC-293](#tc-293) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - incident-type officer upload voi petitionId - 403 | 🚨 Critical |
| [TC-295](#tc-295) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload tren HTTPS (production) - file va request an toan | 🚨 Critical |
| [TC-296](#tc-296) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - FE upload form: sau thanh cong, title va docType reset | 🚨 Critical |
| [TC-298](#tc-298) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - nhan Tai len 2 lan nhanh (double click) - khong double-upload | 🚨 Critical |
| [TC-301](#tc-301) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload khi session cookie bi stolen va dung tu IP khac - 401 | 🚨 Critical |
| [TC-302](#tc-302) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - download voi forged token (another user ID but valid sig) - 403 | 🚨 Critical |
| [TC-303](#tc-303) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - upload voi incidentId la cuid hợp le nhung incident thuoc team khac - 403 | 🚨 Critical |
| [TC-304](#tc-304) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - multipart boundary attack: boundary string la XSS payload | 🚨 Critical |
| [TC-312](#tc-312) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - FE: chon file > 10MB - hien error truoc khi upload (client-side check) | 🚨 Critical |
| [TC-313](#tc-313) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - multiple errors: 2 files fail voi 2 errors khac nhau | 🚨 Critical |
| [TC-315](#tc-315) | 🔴 P0 | `RED` | Validation & Auth & Error | RED - FE: reset file input refs sau cancel (stale ref fix) | 🚨 Critical |
| [TC-317](#tc-317) | 🔴 P0 | `BOUNDARY` | Boundary Values | BOUNDARY - 3 files: tren dung gioi han throttle (request 8,9,10 trong 60s) | 🚨 Critical |
| [TC-008](#tc-008) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | Upload JPEG - Hinh anh | ⚠️ High |
| [TC-009](#tc-009) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | Upload DOCX hop le | ⚠️ High |
| [TC-010](#tc-010) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | Upload TXT bypass magic-byte | ⚡ Medium |
| [TC-012](#tc-012) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | Xoa file trong queue bang nut X | ⚠️ High |
| [TC-025](#tc-025) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | Upload PNG hop le | ⚡ Medium |
| [TC-026](#tc-026) | 🟠 P1 | `RED` | Validation & Auth & Error | Upload ZIP - reject | ⚠️ High |
| [TC-027](#tc-027) | 🟠 P1 | `RED` | Validation & Auth & Error | Deduplication - cung file 2 lan chi 1 trong queue | ⚠️ High |
| [TC-028](#tc-028) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | Gop file tu 2 nguon - Chon file + Chon thu muc | ⚡ Medium |
| [TC-029](#tc-029) | 🟠 P1 | `RED` | Validation & Auth & Error | Tieu de whitespace-only - loi | ⚠️ High |
| [TC-042](#tc-042) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | Upload file SVG co XSS - reject | ⚠️ High |
| [TC-043](#tc-043) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | approver1 role khong co quyen upload - FE guard | ⚠️ High |
| [TC-044](#tc-044) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | Download - user khong co quyen read | ⚠️ High |
| [TC-049](#tc-049) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - title length = 1 char | ⚡ Medium |
| [TC-050](#tc-050) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - title length = 255 chars | ⚡ Medium |
| [TC-051](#tc-051) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - title length = 256 chars - kiem tra DB constraint | ⚡ Medium |
| [TC-053](#tc-053) | 🟠 P1 | `EP` | Equivalence Partition | EP - file application/msword (.doc) | ⚡ Medium |
| [TC-054](#tc-054) | 🟠 P1 | `EP` | Equivalence Partition | EP - file image/gif (.gif) | ⚡ Medium |
| [TC-055](#tc-055) | 🟠 P1 | `EP` | Equivalence Partition | EP - file audio/mpeg (.mp3) | ⚡ Medium |
| [TC-058](#tc-058) | 🟠 P1 | `EP` | Equivalence Partition | EP - file image/webp (.webp) - invalid | ⚡ Medium |
| [TC-059](#tc-059) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - queue size 1 file | ⚡ Medium |
| [TC-060](#tc-060) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - xoa tat ca file trong queue roi upload | ⚠️ High |
| [TC-075](#tc-075) | 🟠 P1 | `DATA` | Data & i18n | DATA - tieu de special chars <>?#% | ⚠️ High |
| [TC-076](#tc-076) | 🟠 P1 | `DATA` | Data & i18n | DATA - mo ta 500 ky tu Unicode | ⚡ Medium |
| [TC-081](#tc-081) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - huy xoa document | ⚠️ High |
| [TC-082](#tc-082) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - list docs pagination limit 100 | ⚡ Medium |
| [TC-084](#tc-084) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - upload audit log ghi nhan | ⚠️ High |
| [TC-085](#tc-085) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | INTEGRATION - download audit log ghi nhan | ⚡ Medium |
| [TC-091](#tc-091) | 🟠 P1 | `A11Y` | Accessibility | A11Y - nut Tai len tai lieu co aria-label | ⚡ Medium |
| [TC-092](#tc-092) | 🟠 P1 | `A11Y` | Accessibility | A11Y - nut Huy co accessible label | ⚡ Medium |
| [TC-094](#tc-094) | 🟠 P1 | `A11Y` | Accessibility | A11Y - error message lien ket voi field bang aria-describedby | ⚠️ High |
| [TC-096](#tc-096) | 🟠 P1 | `A11Y` | Accessibility | A11Y - focus visible tren tat ca interactive elements | ⚠️ High |
| [TC-097](#tc-097) | 🟠 P1 | `A11Y` | Accessibility | A11Y - progress indicator co aria-live khi uploading | ⚡ Medium |
| [TC-098](#tc-098) | 🟠 P1 | `A11Y` | Accessibility | A11Y - color contrast tren button chu khi disabled | ⚡ Medium |
| [TC-099](#tc-099) | 🟠 P1 | `A11Y` | Accessibility | A11Y - file remove button ('x') co aria-label voi ten file | ⚠️ High |
| [TC-102](#tc-102) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - Edge (Chromium, latest): upload + folder select | ⚠️ High |
| [TC-103](#tc-103) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - Firefox (latest): webkitdirectory fallback | ⚠️ High |
| [TC-104](#tc-104) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - Safari (macOS, latest): file input multiple | ⚠️ High |
| [TC-105](#tc-105) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - mobile Chrome (Android 13): tap upload | ⚠️ High |
| [TC-106](#tc-106) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - mobile Safari (iOS 16+): upload PDF tu Files app | ⚠️ High |
| [TC-107](#tc-107) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - screen resolution 1366x768: form khong bi overflow | ⚡ Medium |
| [TC-109](#tc-109) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - zoom 200%: form van usable | ⚡ Medium |
| [TC-111](#tc-111) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - upload 1 file PDF 10MB < 30s tren mang binh thuong | ⚠️ High |
| [TC-112](#tc-112) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - upload 10 file nho (1KB) trong 60 giay khong bi throttle | ⚠️ High |
| [TC-114](#tc-114) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - GET /documents list 100 items - response < 1s | ⚡ Medium |
| [TC-115](#tc-115) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - concurrent 5 user upload cung 1 luc - khong deadlock | ⚠️ High |
| [TC-117](#tc-117) | 🟠 P1 | `EDGE` | Edge Cases | EDGE - upload file co ten trung voi file da co trong list | ⚡ Medium |
| [TC-118](#tc-118) | 🟠 P1 | `EDGE` | Edge Cases | EDGE - folder co subfolder - chi flat file, bo qua subfolder | ⚡ Medium |
| [TC-119](#tc-119) | 🟠 P1 | `EDGE` | Edge Cases | EDGE - file 0 byte - FE hoac BE reject | ⚠️ High |
| [TC-120](#tc-120) | 🟠 P1 | `EDGE` | Edge Cases | EDGE - 2 file trung ten trong 1 queue - tu dong dedup | ⚡ Medium |
| [TC-123](#tc-123) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload PHP script voi .txt extension - accept (MAGIC_BYTE_BYPASS) | ⚠️ High |
| [TC-125](#tc-125) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - title qua dai (>500 ky tu) - 400 | ⚠️ High |
| [TC-126](#tc-126) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - documentType sai enum value - 400 | ⚠️ High |
| [TC-135](#tc-135) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - dong thoi upload 2 file cung ten (race condition) - 1 thanh cong | ⚠️ High |
| [TC-136](#tc-136) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - DB down khi upload - 500 + file cleanup | ⚠️ High |
| [TC-137](#tc-137) | 🟠 P1 | `RECOVERY` | Recovery & Resilience | RECOVERY - upload fail (network cut) - form van mo, co the retry | ⚠️ High |
| [TC-138](#tc-138) | 🟠 P1 | `RECOVERY` | Recovery & Resilience | RECOVERY - refresh trang giua chung upload - khong co orphan file | ⚠️ High |
| [TC-140](#tc-140) | 🟠 P1 | `RECOVERY` | Recovery & Resilience | RECOVERY - session expire khi dang upload - redirect login | ⚠️ High |
| [TC-141](#tc-141) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | AUDIT - upload ghi nhan entityType + entityId | ⚠️ High |
| [TC-142](#tc-142) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | AUDIT - download ghi nhan documentId + ip | ⚡ Medium |
| [TC-143](#tc-143) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | AUDIT - xoa ghi nhan soft-delete + deletedBy | ⚠️ High |
| [TC-144](#tc-144) | 🟠 P1 | `DATA` | Data & i18n | DATA - mimeType khong hop le trong FormData - BE validate accept | ⚠️ High |
| [TC-150](#tc-150) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | SECURITY - CSRF: POST /documents tu origin khac - reject | ⚠️ High |
| [TC-151](#tc-151) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | GREEN - delete document: soft delete, van query duoc boi admin | ⚡ Medium |
| [TC-152](#tc-152) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | GREEN - file doc type HINH_ANH (image) - accept + hien thumbnail | ⚡ Medium |
| [TC-153](#tc-153) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | GREEN - file type AM_THANH (MP3) - upload + download | ⚡ Medium |
| [TC-163](#tc-163) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - title 1 ky tu - accept | ⚡ Medium |
| [TC-164](#tc-164) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - title 500 ky tu - accept (max) | ⚡ Medium |
| [TC-165](#tc-165) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - title 501 ky tu - reject | ⚠️ High |
| [TC-166](#tc-166) | 🟠 P1 | `EP` | Equivalence Partition | EP - MIME group: image types (jpg jpeg png gif) - accept | ⚠️ High |
| [TC-167](#tc-167) | 🟠 P1 | `EP` | Equivalence Partition | EP - MIME group: video + audio (mp4 mp3) - accept | ⚡ Medium |
| [TC-171](#tc-171) | 🟠 P1 | `GREEN` | Tải lên tài liệu - Happy path | GREEN - upload report xuat bat dong bo khi co loi mot so file | ⚠️ High |
| [TC-185](#tc-185) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - petitionId la cuid format sai - 400 | ⚠️ High |
| [TC-189](#tc-189) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload voi title only whitespace - BE reject | ⚠️ High |
| [TC-192](#tc-192) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - doc file vat ly bi xoa khoi disk - download 500 hoac 404 | ⚠️ High |
| [TC-194](#tc-194) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - mo ta co Markdown injection - luu literal | ⚠️ High |
| [TC-195](#tc-195) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - concurrent DELETE + GET cung 1 doc - khong 500 | ⚠️ High |
| [TC-196](#tc-196) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - file tren disk bi doi chu so huu (permission denied) - 500 + clean message | ⚠️ High |
| [TC-197](#tc-197) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - disk full khi upload - 500 + clean message | ⚠️ High |
| [TC-200](#tc-200) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload .csv file - reject (khong trong allowed list) | ⚠️ High |
| [TC-201](#tc-201) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload .xml file - reject | ⚠️ High |
| [TC-204](#tc-204) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload multi-file khi 1 file la 0 bytes - skip zero-byte, upload rest | ⚠️ High |
| [TC-205](#tc-205) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload voi description co NUL byte - sanitize hoac reject | ⚠️ High |
| [TC-206](#tc-206) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload voi file la directory pretending to be file - BE reject | ⚠️ High |
| [TC-207](#tc-207) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - petition.status = DANG_XU_LY (active) vs DINH_CHI - upload van duoc phep | ⚠️ High |
| [TC-208](#tc-208) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - concurrent upload + throttle: 10 user khac nhau co the upload cung luc | ⚠️ High |
| [TC-210](#tc-210) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - GET /documents?limit=999 - gioi han toi da 100 | ⚠️ High |
| [TC-212](#tc-212) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload qua 3 file cung luc khi throttle con 3 slot - partial throttle | ⚠️ High |
| [TC-214](#tc-214) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - pagination: skip/limit param injection - BE sanitize | ⚠️ High |
| [TC-215](#tc-215) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload va sau do xoa entity cha (petition) - doc van con hoac cascade | ⚠️ High |
| [TC-217](#tc-217) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - download trong khi stream bi ngat - client giai quyen | ⚠️ High |
| [TC-218](#tc-218) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload multi-part request bi cat dang dung (partial boundary) - BE xu ly | ⚠️ High |
| [TC-219](#tc-219) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload khi petition bi locked boi system (status = DANG_GIAI_QUYET) - 409 | ⚠️ High |
| [TC-222](#tc-222) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload voi Content-Length: 0 trong multipart - BE reject | ⚠️ High |
| [TC-223](#tc-223) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - fetchDocs fail (network) - hien error, khong empty list | ⚠️ High |
| [TC-224](#tc-224) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - fetchDocs 500 server error - hien error toast | ⚠️ High |
| [TC-226](#tc-226) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - caseId khong co dau quotes (UUID v4 format gia) - 404 | ⚡ Medium |
| [TC-229](#tc-229) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - description > 2000 ky tu - BE reject | ⚠️ High |
| [TC-231](#tc-231) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload queue voi file trung lam (dedup) - chi upload 1 lan | ⚠️ High |
| [TC-236](#tc-236) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - file size exactly 1 byte - accept | ⚡ Medium |
| [TC-237](#tc-237) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - file size 10485759 bytes (10MB - 1) - accept | ⚡ Medium |
| [TC-238](#tc-238) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - description exactly 0 chars (empty string) - accept (optional field) | ⚡ Medium |
| [TC-239](#tc-239) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - description exactly 2000 chars - accept | ⚡ Medium |
| [TC-240](#tc-240) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - description exactly 2001 chars - reject | ⚠️ High |
| [TC-242](#tc-242) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - 100 file trong folder - upload 100 files sequentially | ⚠️ High |
| [TC-243](#tc-243) | 🟠 P1 | `EP` | Equivalence Partition | EP - filename co khoang trang - accept | ⚡ Medium |
| [TC-244](#tc-244) | 🟠 P1 | `EP` | Equivalence Partition | EP - filename chi co Unicode - accept | ⚡ Medium |
| [TC-246](#tc-246) | 🟠 P1 | `EP` | Equivalence Partition | EP - filename double extension: report.docx.pdf - accept | ⚡ Medium |
| [TC-247](#tc-247) | 🟠 P1 | `EP` | Equivalence Partition | EP - documentType = KHAC - accept | ⚡ Medium |
| [TC-248](#tc-248) | 🟠 P1 | `EP` | Equivalence Partition | EP - documentType = VIDEO voi file MP4 - accept | ⚡ Medium |
| [TC-249](#tc-249) | 🟠 P1 | `EP` | Equivalence Partition | EP - 3 entity kinds (case/incident/petition) × all doctypes = 15 combos | ⚠️ High |
| [TC-251](#tc-251) | 🟠 P1 | `EP` | Equivalence Partition | EP - folder rong (0 file) - queue empty, khong upload | ⚡ Medium |
| [TC-253](#tc-253) | 🟠 P1 | `A11Y` | Accessibility | A11Y - 'Chon thu muc' button co role button + aria-label | ⚠️ High |
| [TC-254](#tc-254) | 🟠 P1 | `A11Y` | Accessibility | A11Y - progress text thong bao bang aria-live khi upload 3 files | ⚠️ High |
| [TC-257](#tc-257) | 🟠 P1 | `A11Y` | Accessibility | A11Y - form upload co tieu de (heading hoac aria-label) | ⚠️ High |
| [TC-258](#tc-258) | 🟠 P1 | `A11Y` | Accessibility | A11Y - queue list item co nut xoa voi ten file trong accessible name | ⚠️ High |
| [TC-260](#tc-260) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - tablet (iPad 10, iOS 16) landscape mode | ⚠️ High |
| [TC-263](#tc-263) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - Vietnamese IME input cho title (VNI/Telex) | ⚠️ High |
| [TC-264](#tc-264) | 🟠 P1 | `COMPAT` | Compatibility | COMPAT - clipboard paste vao title (Ctrl+V) | ⚡ Medium |
| [TC-267](#tc-267) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - GET /documents tai ba entity cung luc < 2s moi request | ⚡ Medium |
| [TC-268](#tc-268) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - EntityDocumentsTab render < 500ms voi 100 docs | ⚡ Medium |
| [TC-269](#tc-269) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - upload 3 file trong 60s: 3 POST < 5s tong cong | ⚡ Medium |
| [TC-271](#tc-271) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | SECURITY - Content-Security-Policy header trong response | ⚠️ High |
| [TC-273](#tc-273) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | SECURITY - rate limit: 10 failed upload attempts tu 1 IP - block IP sau nguong | ⚠️ High |
| [TC-274](#tc-274) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | SECURITY - response khong lo Content-Type trong error 400 | ⚠️ High |
| [TC-275](#tc-275) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | SECURITY - audit trail: failed upload attempt duoc ghi nhan | ⚠️ High |
| [TC-277](#tc-277) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | SECURITY - X-Content-Type-Options: nosniff tren response | ⚠️ High |
| [TC-278](#tc-278) | 🟠 P1 | `SECURITY` | Bảo mật & IDOR | SECURITY - zip bomb detection: file nen 1KB expand den 10GB | ⚠️ High |
| [TC-281](#tc-281) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload khi DB transaction timeout - 500 + file cleanup | ⚠️ High |
| [TC-282](#tc-282) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload FormData co extra fields (unknown props) - ignore them | ⚡ Medium |
| [TC-284](#tc-284) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload voi petitionId la ObjectID format (Mongo) - 400 hoac 404 | ⚠️ High |
| [TC-285](#tc-285) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload chua co internet connection (offline) - FE error | ⚠️ High |
| [TC-287](#tc-287) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload chay khi trang dang navigate away - huy upload | ⚠️ High |
| [TC-291](#tc-291) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - tam dinh chi upload: ngan hang upload khi BE maintenance mode | ⚠️ High |
| [TC-297](#tc-297) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - folder upload: hidden OS files (.DS_Store) duoc filter hoac rejected | ⚠️ High |
| [TC-299](#tc-299) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - fetch docs sau upload fail - list van hien docs cu | ⚠️ High |
| [TC-305](#tc-305) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload PNG corrupt (broken header) - magic byte fail hoac multer reject | ⚠️ High |
| [TC-306](#tc-306) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload DOCX voi OLE exploit (malformed XML) - accept nhung khong execute | ⚠️ High |
| [TC-307](#tc-307) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload voi X-Forwarded-For spoofed IP - throttle by real IP | ⚠️ High |
| [TC-308](#tc-308) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload voi Content-Disposition attachment trong multipart - ignore | 🚨 Critical |
| [TC-309](#tc-309) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload khi disk space co 1 byte con (edge disk capacity) - fail gracefully | ⚠️ High |
| [TC-310](#tc-310) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - download bi revoke giua chung stream - stream closed cleanly | ⚠️ High |
| [TC-311](#tc-311) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - tai len khi petition co flag 'archived' - 403 hoac 409 | ⚠️ High |
| [TC-314](#tc-314) | 🟠 P1 | `RED` | Validation & Auth & Error | RED - upload khi BE tra ve 503 (service unavailable) - FE retry suggestion | ⚠️ High |
| [TC-316](#tc-316) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - GET /documents?limit=0 - tra ve empty hoac default | ⚡ Medium |
| [TC-319](#tc-319) | 🟠 P1 | `BOUNDARY` | Boundary Values | BOUNDARY - file 10000001 bytes (9.5MB) - accept | ⚡ Medium |
| [TC-320](#tc-320) | 🟠 P1 | `PERFORMANCE` | Hiệu năng | PERF - concurrent 10 downloads cung entity - khong block | ⚠️ High |
| [TC-030](#tc-030) | 🟡 P2 | `GREEN` | Tải lên tài liệu - Happy path | Upload MP4 hop le | ⚡ Medium |
| [TC-077](#tc-077) | 🟡 P2 | `DATA` | Data & i18n | DATA - filename chi co so | 📌 Low |
| [TC-093](#tc-093) | 🟡 P2 | `A11Y` | Accessibility | A11Y - file queue list dung role list | ⚡ Medium |
| [TC-108](#tc-108) | 🟡 P2 | `COMPAT` | Compatibility | COMPAT - dark mode: cac mau van readable | ⚡ Medium |
| [TC-110](#tc-110) | 🟡 P2 | `COMPAT` | Compatibility | COMPAT - Internet Explorer 11: hien thong bao browser cu | 📌 Low |
| [TC-116](#tc-116) | 🟡 P2 | `PERFORMANCE` | Hiệu năng | PERF - upload progress hien dung khi upload lon | ⚡ Medium |
| [TC-202](#tc-202) | 🟡 P2 | `RED` | Validation & Auth & Error | RED - upload form voi duplicate title trong cung petition - duoc phep | ⚡ Medium |
| [TC-213](#tc-213) | 🟡 P2 | `RED` | Validation & Auth & Error | RED - description voi newline characters - luu dung | 📌 Low |
| [TC-221](#tc-221) | 🟡 P2 | `RED` | Validation & Auth & Error | RED - title co emoji (Unicode supplementary) - accept | 📌 Low |
| [TC-241](#tc-241) | 🟡 P2 | `BOUNDARY` | Boundary Values | BOUNDARY - title exactly 1 char - accept | 📌 Low |
| [TC-245](#tc-245) | 🟡 P2 | `EP` | Equivalence Partition | EP - filename dot-file (.gitignore style) - accept | 📌 Low |
| [TC-250](#tc-250) | 🟡 P2 | `EP` | Equivalence Partition | EP - upload PDF sau khi xoa PDF truoc (reuse ten) - accept, new doc | 📌 Low |
| [TC-252](#tc-252) | 🟡 P2 | `EP` | Equivalence Partition | EP - folder chi co hidden files (.DS_Store, Thumbs.db) - queue empty hoac filter | 📌 Low |
| [TC-256](#tc-256) | 🟡 P2 | `A11Y` | Accessibility | A11Y - title input co autocomplete=off (khong tu dong dien data nhay cam) | ⚡ Medium |
| [TC-259](#tc-259) | 🟡 P2 | `A11Y` | Accessibility | A11Y - skip link hoac focus management sau upload thanh cong | ⚡ Medium |
| [TC-261](#tc-261) | 🟡 P2 | `COMPAT` | Compatibility | COMPAT - Chrome 100 (older version support) | ⚡ Medium |
| [TC-262](#tc-262) | 🟡 P2 | `COMPAT` | Compatibility | COMPAT - Windows 10 (different from Win 11): UI tuong thich | 📌 Low |
| [TC-265](#tc-265) | 🟡 P2 | `COMPAT` | Compatibility | COMPAT - print preview khong lam an form upload | 📌 Low |
| [TC-266](#tc-266) | 🟡 P2 | `COMPAT` | Compatibility | COMPAT - drag-and-drop file vao form (neu ho tro) | 📌 Low |
| [TC-276](#tc-276) | 🟡 P2 | `SECURITY` | Bảo mật & IDOR | SECURITY - Referrer-Policy header trong download response | ⚡ Medium |
| [TC-279](#tc-279) | 🟡 P2 | `SECURITY` | Bảo mật & IDOR | SECURITY - Clickjacking prevention: X-Frame-Options header | ⚡ Medium |
| [TC-286](#tc-286) | 🟡 P2 | `RED` | Validation & Auth & Error | RED - download tren HTTPS nhung cert khong hop le - browser warn | 📌 Low |
| [TC-294](#tc-294) | 🟡 P2 | `RED` | Validation & Auth & Error | RED - download voi Range header (partial content) - 200 hoac 206 | 📌 Low |
| [TC-300](#tc-300) | 🟡 P2 | `RED` | Validation & Auth & Error | RED - upload voi Accept-Language header la la - server xu ly binh thuong | 📌 Low |
| [TC-318](#tc-318) | 🟡 P2 | `BOUNDARY` | Boundary Values | BOUNDARY - GET /documents?skip=0&limit=1 - tra ve doc dau tien | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Mo form upload khi nhan Tai len tai lieu

### Điều kiện tiên quyết
- Dang nhap admin, o trang /petitions/:id da luu.

### Các bước kiểm thử
- [ ] Mo /petitions/:id
- [ ] Scroll Tai lieu don thu
- [ ] Nhan Tai len tai lieu

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Form: Tieu de, Loai tai lieu (Van ban default), Mo ta, Chon file, Chon thu muc, Huy, Tai len

**API**:
- Form: Tieu de, Loai tai lieu (Van ban default), Mo ta, Chon file, Chon thu muc, Huy, Tai len

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-002

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload 1 file PDF hop le - xuat hien trong danh sach

### Điều kiện tiên quyết
- Form mo. File PDF hop le magic bytes %PDF.

### Các bước kiểm thử
- [ ] Tieu de: Bien ban
- [ ] Loai: Van ban
- [ ] Chon qa_real1.pdf
- [ ] Tai len

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Progress (1/1)
- Form dong
- Doc Bien ban trong list
- Khong error

**API**:
- Progress (1/1)
- Form dong
- Doc Bien ban trong list
- Khong error

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload 2 file cung luc - ca 2 xuat hien (1)(2)

### Điều kiện tiên quyết
- Form mo. 2 file PDF.

### Các bước kiểm thử
- [ ] Tieu de: Ho so
- [ ] Chon 2 file
- [ ] Tai len

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid.x2
```

### Kết quả mong đợi
**UI**:
- Queue 2 file. Progress (1/2) (2/2). List: Ho so (1) va Ho so (2).

**API**:
- Queue 2 file. Progress (1/2) (2/2). List: Ho so (1) va Ho so (2).

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-004

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Upload 3 file - progress counter chinh xac

### Điều kiện tiên quyết
- Form mo. 3 file PDF.

### Các bước kiểm thử
- [ ] Tieu de Tai lieu
- [ ] Chon 3 file
- [ ] Tai len - quan sat

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid.x3
```

### Kết quả mong đợi
**UI**:
- Button text: Dang tai (1/3)...(2/3)...(3/3)... Sau xong: 3 doc.

**API**:
- Button text: Dang tai (1/3)...(2/3)...(3/3)... Sau xong: 3 doc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Nhan Huy - form dong, queue xoa sach

### Điều kiện tiên quyết
- Form mo, queue 2 file, nhap tieu de.

### Các bước kiểm thử
- [ ] Queue 2 file
- [ ] Nhap tieu de
- [ ] Nhan Huy

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Form dong. Nut Tai len tai lieu hien lai. Khong error.

**API**:
- Form dong. Nut Tai len tai lieu hien lai. Khong error.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-006

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Mo lai form sau Huy - sach hoan toan

### Điều kiện tiên quyết
- Vua nhan Huy.

### Các bước kiểm thử
- [ ] Nhan Tai len tai lieu lan 2. Kiem tra form.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Queue trong. Tieu de rong. Loai=Van ban. Mo ta rong. File input cleared.

**API**:
- Queue trong. Tieu de rong. Loai=Van ban. Mo ta rong. File input cleared.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-007

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Toggle button dong form - queue bi xoa

### Điều kiện tiên quyết
- Form mo, co file trong queue.

### Các bước kiểm thử
- [ ] Queue 1 file
- [ ] Nhan lai Tai len tai lieu (close)
- [ ] Nhan lai (open)

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Close: form dong. Open: queue trong, form sach.

**API**:
- Close: form dong. Open: queue trong, form sach.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-011

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Chon thu muc - tat ca file vao queue

### Điều kiện tiên quyết
- Form mo. Thu muc co 3 PDF.

### Các bước kiểm thử
- [ ] Nhan Chon thu muc
- [ ] Chon thu muc 3 PDF
- [ ] Xem queue

### Dữ liệu kiểm thử
```
petition.active.D30, folder.3files
```

### Kết quả mong đợi
**UI**:
- file trong queue. webkitdirectory input duoc trigger.

**API**:
- file trong queue. webkitdirectory input duoc trigger.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-013

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload tu Case - gan caseId

### Điều kiện tiên quyết
- Trang case detail.

### Các bước kiểm thử
- [ ] Upload PDF tren case detail page.

### Dữ liệu kiểm thử
```
case.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- FormData co caseId. Khong co petitionId/incidentId.

**API**:
- FormData co caseId. Khong co petitionId/incidentId.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-014

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload tu Incident - gan incidentId

### Điều kiện tiên quyết
- Trang incident detail.

### Các bước kiểm thử
- [ ] Upload PDF tren incident page.

### Dữ liệu kiểm thử
```
incident.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- FormData co incidentId. Khong co caseId/petitionId.

**API**:
- FormData co incidentId. Khong co caseId/petitionId.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-015

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Guard message - petition chua luu

### Điều kiện tiên quyết
- /petitions/new.

### Các bước kiểm thử
- [ ] Quan sat section Tai lieu.

### Kết quả mong đợi
**UI**:
- Khong co button Tai len. Hien Chua co tai lieu. Text: Luu don truoc.

**API**:
- Khong co button Tai len. Hien Chua co tai lieu. Text: Luu don truoc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-016

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload khong tieu de - loi FE

### Điều kiện tiên quyết
- Form mo, co file.

### Các bước kiểm thử
- [ ] Bo trong Tieu de
- [ ] Tai len

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Loi: Vui long nhap tieu de. 0 API calls.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-017

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload khong chon file - loi FE

### Điều kiện tiên quyết
- Form mo, queue trong.

### Các bước kiểm thử
- [ ] Nhap tieu de
- [ ] Khong chon file
- [ ] Tai len

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Loi: Vui long chon file. Khong gui request.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-018

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload file EXE - reject MIME

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Chon .exe. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.invalid
```

### Kết quả mong đợi
**API**:
- Loai file khong duoc ho tro. Khong luu. Error FE.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-019

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload file >10MB - reject size

### Điều kiện tiên quyết
- File PDF 10.1MB.

### Các bước kiểm thử
- [ ] Chon 10.1MB. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.over10mb
```

### Kết quả mong đợi
**API**:
- Multer reject. 400/413. Error FE. Khong luu.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-020

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload file PDF gia mao EXE content - magic-byte fail

### Điều kiện tiên quyết
- bad.pdf co magic bytes MZ (EXE).

### Các bước kiểm thử
- [ ] Upload bad.pdf EXE content.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf_named_exe
```

### Kết quả mong đợi
**API**:
- : Magic-byte khong khop. File xoa khoi disk.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-021

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: 1 file fail trong batch - file con lai van upload

### Điều kiện tiên quyết
- PDF hop le + 1 EXE fake.

### Các bước kiểm thử
- [ ] Queue 2: file1.pdf + badfile.exe. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, file.exe.invalid
```

### Kết quả mong đợi
**API**:
- File1 thanh cong. Badfile fail. Error: 1 that bai. Form KHONG dong. File hop le trong list.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-022

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tat ca file fail - form khong dong

### Điều kiện tiên quyết
- EXE fake.

### Các bước kiểm thử
- [ ] Queue 2 EXE. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.invalid.x2
```

### Kết quả mong đợi
**API**:
- Ca 2 fail. Error file dau. Form KHONG dong. Khong doc moi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-023

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload khong JWT - 401

### Điều kiện tiên quyết
- API direct khong token.

### Các bước kiểm thử
- [ ] curl POST /api/v1/documents no Authorization

### Kết quả mong đợi
**API**:
- Unauthorized. Khong luu.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-024

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload HTML gia PDF - magic-byte fail

### Điều kiện tiên quyết
- File .pdf co noi dung HTML.

### Các bước kiểm thử
- [ ] Upload html-content .pdf

### Dữ liệu kiểm thử
```
petition.active.D30, file.html_as_pdf
```

### Kết quả mong đợi
**API**:
- magic-byte fail. File xoa.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-031

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR - upload document vao petition cua user khac

### Điều kiện tiên quyết
- officer1 dang nhap. Petition B thuoc officer2.

### Các bước kiểm thử
- [ ] Dang nhap officer1
- [ ] POST /api/v1/documents voi petitionId = id petition cua officer2
- [ ] Upload file hop le

### Dữ liệu kiểm thử
```
petition.officer1.D30, petition.officer2.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Forbidden hoac 404. Document khong duoc tao cho petition B. DataScope assertPetitionParentInScope reject.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-032

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR - doc GET cua user khac

### Điều kiện tiên quyết
- officer1 co doc D1. officer2 dang nhap.

### Các bước kiểm thử
- [ ] GET /api/v1/documents/:id voi id=D1 (cua officer1) duoi token officer2

### Dữ liệu kiểm thử
```
document.officer1.D30
```

### Kết quả mong đợi
**API**:
- hoac 404 Not Found. Khong tra doc cua user khac.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-033

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR - DELETE doc cua user khac

### Điều kiện tiên quyết
- officer1 co doc D1. officer2 dang nhap.

### Các bước kiểm thử
- [ ] DELETE /api/v1/documents/:id (D1 cua officer1) duoi token officer2

### Dữ liệu kiểm thử
```
document.officer1.D30
```

### Kết quả mong đợi
**API**:
- hoac 404. Khong xoa.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-034

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: XSS trong title - render HTML escaping

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Nhap tieu de: <script>alert(1)</script>
- [ ] Upload file hop le
- [ ] Xem list

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Title hien thi literal '<script>alert(1)</script>' KHONG execute. React auto-escape text nodes.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: EntityDocumentsTab

---

## TC-035

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: XSS trong description - render escaping

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Mo ta: <img src=x onerror=alert(1)>. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Description hien thi as text. Khong trigger XSS.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: EntityDocumentsTab

---

## TC-036

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Path traversal trong filename - ../etc/passwd

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Upload file voi ten: ../../../etc/passwd.pdf

### Dữ liệu kiểm thử
```
petition.active.D30, file.traversal.pdf
```

### Kết quả mong đợi
**API**:
- Backend multer dung crypto.randomBytes() de dat ten file (timestamp-random.ext), bo qua originalname cho disk path. Khong path traversal. File luu an toan.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-037

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SQL Injection trong title parameter

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Title: ' OR '1'='1. Upload file hop le.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Title luu as literal string (Prisma parameterized query). Khong SQL inject. Doc duoc tao binh thuong.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-038

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: JWT cu da het han - 401

### Điều kiện tiên quyết
- Token da expired.

### Các bước kiểm thử
- [ ] Upload voi Authorization: Bearer <expired_jwt>

### Kết quả mong đợi
**API**:
- Unauthorized. Token validation fail.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-039

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: JWT tampered signature - reject

### Điều kiện tiên quyết
- Token hop le nhung sua payload khong resign.

### Các bước kiểm thử
- [ ] Upload voi JWT payload thay doi sub nhung signature cu.

### Kết quả mong đợi
**API**:
- JWT signature invalid.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-040

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Throttle - 11 upload trong 60s - request 11 bi block

### Điều kiện tiên quyết
- Dang nhap user. Limit: 10 req/60s.

### Các bước kiểm thử
- [ ] Upload 10 file hop le lien tuc
- [ ] Upload file thu 11 trong cung 60s

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid.x11
```

### Kết quả mong đợi
**API**:
- File 1-10 thanh cong. File 11: 429 Too Many Requests. Rate limit message.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-041

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload file PHP script - reject MIME

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Upload file .php (application/x-php).

### Dữ liệu kiểm thử
```
petition.active.D30, file.php.invalid
```

### Kết quả mong đợi
**API**:
- Loai file khong duoc ho tro. File khong luu tren disk.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-045

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Content-Type header giong allowed nhung magic bytes khac

### Điều kiện tiên quyết
- File .xls co magic bytes cua PDF.

### Các bước kiểm thử
- [ ] Upload file xls co noi dung PDF magic bytes.

### Dữ liệu kiểm thử
```
petition.active.D30, file.xls_as_pdf
```

### Kết quả mong đợi
**API**:
- Content-Type=application/vnd.ms-excel trong ALLOWED. Magic bytes = PDF. Detected mime != declared -> 400 magic-byte mismatch. File xoa.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-046

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - file size = 0 bytes

### Điều kiện tiên quyết
- File PDF rong 0 bytes nhung co magic bytes %PDF.

### Các bước kiểm thử
- [ ] Upload file 0 bytes.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.0bytes
```

### Kết quả mong đợi
**API**:
- Multer chap nhan (size=0 < 10MB). Magic-byte check: 0 bytes -> file-type khong detect -> 400 Magic-byte fail. Hoac multer reject 0 bytes.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-047

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - file size = 10MB chinh xac

### Điều kiện tiên quyết
- File PDF dung 10MB (10485760 bytes).

### Các bước kiểm thử
- [ ] Upload file 10MB.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.10mb_exact
```

### Kết quả mong đợi
**API**:
- Upload THANH CONG (10MB = MAX_FILE_SIZE). Document trong list.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-048

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - file size = 10MB + 1 byte

### Điều kiện tiên quyết
- File PDF 10485761 bytes.

### Các bước kiểm thử
- [ ] Upload file 10MB+1.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.10mb_plus1
```

### Kết quả mong đợi
**API**:
- Multer reject voi LIMIT_FILE_SIZE error. 400 hoac 413. Khong luu.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-052

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EP - file PDF (application/pdf) - valid MIME

### Điều kiện tiên quyết
- File PDF hop le.

### Các bước kiểm thử
- [ ] Upload .pdf

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: Critical
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-056

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP - file application/x-python (.py) - invalid

### Điều kiện tiên quyết
- File .py

### Các bước kiểm thử
- [ ] Upload .py

### Dữ liệu kiểm thử
```
petition.active.D30, file.py.invalid
```

### Kết quả mong đợi
**API**:
- Loai khong ho tro.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: High
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-057

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP - file text/html (.html) - invalid

### Điều kiện tiên quyết
- File .html

### Các bước kiểm thử
- [ ] Upload .html

### Dữ liệu kiểm thử
```
petition.active.D30, file.html.invalid
```

### Kết quả mong đợi
**API**:
- Loai khong ho tro.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: High
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-061

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE - form hidden -> open -> upload -> success

### Điều kiện tiên quyết
- Section Tai lieu, entityId co san.

### Các bước kiểm thử
- [ ] STATE: form hidden (init)
- [ ] Nhan Tai len -> STATE: form open
- [ ] Nhap tieu de + file
- [ ] Nhan Tai len -> STATE: uploading
- [ ] Doi xong -> STATE: list updated, form closed

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- State machine dung: hidden->open->uploading->closed. Khong bi stuck o uploading state.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: Critical
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-062

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: STATE - form open -> cancel -> hidden

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] STATE: form open
- [ ] Nhan Huy -> STATE: form hidden

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- State chuyen chinh xac. Queue cleared. Title reset.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: High
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-063

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE - uploading disabled button

### Điều kiện tiên quyết
- Bat dau upload.

### Các bước kiểm thử
- [ ] Quan sat button Tai len trong khi upload dang chay.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Button Tai len disabled (disabled:opacity-60). Khong the click 2 lan. Khong double-upload.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Critical
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-064

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE - upload thanh cong -> fetch docs moi

### Điều kiện tiên quyết
- Sau khi upload thanh cong.

### Các bước kiểm thử
- [ ] Upload file. Doi complete.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- fetchDocs() duoc goi. List update hien file moi. Khong can reload trang.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Critical
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-065

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE - upload fail -> form van mo, error hien

### Điều kiện tiên quyết
- Upload 1 EXE invalid.

### Các bước kiểm thử
- [ ] Upload EXE. Doi response.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.invalid
```

### Kết quả mong đợi
**API**:
- STATE: error state. Form KHONG dong. Error message hien. List khong thay doi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: Critical
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-066

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE - partial success -> form dong, error partial

### Điều kiện tiên quyết
- file: 1 hop le + 1 fail.

### Các bước kiểm thử
- [ ] Upload 2 file. Doi.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, file.exe.invalid
```

### Kết quả mong đợi
**API**:
- STATE: partial success. Form DONG. Error: X file that bai. List co file thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Critical
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-067

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION - title empty + file co - FE stop

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Title: empty. File: chon PDF. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- FE validate: Vui long nhap tieu de. KHONG goi API.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: Critical
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: EntityDocumentsTab

---

## TC-068

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION - title co + file empty - FE stop

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Title: co. File: khong chon. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- FE validate: Vui long chon file. KHONG goi API.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: Critical
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: EntityDocumentsTab

---

## TC-069

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION - title co + file co + entityId undefined - goi guardMessage

### Điều kiện tiên quyết
- entityId = undefined (new form).

### Các bước kiểm thử
- [ ] Nhap tieu de. Chon file. Tai len.

### Kết quả mong đợi
**API**:
- Error: Luu don truoc de tai len tai lieu. Khong goi POST API.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: Critical
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: EntityDocumentsTab

---

## TC-070

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION - file type allowed + magic bytes match - accept

### Điều kiện tiên quyết
- File PDF thuc su.

### Các bước kiểm thử
- [ ] Upload PDF hop le.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept. 201 Created.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: Critical
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: DocumentsController

---

## TC-071

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION - file type allowed + magic bytes mismatch - reject + cleanup

### Điều kiện tiên quyết
- File .pdf co EXE bytes.

### Các bước kiểm thử
- [ ] Upload .pdf EXE content.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf_named_exe
```

### Kết quả mong đợi
**API**:
- Reject. fs.unlinkSync goi. File khong con tren disk. 400.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: Critical
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: DocumentsController

---

## TC-072

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DECISION - file type text/plain + bat ky noi dung - accept (bypass magic)

### Điều kiện tiên quyết
- File .txt voi noi dung bat ky.

### Các bước kiểm thử
- [ ] Upload .txt.

### Dữ liệu kiểm thử
```
petition.active.D30, file.txt.valid
```

### Kết quả mong đợi
**API**:
- Accept (MAGIC_BYTE_BYPASS set). 201.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: High
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: DocumentsController

---

## TC-073

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: `Data & i18n`
- Yêu cầu: `REQ-G0-DOC-DATA`
- Kỹ thuật: `Data validation / i18n`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DATA - tieu de Unicode tieng Viet co dau

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Title: 'Biên bản điều tra - năm 2026'. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong. Title hien dung Unicode. Khong bi corrupted.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Data & i18n`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Data & i18n`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: Critical
module: Data & i18n
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DATA | Entity: EntityDocumentsTab

---

## TC-074

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: `Data & i18n`
- Yêu cầu: `REQ-G0-DOC-DATA`
- Kỹ thuật: `Data validation / i18n`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DATA - filename Unicode tieng Bien ban.pdf

### Điều kiện tiên quyết
- File co ten Unicode.

### Các bước kiểm thử
- [ ] Upload 'Biên bản.pdf' (ten Unicode).

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.unicode_name
```

### Kết quả mong đợi
**API**:
- originalName luu dung. Download filename dung. encodeURIComponent trong Content-Disposition.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Data & i18n`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Data & i18n`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Critical
module: Data & i18n
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DATA | Entity: DocumentsController

---

## TC-078

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION - download document sau upload

### Điều kiện tiên quyết
- Doc da duoc upload.

### Các bước kiểm thử
- [ ] Nhan nut Download tren doc da upload
- [ ] Kiem tra file download

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- File duoc download. Filename dung (originalName). Content-Type header dung. Content = file goc.

**API**:
- File duoc download. Filename dung (originalName). Content-Type header dung. Content = file goc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-079

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: INTEGRATION - mo document trong tab moi

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] Nhan nut Mat kin (Eye icon) tren doc.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- window.open goi voi Blob URL. Tab moi mo voi noi dung file. URL revoke sau 60s.

**API**:
- window.open goi voi Blob URL. Tab moi mo voi noi dung file. URL revoke sau 60s.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-080

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION - xoa document voi confirm

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] Nhan Delete (Trash2 icon)
- [ ] Confirm dialog hien: Xoa tai lieu X?
- [ ] Nhan OK

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- DELETE /documents/:id goi. 200. Doc bien mat khoi list sau fetchDocs.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-083

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION - upload tren Case, xem tai Case

### Điều kiện tiên quyết
- Case da luu.

### Các bước kiểm thử
- [ ] Upload doc tai /cases/:id
- [ ] Reload trang
- [ ] Xem section Tai lieu

### Dữ liệu kiểm thử
```
case.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Doc van con sau reload. GET /documents?caseId=:id tra ve doc moi.

**API**:
- Doc van con sau reload. GET /documents?caseId=:id tra ve doc moi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-086

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: INTEGRATION - xoa doc, file vat ly bi xoa khoi disk

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] Xoa doc qua UI. Kiem tra disk.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- File bi xoa hoac soft-delete. GET /documents/:id/download 404. Khong con file tren disk.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-087

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION - refresh page - doc van con

### Điều kiện tiên quyết
- Da upload doc.

### Các bước kiểm thử
- [ ] Upload doc
- [ ] F5 refresh trang
- [ ] Xem section

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- fetchDocs() goi lai. Doc van hien trong list. Khong bi mat.

**API**:
- fetchDocs() goi lai. Doc van hien trong list. Khong bi mat.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-088

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: `Regression`
- Yêu cầu: `REQ-G0-DOC-REGRESSION`
- Kỹ thuật: `Regression Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: REGRESSION - upload Enter key khong submit outer form

### Điều kiện tiên quyết
- EntityDocumentsTab nhung trong PetitionFormPage (outer form).

### Các bước kiểm thử
- [ ] Mo form upload
- [ ] Click vao Tieu de input
- [ ] Nhan Enter

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Enter bi prevent (onKeyDown preventDefault). Outer form KHONG submit. Khong redirect.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: Critical
module: Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: REGRESSION | Entity: EntityDocumentsTab

---

## TC-089

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: `Regression`
- Yêu cầu: `REQ-G0-DOC-REGRESSION`
- Kỹ thuật: `Regression Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: REGRESSION - Enter key trong Mo ta khong submit outer form

### Điều kiện tiên quyết
- Form mo. Dang o Mo ta input.

### Các bước kiểm thử
- [ ] Focus vao Mo ta
- [ ] Nhan Enter

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Enter prevent. Outer form khong submit.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: Critical
module: Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: REGRESSION | Entity: EntityDocumentsTab

---

## TC-090

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: `Regression`
- Yêu cầu: `REQ-G0-DOC-REGRESSION`
- Kỹ thuật: `Regression Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: REGRESSION - button type=button khong trigger form submit

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Nhan cac button Tai len, Huy, Chon thu muc.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Tat ca co type=button. Khong co button nao type=submit. Khong trigger outer form.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: Critical
module: Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: REGRESSION | Entity: EntityDocumentsTab

---

## TC-095

**Meta**:
- Loại: `A11Y`
- Priority: `P0` 🔴
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: A11Y - keyboard navigation: Tab qua cac button, Enter/Space activate

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Tab den nut Tai len tai lieu
- [ ] Enter/Space
- [ ] Tab qua Title, DocType, Mo ta
- [ ] Tab den nut Tai len (submit)
- [ ] Enter

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Tab navigation hop le. Enter/Space activate buttons. Focus order logic (top-down). Khong co focus trap ngoai modal.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: Critical
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-100

**Meta**:
- Loại: `A11Y`
- Priority: `P0` 🔴
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: A11Y - form label dung htmlFor + input id

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Inspect labels va inputs.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Label 'Tieu de' htmlFor=doc-title. Input id=doc-title. Click label → focus input. Screen reader: 'Tieu de, edit text'.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: Critical
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-101

**Meta**:
- Loại: `COMPAT`
- Priority: `P0` 🔴
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: COMPAT - Chrome 120+ (Windows 11): upload thanh cong

### Điều kiện tiên quyết
- Chrome 120+ tren Windows 11.

### Các bước kiểm thử
- [ ] Upload PDF tren Chrome 120+. Kiem tra queue va result.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Queue hien dung. Upload thanh cong. Khong co JS error trong console.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: Critical
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-113

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P0` 🔴
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PERF - upload 11 file lien tiep - file thu 11 nhan 429

### Điều kiện tiên quyết
- Throttle 10/60s.

### Các bước kiểm thử
- [ ] Upload 11 file trong 60 giay.

### Dữ liệu kiểm thử
```
petition.active.D30, files.small.11pack
```

### Kết quả mong đợi
**API**:
- File 1-10: 201. File 11: 429 Too Many Requests. FE hien 'Qua gioi han, thu lai sau gio'. Khong crash.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Critical
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: DocumentsController

---

## TC-121

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload EXE content voi .pdf extension - backend reject

### Điều kiện tiên quyết
- File EXE doi extension .pdf.

### Các bước kiểm thử
- [ ] Upload file EXE doi ten thanh .pdf.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe_as_pdf
```

### Kết quả mong đợi
**API**:
- BE: fileTypeFromFile phat hien content-type mismatch. 400 Bad Request: 'Dinh dang file khong hop le.' File bi xoa tren disk (unlink).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-122

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload ZIP content voi .docx extension - backend reject

### Điều kiện tiên quyết
- File ZIP doi extension .docx.

### Các bước kiểm thử
- [ ] Upload ZIP doi thanh .docx.

### Dữ liệu kiểm thử
```
petition.active.D30, file.zip_as_docx
```

### Kết quả mong đợi
**API**:
- Magic byte mismatch. 400 reject. Disk clean.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-124

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - missing title (empty string) - 400

### Điều kiện tiên quyết
- Call API truc tiep khong qua FE.

### Các bước kiểm thử
- [ ] POST /documents FormData voi title=''.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO validate: title IsNotEmpty. 400 ValidationError. Message: 'title should not be empty'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-127

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - khong co file trong request - 400

### Điều kiện tiên quyết
- API call truc tiep.

### Các bước kiểm thử
- [ ] POST /documents FormData KHONG co file field.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- FileInterceptor: multer khong tim thay file. 400 hoac 422. Message: 'File la bat buoc'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-128

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - file > 10MB - multer reject

### Điều kiện tiên quyết
- File 10MB + 1 byte.

### Các bước kiểm thử
- [ ] Upload file 10MB+1.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.10mb_plus1
```

### Kết quả mong đợi
**API**:
- Multer limits.fileSize → reject. 413 Payload Too Large. Message: 'File qua lon (toi da 10MB)'. File khong luu tren disk.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-129

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - unauth (no token) - 401

### Điều kiện tiên quyết
- Khong dang nhap.

### Các bước kiểm thử
- [ ] POST /documents khong co Authorization header.

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- JwtAuthGuard: 401 Unauthorized.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-130

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - token het han - 401

### Điều kiện tiên quyết
- Token expired.

### Các bước kiểm thử
- [ ] POST /documents voi expired JWT.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.expired_token
```

### Kết quả mong đợi
**API**:
- Unauthorized. 'Token expired'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-130
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-131

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - petitionId khong ton tai - 404

### Điều kiện tiên quyết
- petitionId la cuid ngau nhien.

### Các bước kiểm thử
- [ ] POST /documents voi petitionId='non-existent-id'.

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- assertPetitionParentInScope: 404 Not Found. Khong tao doc.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-131
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-132

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - caseId thuoc team khac - 403

### Điều kiện tiên quyết
- officer1 thuoc team A. Case thuoc team B.

### Các bước kiểm thử
- [ ] officer1 upload doc voi caseId thuoc team B.

### Dữ liệu kiểm thử
```
case.other_team.D30, file.pdf.valid, user.officer1
```

### Kết quả mong đợi
**API**:
- assertParentInScope: 403 Forbidden. Data scope violation.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-132
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-133

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - DELETE doc cua nguoi khac (officer khac) - 403

### Điều kiện tiên quyết
- officer1 try xoa doc cua officer2.

### Các bước kiểm thử
- [ ] officer1 DELETE /documents/:id (doc cua officer2).

### Dữ liệu kiểm thử
```
document.other_officer.D30, user.officer1
```

### Kết quả mong đợi
**API**:
- Forbidden hoac role check. Khong cho xoa.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-133
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-134

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - GET /documents/:id/download doc cua entity khac scope - 403

### Điều kiện tiên quyết
- officer1 co doc trong petition cua team A. officer2 tu team B.

### Các bước kiểm thử
- [ ] officer2 download doc cua team A.

### Dữ liệu kiểm thử
```
document.team_a.D30, user.officer2
```

### Kết quả mong đợi
**API**:
- Forbidden. Scope check khi download.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-134
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-139

**Meta**:
- Loại: `RECOVERY`
- Priority: `P0` 🔴
- Module: `Recovery & Resilience`
- Yêu cầu: `REQ-G0-DOC-RECOVERY`
- Kỹ thuật: `Recovery / Resilience`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RECOVERY - 429 throttle - FE hien message that bai, khong crash

### Điều kiện tiên quyết
- Da upload 10 file trong 60s.

### Các bước kiểm thử
- [ ] Thu upload file thu 11.

### Dữ liệu kiểm thử
```
petition.active.D30, files.throttle_exceeded
```

### Kết quả mong đợi
**API**:
- FE nhan 429. Error: 'Qua gioi han tai len, vui long thu lai sau'. Form giu nguyen. Khong exception.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Recovery & Resilience`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Recovery & Resilience`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-139
severity: Critical
module: Recovery & Resilience
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RECOVERY | Entity: EntityDocumentsTab

---

## TC-145

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DATA - filename SQL injection attempt - sanitize

### Điều kiện tiên quyết
- File co ten chua SQL.

### Các bước kiểm thử
- [ ] Upload file co ten: 'test'; DROP TABLE documents;--.pdf'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.sql_injection_name
```

### Kết quả mong đợi
**API**:
- Filename duoc escape/sanitize. DB operation an toan. Khong SQL injection. originalName luu as literal string.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-145
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-146

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY - IDOR: xem doc list cua petition khac via query param

### Điều kiện tiên quyết
- officer2 co petition rieng. officer1 biet petitionId cua officer2.

### Các bước kiểm thử
- [ ] officer1 GET /documents?petitionId={petitionId_of_officer2}.

### Dữ liệu kiểm thử
```
petition.other_officer.D30, user.officer1
```

### Kết quả mong đợi
**API**:
- Scope check: 403 Forbidden hoac 200 voi empty list. KHONG tra ve docs cua officer2.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-146
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-147

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY - path traversal trong filename khi download

### Điều kiện tiên quyết
- Doc voi filePath co '..'.

### Các bước kiểm thử
- [ ] Download doc co filePath='../../etc/passwd'.

### Dữ liệu kiểm thử
```
document.path_traversal.D30
```

### Kết quả mong đợi
**API**:
- BE: dung path.basename + absolute path resolution. Khong cho doc file ngoai uploads/documents/. 400 hoac 404.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-147
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-148

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY - upload HTML file + XSS payload

### Điều kiện tiên quyết
- File .html hoac .htm co noi dung XSS.

### Các bước kiểm thử
- [ ] Upload .html file (khong trong allowed list) qua API.

### Dữ liệu kiểm thử
```
petition.active.D30, file.html_xss
```

### Kết quả mong đợi
**API**:
- BE: .html khong trong ALLOWED_MIME_TYPES. 400 reject. Khong luu. Neu somehow bi upload: Content-Type: text/plain khi download, KHONG text/html.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-148
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-149

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY - Content-Type header spoofing: PDF file voi Content-Type: image/jpeg

### Điều kiện tiên quyết
- PDF file nhung request header Content-Type: image/jpeg.

### Các bước kiểm thử
- [ ] Upload PDF voi Content-Type: image/jpeg trong multipart.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE: multer doc Content-Type tu part header → mimeType='image/jpeg'. Magic byte check: fileTypeFromFile tra ve 'application/pdf'. MISMATCH → 400 reject.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-149
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-154

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GREEN - download file: Content-Disposition filename encoded

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] GET /documents/:id/download. Kiem tra response headers.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- Content-Disposition: attachment; filename*=UTF-8''<encoded_name>. RFC 5987. Browser download file dung ten.

**API**:
- Content-Disposition: attachment; filename*=UTF-8''<encoded_name>. RFC 5987. Browser download file dung ten.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-154
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: DocumentsController

---

## TC-155

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - download soft-deleted doc - 404

### Điều kiện tiên quyết
- Doc da bi xoa.

### Các bước kiểm thử
- [ ] GET /documents/:id/download cho doc da xoa.

### Dữ liệu kiểm thử
```
document.deleted.D30
```

### Kết quả mong đợi
**API**:
- Not Found. Khong tra ve file. Message: 'Tai lieu khong ton tai.'

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-155
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-156

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION - petitionId + caseId cu the trong 1 request - BE reject

### Điều kiện tiên quyết
- API call voi ca petitionId + caseId.

### Các bước kiểm thử
- [ ] POST /documents voi ca 2 field.

### Dữ liệu kiểm thử
```
petition.active.D30, case.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE validate: chi duoc 1 entityId. 400 Bad Request: 'Chi duoc truyen 1 trong caseId, incidentId, petitionId'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-156
severity: Critical
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: DocumentsController

---

## TC-157

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Decision Table`
- Yêu cầu: `REQ-G0-DOC-DECISION`
- Kỹ thuật: `Decision Table Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION - doc khong co entityId nao - 400

### Điều kiện tiên quyết
- API call khong co entity link.

### Các bước kiểm thử
- [ ] POST /documents khong co caseId, incidentId, petitionId.

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE: 400 hoac doc duoc tao 'floating' (tuy policy). Neu floating khong cho phep: 'Phai truyen it nhat 1 entityId'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Decision Table`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Decision Table`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-157
severity: Critical
module: Decision Table
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DECISION | Entity: DocumentsController

---

## TC-158

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE - queue: xoa file khoi queue bang X button

### Điều kiện tiên quyết
- file trong queue.

### Các bước kiểm thử
- [ ] Nhan X ben canh file thu 2.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- File thu 2 bi xoa khoi queue. Con lai 2 file. File input van co 2 file con lai (neu possible) hoac giu state trong React. Nhan X file thu 3 → con 1 file.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-158
severity: Critical
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-159

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `State Transition`
- Yêu cầu: `REQ-G0-DOC-STATE`
- Kỹ thuật: `State Transition Testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE - queue empty sau xoa het → button Tai len disabled

### Điều kiện tiên quyết
- file trong queue.

### Các bước kiểm thử
- [ ] Xoa file cuoi cung bang X.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Queue rong. Button Tai len (submit) disabled hoac an. Khong the submit form rong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `State Transition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `State Transition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-159
severity: Critical
module: State Transition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: STATE | Entity: EntityDocumentsTab

---

## TC-160

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload file MP4 video > 10MB - reject

### Điều kiện tiên quyết
- File MP4 20MB.

### Các bước kiểm thử
- [ ] Upload video MP4 20MB.

### Dữ liệu kiểm thử
```
petition.active.D30, file.mp4.20mb
```

### Kết quả mong đợi
**API**:
- Multer limits.fileSize = 10MB → reject 413 ngay ca file hop le mime. Khong luu.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-160
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-161

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - file exacty 10MB (10485760 bytes) - accept

### Điều kiện tiên quyết
- File PDF persis 10485760 bytes.

### Các bước kiểm thử
- [ ] Upload file persis 10MB.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.10mb_exact
```

### Kết quả mong đợi
**API**:
- Accept. 201. (max boundary hop le).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-161
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-162

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - file 10485761 bytes (10MB + 1) - reject

### Điều kiện tiên quyết
- File 10485761 bytes.

### Các bước kiểm thử
- [ ] Upload file 10485761 bytes.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.10mb_plus1
```

### Kết quả mong đợi
**API**:
- reject. (> max boundary).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-162
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-168

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EP - MIME group: documents (pdf doc docx xls xlsx) - accept

### Điều kiện tiên quyết
- File hop le tung loai.

### Các bước kiểm thử
- [ ] Upload .pdf .doc .docx .xls .xlsx rieng le.

### Dữ liệu kiểm thử
```
petition.active.D30, files.document_group
```

### Kết quả mong đợi
**API**:
- Tat ca 5 loai: 201 Accept.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-168
severity: Critical
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-169

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EP - MIME rejected: .zip .rar .bat .exe .php - 400

### Điều kiện tiên quyết
- File ngoai danh sach cho phep.

### Các bước kiểm thử
- [ ] Upload .zip, .rar, .bat, .exe, .php.

### Dữ liệu kiểm thử
```
petition.active.D30, files.rejected_group
```

### Kết quả mong đợi
**API**:
- Tat ca: 400 reject. Khong luu.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-169
severity: Critical
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-170

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GREEN - incident upload doc + list + download full flow

### Điều kiện tiên quyết
- Incident da luu.

### Các bước kiểm thử
- [ ] Mo /incidents/:id
- [ ] Tab Tai lieu
- [ ] Upload PDF
- [ ] Verify list
- [ ] Download

### Dữ liệu kiểm thử
```
incident.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- incidentId duoc dung. Doc lien ket voi incident. Get/Download dung. Scope check voi incident.

**API**:
- incidentId duoc dung. Doc lien ket voi incident. Get/Download dung. Scope check voi incident.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-170
severity: Critical
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-172

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload file JFIF (JPEG variant) dat theo .png - magic byte mismatch

### Điều kiện tiên quyết
- JFIF file doi ten .png.

### Các bước kiểm thử
- [ ] Upload JFIF dat ten .png.

### Dữ liệu kiểm thử
```
petition.active.D30, file.jfif_as_png
```

### Kết quả mong đợi
**API**:
- magic byte: image/jpeg != image/png → 400 reject. File cleanup.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-172
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-173

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload PDF dat theo .xls - magic byte mismatch

### Điều kiện tiên quyết
- PDF file, extension .xls.

### Các bước kiểm thử
- [ ] Upload PDF dat ten .xls.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf_as_xls
```

### Kết quả mong đợi
**API**:
- magic byte mismatch → 400 reject.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-173
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-174

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload PNG dat theo .mp3 - magic byte mismatch

### Điều kiện tiên quyết
- PNG file, extension .mp3.

### Các bước kiểm thử
- [ ] Upload PNG dat ten .mp3.

### Dữ liệu kiểm thử
```
petition.active.D30, file.png_as_mp3
```

### Kết quả mong đợi
**API**:
- reject.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-174
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-175

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload .gif dat theo .docx - magic byte mismatch

### Điều kiện tiên quyết
- GIF file, extension .docx.

### Các bước kiểm thử
- [ ] Upload GIF dat ten .docx.

### Dữ liệu kiểm thử
```
petition.active.D30, file.gif_as_docx
```

### Kết quả mong đợi
**API**:
- reject.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-175
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-176

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - multer fileFilter: extension .exe bi reject truoc magic byte check

### Điều kiện tiên quyết
- File EXE thuc su.

### Các bước kiểm thử
- [ ] Upload file .exe thuc su (correct magic bytes).

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.real
```

### Kết quả mong đợi
**API**:
- multer fileFilter: extension .exe khong trong ALLOWED_MIME_TYPES → reject. 400. 0 file tren disk.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-176
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-177

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload file .rar (archive) - reject

### Điều kiện tiên quyết
- File .rar hop le.

### Các bước kiểm thử
- [ ] Upload .rar file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.rar.valid
```

### Kết quả mong đợi
**API**:
- application/x-rar-compressed khong trong ALLOWED_MIME_TYPES → 400.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-177
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-178

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload file .bat (script) - reject

### Điều kiện tiên quyết
- File .bat hop le.

### Các bước kiểm thử
- [ ] Upload .bat file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.bat.valid
```

### Kết quả mong đợi
**API**:
- Reject. application/bat khong trong allowed list.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-178
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-179

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload file .svg (SVG co the co JS) - reject

### Điều kiện tiên quyết
- SVG file co embedded JS.

### Các bước kiểm thử
- [ ] Upload SVG file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.svg_xss
```

### Kết quả mong đợi
**API**:
- image/svg+xml khong trong ALLOWED_MIME_TYPES → reject. Phong tranh SVG XSS.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-179
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-180

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - JWT tampered (signature invalid) - 401

### Điều kiện tiên quyết
- JWT co chu ky gia.

### Các bước kiểm thử
- [ ] POST /documents voi tampered JWT (doi payload + giu signature).

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.tampered_jwt
```

### Kết quả mong đợi
**API**:
- JwtAuthGuard: verify fail → 401 Unauthorized.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-180
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-181

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - JWT algorithm none attack - 401

### Điều kiện tiên quyết
- JWT voi alg: none trong header.

### Các bước kiểm thử
- [ ] Upload voi JWT alg=none.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.jwt_alg_none
```

### Kết quả mong đợi
**API**:
- JwtAuthGuard: reject alg=none. 401.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-181
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-182

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload nhieu file vuot gioi han: 11 file dong thoi trong folder - thu 11 nhan 429

### Điều kiện tiên quyết
- Throttle 10/60s.

### Các bước kiểm thử
- [ ] Upload folder 11 files trong 60s.

### Dữ liệu kiểm thử
```
petition.active.D30, folder.11files
```

### Kết quả mong đợi
**API**:
- File 1-10: 201. File 11: 429. UI hien error cho file bi throttle.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-182
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-183

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - form submit voi queue rong (JS bypass) - FE block

### Điều kiện tiên quyết
- Form mo, queue rong.

### Các bước kiểm thử
- [ ] Bypass FE validation: call submit handler truc tiep (console).

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- FE check: queuedFiles.length === 0 → return early. POST khong duoc goi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-183
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-184

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - petitionId la SQL injection payload - 400 hoac 422

### Điều kiện tiên quyết
- API call.

### Các bước kiểm thử
- [ ] POST /documents voi petitionId="'; DROP TABLE petitions; --".

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Prisma dung parameterized query. SQL injection khong co tac dong. 404 Not Found (petitionId khong hop le). Khong 500.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-184
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-186

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - caseId + incidentId + petitionId cung luc - 400

### Điều kiện tiên quyết
- API voi 3 entityIds.

### Các bước kiểm thử
- [ ] POST voi caseId + incidentId + petitionId.

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- : chi duoc 1 entityId.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-186
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-187

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - file name dat PathInfo attack: file.pdf/.php - BE sanitize

### Điều kiện tiên quyết
- File co ten co dang path injection.

### Các bước kiểm thử
- [ ] Upload file co originalName = 'test.pdf/.php'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pathinfo_attack
```

### Kết quả mong đợi
**API**:
- path.basename sanitize: originalName luu as 'test.pdf_.php' hoac tuong tu. Khong execute .php. Server khong bi confused.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-187
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-188

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload file blank title sau strip (all spaces) - FE reject

### Điều kiện tiên quyết
- Title = '   ' (chi khoang trang).

### Các bước kiểm thử
- [ ] Nhap title chi la spaces. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- FE: title.trim() === '' → 'Vui long nhap tieu de'. POST khong goi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-188
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-190

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - file null content (fake FormData khong co file binary) - 400

### Điều kiện tiên quyết
- FormData co file field nhung empty.

### Các bước kiểm thử
- [ ] POST FormData co key 'file' nhung value = empty Blob.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- multer: file size = 0. BE reject voi thong bao loi.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-190
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-191

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - download bi delete (doc.deletedAt != null) - 404

### Điều kiện tiên quyết
- Doc da bi soft-delete.

### Các bước kiểm thử
- [ ] GET /documents/:id/download cho deleted doc.

### Dữ liệu kiểm thử
```
document.deleted.D30
```

### Kết quả mong đợi
**API**:
- 'Tai lieu khong ton tai hoac da bi xoa.'

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-191
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-193

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - title co HTML tags - luu literal, khong render

### Điều kiện tiên quyết
- Title voi HTML tags.

### Các bước kiểm thử
- [ ] Title: '<b>Test</b><script>alert(1)</script>'. Upload. Xem list.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Luu literal string. List hien '<b>Test</b>...' as text. React auto-escape innerHTML. Khong XSS.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-193
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-198

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - GET /documents theo entityId khong thuoc scope - empty (khong 403)

### Điều kiện tiên quyết
- officer1, caseId cua team khac.

### Các bước kiểm thử
- [ ] GET /documents?caseId={case_of_team_b}

### Dữ liệu kiểm thử
```
case.other_team.D30, user.officer1
```

### Kết quả mong đợi
**API**:
- Scope filter: tra ve [] (empty list), khong 403. 'Dung chau' behavior — hiding existence.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-198
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-199

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload voi petitionId hop le + title hop le + sai MIME - 400

### Điều kiện tiên quyết
- Moi thu hop le tru MIME.

### Các bước kiểm thử
- [ ] Upload file application/json (JSON content, .json extension).

### Dữ liệu kiểm thử
```
petition.active.D30, file.json.invalid
```

### Kết quả mong đợi
**API**:
- application/json khong trong ALLOWED_MIME_TYPES → 400. 'Dinh dang khong duoc phep.'

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-199
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-203

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - ROLE VIEWER (read-only) upload doc - 403

### Điều kiện tiên quyết
- User voi role VIEWER (read-only) chua co trong hien tai — test voi role thap nhat co quyen.

### Các bước kiểm thử
- [ ] Neu co VIEWER role: POST /documents.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.viewer
```

### Kết quả mong đợi
**API**:
- Forbidden. VIEWER khong co UPLOAD permission.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-203
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-209

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - tai len tu incident scope khi caseId duoc dung - 403

### Điều kiện tiên quyết
- Incident-scope officer thu dung caseId.

### Các bước kiểm thử
- [ ] Officer cua incident-team upload doc voi caseId thuoc case-team.

### Dữ liệu kiểm thử
```
case.active.D30, file.pdf.valid, user.incident_officer
```

### Kết quả mong đợi
**API**:
- assertParentInScope: 403 Forbidden.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-209
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-211

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - DELETE doc ma minhduoc xoa (admin) - khong xoa dc doc cua entity ngoai scope

### Điều kiện tiên quyết
- admin2 thuoc team khac voi doc.

### Các bước kiểm thử
- [ ] admin2 DELETE /documents/:id (doc cua team A, admin2 o team B).

### Dữ liệu kiểm thử
```
document.team_a.D30, user.admin2
```

### Kết quả mong đợi
**API**:
- Admin co the xoa moi doc: 200. Hoac scope check ap dung ca admin → 403. Phai ro business rule.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-211
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-216

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload khi entityId = empty string - 400

### Điều kiện tiên quyết
- API call.

### Các bước kiểm thử
- [ ] POST /documents voi petitionId=''.

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO IsNotEmpty: 400. Empty string la invalid entityId.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-216
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-220

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload response chua truong 'id' cua doc moi - verify response shape

### Điều kiện tiên quyết
- Upload thanh cong.

### Các bước kiểm thử
- [ ] POST /documents. Kiem tra response body.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Response: {id, title, fileName, mimeType, size, petitionId, createdAt}. Khong tra ve filePath (duong dan vat ly). Khong la RID.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-220
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-225

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload API tra ve 500 (BE crash) - FE error message khong leak stack

### Điều kiện tiên quyết
- BE tra ve 500 voi stack trace.

### Các bước kiểm thử
- [ ] Upload. BE tra ve 500 JSON co stack trace.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- FE: chi hien message an toan. KHONG hien stack trace. extractApiError lay message an toan.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-225
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-227

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload theo batch: 1 file fail magic check, rest thanh cong

### Điều kiện tiên quyết
- Queue: [pdf.valid, exe_as_pdf, jpg.valid].

### Các bước kiểm thử
- [ ] Upload 3 file. File thu 2 la EXE.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, file.exe_as_pdf, file.jpg.valid
```

### Kết quả mong đợi
**API**:
- File 1: 201. File 2: 400 (magic mismatch). File 3: 201. error 'exe_as_pdf.pdf: Dinh dang file khong hop le.' Form dong (2/3 thanh cong).

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-227
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-228

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - tai len khi khong co quyen (da dang xuat giua chung) - FE redirect login

### Điều kiện tiên quyết
- User dang xuat trong khi form upload dang mo.

### Các bước kiểm thử
- [ ] Mo form. Dang xuat o tab khac. Nhan Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- FE nhan 401. Redirect /login. Form khong crash. User duoc bao.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-228
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-230

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload file truoc khi nhap title: FE validate order

### Điều kiện tiên quyết
- Form mo. File duoc chon truoc title.

### Các bước kiểm thử
- [ ] Chon file trong queue. Khong nhap title. Nhan Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- FE validate: title la bat buoc, kiem tra truoc khi upload. Error: 'Vui long nhap tieu de tai lieu.'

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-230
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-232

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - FE: button type submit trong form upload - khong ton tai

### Điều kiện tiên quyết
- Inspect DOM.

### Các bước kiểm thử
- [ ] Render EntityDocumentsTab. Kiem tra tat ca button types.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- KHONG co button type=submit. Tat ca la type=button. Dac biet 'Tai len' submit button co type=button de prevent outer form submit.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-232
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-233

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - 2 files queue: upload → 2 titles (title, title (2))

### Điều kiện tiên quyết
- Queue 2 files, title='Bien ban'.

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, files.2pack
```

### Kết quả mong đợi
**API**:
- File 1: title='Bien ban'. File 2: title='Bien ban (2)'. Ca 2 tao thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-233
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-234

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - 10 files queue: titles (1)..(10)

### Điều kiện tiên quyết
- Queue 10 files.

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, files.10pack
```

### Kết quả mong đợi
**API**:
- File 1: 'X'. Files 2-10: 'X (2)'..'X (10)'. 10 POST calls. De-indexed chuyen dong de.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-234
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-235

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - 1 file queue: title khong co index

### Điều kiện tiên quyết
- Queue 1 file.

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- title = 'Bien ban' (khong co '(1)'). Khi filesToUpload.length===1, dung title thuong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-235
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-255

**Meta**:
- Loại: `A11Y`
- Priority: `P0` 🔴
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: A11Y - upload error co role=alert (screen reader doc ngay)

### Điều kiện tiên quyết
- Upload fail.

### Các bước kiểm thử
- [ ] Trigger upload error. Kiem tra DOM.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.invalid
```

### Kết quả mong đợi
**UI**:
- Error div co role=alert hoac aria-live='assertive'. Screen reader doc error ngay, khong cho user click.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-255
severity: Critical
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-270

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY - file scanning: upload eicar test string (vi-rus test) - detect va reject

### Điều kiện tiên quyết
- AV scan neu co.

### Các bước kiểm thử
- [ ] Upload EICAR test file (X5O!P...$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*).

### Dữ liệu kiểm thử
```
petition.active.D30, file.eicar
```

### Kết quả mong đợi
**API**:
- Neu co AV scan: reject. Neu khong co AV: accept (text/plain bypass). NOTE: nen implement AV scan cho prod.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-270
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-272

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY - upload doc chi de test SSRF via filename URL

### Điều kiện tiên quyết
- originalName la URL.

### Các bước kiểm thử
- [ ] Upload voi originalName = 'http://169.254.169.254/latest/meta-data'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.ssrf_name
```

### Kết quả mong đợi
**API**:
- Filename duoc luu as literal string. Khong fetch URL. Khong SSRF.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-272
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-280

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY - download file: Content-Type phai match file content

### Điều kiện tiên quyết
- PDF upload.

### Các bước kiểm thử
- [ ] Download PDF. Kiem tra Content-Type.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Content-Type: application/pdf (match original MIME). Khong bao gio tra Content-Type: text/html cho binary file.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-280
severity: Critical
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-283

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload qua API voi Content-Type sai (application/json) - 400

### Điều kiện tiên quyết
- Request Content-Type: application/json.

### Các bước kiểm thử
- [ ] POST /documents voi Content-Type: application/json.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- multer: multipart/form-data la bat buoc. 400 hoac 415 Unsupported Media Type.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-283
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-288

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload 3 files, ca 3 fail - form van mo, loi hien ro

### Điều kiện tiên quyết
- BE luon tra ve 500.

### Các bước kiểm thử
- [ ] Upload 3 files, ca 3 fail.

### Dữ liệu kiểm thử
```
petition.active.D30, files.3pack
```

### Kết quả mong đợi
**API**:
- failed.length === filesToUpload.length → form khong dong. Error: '[file1]: loi. [file2]: loi. [file3]: loi.' Van hien.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-288
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-289

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload voi session bi revoke (server-side logout) - 401

### Điều kiện tiên quyết
- Admin revoke session cua user.

### Các bước kiểm thử
- [ ] Upload voi revoked JWT.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.revoked_session
```

### Kết quả mong đợi
**API**:
- Nhu session expire. Redirect login.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-289
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-290

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - file input 'accept' attribute bi bo qua boi user (bypass FE filter) - BE nhan

### Điều kiện tiên quyết
- User bo qua accept attr.

### Các bước kiểm thử
- [ ] HTML injection / DevTools xoa accept attr → chon .exe → submit.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.real
```

### Kết quả mong đợi
**API**:
- BE la tuyen bao ve cuoi cung. Magic byte check reject .exe. 400.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-290
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-292

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload doc co file path chua null bytes (path injection) - BE reject

### Điều kiện tiên quyết
- filePath voi null byte.

### Các bước kiểm thử
- [ ] POST voi filePath='../../etc%00.pdf' (null byte).

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE: path.basename + strip null bytes. Reject hoac sanitize. Khong path injection.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-292
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-293

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - incident-type officer upload voi petitionId - 403

### Điều kiện tiên quyết
- Officer chi co quyen incident scope.

### Các bước kiểm thử
- [ ] Upload voi petitionId cua petition ngoai scope.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.incident_officer
```

### Kết quả mong đợi
**API**:
- assertPetitionParentInScope: 403.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-293
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-295

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload tren HTTPS (production) - file va request an toan

### Điều kiện tiên quyết
- Production HTTPS.

### Các bước kiểm thử
- [ ] Upload PDF tren HTTPS.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- TLS encryption. No mixed content. HSTS header. Request an toan tren dang truyen.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-295
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-296

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - FE upload form: sau thanh cong, title va docType reset

### Điều kiện tiên quyết
- Upload thanh cong.

### Các bước kiểm thử
- [ ] Upload PDF. Xem state sau khi form dong.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- title='', docType='VAN_BAN', description='', queue=[]. Mo lai form: form sach.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-296
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-298

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - nhan Tai len 2 lan nhanh (double click) - khong double-upload

### Điều kiện tiên quyết
- Form hop le.

### Các bước kiểm thử
- [ ] Double-click Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Button disabled ngay sau click dau. Chi 1 POST duoc gui. Khong co 2 doc trung nhau.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-298
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-301

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload khi session cookie bi stolen va dung tu IP khac - 401

### Điều kiện tiên quyết
- Session cookie stolen.

### Các bước kiểm thử
- [ ] Upload voi stolen session tu IP khac.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.stolen_session
```

### Kết quả mong đợi
**API**:
- Server detect IP mismatch hoac cookie invalid. 401. Log suspicious.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-301
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-302

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - download voi forged token (another user ID but valid sig) - 403

### Điều kiện tiên quyết
- Token hop le nhung userId la nguoi khac.

### Các bước kiểm thử
- [ ] Download /documents/:id voi JWT cua user A nhung id cua doc cua user B.

### Dữ liệu kiểm thử
```
document.other_user.D30, user.officer1
```

### Kết quả mong đợi
**API**:
- Scope check: user A khong co quyen. 403.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-302
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-303

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload voi incidentId la cuid hợp le nhung incident thuoc team khac - 403

### Điều kiện tiên quyết
- Incident cua team B.

### Các bước kiểm thử
- [ ] officer (team A) upload voi incidentId cua team B.

### Dữ liệu kiểm thử
```
incident.other_team.D30, file.pdf.valid, user.officer_team_a
```

### Kết quả mong đợi
**API**:
- assertParentInScope: 403.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-303
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-304

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - multipart boundary attack: boundary string la XSS payload

### Điều kiện tiên quyết
- Multipart voi boundary co XSS.

### Các bước kiểm thử
- [ ] POST voi Content-Type: multipart/form-data; boundary=<script>alert(1)</script>.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- multer/Express parse boundary literal. Khong execute. Log ghi nhan. 200/400 tuy content.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-304
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-312

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - FE: chon file > 10MB - hien error truoc khi upload (client-side check)

### Điều kiện tiên quyết
- File > 10MB tren client.

### Các bước kiểm thử
- [ ] Chon file 15MB. Xem queue.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.15mb
```

### Kết quả mong đợi
**API**:
- FE kiem tra file.size > 10MB → hien error trong queue: 'bao_cao.pdf: File qua lon (toi da 10MB)'. KHONG post to server.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-312
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-313

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - multiple errors: 2 files fail voi 2 errors khac nhau

### Điều kiện tiên quyết
- files: 1 too large + 1 invalid mime.

### Các bước kiểm thử
- [ ] Upload 2 files: too-large.pdf + exe.pdf.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.15mb, file.exe_as_pdf
```

### Kết quả mong đợi
**API**:
- failed = ['too-large.pdf: File qua lon', 'exe.pdf: Dinh dang khong hop le']. Ca 2 fail → error hien ro cac file va ly do. Form van mo.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-313
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-315

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - FE: reset file input refs sau cancel (stale ref fix)

### Điều kiện tiên quyết
- Cancel sau khi chon file.

### Các bước kiểm thử
- [ ] Chon file. 2. Cancel. 3. Tai len lai voi cung file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- fileRef.current.value = '' sau cancel. File input reset. Co the chon lai cung file lan sau.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-315
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-317

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY - 3 files: tren dung gioi han throttle (request 8,9,10 trong 60s)

### Điều kiện tiên quyết
- Da upload 7 files trong 60s. Con 3 slot.

### Các bước kiểm thử
- [ ] Upload 3 files. Moi file dung 1 slot.

### Dữ liệu kiểm thử
```
petition.active.D30, files.3pack
```

### Kết quả mong đợi
**API**:
- Ca 3 accept. 201 each. Throttle counter = 10.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-317
severity: Critical
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-008

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Upload JPEG - Hinh anh

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Loai=Hinh anh. Chon JPEG. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.jpg.valid
```

### Kết quả mong đợi
**UI**:
- Thanh cong. Type Hinh anh.

**API**:
- Thanh cong. Type Hinh anh.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-009

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Upload DOCX hop le

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Upload .docx hop le.

### Dữ liệu kiểm thử
```
petition.active.D30, file.docx.valid
```

### Kết quả mong đợi
**UI**:
- Thanh cong.

**API**:
- Thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-010

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Upload TXT bypass magic-byte

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Upload .txt

### Dữ liệu kiểm thử
```
petition.active.D30, file.txt.valid
```

### Kết quả mong đợi
**UI**:
- Thanh cong (MAGIC_BYTE_BYPASS set).

**API**:
- Thanh cong (MAGIC_BYTE_BYPASS set).

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-012

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xoa file trong queue bang nut X

### Điều kiện tiên quyết
- Queue 3 file.

### Các bước kiểm thử
- [ ] Queue 3 file
- [ ] Nhan X file thu 2
- [ ] Kiem tra queue

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Queue con 2. File 2 bi xoa. Thu tu khong thay doi.

**API**:
- Queue con 2. File 2 bi xoa. Thu tu khong thay doi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-025

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Upload PNG hop le

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Upload PNG thuc su.

### Dữ liệu kiểm thử
```
petition.active.D30, file.png.valid
```

### Kết quả mong đợi
**UI**:
- Thanh cong. Loai Hinh anh.

**API**:
- Thanh cong. Loai Hinh anh.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-026

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Upload ZIP - reject

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Upload .zip.

### Dữ liệu kiểm thử
```
petition.active.D30, file.zip.invalid
```

### Kết quả mong đợi
**API**:
- Loai khong duoc ho tro.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-027

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Deduplication - cung file 2 lan chi 1 trong queue

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Chon abc.pdf (100B)
- [ ] Chon lai abc.pdf (100B)

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Queue chi 1 entry. Dedup name+size.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-028

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Gop file tu 2 nguon - Chon file + Chon thu muc

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Chon 1 file
- [ ] Chon thu muc 2 file khac
- [ ] Xem queue

### Dữ liệu kiểm thử
```
petition.active.D30, folder.2files
```

### Kết quả mong đợi
**UI**:
- Queue = 3 file. Khong dedup (khac ten/size).

**API**:
- Queue = 3 file. Khong dedup (khac ten/size).

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-029

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tieu de whitespace-only - loi

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Nhap tieu de 3 spaces. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Loi: Vui long nhap tieu de (trim() trong). Khong gui.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-042

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Upload file SVG co XSS - reject

### Điều kiện tiên quyết
- File SVG co <script> tag.

### Các bước kiểm thử
- [ ] Upload xss.svg

### Dữ liệu kiểm thử
```
petition.active.D30, file.svg.xss
```

### Kết quả mong đợi
**API**:
- image/svg+xml khong trong ALLOWED_MIME_TYPES -> 400 Loai khong ho tro.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-043

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: approver1 role khong co quyen upload - FE guard

### Điều kiện tiên quyết
- Dang nhap approver1 (DEADLINE_APPROVER role).

### Các bước kiểm thử
- [ ] Vao /petitions/:id. Xem section Tai lieu.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Button Tai len tai lieu an hoac disabled. Khong co quyen write Document. 403 neu goi API.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: EntityDocumentsTab

---

## TC-044

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Download - user khong co quyen read

### Điều kiện tiên quyết
- Token role khong co permission read Document.

### Các bước kiểm thử
- [ ] GET /api/v1/documents/:id/download voi token thap quyen

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Forbidden. File stream khong duoc mo.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-049

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - title length = 1 char

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Nhap tieu de 1 ky tu A. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong. Title A hien trong list.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-050

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - title length = 255 chars

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Nhap tieu de 255 ky tu. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong. Title 255 chars luu OK (ktra DB schema limit).

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-051

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - title length = 256 chars - kiem tra DB constraint

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Nhap tieu de 256 ky tu. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Hoac: Prisma truncate/reject voi DB constraint error -> FE hien error. Hoac: Thanh cong neu DB cho phep VARCHAR(256+).

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-053

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - file application/msword (.doc)

### Điều kiện tiên quyết
- File .doc hop le.

### Các bước kiểm thử
- [ ] Upload .doc

### Dữ liệu kiểm thử
```
petition.active.D30, file.doc.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-054

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - file image/gif (.gif)

### Điều kiện tiên quyết
- File .gif hop le.

### Các bước kiểm thử
- [ ] Upload .gif

### Dữ liệu kiểm thử
```
petition.active.D30, file.gif.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong (image/gif trong ALLOWED_MIME_TYPES).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-055

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - file audio/mpeg (.mp3)

### Điều kiện tiên quyết
- File .mp3 hop le.

### Các bước kiểm thử
- [ ] Upload .mp3. Loai=Am thanh.

### Dữ liệu kiểm thử
```
petition.active.D30, file.mp3.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-058

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - file image/webp (.webp) - invalid

### Điều kiện tiên quyết
- File .webp

### Các bước kiểm thử
- [ ] Upload .webp

### Dữ liệu kiểm thử
```
petition.active.D30, file.webp.invalid
```

### Kết quả mong đợi
**API**:
- (webp khong trong ALLOWED_MIME_TYPES).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-059

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - queue size 1 file

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Chon 1 file. Xem queue.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Queue hien 1 item. Khong co 0 hoac -1 state.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-060

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY - xoa tat ca file trong queue roi upload

### Điều kiện tiên quyết
- Queue 3 file.

### Các bước kiểm thử
- [ ] Queue 3 file
- [ ] X tung file (3 lan)
- [ ] Nhan Tai len

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Sau khi xoa het: queue trong. Nhan Tai len -> loi Vui long chon file. 0 API calls.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: High
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-075

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Data & i18n`
- Yêu cầu: `REQ-G0-DOC-DATA`
- Kỹ thuật: `Data validation / i18n`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DATA - tieu de special chars <>?#%

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Title: '<test>&"query#%'. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Title luu as literal. Khong XSS. Hien thi dung.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Data & i18n`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Data & i18n`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: High
module: Data & i18n
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DATA | Entity: EntityDocumentsTab

---

## TC-076

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Data & i18n`
- Yêu cầu: `REQ-G0-DOC-DATA`
- Kỹ thuật: `Data validation / i18n`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DATA - mo ta 500 ky tu Unicode

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Mo ta 500 ky tu Unicode. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong. Description luu day du. Hien thi khi mo doc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Data & i18n`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Data & i18n`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: Medium
module: Data & i18n
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DATA | Entity: EntityDocumentsTab

---

## TC-081

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: INTEGRATION - huy xoa document

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] Nhan Delete
- [ ] Dialog hien
- [ ] Nhan Cancel

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- Doc van con trong list. DELETE API KHONG goi.

**API**:
- Doc van con trong list. DELETE API KHONG goi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-082

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: INTEGRATION - list docs pagination limit 100

### Điều kiện tiên quyết
- Petition co 50 docs.

### Các bước kiểm thử
- [ ] Xem section Tai lieu cua petition co 50 docs.

### Dữ liệu kiểm thử
```
petition.active.D30.50docs
```

### Kết quả mong đợi
**UI**:
- GET /documents?petitionId=X&limit=100 goi. Hien toi da 100 docs.

**API**:
- GET /documents?petitionId=X&limit=100 goi. Hien toi da 100 docs.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-084

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: INTEGRATION - upload audit log ghi nhan

### Điều kiện tiên quyết
- Upload thanh cong.

### Các bước kiểm thử
- [ ] Upload doc. Kiem tra audit log (GET /audit-logs hoac DB).

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Audit log co event DOCUMENT_UPLOADED voi userId, petitionId, fileName, ip, userAgent.

**API**:
- Audit log co event DOCUMENT_UPLOADED voi userId, petitionId, fileName, ip, userAgent.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: DocumentsController

---

## TC-085

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: INTEGRATION - download audit log ghi nhan

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] Download doc. Kiem tra audit log.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- Audit log co event DOCUMENT_DOWNLOADED voi userId, documentId, ip, userAgent.

**API**:
- Audit log co event DOCUMENT_DOWNLOADED voi userId, documentId, ip, userAgent.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: DocumentsController

---

## TC-091

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y - nut Tai len tai lieu co aria-label

### Điều kiện tiên quyết
- Component render.

### Các bước kiểm thử
- [ ] Inspect nut 'Tai len tai lieu' bang screen reader hoac aria tools.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Button co accessible name ro rang: 'Tai len tai lieu'. aria-label hoac text content.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: Medium
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-092

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y - nut Huy co accessible label

### Điều kiện tiên quyết
- Form upload mo.

### Các bước kiểm thử
- [ ] Inspect nut Huy.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Huy button: accessible name 'Huy'. Khong chi la icon.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: Medium
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-094

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: A11Y - error message lien ket voi field bang aria-describedby

### Điều kiện tiên quyết
- Submit form khong hop le.

### Các bước kiểm thử
- [ ] Inspect error alert va field.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Error message co role=alert hoac aria-live=polite. Screen reader announce khi error xuat hien.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: High
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-096

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: A11Y - focus visible tren tat ca interactive elements

### Điều kiện tiên quyết
- Cai dat moi (no custom focus override).

### Các bước kiểm thử
- [ ] Tab qua tat ca controls trong EntityDocumentsTab.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Focus ring visible tren moi element. Khong co element nao bi an focus. outline: none chi khi co :focus-visible visible alt.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: High
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-097

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y - progress indicator co aria-live khi uploading

### Điều kiện tiên quyết
- Upload dang chay.

### Các bước kiểm thử
- [ ] Kiem tra progress text bang screen reader trong khi upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Uploading X/Y text hoac progress aria-live=polite/assertive. Screen reader announce trang thai thay doi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: Medium
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-098

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y - color contrast tren button chu khi disabled

### Điều kiện tiên quyết
- Upload dang chay, button disabled.

### Các bước kiểm thử
- [ ] Kiem tra contrast ratio cua disabled button (opacity-60).

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- WCAG 2.1 AA: contrast >=3:1 cho text >= 18pt hoac >=4.5:1 cho text nho. Opacity-60 co the vi pham — can verify.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: Medium
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-099

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: A11Y - file remove button ('x') co aria-label voi ten file

### Điều kiện tiên quyết
- file trong queue.

### Các bước kiểm thử
- [ ] Inspect nut X (remove) ben canh filename.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- aria-label='Xoa bao_cao.pdf' hoac equivalent. Screen reader doc 'Remove bao_cao.pdf'. Khong chi la 'X'.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: High
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-102

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT - Edge (Chromium, latest): upload + folder select

### Điều kiện tiên quyết
- Edge latest tren Windows 11.

### Các bước kiểm thử
- [ ] Upload PDF. Thu folder upload (webkitdirectory).

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Folder button hoat dong. Upload thanh cong. Edge ho tro webkitdirectory.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: High
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-103

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT - Firefox (latest): webkitdirectory fallback

### Điều kiện tiên quyết
- Firefox latest.

### Các bước kiểm thử
- [ ] Thu Chon thu muc tren Firefox.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Firefox ho tro mozdirectory / webkitdirectory (Firefox 50+). Folder button kha dung. Neu khong ho tro: button an hoac disable voi tooltip.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: High
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-104

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT - Safari (macOS, latest): file input multiple

### Điều kiện tiên quyết
- Safari macOS latest.

### Các bước kiểm thử
- [ ] Mo file picker voi multiple. Chon 2 files.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- multiple attribute hoat dong tren Safari. Ca 2 file hien trong queue.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: High
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-105

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT - mobile Chrome (Android 13): tap upload

### Điều kiện tiên quyết
- Android 13 + Chrome mobile.

### Các bước kiểm thử
- [ ] Mo petition. Tap Tai len tai lieu. Chon file. Tai len.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- File picker mo thanh cong. Queue hien. Upload thanh cong. UI khong bi crop hay overflow.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: High
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-106

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT - mobile Safari (iOS 16+): upload PDF tu Files app

### Điều kiện tiên quyết
- iPhone iOS 16+ + Safari.

### Các bước kiểm thử
- [ ] Mo petition tren mobile Safari. Upload PDF tu Files app.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- accept attribute cho phep chon dung loai file. Upload thanh cong. Khong bi block boi iOS sandbox.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: High
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-107

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT - screen resolution 1366x768: form khong bi overflow

### Điều kiện tiên quyết
- x768 viewport.

### Các bước kiểm thử
- [ ] Resize browser den 1366x768. Mo form upload.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Form hien dung trong viewport. Khong co horizontal scrollbar. Khong co text bi cut.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: Medium
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-109

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT - zoom 200%: form van usable

### Điều kiện tiên quyết
- Zoom browser den 200%.

### Các bước kiểm thử
- [ ] Ctrl+plus den 200%. Mo form.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Form van usable. Text khong overlap. Scroll duoc. WCAG 1.4.4: reflow.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: Medium
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-111

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PERF - upload 1 file PDF 10MB < 30s tren mang binh thuong

### Điều kiện tiên quyết
- Mang binh thuong (>=10Mbps). File 10MB.

### Các bước kiểm thử
- [ ] Upload 1 file 10MB. Do thoi gian tu click Tai len den doc 'Tai len thanh cong'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.10mb
```

### Kết quả mong đợi
**API**:
- < 30 giay. Khong timeout. Khong 504 gateway timeout.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: High
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: DocumentsController

---

## TC-112

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PERF - upload 10 file nho (1KB) trong 60 giay khong bi throttle

### Điều kiện tiên quyết
- Throttle: 10 uploads/60s/user.

### Các bước kiểm thử
- [ ] Upload 10 file lien tiep trong 60 giay (dung folder upload).

### Dữ liệu kiểm thử
```
petition.active.D30, files.small.10pack
```

### Kết quả mong đợi
**API**:
- file thanh cong. File thu 11 trong 60s nhan 429. Throttle don vi la per-user, khong per-IP.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: High
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: DocumentsController

---

## TC-114

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF - GET /documents list 100 items - response < 1s

### Điều kiện tiên quyết
- Petition co 100 docs.

### Các bước kiểm thử
- [ ] Mo section Tai lieu cua petition co 100 docs. Do thoi gian fetch.

### Dữ liệu kiểm thử
```
petition.active.D30.100docs
```

### Kết quả mong đợi
**API**:
- GET /documents response < 1 giay. List hien day du. Khong loading spin qua 3s.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: Medium
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: DocumentsController

---

## TC-115

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PERF - concurrent 5 user upload cung 1 luc - khong deadlock

### Điều kiện tiên quyết
- user khac nhau.

### Các bước kiểm thử
- [ ] user dong thoi upload 1 file. Kiem tra response.

### Dữ liệu kiểm thử
```
case.active.D30.5users
```

### Kết quả mong đợi
**API**:
- Moi user nhan 201 doc lap. Khong deadlock. Khong 500. File cua moi user duoc luu rieng.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: High
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: DocumentsController

---

## TC-117

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `Edge Cases`
- Yêu cầu: `REQ-G0-DOC-EDGE`
- Kỹ thuật: `Edge case exploration`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EDGE - upload file co ten trung voi file da co trong list

### Điều kiện tiên quyết
- Petition da co doc 'bao_cao.pdf'.

### Các bước kiểm thử
- [ ] Upload them 1 file ten 'bao_cao.pdf'.

### Dữ liệu kiểm thử
```
petition.active.D30.existing_doc
```

### Kết quả mong đợi
**API**:
- Tuy chinh sach: (a) Accept va tao doc moi voi ten khac tren disk, hoac (b) Warning user. Khong replace file cu. Doc moi co originalName = 'bao_cao.pdf'.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Edge Cases`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Edge Cases`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: Medium
module: Edge Cases
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EDGE | Entity: EntityDocumentsTab

---

## TC-118

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `Edge Cases`
- Yêu cầu: `REQ-G0-DOC-EDGE`
- Kỹ thuật: `Edge case exploration`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EDGE - folder co subfolder - chi flat file, bo qua subfolder

### Điều kiện tiên quyết
- Thu muc co subfolder.

### Các bước kiểm thử
- [ ] Chon thu muc co cau truc: /root/file.pdf + /root/sub/file2.pdf. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, folder.with_subfolders
```

### Kết quả mong đợi
**API**:
- webkitdirectory tra ve ca file trong subfolder (recursive). Tat ca file hien trong queue. Khong co entry la thu muc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Edge Cases`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Edge Cases`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: Medium
module: Edge Cases
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EDGE | Entity: EntityDocumentsTab

---

## TC-119

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `Edge Cases`
- Yêu cầu: `REQ-G0-DOC-EDGE`
- Kỹ thuật: `Edge case exploration`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EDGE - file 0 byte - FE hoac BE reject

### Điều kiện tiên quyết
- File rong.

### Các bước kiểm thử
- [ ] Upload file 0 byte.

### Dữ liệu kiểm thử
```
petition.active.D30, file.empty
```

### Kết quả mong đợi
**API**:
- FE check: size === 0 → skip with error 'File khong the rong'. Hoac BE: multer reject 0 byte file voi 400.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Edge Cases`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Edge Cases`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: High
module: Edge Cases
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EDGE | Entity: EntityDocumentsTab

---

## TC-120

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `Edge Cases`
- Yêu cầu: `REQ-G0-DOC-EDGE`
- Kỹ thuật: `Edge case exploration`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EDGE - 2 file trung ten trong 1 queue - tu dong dedup

### Điều kiện tiên quyết
- Them 2 file cung name+size vao queue.

### Các bước kiểm thử
- [ ] Chon 2 file cung ten 'test.pdf' tu cung folder (hoac 2 folder khac nhau). Xem queue.

### Dữ liệu kiểm thử
```
petition.active.D30, files.duplicate_name
```

### Kết quả mong đợi
**API**:
- Queue chi hien 1 file (dedup by name+size). Khong co duplicate trong list. Hoac: hien canh bao 'Trung file'.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Edge Cases`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Edge Cases`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: Medium
module: Edge Cases
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EDGE | Entity: EntityDocumentsTab

---

## TC-123

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload PHP script voi .txt extension - accept (MAGIC_BYTE_BYPASS)

### Điều kiện tiên quyết
- File .txt voi noi dung <?php.

### Các bước kiểm thử
- [ ] Upload .txt co noi dung PHP.

### Dữ liệu kiểm thử
```
petition.active.D30, file.php_as_txt
```

### Kết quả mong đợi
**API**:
- text/plain bypass magic check → ACCEPT. Khong execute. Luu la plain text. NOTE: day la behavior hien tai, can review security.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-125

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - title qua dai (>500 ky tu) - 400

### Điều kiện tiên quyết
- API call truc tiep.

### Các bước kiểm thử
- [ ] POST /documents voi title = 501 ky tu.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO validate: MaxLength(500). 400. Message: 'title must be shorter than or equal to 500 characters'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-126

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - documentType sai enum value - 400

### Điều kiện tiên quyết
- API call truc tiep.

### Các bước kiểm thử
- [ ] POST /documents voi documentType='INVALID_TYPE'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO: IsEnum(DocumentType). 400. Message: 'documentType must be a valid enum value'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-135

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - dong thoi upload 2 file cung ten (race condition) - 1 thanh cong

### Điều kiện tiên quyết
- request dong thoi voi cung petitionId.

### Các bước kiểm thử
- [ ] Gui 2 POST /documents dong thoi voi cung title+file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Ca 2 co the thanh cong (2 docs rieng biet tren disk). Hoac BE co idempotency guard. Khong deadlock. Khong 500.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-135
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-136

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - DB down khi upload - 500 + file cleanup

### Điều kiện tiên quyết
- DB unavailable (simulated).

### Các bước kiểm thử
- [ ] POST /documents khi DB down.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE: file upload toi disk, DB insert fail → 500 Internal Server Error. File bi cleanup (unlink). Khong de file orphan.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-136
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-137

**Meta**:
- Loại: `RECOVERY`
- Priority: `P1` 🟠
- Module: `Recovery & Resilience`
- Yêu cầu: `REQ-G0-DOC-RECOVERY`
- Kỹ thuật: `Recovery / Resilience`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RECOVERY - upload fail (network cut) - form van mo, co the retry

### Điều kiện tiên quyết
- Upload bi ngat mang giua chung.

### Các bước kiểm thử
- [ ] Bat dau upload
- [ ] Ngat mang
- [ ] Doi response

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Timeout/network error → error message hien. Form KHONG dong. User co the retry. Khong hung.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Recovery & Resilience`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Recovery & Resilience`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-137
severity: High
module: Recovery & Resilience
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RECOVERY | Entity: EntityDocumentsTab

---

## TC-138

**Meta**:
- Loại: `RECOVERY`
- Priority: `P1` 🟠
- Module: `Recovery & Resilience`
- Yêu cầu: `REQ-G0-DOC-RECOVERY`
- Kỹ thuật: `Recovery / Resilience`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RECOVERY - refresh trang giua chung upload - khong co orphan file

### Điều kiện tiên quyết
- Upload dang chay.

### Các bước kiểm thử
- [ ] Bat dau upload 5MB
- [ ] Nhan F5
- [ ] Kiem tra disk + DB

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- FE reset ve trang thai ban dau. Neu BE da nhan file truoc khi refresh: cleanup hoac doc duoc tao. Khong orphan.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Recovery & Resilience`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Recovery & Resilience`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-138
severity: High
module: Recovery & Resilience
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RECOVERY | Entity: EntityDocumentsTab

---

## TC-140

**Meta**:
- Loại: `RECOVERY`
- Priority: `P1` 🟠
- Module: `Recovery & Resilience`
- Yêu cầu: `REQ-G0-DOC-RECOVERY`
- Kỹ thuật: `Recovery / Resilience`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RECOVERY - session expire khi dang upload - redirect login

### Điều kiện tiên quyết
- JWT het han trong khi upload dang chay.

### Các bước kiểm thử
- [ ] Upload. Token het han trong luc request. Kiem tra response.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid, user.expiring_token
```

### Kết quả mong đợi
**API**:
- FE nhan 401. Redirect den trang login hoac hien 'Phien lam viec het han, vui long dang nhap lai'. Khong lo data.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Recovery & Resilience`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Recovery & Resilience`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-140
severity: High
module: Recovery & Resilience
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RECOVERY | Entity: EntityDocumentsTab

---

## TC-141

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: AUDIT - upload ghi nhan entityType + entityId

### Điều kiện tiên quyết
- Upload doc cho petition.

### Các bước kiểm thử
- [ ] Upload. Kiem tra audit log.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Audit log: action=DOCUMENT_UPLOAD, entityType=PETITION, entityId=:id, userId=:uid, fileName=:name, ip=:ip.

**API**:
- Audit log: action=DOCUMENT_UPLOAD, entityType=PETITION, entityId=:id, userId=:uid, fileName=:name, ip=:ip.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-141
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: DocumentsController

---

## TC-142

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: AUDIT - download ghi nhan documentId + ip

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] Download. Kiem tra audit log.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- Audit log: action=DOCUMENT_DOWNLOAD, documentId=:id, userId=:uid, ip=:ip.

**API**:
- Audit log: action=DOCUMENT_DOWNLOAD, documentId=:id, userId=:uid, ip=:ip.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-142
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: DocumentsController

---

## TC-143

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: AUDIT - xoa ghi nhan soft-delete + deletedBy

### Điều kiện tiên quyết
- Doc da upload.

### Các bước kiểm thử
- [ ] Xoa doc. Kiem tra audit log.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- Audit log: action=DOCUMENT_DELETE, documentId=:id, deletedById=:uid. Doc bi soft-delete (deletedAt set).

**API**:
- Audit log: action=DOCUMENT_DELETE, documentId=:id, deletedById=:uid. Doc bi soft-delete (deletedAt set).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-143
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: DocumentsController

---

## TC-144

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Data & i18n`
- Yêu cầu: `REQ-G0-DOC-DATA`
- Kỹ thuật: `Data validation / i18n`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DATA - mimeType khong hop le trong FormData - BE validate accept

### Điều kiện tiên quyết
- API call truc tiep.

### Các bước kiểm thử
- [ ] POST /documents voi mimeType='application/x-www-form-urlencoded' nhung file thuc la PDF.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE: multer lay mimeType tu file content-type header. mimeType field trong FormData khong duoc tin tuong. Kiem tra magic byte thi trust.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Data & i18n`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Data & i18n`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-144
severity: High
module: Data & i18n
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DATA | Entity: DocumentsController

---

## TC-150

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY - CSRF: POST /documents tu origin khac - reject

### Điều kiện tiên quyết
- App co CSRF protection hoac SameSite cookie.

### Các bước kiểm thử
- [ ] Simulated CSRF: cross-origin POST /documents.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- CORS reject (origin khong trong whitelist) hoac CSRF token missing → 403. Tuy config CORS/CSRF.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-150
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-151

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GREEN - delete document: soft delete, van query duoc boi admin

### Điều kiện tiên quyết
- Doc da upload + xoa.

### Các bước kiểm thử
- [ ] Xoa doc (DELETE /documents/:id)
- [ ] Admin GET /documents?includeDeleted=true

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**UI**:
- Soft delete: deletedAt set. GET /documents khong tra ve (FE list). Admin API co the tra ve. Disk file con do.

**API**:
- Soft delete: deletedAt set. GET /documents khong tra ve (FE list). Admin API co the tra ve. Disk file con do.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-151
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: DocumentsController

---

## TC-152

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GREEN - file doc type HINH_ANH (image) - accept + hien thumbnail

### Điều kiện tiên quyết
- File JPEG hop le.

### Các bước kiểm thử
- [ ] Upload JPEG voi documentType='HINH_ANH'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.jpg.valid
```

### Kết quả mong đợi
**UI**:
- Upload 201. List doc hien thumbnail hoac icon hinh anh. documentType='HINH_ANH'.

**API**:
- Upload 201. List doc hien thumbnail hoac icon hinh anh. documentType='HINH_ANH'.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-152
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-153

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GREEN - file type AM_THANH (MP3) - upload + download

### Điều kiện tiên quyết
- File MP3 hop le.

### Các bước kiểm thử
- [ ] Upload MP3 voi type='AM_THANH'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.mp3.valid
```

### Kết quả mong đợi
**UI**:
- Upload 201. Download tra ve MP3 voi Content-Type: audio/mpeg.

**API**:
- Upload 201. Download tra ve MP3 voi Content-Type: audio/mpeg.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-153
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-163

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - title 1 ky tu - accept

### Điều kiện tiên quyết
- Title: '1 ky tu'.

### Các bước kiểm thử
- [ ] Upload voi title='A'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept. Khong co min-length validate.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-163
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-164

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - title 500 ky tu - accept (max)

### Điều kiện tiên quyết
- Title exactly 500 ky tu.

### Các bước kiểm thử
- [ ] API upload voi title = 500 ky tu.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept. 201.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-164
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-165

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY - title 501 ky tu - reject

### Điều kiện tiên quyết
- Title exactly 501 ky tu.

### Các bước kiểm thử
- [ ] API upload voi title = 501 ky tu.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- ValidationError: MaxLength.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-165
severity: High
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-166

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP - MIME group: image types (jpg jpeg png gif) - accept

### Điều kiện tiên quyết
- File hop le tung loai.

### Các bước kiểm thử
- [ ] Upload .jpg, .jpeg, .png, .gif rieng le.

### Dữ liệu kiểm thử
```
petition.active.D30, files.image_group
```

### Kết quả mong đợi
**API**:
- Ca 4 loai: 201 Accept. Magic byte match content-type.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-166
severity: High
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-167

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - MIME group: video + audio (mp4 mp3) - accept

### Điều kiện tiên quyết
- File video/audio hop le.

### Các bước kiểm thử
- [ ] Upload .mp4 va .mp3.

### Dữ liệu kiểm thử
```
petition.active.D30, file.mp4.valid, file.mp3.valid
```

### Kết quả mong đợi
**API**:
- Ca 2: 201. Content-Type dung.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-167
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-171

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GREEN - upload report xuat bat dong bo khi co loi mot so file

### Điều kiện tiên quyết
- file: 2 hop le + 1 qua 10MB.

### Các bước kiểm thử
- [ ] Upload folder co 3 file (2 ok + 1 too large). Kiem tra ket qua.

### Dữ liệu kiểm thử
```
petition.active.D30, files.mixed_valid_invalid
```

### Kết quả mong đợi
**UI**:
- File ok (2): upload thanh cong, hien trong list. File fail (1): bao loi 'bao_cao_lon.pdf: File qua lon'. Form van mo. List co 2 doc moi. Khong mat du lieu.

**API**:
- File ok (2): upload thanh cong, hien trong list. File fail (1): bao loi 'bao_cao_lon.pdf: File qua lon'. Form van mo. List co 2 doc moi. Khong mat du lieu.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-171
severity: High
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-185

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - petitionId la cuid format sai - 400

### Điều kiện tiên quyết
- petitionId = 'not-a-cuid'.

### Các bước kiểm thử
- [ ] POST /documents voi petitionId = 'not-a-cuid'.

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO validate: IsCuid hoac IsString. 400. Hoac Prisma 404 (khong tim thay).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-185
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-189

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload voi title only whitespace - BE reject

### Điều kiện tiên quyết
- API truc tiep voi title = '   '.

### Các bước kiểm thử
- [ ] POST voi title = '   '.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO: @IsNotEmpty({each:true}) / @Matches trim. 400. Hoac FE da block truoc.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-189
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-192

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - doc file vat ly bi xoa khoi disk - download 500 hoac 404

### Điều kiện tiên quyết
- DB co doc nhung file tren disk bi xoa ngoai he thong.

### Các bước kiểm thử
- [ ] GET /documents/:id/download khi file khong con tren disk.

### Dữ liệu kiểm thử
```
document.orphaned_db_record
```

### Kết quả mong đợi
**API**:
- fs.existsSync fail. 404 hoac 500. Message: 'File khong ton tai tren server'. Khong reveal duong dan.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-192
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-194

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - mo ta co Markdown injection - luu literal

### Điều kiện tiên quyết
- Mo ta voi Markdown.

### Các bước kiểm thử
- [ ] Mo ta: '**bold** [link](javascript:alert(1))'. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Luu literal. Neu app render Markdown: link sanitized. Khong XSS via Markdown injection.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-194
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-195

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - concurrent DELETE + GET cung 1 doc - khong 500

### Điều kiện tiên quyết
- request dong thoi.

### Các bước kiểm thử
- [ ] Dong thoi DELETE va GET /download cho cung 1 documentId.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Soft delete: 1 trong 2 se gap race. Khong deadlock. Khong 500. DELETE ok → 200, GET ra sau → 404.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-195
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-196

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - file tren disk bi doi chu so huu (permission denied) - 500 + clean message

### Điều kiện tiên quyết
- uploads/documents/ khong co write permission.

### Các bước kiểm thử
- [ ] Upload khi thu muc khong co write permission.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- multer: EACCES error. 500 Internal Server Error. Message an toan: 'Loi he thong, vui long thu lai sau'. Khong reveal duong dan he thong.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-196
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-197

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - disk full khi upload - 500 + clean message

### Điều kiện tiên quyết
- Disk full (ENOSPC).

### Các bước kiểm thử
- [ ] Upload khi disk het dung luong.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- ENOSPC → 500. 'He thong tam thoi qua tai, vui long thu lai sau'. Khong reveal du lieu he thong.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-197
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-200

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload .csv file - reject (khong trong allowed list)

### Điều kiện tiên quyết
- CSV file hop le.

### Các bước kiểm thử
- [ ] Upload .csv file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.csv.valid
```

### Kết quả mong đợi
**API**:
- text/csv khong trong ALLOWED_MIME_TYPES → 400.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-200
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-201

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload .xml file - reject

### Điều kiện tiên quyết
- XML file hop le.

### Các bước kiểm thử
- [ ] Upload .xml file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.xml.valid
```

### Kết quả mong đợi
**API**:
- application/xml reject → 400.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-201
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-204

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload multi-file khi 1 file la 0 bytes - skip zero-byte, upload rest

### Điều kiện tiên quyết
- Queue co 3 file: 2 hop le + 1 zero-byte.

### Các bước kiểm thử
- [ ] Upload 3 file trong queue co 1 file rong.

### Dữ liệu kiểm thử
```
petition.active.D30, files.mixed_zerob
```

### Kết quả mong đợi
**API**:
- FE: filter ra file 0 byte truoc khi upload. Hoac: file 0 byte goi BE → BE reject → partial success. 2 file thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-204
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-205

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload voi description co NUL byte - sanitize hoac reject

### Điều kiện tiên quyết
- Description chua NUL byte.

### Các bước kiểm thử
- [ ] POST /documents voi description co \u0000.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO sanitize NUL. Hoac reject 400. Khong luu NUL vao DB (PostgreSQL reject NUL in text).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-205
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-206

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload voi file la directory pretending to be file - BE reject

### Điều kiện tiên quyết
- Gia lap thu muc trong FormData.

### Các bước kiểm thử
- [ ] POST FormData voi file la empty, size=0, type='inode/directory'.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- multer: reject. 400. Khong cho upload thu muc.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-206
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-207

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - petition.status = DANG_XU_LY (active) vs DINH_CHI - upload van duoc phep

### Điều kiện tiên quyết
- Petition status = DINH_CHI (tam dinh chi).

### Các bước kiểm thử
- [ ] Upload doc vao petition co status = DINH_CHI.

### Dữ liệu kiểm thử
```
petition.suspended.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Tuy business rule: neu upload bi block khi petition DINH_CHI → 403. Neu khong block → 201. Phai co ro policy.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-207
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-208

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - concurrent upload + throttle: 10 user khac nhau co the upload cung luc

### Điều kiện tiên quyết
- Throttle la per-user.

### Các bước kiểm thử
- [ ] user khac nhau upload dong thoi (1 file/user).

### Dữ liệu kiểm thử
```
users.10_different, file.pdf.valid, petition.active.D30
```

### Kết quả mong đợi
**API**:
- Tat ca 10 nhan 201. Throttle khong block user khac nhau. per-user rate limit.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-208
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-210

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - GET /documents?limit=999 - gioi han toi da 100

### Điều kiện tiên quyết
- Petition co 200 docs.

### Các bước kiểm thử
- [ ] GET /documents?petitionId=:id&limit=999.

### Dữ liệu kiểm thử
```
petition.active.D30.200docs, user.officer1
```

### Kết quả mong đợi
**API**:
- BE cap limit: max 100. Tra ve toi da 100 docs. Khong bi abuse (data dump).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-210
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-212

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload qua 3 file cung luc khi throttle con 3 slot - partial throttle

### Điều kiện tiên quyết
- Da dung 7/10 slot trong 60s.

### Các bước kiểm thử
- [ ] Upload 4 file mot luc. Chi co 3 slot con.

### Dữ liệu kiểm thử
```
petition.active.D30, files.4pack
```

### Kết quả mong đợi
**API**:
- File 1-3: 201 (dung het slot). File 4: 429. FE: hien ket qua hon hop (3 ok, 1 throttled).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-212
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-214

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - pagination: skip/limit param injection - BE sanitize

### Điều kiện tiên quyết
- API call.

### Các bước kiểm thử
- [ ] GET /documents?limit=-1&skip=-100 hoac limit='all'.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- BE validate: limit la positive integer, fallback to default 50 hoac 100. Khong query tat ca records.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-214
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-215

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload va sau do xoa entity cha (petition) - doc van con hoac cascade

### Điều kiện tiên quyết
- Petition bi xoa sau khi da co doc.

### Các bước kiểm thử
- [ ] Xoa petition. Kiem tra doc lien ket.

### Dữ liệu kiểm thử
```
petition.to_delete.D30, document.linked.D30
```

### Kết quả mong đợi
**API**:
- Cascade behavior: cascade delete hoac set petitionId=null. Khong orphan FK. DB constraint dung.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-215
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-217

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - download trong khi stream bi ngat - client giai quyen

### Điều kiện tiên quyết
- Download file 5MB+. Ngat mang giua chung.

### Các bước kiểm thử
- [ ] Bat dau download. Ngat connection.

### Dữ liệu kiểm thử
```
document.large.D30
```

### Kết quả mong đợi
**API**:
- Stream cleanup: ECONNRESET duoc xu ly. No crash. No zombie stream. Server khong bi stuck.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-217
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-218

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload multi-part request bi cat dang dung (partial boundary) - BE xu ly

### Điều kiện tiên quyết
- Multipart request bi ket thuc dot ngot.

### Các bước kiểm thử
- [ ] POST voi multipart content bi cat truncated (Content-Length sai).

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- multer: incomplete upload. 400 hoac 500 xay ra. File bi xoa. Khong luu file chua hoan chinh tren disk.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-218
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-219

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload khi petition bi locked boi system (status = DANG_GIAI_QUYET) - 409

### Điều kiện tiên quyết
- Petition co trang thai locked.

### Các bước kiểm thử
- [ ] Upload vao petition locked.

### Dữ liệu kiểm thử
```
petition.locked.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Conflict hoac 403 tuy business rule. Message: 'Don thu dang trong qua trinh xu ly, khong the tai them tai lieu.'

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-219
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-222

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload voi Content-Length: 0 trong multipart - BE reject

### Điều kiện tiên quyết
- Content-Length = 0 truoc khi gui.

### Các bước kiểm thử
- [ ] POST voi Content-Length: 0 trong header.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- multer: empty body → 400.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-222
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-223

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - fetchDocs fail (network) - hien error, khong empty list

### Điều kiện tiên quyết
- GET /documents tra ve network error.

### Các bước kiểm thử
- [ ] Simulate network error cho fetchDocs. Xem component.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Error state: 'Khong tai duoc danh sach tai lieu.' Khong hien list rong nhu khong co doc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-223
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-224

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - fetchDocs 500 server error - hien error toast

### Điều kiện tiên quyết
- GET /documents tra ve 500.

### Các bước kiểm thử
- [ ] Simulate 500 cho fetchDocs.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- Component khong crash. Error message hien. Retry possible.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-224
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-226

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED - caseId khong co dau quotes (UUID v4 format gia) - 404

### Điều kiện tiên quyết
- caseId la UUID v4.

### Các bước kiểm thử
- [ ] POST voi caseId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479' (UUID v4).

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Prisma: UUID khong la cuid → Prisma convert → 404 Not Found. Khong 500.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-226
severity: Medium
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-229

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - description > 2000 ky tu - BE reject

### Điều kiện tiên quyết
- API call voi description = 2001 ky tu.

### Các bước kiểm thử
- [ ] POST voi description = 2001 chars.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- DTO MaxLength(2000) hoac tuong duong → 400.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-229
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-231

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload queue voi file trung lam (dedup) - chi upload 1 lan

### Điều kiện tiên quyết
- file cung name+size trong queue sau khi dedup.

### Các bước kiểm thử
- [ ] Add cung file 2 lan (2 file objects khac nhau nhung same name+size).

### Dữ liệu kiểm thử
```
petition.active.D30, files.duplicate_same_file
```

### Kết quả mong đợi
**API**:
- handleFilesChange dedup by name+size. Queue chi co 1 copy. POST chi goi 1 lan.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-231
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-236

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - file size exactly 1 byte - accept

### Điều kiện tiên quyết
- File 1 byte.

### Các bước kiểm thử
- [ ] Upload 1-byte file.

### Dữ liệu kiểm thử
```
petition.active.D30, file.1byte
```

### Kết quả mong đợi
**API**:
- Accept. 201.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-236
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-237

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - file size 10485759 bytes (10MB - 1) - accept

### Điều kiện tiên quyết
- File 10MB-1 byte.

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.10mb_minus1
```

### Kết quả mong đợi
**API**:
- Accept. 201.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-237
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-238

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - description exactly 0 chars (empty string) - accept (optional field)

### Điều kiện tiên quyết
- Mo ta de trong.

### Các bước kiểm thử
- [ ] Upload voi description=''.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept. description=null/empty. 201.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-238
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-239

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - description exactly 2000 chars - accept

### Điều kiện tiên quyết
- description = 2000 ky tu.

### Các bước kiểm thử
- [ ] API upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept. 201.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-239
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-240

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY - description exactly 2001 chars - reject

### Điều kiện tiên quyết
- description = 2001 ky tu.

### Các bước kiểm thử
- [ ] API upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- MaxLength(2000).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-240
severity: High
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-242

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY - 100 file trong folder - upload 100 files sequentially

### Điều kiện tiên quyết
- Folder 100 files nho (1KB/file).

### Các bước kiểm thử
- [ ] Chon folder 100 files. Xem queue. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, folder.100files
```

### Kết quả mong đợi
**API**:
- Queue hien 100 files. Upload bat dau. Throttle: 10 files dau ok, tu file 11 cung gio → 429. Form hien error cho batch tiep theo.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-242
severity: High
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-243

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - filename co khoang trang - accept

### Điều kiện tiên quyết
- File co ten 'bao cao chinh.pdf'.

### Các bước kiểm thử
- [ ] Upload file co ten chua khoang trang.

### Dữ liệu kiểm thử
```
petition.active.D30, file.space_name
```

### Kết quả mong đợi
**API**:
- Accept. originalName = 'bao cao chinh.pdf'. Download filename encoded dung (RFC 5987).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-243
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-244

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - filename chi co Unicode - accept

### Điều kiện tiên quyết
- File ten '解决方案.pdf'.

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.unicode_name
```

### Kết quả mong đợi
**API**:
- Accept. originalName luu dung UTF-8. Download dung.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-244
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-246

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - filename double extension: report.docx.pdf - accept

### Điều kiện tiên quyết
- File ten double extension.

### Các bước kiểm thử
- [ ] Upload 'report.docx.pdf' voi content PDF.

### Dữ liệu kiểm thử
```
petition.active.D30, file.double_ext
```

### Kết quả mong đợi
**API**:
- Accept. magic byte match PDF. originalName = 'report.docx.pdf'. Khong bi confused.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-246
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-247

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - documentType = KHAC - accept

### Điều kiện tiên quyết
- Type = KHAC.

### Các bước kiểm thử
- [ ] Upload voi documentType='KHAC'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept. 201. KHAC la valid DocumentType enum.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-247
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-248

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - documentType = VIDEO voi file MP4 - accept

### Điều kiện tiên quyết
- Type = VIDEO, file MP4.

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.mp4.valid
```

### Kết quả mong đợi
**API**:
- Accept. 201. documentType='VIDEO'.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-248
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-249

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP - 3 entity kinds (case/incident/petition) × all doctypes = 15 combos

### Điều kiện tiên quyết
- Moi entity kind + 5 doc types.

### Các bước kiểm thử
- [ ] Upload doc cho case/incident/petition × VAN_BAN/HINH_ANH/VIDEO/AM_THANH/KHAC.

### Dữ liệu kiểm thử
```
case.active.D30, incident.active.D30, petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Tat ca 15 combo: 201. Scope check dung cho tung entity kind.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-249
severity: High
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-251

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP - folder rong (0 file) - queue empty, khong upload

### Điều kiện tiên quyết
- Folder rong.

### Các bước kiểm thử
- [ ] Chon folder rong.

### Dữ liệu kiểm thử
```
petition.active.D30, folder.empty
```

### Kết quả mong đợi
**API**:
- files.length === 0. Queue empty. Khong hien loi. Khong upload.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-251
severity: Medium
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: EntityDocumentsTab

---

## TC-253

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: A11Y - 'Chon thu muc' button co role button + aria-label

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Inspect 'Chon thu muc' button.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- role=button. aria-label='Chon thu muc'. Screen reader doc dung.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-253
severity: High
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-254

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: A11Y - progress text thong bao bang aria-live khi upload 3 files

### Điều kiện tiên quyết
- Upload 3 files.

### Các bước kiểm thử
- [ ] Monitor aria-live regions.

### Dữ liệu kiểm thử
```
petition.active.D30, files.3pack
```

### Kết quả mong đợi
**UI**:
- 'Dang tai len 1/3...' → '2/3' → '3/3' → 'Hoan thanh'. Moi update co aria-live='polite'. Screen reader thong bao tung buoc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-254
severity: High
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-257

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: A11Y - form upload co tieu de (heading hoac aria-label)

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Inspect heading structure.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Form upload co heading 'Tai len tai lieu' voi muc heading phu hop (h3/h4 hoac aria-label tren fieldset). Screen reader navigate duoc.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-257
severity: High
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-258

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: A11Y - queue list item co nut xoa voi ten file trong accessible name

### Điều kiện tiên quyết
- file trong queue.

### Các bước kiểm thử
- [ ] Inspect X button voi screen reader.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Nut X: aria-label='Xoa {filename}'. Khong chi la 'X'. Screen reader: 'Xoa bao_cao.pdf, button'.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-258
severity: High
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-260

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT - tablet (iPad 10, iOS 16) landscape mode

### Điều kiện tiên quyết
- iPad 10 landscape.

### Các bước kiểm thử
- [ ] Mo form upload tren tablet.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Form hien dung trong 1024px viewport. Khong overlap. Upload hoat dong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-260
severity: High
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-263

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT - Vietnamese IME input cho title (VNI/Telex)

### Điều kiện tiên quyết
- VNI/Telex keyboard input.

### Các bước kiểm thử
- [ ] Nhap tieu de tieng Viet bang IME.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Unicode tieng Viet go dung. Khong bi mat ky tu khi dung IME. onChange xu ly dung.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-263
severity: High
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-264

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT - clipboard paste vao title (Ctrl+V)

### Điều kiện tiên quyết
- Clipboard co text.

### Các bước kiểm thử
- [ ] Paste text vao title input.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Text duoc paste dung. onChange goi. Ky tu Unicode giu nguyen.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-264
severity: Medium
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-267

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF - GET /documents tai ba entity cung luc < 2s moi request

### Điều kiện tiên quyết
- entities cung co docs.

### Các bước kiểm thử
- [ ] Dong thoi fetch docs cho 3 entities khac nhau.

### Dữ liệu kiểm thử
```
case.active.D30, incident.active.D30, petition.active.D30
```

### Kết quả mong đợi
**API**:
- Moi GET /documents < 2s. Total concurrent 3 requests OK.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-267
severity: Medium
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: DocumentsController

---

## TC-268

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF - EntityDocumentsTab render < 500ms voi 100 docs

### Điều kiện tiên quyết
- Petition co 100 docs.

### Các bước kiểm thử
- [ ] Render component. Do thoi gian.

### Dữ liệu kiểm thử
```
petition.active.D30.100docs
```

### Kết quả mong đợi
**API**:
- Component render hoan thanh < 500ms. Khong lag.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-268
severity: Medium
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: EntityDocumentsTab

---

## TC-269

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF - upload 3 file trong 60s: 3 POST < 5s tong cong

### Điều kiện tiên quyết
- file nho (5KB moi).

### Các bước kiểm thử
- [ ] Upload 3 file. Do tong thoi gian.

### Dữ liệu kiểm thử
```
petition.active.D30, files.3small
```

### Kết quả mong đợi
**API**:
- POST sequential < 5s total (moi <2s). UI phan hoi.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-269
severity: Medium
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: EntityDocumentsTab

---

## TC-271

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY - Content-Security-Policy header trong response

### Điều kiện tiên quyết
- Download request.

### Các bước kiểm thử
- [ ] GET /documents/:id/download. Kiem tra headers.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Response co Content-Security-Policy header. Khong cho iframe embed unauthorized. download response an toan.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-271
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-273

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY - rate limit: 10 failed upload attempts tu 1 IP - block IP sau nguong

### Điều kiện tiên quyết
- 0+ failed attempts tu 1 IP.

### Các bước kiểm thử
- [ ] Gui 15 request fail lien tiep.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.invalid
```

### Kết quả mong đợi
**API**:
- Throttle hoac IP-based rate limit. 429 sau 10 attempts. Log ghi nhan suspicious activity.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-273
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-274

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY - response khong lo Content-Type trong error 400

### Điều kiện tiên quyết
- Upload fail.

### Các bước kiểm thử
- [ ] Upload file invalid. Kiem tra error response.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.invalid
```

### Kết quả mong đợi
**API**:
- Content-Type: application/json. Khong text/html (phong XSS trong error response). Khong stack trace.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-274
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-275

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY - audit trail: failed upload attempt duoc ghi nhan

### Điều kiện tiên quyết
- Upload bi reject.

### Các bước kiểm thử
- [ ] Upload file invalid. Kiem tra audit log.

### Dữ liệu kiểm thử
```
petition.active.D30, file.exe.invalid
```

### Kết quả mong đợi
**API**:
- Audit log: DOCUMENT_UPLOAD_FAILED, userId, ip, fileName, reason. Tro cuu bao mat.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-275
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-277

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY - X-Content-Type-Options: nosniff tren response

### Điều kiện tiên quyết
- Bat ky response.

### Các bước kiểm thử
- [ ] Kiem tra X-Content-Type-Options header.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- X-Content-Type-Options: nosniff. Browser khong MIME-sniff content-type.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-277
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-278

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY - zip bomb detection: file nen 1KB expand den 10GB

### Điều kiện tiên quyết
- Zip bomb file (neu MIME cho phep zip).

### Các bước kiểm thử
- [ ] Upload file .zip trong ALLOWED list (hoac .docx co zip bomb ben trong).

### Dữ liệu kiểm thử
```
petition.active.D30, file.zipbomb
```

### Kết quả mong đợi
**API**:
- Neu .zip khong trong allowed: reject. Neu .docx: unzip check dung; size limit prevent extraction. Khong OOM.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-278
severity: High
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-281

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload khi DB transaction timeout - 500 + file cleanup

### Điều kiện tiên quyết
- DB transaction timeout.

### Các bước kiểm thử
- [ ] POST voi DB query lag > 30s.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Transaction timeout → 500. file bi cleanup. Khong partial state.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-281
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-282

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED - upload FormData co extra fields (unknown props) - ignore them

### Điều kiện tiên quyết
- FormData co truong khong biet.

### Các bước kiểm thử
- [ ] POST voi fields la: 'maliciousField=true'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE ignore unknown fields (DTO validation). 201 Accept. Khong luu extra fields vao DB.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-282
severity: Medium
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-284

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload voi petitionId la ObjectID format (Mongo) - 400 hoac 404

### Điều kiện tiên quyết
- petitionId = '507f1f77bcf86cd799439011' (MongoDB ObjectId format).

### Các bước kiểm thử
- [ ] POST.

### Dữ liệu kiểm thử
```
file.pdf.valid
```

### Kết quả mong đợi
**API**:
- hoac 404. Khong 500. Prisma xac thuc ID format.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-284
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-285

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload chua co internet connection (offline) - FE error

### Điều kiện tiên quyết
- Browser offline.

### Các bước kiểm thử
- [ ] Tat mang. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- FE: network error. Error message: 'Loi ket noi. Kiem tra mang va thu lai.' Khong crash.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-285
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-287

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload chay khi trang dang navigate away - huy upload

### Điều kiện tiên quyết
- Upload dang chay. Navigate sang trang khac.

### Các bước kiểm thử
- [ ] Upload file 5MB. Navigate di ngay.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.5mb
```

### Kết quả mong đợi
**API**:
- Upload bi huy (AbortController hoac FE unmount cleanup). Khong zombie request. Neu file da len server: cleanup hoac tao doc bi dat flag.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-287
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-291

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - tam dinh chi upload: ngan hang upload khi BE maintenance mode

### Điều kiện tiên quyết
- Maintenance mode flag.

### Các bước kiểm thử
- [ ] Upload khi maintenance flag = true.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Service Unavailable. Message: 'He thong dang bao tri, vui long thu lai sau.' Form hien loi.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-291
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-297

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - folder upload: hidden OS files (.DS_Store) duoc filter hoac rejected

### Điều kiện tiên quyết
- Folder co .DS_Store.

### Các bước kiểm thử
- [ ] Chon folder tren macOS.

### Dữ liệu kiểm thử
```
petition.active.D30, folder.with_dsstore
```

### Kết quả mong đợi
**API**:
- FE: filter file bat dau bang '.'. Hoac BE reject mime. .DS_Store khong duoc luu.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-297
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-299

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - fetch docs sau upload fail - list van hien docs cu

### Điều kiện tiên quyết
- Upload fail.

### Các bước kiểm thử
- [ ] Upload that bai. Xem danh sach docs.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- fetchDocs() KHONG duoc goi khi tat ca file fail. List hien docs cu (truoc khi fail). Khong load lai.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-299
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-305

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload PNG corrupt (broken header) - magic byte fail hoac multer reject

### Điều kiện tiên quyết
- PNG voi header bi corrupt.

### Các bước kiểm thử
- [ ] Upload corrupt PNG.

### Dữ liệu kiểm thử
```
petition.active.D30, file.png.corrupt
```

### Kết quả mong đợi
**API**:
- file-type: unknown hoac corrupt → reject 400. Hoac multer accept nhung magic check fail.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-305
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-306

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload DOCX voi OLE exploit (malformed XML) - accept nhung khong execute

### Điều kiện tiên quyết
- DOCX voi malformed XML.

### Các bước kiểm thử
- [ ] Upload DOCX voi malformed XML.

### Dữ liệu kiểm thử
```
petition.active.D30, file.docx.malformed
```

### Kết quả mong đợi
**API**:
- Accept (magic byte ok). Khong execute. Server khong parse noi dung. Luu as binary blob.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-306
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-307

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload voi X-Forwarded-For spoofed IP - throttle by real IP

### Điều kiện tiên quyết
- Request voi X-Forwarded-For: 1.1.1.1.

### Các bước kiểm thử
- [ ] POST voi X-Forwarded-For: 1.1.1.1 tu IP thuc 10.0.0.1.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Throttle dung IP thuc (sau proxy). X-Forwarded-For khong bypass throttle. NestJS ThrottlerGuard lay IP dung.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-307
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-308

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED - upload voi Content-Disposition attachment trong multipart - ignore

### Điều kiện tiên quyết
- Multipart part co Content-Disposition attack.

### Các bước kiểm thử
- [ ] Gui multipart voi Content-Disposition: attachment; filename='../../../etc/passwd'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- multer lay filename an toan. path.basename strip ../. originalName = 'passwd'. Khong path traversal.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-308
severity: Critical
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-309

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload khi disk space co 1 byte con (edge disk capacity) - fail gracefully

### Điều kiện tiên quyết
- Disk chi con 1 byte.

### Các bước kiểm thử
- [ ] Upload file 1KB.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- ENOSPC. 500. Message an toan. file khong duoc tao. Cleanup bat ky temp file.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-309
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-310

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - download bi revoke giua chung stream - stream closed cleanly

### Điều kiện tiên quyết
- Download dang stream.

### Các bước kiểm thử
- [ ] Admin revoke access giua chung download.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Stream bi cat. 403 hoac partial 206. Khong server crash. Resource cleanup.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-310
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-311

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - tai len khi petition co flag 'archived' - 403 hoac 409

### Điều kiện tiên quyết
- Petition da duoc archive.

### Các bước kiểm thử
- [ ] Upload vao petition archived.

### Dữ liệu kiểm thử
```
petition.archived.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Forbidden hoac 409 Conflict. 'Don thu da bi luu tru, khong the tai them tai lieu.'

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-311
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-314

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED - upload khi BE tra ve 503 (service unavailable) - FE retry suggestion

### Điều kiện tiên quyết
- BE tra ve 503.

### Các bước kiểm thử
- [ ] Upload. BE 503.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- FE error: 'Dich vu tam thoi khong kha dung. Vui long thu lai sau.' Form giu nguyen.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-314
severity: High
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-316

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - GET /documents?limit=0 - tra ve empty hoac default

### Điều kiện tiên quyết
- limit=0 trong query.

### Các bước kiểm thử
- [ ] GET /documents?petitionId=:id&limit=0.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**API**:
- BE: limit=0 → tra ve default 50 hoac error 400. Khong tra ve all records.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-316
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-319

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY - file 10000001 bytes (9.5MB) - accept

### Điều kiện tiên quyết
- File 9.5MB.

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.9_5mb
```

### Kết quả mong đợi
**API**:
- Accept. 201. (Duoi 10MB limit).

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-319
severity: Medium
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

---

## TC-320

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PERF - concurrent 10 downloads cung entity - khong block

### Điều kiện tiên quyết
- 0 clients download cung 1 doc.

### Các bước kiểm thử
- [ ] concurrent GET /documents/:id/download.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Tat ca 10 response < 5s. Stream song song. Khong block nhau. Server khong het thread.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-320
severity: High
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: DocumentsController

---

## TC-030

**Meta**:
- Loại: `GREEN`
- Priority: `P2` 🟡
- Module: `Tải lên tài liệu - Happy path`
- Yêu cầu: `REQ-G0-DOC-GREEN`
- Kỹ thuật: `Black-box / Use case`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Upload MP4 hop le

### Điều kiện tiên quyết
- File .mp4 <=10MB.

### Các bước kiểm thử
- [ ] Upload mp4. Loai=Video.

### Dữ liệu kiểm thử
```
petition.active.D30, file.mp4.valid
```

### Kết quả mong đợi
**UI**:
- Thanh cong. Type Video.

**API**:
- Thanh cong. Type Video.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Tải lên tài liệu - Happy path`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Tải lên tài liệu - Happy path`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Medium
module: Tải lên tài liệu - Happy path
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: GREEN | Entity: EntityDocumentsTab

---

## TC-077

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Data & i18n`
- Yêu cầu: `REQ-G0-DOC-DATA`
- Kỹ thuật: `Data validation / i18n`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: DATA - filename chi co so

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Upload '123456.pdf'

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Thanh cong.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Data & i18n`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Data & i18n`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: Low
module: Data & i18n
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: DATA | Entity: EntityDocumentsTab

---

## TC-093

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y - file queue list dung role list

### Điều kiện tiên quyết
- file trong queue.

### Các bước kiểm thử
- [ ] Inspect DOM structure cua file queue.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- ul/ol hoac role=list, moi file la li hoac role=listitem. Screen reader doc duoc 'X files in queue'.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: Medium
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-108

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT - dark mode: cac mau van readable

### Điều kiện tiên quyết
- Browser/OS dark mode.

### Các bước kiểm thử
- [ ] Bat dark mode. Mo form upload.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Text contrast hop le. Background toi. Khong co white-on-white hay black-on-black. Error text van visible.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: Medium
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-110

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT - Internet Explorer 11: hien thong bao browser cu

### Điều kiện tiên quyết
- IE11 (neu con support).

### Các bước kiểm thử
- [ ] Mo app tren IE11.

### Kết quả mong đợi
**UI**:
- App hien thong bao 'Browser khong duoc ho tro, vui long dung Chrome/Edge/Firefox'. Khong crash. Graceful degradation.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: Low
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-116

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `Hiệu năng`
- Yêu cầu: `REQ-G0-DOC-PERFORMANCE`
- Kỹ thuật: `Load test / Latency`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF - upload progress hien dung khi upload lon

### Điều kiện tiên quyết
- Upload file 5MB+.

### Các bước kiểm thử
- [ ] Upload file 5MB. Quan sat progress text.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.5mb
```

### Kết quả mong đợi
**API**:
- 'Dang tai len 1/1...' hien ngay khi bat dau. Progress text cap nhat dung (current/total). Khong bi frozen.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Hiệu năng`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Hiệu năng`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: Medium
module: Hiệu năng
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: PERFORMANCE | Entity: EntityDocumentsTab

---

## TC-202

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED - upload form voi duplicate title trong cung petition - duoc phep

### Điều kiện tiên quyết
- Petition co doc 'Bao cao'.

### Các bước kiểm thử
- [ ] Upload them 1 doc ten 'Bao cao' vao cung petition.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- BE KHONG block trung ten (chua co unique constraint tren title+petitionId). 201 Accept. 2 doc ten giong nhau.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-202
severity: Medium
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-213

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED - description voi newline characters - luu dung

### Điều kiện tiên quyết
- Mo ta co newline.

### Các bước kiểm thử
- [ ] Mo ta = 'Dong 1\nDong 2'. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Luu \n literal. Hien thi: xuong dong trong UI hoac luu as is. Khong break JSON.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-213
severity: Low
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-221

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED - title co emoji (Unicode supplementary) - accept

### Điều kiện tiên quyết
- Title co emoji.

### Các bước kiểm thử
- [ ] Title = 'Bien ban 🔒 2026'. Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept. Emoji luu dung (UTF-8MB4 trong DB). Hien thi dung.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-221
severity: Low
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-241

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: BOUNDARY - title exactly 1 char - accept

### Điều kiện tiên quyết
- Title = 1 char.

### Các bước kiểm thử
- [ ] Upload voi title='A'.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Accept.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-241
severity: Low
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: EntityDocumentsTab

---

## TC-245

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: EP - filename dot-file (.gitignore style) - accept

### Điều kiện tiên quyết
- File ten '.pdf' (chi co extension).

### Các bước kiểm thử
- [ ] Upload.

### Dữ liệu kiểm thử
```
petition.active.D30, file.dotfile
```

### Kết quả mong đợi
**API**:
- Accept hoac reject tuy policy. Khong crash.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-245
severity: Low
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: DocumentsController

---

## TC-250

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: EP - upload PDF sau khi xoa PDF truoc (reuse ten) - accept, new doc

### Điều kiện tiên quyết
- PDF cu da xoa.

### Các bước kiểm thử
- [ ] Upload PDF moi cung ten voi PDF cu.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Tao doc moi. File tren disk co ten khac (timestamp random). Khong conflict.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-250
severity: Low
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: EntityDocumentsTab

---

## TC-252

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Equivalence Partition`
- Yêu cầu: `REQ-G0-DOC-EP`
- Kỹ thuật: `EP (Equivalence Partitioning)`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: EP - folder chi co hidden files (.DS_Store, Thumbs.db) - queue empty hoac filter

### Điều kiện tiên quyết
- Folder chi co OS hidden files.

### Các bước kiểm thử
- [ ] Chon folder.

### Dữ liệu kiểm thử
```
petition.active.D30, folder.hidden_only
```

### Kết quả mong đợi
**API**:
- FE filter: tat ca hidden files bi bo qua (hoac accept nhung BE reject mime). Queue rong hoac 0 hop le.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Equivalence Partition`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Equivalence Partition`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-252
severity: Low
module: Equivalence Partition
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: EP | Entity: EntityDocumentsTab

---

## TC-256

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y - title input co autocomplete=off (khong tu dong dien data nhay cam)

### Điều kiện tiên quyết
- Form mo.

### Các bước kiểm thử
- [ ] Inspect title input.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- autocomplete='off' tren title input de phong browser tu dong dien thong tin nhay cam.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-256
severity: Medium
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-259

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Accessibility`
- Yêu cầu: `REQ-G0-DOC-A11Y`
- Kỹ thuật: `WCAG 2.1 AA / Keyboard nav`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y - skip link hoac focus management sau upload thanh cong

### Điều kiện tiên quyết
- Upload thanh cong.

### Các bước kiểm thử
- [ ] Sau upload, kiem tra focus.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Focus chuyen den success message hoac dau list tai lieu. Screen reader thong bao 'Upload thanh cong. X files duoc tai len.'

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Accessibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Accessibility`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-259
severity: Medium
module: Accessibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: A11Y | Entity: EntityDocumentsTab

---

## TC-261

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT - Chrome 100 (older version support)

### Điều kiện tiên quyết
- Chrome 100 tren Windows 10.

### Các bước kiểm thử
- [ ] Upload PDF.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Hoat dong. webkitdirectory ho tro tu Chrome 21.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-261
severity: Medium
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-262

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT - Windows 10 (different from Win 11): UI tuong thich

### Điều kiện tiên quyết
- Windows 10 + Chrome latest.

### Các bước kiểm thử
- [ ] Upload flow.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Khong co OS-specific rendering issue.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-262
severity: Low
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-265

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT - print preview khong lam an form upload

### Điều kiện tiên quyết
- Trang co EntityDocumentsTab.

### Các bước kiểm thử
- [ ] Ctrl+P.

### Dữ liệu kiểm thử
```
petition.active.D30
```

### Kết quả mong đợi
**UI**:
- Print CSS: form upload bi an (display:none hoac @media print). Chi hien danh sach docs.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-265
severity: Low
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-266

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Compatibility`
- Yêu cầu: `REQ-G0-DOC-COMPAT`
- Kỹ thuật: `Cross-browser / Responsive`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT - drag-and-drop file vao form (neu ho tro)

### Điều kiện tiên quyết
- Drag PDF vao form area.

### Các bước kiểm thử
- [ ] Keo file vao section Tai lieu.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**UI**:
- Neu ho tro: file duoc them vao queue. Neu khong: khong crash, khong bat ky hanh dong gi. onDrop handler.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Compatibility`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Compatibility`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-266
severity: Low
module: Compatibility
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: COMPAT | Entity: EntityDocumentsTab

---

## TC-276

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: SECURITY - Referrer-Policy header trong download response

### Điều kiện tiên quyết
- Download request.

### Các bước kiểm thử
- [ ] Kiem tra Referrer-Policy header.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Referrer-Policy: no-referrer hoac strict-origin. Khong lo URL noi bo qua Referer header.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-276
severity: Medium
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-279

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `Bảo mật & IDOR`
- Yêu cầu: `REQ-G0-DOC-SECURITY`
- Kỹ thuật: `OWASP Top 10 / IDOR / Inject`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: SECURITY - Clickjacking prevention: X-Frame-Options header

### Điều kiện tiên quyết
- Bat ky API response.

### Các bước kiểm thử
- [ ] Kiem tra X-Frame-Options hoac CSP frame-ancestors.

### Kết quả mong đợi
**API**:
- X-Frame-Options: DENY hoac CSP frame-ancestors: 'none'. Phong clickjacking.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật & IDOR`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật & IDOR`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-279
severity: Medium
module: Bảo mật & IDOR
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: SECURITY | Entity: DocumentsController

---

## TC-286

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED - download tren HTTPS nhung cert khong hop le - browser warn

### Điều kiện tiên quyết
- Self-signed cert.

### Các bước kiểm thử
- [ ] Download tren HTTPS voi cert issue.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Browser hien warning. Khong auto-download. User phai confirm.

**Side effects** (DB, email, log, queue...):
- Entity: EntityDocumentsTab

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-286
severity: Low
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: EntityDocumentsTab

---

## TC-294

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED - download voi Range header (partial content) - 200 hoac 206

### Điều kiện tiên quyết
- Download request voi Range header.

### Các bước kiểm thử
- [ ] GET /documents/:id/download voi Range: bytes=0-1023.

### Dữ liệu kiểm thử
```
document.active.D30
```

### Kết quả mong đợi
**API**:
- Partial Content hoac 200 Full. Khong 416. Stream van dung. FE xu ly both.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-294
severity: Low
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-300

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Validation & Auth & Error`
- Yêu cầu: `REQ-G0-DOC-RED`
- Kỹ thuật: `Error guessing / BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED - upload voi Accept-Language header la la - server xu ly binh thuong

### Điều kiện tiên quyết
- Request voi Accept-Language: xx-XX (khong ton tai).

### Các bước kiểm thử
- [ ] POST voi Accept-Language: zz-ZZ.

### Dữ liệu kiểm thử
```
petition.active.D30, file.pdf.valid
```

### Kết quả mong đợi
**API**:
- Server ignore Accept-Language. Response binh thuong (201/400 tuy noi dung). Khong 500.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Validation & Auth & Error`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Validation & Auth & Error`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-300
severity: Low
module: Validation & Auth & Error
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: RED | Entity: DocumentsController

---

## TC-318

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Boundary Values`
- Yêu cầu: `REQ-G0-DOC-BOUNDARY`
- Kỹ thuật: `BVA (Boundary Value Analysis)`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: BOUNDARY - GET /documents?skip=0&limit=1 - tra ve doc dau tien

### Điều kiện tiên quyết
- Petition co nhieu docs.

### Các bước kiểm thử
- [ ] GET voi skip=0&limit=1.

### Dữ liệu kiểm thử
```
petition.active.D30.50docs
```

### Kết quả mong đợi
**API**:
- Tra ve 1 doc. Meta.total > 1. Pagination dung.

**Side effects** (DB, email, log, queue...):
- Entity: DocumentsController

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Boundary Values`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Boundary Values`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-318
severity: Low
module: Boundary Values
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Type: BOUNDARY | Entity: DocumentsController

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

- [ ] **TC-001** [P0] Mo form upload khi nhan Tai len tai lieu
- [ ] **TC-002** [P0] Upload 1 file PDF hop le - xuat hien trong danh sach
- [ ] **TC-003** [P0] Upload 2 file cung luc - ca 2 xuat hien (1)(2)
- [ ] **TC-004** [P0] Upload 3 file - progress counter chinh xac
- [ ] **TC-005** [P0] Nhan Huy - form dong, queue xoa sach
- [ ] **TC-006** [P0] Mo lai form sau Huy - sach hoan toan
- [ ] **TC-007** [P0] Toggle button dong form - queue bi xoa
- [ ] **TC-011** [P0] Chon thu muc - tat ca file vao queue
- [ ] **TC-013** [P0] Upload tu Case - gan caseId
- [ ] **TC-014** [P0] Upload tu Incident - gan incidentId
- [ ] **TC-015** [P0] Guard message - petition chua luu
- [ ] **TC-016** [P0] Upload khong tieu de - loi FE
- [ ] **TC-017** [P0] Upload khong chon file - loi FE
- [ ] **TC-018** [P0] Upload file EXE - reject MIME
- [ ] **TC-019** [P0] Upload file >10MB - reject size
- [ ] **TC-020** [P0] Upload file PDF gia mao EXE content - magic-byte fail
- [ ] **TC-021** [P0] 1 file fail trong batch - file con lai van upload
- [ ] **TC-022** [P0] Tat ca file fail - form khong dong
- [ ] **TC-023** [P0] Upload khong JWT - 401
- [ ] **TC-024** [P0] Upload HTML gia PDF - magic-byte fail
- [ ] **TC-031** [P0] IDOR - upload document vao petition cua user khac
- [ ] **TC-032** [P0] IDOR - doc GET cua user khac
- [ ] **TC-033** [P0] IDOR - DELETE doc cua user khac
- [ ] **TC-034** [P0] XSS trong title - render HTML escaping
- [ ] **TC-035** [P0] XSS trong description - render escaping
- [ ] **TC-036** [P0] Path traversal trong filename - ../etc/passwd
- [ ] **TC-037** [P0] SQL Injection trong title parameter
- [ ] **TC-038** [P0] JWT cu da het han - 401
- [ ] **TC-039** [P0] JWT tampered signature - reject
- [ ] **TC-040** [P0] Throttle - 11 upload trong 60s - request 11 bi block
- [ ] **TC-041** [P0] Upload file PHP script - reject MIME
- [ ] **TC-045** [P0] Content-Type header giong allowed nhung magic bytes khac
- [ ] **TC-046** [P0] BOUNDARY - file size = 0 bytes
- [ ] **TC-047** [P0] BOUNDARY - file size = 10MB chinh xac
- [ ] **TC-048** [P0] BOUNDARY - file size = 10MB + 1 byte
- [ ] **TC-052** [P0] EP - file PDF (application/pdf) - valid MIME
- [ ] **TC-056** [P0] EP - file application/x-python (.py) - invalid
- [ ] **TC-057** [P0] EP - file text/html (.html) - invalid
- [ ] **TC-061** [P0] STATE - form hidden -> open -> upload -> success
- [ ] **TC-062** [P0] STATE - form open -> cancel -> hidden
- [ ] **TC-063** [P0] STATE - uploading disabled button
- [ ] **TC-064** [P0] STATE - upload thanh cong -> fetch docs moi
- [ ] **TC-065** [P0] STATE - upload fail -> form van mo, error hien
- [ ] **TC-066** [P0] STATE - partial success -> form dong, error partial
- [ ] **TC-067** [P0] DECISION - title empty + file co - FE stop
- [ ] **TC-068** [P0] DECISION - title co + file empty - FE stop
- [ ] **TC-069** [P0] DECISION - title co + file co + entityId undefined - goi guardMessage
- [ ] **TC-070** [P0] DECISION - file type allowed + magic bytes match - accept
- [ ] **TC-071** [P0] DECISION - file type allowed + magic bytes mismatch - reject + cleanup
- [ ] **TC-072** [P0] DECISION - file type text/plain + bat ky noi dung - accept (bypass magic)
- [ ] **TC-073** [P0] DATA - tieu de Unicode tieng Viet co dau
- [ ] **TC-074** [P0] DATA - filename Unicode tieng Bien ban.pdf
- [ ] **TC-078** [P0] INTEGRATION - download document sau upload
- [ ] **TC-079** [P0] INTEGRATION - mo document trong tab moi
- [ ] **TC-080** [P0] INTEGRATION - xoa document voi confirm
- [ ] **TC-083** [P0] INTEGRATION - upload tren Case, xem tai Case
- [ ] **TC-086** [P0] INTEGRATION - xoa doc, file vat ly bi xoa khoi disk
- [ ] **TC-087** [P0] INTEGRATION - refresh page - doc van con
- [ ] **TC-088** [P0] REGRESSION - upload Enter key khong submit outer form
- [ ] **TC-089** [P0] REGRESSION - Enter key trong Mo ta khong submit outer form
- [ ] **TC-090** [P0] REGRESSION - button type=button khong trigger form submit
- [ ] **TC-095** [P0] A11Y - keyboard navigation: Tab qua cac button, Enter/Space activate
- [ ] **TC-100** [P0] A11Y - form label dung htmlFor + input id
- [ ] **TC-101** [P0] COMPAT - Chrome 120+ (Windows 11): upload thanh cong
- [ ] **TC-113** [P0] PERF - upload 11 file lien tiep - file thu 11 nhan 429
- [ ] **TC-121** [P0] RED - upload EXE content voi .pdf extension - backend reject
- [ ] **TC-122** [P0] RED - upload ZIP content voi .docx extension - backend reject
- [ ] **TC-124** [P0] RED - missing title (empty string) - 400
- [ ] **TC-127** [P0] RED - khong co file trong request - 400
- [ ] **TC-128** [P0] RED - file > 10MB - multer reject
- [ ] **TC-129** [P0] RED - unauth (no token) - 401
- [ ] **TC-130** [P0] RED - token het han - 401
- [ ] **TC-131** [P0] RED - petitionId khong ton tai - 404
- [ ] **TC-132** [P0] RED - caseId thuoc team khac - 403
- [ ] **TC-133** [P0] RED - DELETE doc cua nguoi khac (officer khac) - 403
- [ ] **TC-134** [P0] RED - GET /documents/:id/download doc cua entity khac scope - 403
- [ ] **TC-139** [P0] RECOVERY - 429 throttle - FE hien message that bai, khong crash
- [ ] **TC-145** [P0] DATA - filename SQL injection attempt - sanitize
- [ ] **TC-146** [P0] SECURITY - IDOR: xem doc list cua petition khac via query param
- [ ] **TC-147** [P0] SECURITY - path traversal trong filename khi download
- [ ] **TC-148** [P0] SECURITY - upload HTML file + XSS payload
- [ ] **TC-149** [P0] SECURITY - Content-Type header spoofing: PDF file voi Content-Type: image/jpeg
- [ ] **TC-154** [P0] GREEN - download file: Content-Disposition filename encoded
- [ ] **TC-155** [P0] RED - download soft-deleted doc - 404
- [ ] **TC-156** [P0] DECISION - petitionId + caseId cu the trong 1 request - BE reject
- [ ] **TC-157** [P0] DECISION - doc khong co entityId nao - 400
- [ ] **TC-158** [P0] STATE - queue: xoa file khoi queue bang X button
- [ ] **TC-159** [P0] STATE - queue empty sau xoa het → button Tai len disabled
- [ ] **TC-160** [P0] RED - upload file MP4 video > 10MB - reject
- [ ] **TC-161** [P0] BOUNDARY - file exacty 10MB (10485760 bytes) - accept
- [ ] **TC-162** [P0] BOUNDARY - file 10485761 bytes (10MB + 1) - reject
- [ ] **TC-168** [P0] EP - MIME group: documents (pdf doc docx xls xlsx) - accept
- [ ] **TC-169** [P0] EP - MIME rejected: .zip .rar .bat .exe .php - 400
- [ ] **TC-170** [P0] GREEN - incident upload doc + list + download full flow
- [ ] **TC-172** [P0] RED - upload file JFIF (JPEG variant) dat theo .png - magic byte mismatch
- [ ] **TC-173** [P0] RED - upload PDF dat theo .xls - magic byte mismatch
- [ ] **TC-174** [P0] RED - upload PNG dat theo .mp3 - magic byte mismatch
- [ ] **TC-175** [P0] RED - upload .gif dat theo .docx - magic byte mismatch
- [ ] **TC-176** [P0] RED - multer fileFilter: extension .exe bi reject truoc magic byte check
- [ ] **TC-177** [P0] RED - upload file .rar (archive) - reject
- [ ] **TC-178** [P0] RED - upload file .bat (script) - reject
- [ ] **TC-179** [P0] RED - upload file .svg (SVG co the co JS) - reject
- [ ] **TC-180** [P0] RED - JWT tampered (signature invalid) - 401
- [ ] **TC-181** [P0] RED - JWT algorithm none attack - 401
- [ ] **TC-182** [P0] RED - upload nhieu file vuot gioi han: 11 file dong thoi trong folder - thu 11 nhan 429
- [ ] **TC-183** [P0] RED - form submit voi queue rong (JS bypass) - FE block
- [ ] **TC-184** [P0] RED - petitionId la SQL injection payload - 400 hoac 422
- [ ] **TC-186** [P0] RED - caseId + incidentId + petitionId cung luc - 400
- [ ] **TC-187** [P0] RED - file name dat PathInfo attack: file.pdf/.php - BE sanitize
- [ ] **TC-188** [P0] RED - upload file blank title sau strip (all spaces) - FE reject
- [ ] **TC-190** [P0] RED - file null content (fake FormData khong co file binary) - 400
- [ ] **TC-191** [P0] RED - download bi delete (doc.deletedAt != null) - 404
- [ ] **TC-193** [P0] RED - title co HTML tags - luu literal, khong render
- [ ] **TC-198** [P0] RED - GET /documents theo entityId khong thuoc scope - empty (khong 403)
- [ ] **TC-199** [P0] RED - upload voi petitionId hop le + title hop le + sai MIME - 400
- [ ] **TC-203** [P0] RED - ROLE VIEWER (read-only) upload doc - 403
- [ ] **TC-209** [P0] RED - tai len tu incident scope khi caseId duoc dung - 403
- [ ] **TC-211** [P0] RED - DELETE doc ma minhduoc xoa (admin) - khong xoa dc doc cua entity ngoai scope
- [ ] **TC-216** [P0] RED - upload khi entityId = empty string - 400
- [ ] **TC-220** [P0] RED - upload response chua truong 'id' cua doc moi - verify response shape
- [ ] **TC-225** [P0] RED - upload API tra ve 500 (BE crash) - FE error message khong leak stack
- [ ] **TC-227** [P0] RED - upload theo batch: 1 file fail magic check, rest thanh cong
- [ ] **TC-228** [P0] RED - tai len khi khong co quyen (da dang xuat giua chung) - FE redirect login
- [ ] **TC-230** [P0] RED - upload file truoc khi nhap title: FE validate order
- [ ] **TC-232** [P0] RED - FE: button type submit trong form upload - khong ton tai
- [ ] **TC-233** [P0] BOUNDARY - 2 files queue: upload → 2 titles (title, title (2))
- [ ] **TC-234** [P0] BOUNDARY - 10 files queue: titles (1)..(10)
- [ ] **TC-235** [P0] BOUNDARY - 1 file queue: title khong co index
- [ ] **TC-255** [P0] A11Y - upload error co role=alert (screen reader doc ngay)
- [ ] **TC-270** [P0] SECURITY - file scanning: upload eicar test string (vi-rus test) - detect va reject
- [ ] **TC-272** [P0] SECURITY - upload doc chi de test SSRF via filename URL
- [ ] **TC-280** [P0] SECURITY - download file: Content-Type phai match file content
- [ ] **TC-283** [P0] RED - upload qua API voi Content-Type sai (application/json) - 400
- [ ] **TC-288** [P0] RED - upload 3 files, ca 3 fail - form van mo, loi hien ro
- [ ] **TC-289** [P0] RED - upload voi session bi revoke (server-side logout) - 401
- [ ] **TC-290** [P0] RED - file input 'accept' attribute bi bo qua boi user (bypass FE filter) - BE nhan
- [ ] **TC-292** [P0] RED - upload doc co file path chua null bytes (path injection) - BE reject
- [ ] **TC-293** [P0] RED - incident-type officer upload voi petitionId - 403
- [ ] **TC-295** [P0] RED - upload tren HTTPS (production) - file va request an toan
- [ ] **TC-296** [P0] RED - FE upload form: sau thanh cong, title va docType reset
- [ ] **TC-298** [P0] RED - nhan Tai len 2 lan nhanh (double click) - khong double-upload
- [ ] **TC-301** [P0] RED - upload khi session cookie bi stolen va dung tu IP khac - 401
- [ ] **TC-302** [P0] RED - download voi forged token (another user ID but valid sig) - 403
- [ ] **TC-303** [P0] RED - upload voi incidentId la cuid hợp le nhung incident thuoc team khac - 403
- [ ] **TC-304** [P0] RED - multipart boundary attack: boundary string la XSS payload
- [ ] **TC-312** [P0] RED - FE: chon file > 10MB - hien error truoc khi upload (client-side check)
- [ ] **TC-313** [P0] RED - multiple errors: 2 files fail voi 2 errors khac nhau
- [ ] **TC-315** [P0] RED - FE: reset file input refs sau cancel (stale ref fix)
- [ ] **TC-317** [P0] BOUNDARY - 3 files: tren dung gioi han throttle (request 8,9,10 trong 60s)
- [ ] **TC-008** [P1] Upload JPEG - Hinh anh
- [ ] **TC-009** [P1] Upload DOCX hop le
- [ ] **TC-010** [P1] Upload TXT bypass magic-byte
- [ ] **TC-012** [P1] Xoa file trong queue bang nut X
- [ ] **TC-025** [P1] Upload PNG hop le
- [ ] **TC-026** [P1] Upload ZIP - reject
- [ ] **TC-027** [P1] Deduplication - cung file 2 lan chi 1 trong queue
- [ ] **TC-028** [P1] Gop file tu 2 nguon - Chon file + Chon thu muc
- [ ] **TC-029** [P1] Tieu de whitespace-only - loi
- [ ] **TC-042** [P1] Upload file SVG co XSS - reject
- [ ] **TC-043** [P1] approver1 role khong co quyen upload - FE guard
- [ ] **TC-044** [P1] Download - user khong co quyen read
- [ ] **TC-049** [P1] BOUNDARY - title length = 1 char
- [ ] **TC-050** [P1] BOUNDARY - title length = 255 chars
- [ ] **TC-051** [P1] BOUNDARY - title length = 256 chars - kiem tra DB constraint
- [ ] **TC-053** [P1] EP - file application/msword (.doc)
- [ ] **TC-054** [P1] EP - file image/gif (.gif)
- [ ] **TC-055** [P1] EP - file audio/mpeg (.mp3)
- [ ] **TC-058** [P1] EP - file image/webp (.webp) - invalid
- [ ] **TC-059** [P1] BOUNDARY - queue size 1 file
- [ ] **TC-060** [P1] BOUNDARY - xoa tat ca file trong queue roi upload
- [ ] **TC-075** [P1] DATA - tieu de special chars <>?#%
- [ ] **TC-076** [P1] DATA - mo ta 500 ky tu Unicode
- [ ] **TC-081** [P1] INTEGRATION - huy xoa document
- [ ] **TC-082** [P1] INTEGRATION - list docs pagination limit 100
- [ ] **TC-084** [P1] INTEGRATION - upload audit log ghi nhan
- [ ] **TC-085** [P1] INTEGRATION - download audit log ghi nhan
- [ ] **TC-091** [P1] A11Y - nut Tai len tai lieu co aria-label
- [ ] **TC-092** [P1] A11Y - nut Huy co accessible label
- [ ] **TC-094** [P1] A11Y - error message lien ket voi field bang aria-describedby
- [ ] **TC-096** [P1] A11Y - focus visible tren tat ca interactive elements
- [ ] **TC-097** [P1] A11Y - progress indicator co aria-live khi uploading
- [ ] **TC-098** [P1] A11Y - color contrast tren button chu khi disabled
- [ ] **TC-099** [P1] A11Y - file remove button ('x') co aria-label voi ten file
- [ ] **TC-102** [P1] COMPAT - Edge (Chromium, latest): upload + folder select
- [ ] **TC-103** [P1] COMPAT - Firefox (latest): webkitdirectory fallback
- [ ] **TC-104** [P1] COMPAT - Safari (macOS, latest): file input multiple
- [ ] **TC-105** [P1] COMPAT - mobile Chrome (Android 13): tap upload
- [ ] **TC-106** [P1] COMPAT - mobile Safari (iOS 16+): upload PDF tu Files app
- [ ] **TC-107** [P1] COMPAT - screen resolution 1366x768: form khong bi overflow
- [ ] **TC-109** [P1] COMPAT - zoom 200%: form van usable
- [ ] **TC-111** [P1] PERF - upload 1 file PDF 10MB < 30s tren mang binh thuong
- [ ] **TC-112** [P1] PERF - upload 10 file nho (1KB) trong 60 giay khong bi throttle
- [ ] **TC-114** [P1] PERF - GET /documents list 100 items - response < 1s
- [ ] **TC-115** [P1] PERF - concurrent 5 user upload cung 1 luc - khong deadlock
- [ ] **TC-117** [P1] EDGE - upload file co ten trung voi file da co trong list
- [ ] **TC-118** [P1] EDGE - folder co subfolder - chi flat file, bo qua subfolder
- [ ] **TC-119** [P1] EDGE - file 0 byte - FE hoac BE reject
- [ ] **TC-120** [P1] EDGE - 2 file trung ten trong 1 queue - tu dong dedup
- [ ] **TC-123** [P1] RED - upload PHP script voi .txt extension - accept (MAGIC_BYTE_BYPASS)
- [ ] **TC-125** [P1] RED - title qua dai (>500 ky tu) - 400
- [ ] **TC-126** [P1] RED - documentType sai enum value - 400
- [ ] **TC-135** [P1] RED - dong thoi upload 2 file cung ten (race condition) - 1 thanh cong
- [ ] **TC-136** [P1] RED - DB down khi upload - 500 + file cleanup
- [ ] **TC-137** [P1] RECOVERY - upload fail (network cut) - form van mo, co the retry
- [ ] **TC-138** [P1] RECOVERY - refresh trang giua chung upload - khong co orphan file
- [ ] **TC-140** [P1] RECOVERY - session expire khi dang upload - redirect login
- [ ] **TC-141** [P1] AUDIT - upload ghi nhan entityType + entityId
- [ ] **TC-142** [P1] AUDIT - download ghi nhan documentId + ip
- [ ] **TC-143** [P1] AUDIT - xoa ghi nhan soft-delete + deletedBy
- [ ] **TC-144** [P1] DATA - mimeType khong hop le trong FormData - BE validate accept
- [ ] **TC-150** [P1] SECURITY - CSRF: POST /documents tu origin khac - reject
- [ ] **TC-151** [P1] GREEN - delete document: soft delete, van query duoc boi admin
- [ ] **TC-152** [P1] GREEN - file doc type HINH_ANH (image) - accept + hien thumbnail
- [ ] **TC-153** [P1] GREEN - file type AM_THANH (MP3) - upload + download
- [ ] **TC-163** [P1] BOUNDARY - title 1 ky tu - accept
- [ ] **TC-164** [P1] BOUNDARY - title 500 ky tu - accept (max)
- [ ] **TC-165** [P1] BOUNDARY - title 501 ky tu - reject
- [ ] **TC-166** [P1] EP - MIME group: image types (jpg jpeg png gif) - accept
- [ ] **TC-167** [P1] EP - MIME group: video + audio (mp4 mp3) - accept
- [ ] **TC-171** [P1] GREEN - upload report xuat bat dong bo khi co loi mot so file
- [ ] **TC-185** [P1] RED - petitionId la cuid format sai - 400
- [ ] **TC-189** [P1] RED - upload voi title only whitespace - BE reject
- [ ] **TC-192** [P1] RED - doc file vat ly bi xoa khoi disk - download 500 hoac 404
- [ ] **TC-194** [P1] RED - mo ta co Markdown injection - luu literal
- [ ] **TC-195** [P1] RED - concurrent DELETE + GET cung 1 doc - khong 500
- [ ] **TC-196** [P1] RED - file tren disk bi doi chu so huu (permission denied) - 500 + clean message
- [ ] **TC-197** [P1] RED - disk full khi upload - 500 + clean message
- [ ] **TC-200** [P1] RED - upload .csv file - reject (khong trong allowed list)
- [ ] **TC-201** [P1] RED - upload .xml file - reject
- [ ] **TC-204** [P1] RED - upload multi-file khi 1 file la 0 bytes - skip zero-byte, upload rest
- [ ] **TC-205** [P1] RED - upload voi description co NUL byte - sanitize hoac reject
- [ ] **TC-206** [P1] RED - upload voi file la directory pretending to be file - BE reject
- [ ] **TC-207** [P1] RED - petition.status = DANG_XU_LY (active) vs DINH_CHI - upload van duoc phep
- [ ] **TC-208** [P1] RED - concurrent upload + throttle: 10 user khac nhau co the upload cung luc
- [ ] **TC-210** [P1] RED - GET /documents?limit=999 - gioi han toi da 100
- [ ] **TC-212** [P1] RED - upload qua 3 file cung luc khi throttle con 3 slot - partial throttle
- [ ] **TC-214** [P1] RED - pagination: skip/limit param injection - BE sanitize
- [ ] **TC-215** [P1] RED - upload va sau do xoa entity cha (petition) - doc van con hoac cascade
- [ ] **TC-217** [P1] RED - download trong khi stream bi ngat - client giai quyen
- [ ] **TC-218** [P1] RED - upload multi-part request bi cat dang dung (partial boundary) - BE xu ly
- [ ] **TC-219** [P1] RED - upload khi petition bi locked boi system (status = DANG_GIAI_QUYET) - 409
- [ ] **TC-222** [P1] RED - upload voi Content-Length: 0 trong multipart - BE reject
- [ ] **TC-223** [P1] RED - fetchDocs fail (network) - hien error, khong empty list
- [ ] **TC-224** [P1] RED - fetchDocs 500 server error - hien error toast
- [ ] **TC-226** [P1] RED - caseId khong co dau quotes (UUID v4 format gia) - 404
- [ ] **TC-229** [P1] RED - description > 2000 ky tu - BE reject
- [ ] **TC-231** [P1] RED - upload queue voi file trung lam (dedup) - chi upload 1 lan
- [ ] **TC-236** [P1] BOUNDARY - file size exactly 1 byte - accept
- [ ] **TC-237** [P1] BOUNDARY - file size 10485759 bytes (10MB - 1) - accept
- [ ] **TC-238** [P1] BOUNDARY - description exactly 0 chars (empty string) - accept (optional field)
- [ ] **TC-239** [P1] BOUNDARY - description exactly 2000 chars - accept
- [ ] **TC-240** [P1] BOUNDARY - description exactly 2001 chars - reject
- [ ] **TC-242** [P1] BOUNDARY - 100 file trong folder - upload 100 files sequentially
- [ ] **TC-243** [P1] EP - filename co khoang trang - accept
- [ ] **TC-244** [P1] EP - filename chi co Unicode - accept
- [ ] **TC-246** [P1] EP - filename double extension: report.docx.pdf - accept
- [ ] **TC-247** [P1] EP - documentType = KHAC - accept
- [ ] **TC-248** [P1] EP - documentType = VIDEO voi file MP4 - accept
- [ ] **TC-249** [P1] EP - 3 entity kinds (case/incident/petition) × all doctypes = 15 combos
- [ ] **TC-251** [P1] EP - folder rong (0 file) - queue empty, khong upload
- [ ] **TC-253** [P1] A11Y - 'Chon thu muc' button co role button + aria-label
- [ ] **TC-254** [P1] A11Y - progress text thong bao bang aria-live khi upload 3 files
- [ ] **TC-257** [P1] A11Y - form upload co tieu de (heading hoac aria-label)
- [ ] **TC-258** [P1] A11Y - queue list item co nut xoa voi ten file trong accessible name
- [ ] **TC-260** [P1] COMPAT - tablet (iPad 10, iOS 16) landscape mode
- [ ] **TC-263** [P1] COMPAT - Vietnamese IME input cho title (VNI/Telex)
- [ ] **TC-264** [P1] COMPAT - clipboard paste vao title (Ctrl+V)
- [ ] **TC-267** [P1] PERF - GET /documents tai ba entity cung luc < 2s moi request
- [ ] **TC-268** [P1] PERF - EntityDocumentsTab render < 500ms voi 100 docs
- [ ] **TC-269** [P1] PERF - upload 3 file trong 60s: 3 POST < 5s tong cong
- [ ] **TC-271** [P1] SECURITY - Content-Security-Policy header trong response
- [ ] **TC-273** [P1] SECURITY - rate limit: 10 failed upload attempts tu 1 IP - block IP sau nguong
- [ ] **TC-274** [P1] SECURITY - response khong lo Content-Type trong error 400
- [ ] **TC-275** [P1] SECURITY - audit trail: failed upload attempt duoc ghi nhan
- [ ] **TC-277** [P1] SECURITY - X-Content-Type-Options: nosniff tren response
- [ ] **TC-278** [P1] SECURITY - zip bomb detection: file nen 1KB expand den 10GB
- [ ] **TC-281** [P1] RED - upload khi DB transaction timeout - 500 + file cleanup
- [ ] **TC-282** [P1] RED - upload FormData co extra fields (unknown props) - ignore them
- [ ] **TC-284** [P1] RED - upload voi petitionId la ObjectID format (Mongo) - 400 hoac 404
- [ ] **TC-285** [P1] RED - upload chua co internet connection (offline) - FE error
- [ ] **TC-287** [P1] RED - upload chay khi trang dang navigate away - huy upload
- [ ] **TC-291** [P1] RED - tam dinh chi upload: ngan hang upload khi BE maintenance mode
- [ ] **TC-297** [P1] RED - folder upload: hidden OS files (.DS_Store) duoc filter hoac rejected
- [ ] **TC-299** [P1] RED - fetch docs sau upload fail - list van hien docs cu
- [ ] **TC-305** [P1] RED - upload PNG corrupt (broken header) - magic byte fail hoac multer reject
- [ ] **TC-306** [P1] RED - upload DOCX voi OLE exploit (malformed XML) - accept nhung khong execute
- [ ] **TC-307** [P1] RED - upload voi X-Forwarded-For spoofed IP - throttle by real IP
- [ ] **TC-308** [P1] RED - upload voi Content-Disposition attachment trong multipart - ignore
- [ ] **TC-309** [P1] RED - upload khi disk space co 1 byte con (edge disk capacity) - fail gracefully
- [ ] **TC-310** [P1] RED - download bi revoke giua chung stream - stream closed cleanly
- [ ] **TC-311** [P1] RED - tai len khi petition co flag 'archived' - 403 hoac 409
- [ ] **TC-314** [P1] RED - upload khi BE tra ve 503 (service unavailable) - FE retry suggestion
- [ ] **TC-316** [P1] BOUNDARY - GET /documents?limit=0 - tra ve empty hoac default
- [ ] **TC-319** [P1] BOUNDARY - file 10000001 bytes (9.5MB) - accept
- [ ] **TC-320** [P1] PERF - concurrent 10 downloads cung entity - khong block
- [ ] **TC-030** [P2] Upload MP4 hop le
- [ ] **TC-077** [P2] DATA - filename chi co so
- [ ] **TC-093** [P2] A11Y - file queue list dung role list
- [ ] **TC-108** [P2] COMPAT - dark mode: cac mau van readable
- [ ] **TC-110** [P2] COMPAT - Internet Explorer 11: hien thong bao browser cu
- [ ] **TC-116** [P2] PERF - upload progress hien dung khi upload lon
- [ ] **TC-202** [P2] RED - upload form voi duplicate title trong cung petition - duoc phep
- [ ] **TC-213** [P2] RED - description voi newline characters - luu dung
- [ ] **TC-221** [P2] RED - title co emoji (Unicode supplementary) - accept
- [ ] **TC-241** [P2] BOUNDARY - title exactly 1 char - accept
- [ ] **TC-245** [P2] EP - filename dot-file (.gitignore style) - accept
- [ ] **TC-250** [P2] EP - upload PDF sau khi xoa PDF truoc (reuse ten) - accept, new doc
- [ ] **TC-252** [P2] EP - folder chi co hidden files (.DS_Store, Thumbs.db) - queue empty hoac filter
- [ ] **TC-256** [P2] A11Y - title input co autocomplete=off (khong tu dong dien data nhay cam)
- [ ] **TC-259** [P2] A11Y - skip link hoac focus management sau upload thanh cong
- [ ] **TC-261** [P2] COMPAT - Chrome 100 (older version support)
- [ ] **TC-262** [P2] COMPAT - Windows 10 (different from Win 11): UI tuong thich
- [ ] **TC-265** [P2] COMPAT - print preview khong lam an form upload
- [ ] **TC-266** [P2] COMPAT - drag-and-drop file vao form (neu ho tro)
- [ ] **TC-276** [P2] SECURITY - Referrer-Policy header trong download response
- [ ] **TC-279** [P2] SECURITY - Clickjacking prevention: X-Frame-Options header
- [ ] **TC-286** [P2] RED - download tren HTTPS nhung cert khong hop le - browser warn
- [ ] **TC-294** [P2] RED - download voi Range header (partial content) - 200 hoac 206
- [ ] **TC-300** [P2] RED - upload voi Accept-Language header la la - server xu ly binh thuong
- [ ] **TC-318** [P2] BOUNDARY - GET /documents?skip=0&limit=1 - tra ve doc dau tien

---

_Generated by `uat-test-writer` skill on 07/06/2026 23:12_