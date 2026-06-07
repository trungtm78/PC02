# UAT Nhóm II — Chuyển đổi đơn thư thành Vụ việc hoặc Vụ án

**Ngày tạo:** 2026-06-08  
**Tổng số TC:** 313  
**Module:** POST /petitions/:id/convert-incident + convert-case + UI ConvertPetitionModal

## Tóm tắt phân bổ

| Loại | Số lượng | Tỷ lệ |
|------|----------|-------|
| GREEN | 47 | 15.0% |
| SECURITY | 34 | 10.9% |
| RED | 31 | 9.9% |
| DATA | 24 | 7.7% |
| EDGE | 23 | 7.3% |
| INTEGRATION | 20 | 6.4% |
| A11Y | 19 | 6.1% |
| DECISION | 18 | 5.8% |
| EP | 17 | 5.4% |
| REGRESSION | 17 | 5.4% |
| STATE | 16 | 5.1% |
| COMPAT | 16 | 5.1% |
| BOUNDARY | 13 | 4.2% |
| PERFORMANCE | 11 | 3.5% |
| RECOVERY | 4 | 1.3% |
| USABILITY | 3 | 1.0% |

## Data Fixtures

| Fixture ID | State | Lifecycle | Shape |
|------------|-------|-----------|-------|
| `petition.active.D0.normal` | ACTIVE | D0 | normal |
| `petition.converted-to-incident.D0` | CONVERTED_INCIDENT | D0 | normal |
| `petition.converted-to-case.D0` | CONVERTED_CASE | D0 | normal |
| `petition.deleted.D0` | DELETED | D0 | normal |
| `petition.active.other-team.D0` | ACTIVE | D0 | normal |
| `petition.active.D0.empty` | ACTIVE | D0 | empty |
| `petition.active.D0.with-docs` | ACTIVE | D0 | with_attachments |
| `petition.active.D0.with-team` | ACTIVE | D0 | normal |
| `petition.active.D0.sparse` | ACTIVE | D0 | sparse |
| `petition.active.D365.normal` | ACTIVE | D365 | normal |
| `petition.active.D0.with-assignments` | ACTIVE | D0 | with_assignments |

## Test Cases

### A11Y-Color

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-219 | A11Y | P2 | A11Y: Màu error text đủ contrast (red-600 trên white) | Contrast ratio ≥ 4.5:1; WCAG 2.1 AA pass |

### A11Y-ConvertPetitionModal

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-151 | A11Y | P1 | A11Y: convert-modal-close có aria-label hoặc accessible name | Button có aria-label='Đóng' hoặc title; Screen reader thông báo đúng tên |
| TC-152 | A11Y | P1 | A11Y: Required fields có aria-required=true hoặc * label | input có aria-required='true' HOẶC label có span.text-red-500 (*); Screen reader... |
| TC-153 | A11Y | P1 | A11Y: Error messages có aria-live=polite hoặc role=alert | div có aria-live='polite' HOẶC role='alert'; Screen reader thông báo lỗi tự động |
| TC-154 | A11Y | P1 | A11Y: Tab order hợp lý trong modal — focus không thoát khỏi  | Focus ở trong modal; Không focus sang phần tử background; Nhấn Shift+Tab cũng tr... |
| TC-155 | A11Y | P1 | A11Y: Modal có role=dialog và aria-modal=true | role='dialog'; aria-modal='true'; aria-labelledby trỏ tới h2 'Chuyển đổi đơn thư... |
| TC-156 | A11Y | P1 | A11Y: Nút submit disabled có aria-disabled=true | button[disabled] hoặc aria-disabled='true'; Screen reader thông báo disabled |
| TC-157 | A11Y | P2 | A11Y: Contrast ratio đủ 4.5:1 cho text trên button | Text màu white (#fff) trên blue-600 (#2563EB): ratio >4.5:1; Đạt WCAG 2.1 AA |
| TC-158 | A11Y | P1 | A11Y: Labels associated đúng với inputs (for=id) | label có htmlFor tương ứng với input id; Click label → focus input |
| TC-159 | A11Y | P1 | A11Y: Keyboard navigation: Space/Enter activate option butto | Step 2 form mở; Keyboard equivalent với click chuột |
| TC-160 | A11Y | P2 | A11Y: Loading state có accessible announcement | 'Đang chuyển...' được screen reader thông báo HOẶC có spinner role=progressbar |

### A11Y-ErrorBox

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-281 | A11Y | P2 | A11Y: Màu bg-red-50 border-red-200 error box có đủ contrast | Contrast ratio ≥ 4.5:1; #DC2626 trên #FEF2F2 đạt WCAG AA |

### A11Y-FontScale

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-259 | A11Y | P2 | A11Y: Font scale 150% (browser) — modal không bị overflow | Content vẫn readable; Không tràn container; Scroll khả dụng |

### A11Y-HighContrast

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-258 | A11Y | P2 | A11Y: High contrast mode — modal vẫn readable | Text vẫn readable; Buttons vẫn visible; Không bị mất nội dung |

### A11Y-Modal

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-216 | A11Y | P1 | A11Y: Modal được announce bởi screen reader khi mở (aria-lab | Screen reader thông báo 'Chuyển đổi đơn thư dialog'; role=dialog được detect |
| TC-217 | A11Y | P1 | A11Y: Step 2 form — focus được đưa về trường đầu tiên sau tr | Focus tự động vào incidentName input; Không lost focus |
| TC-220 | A11Y | P1 | A11Y: Option buttons có descriptive text không chỉ dựa vào i | Button có text 'Vụ việc' visible; Icon bổ sung, không thay thế text; Screen read... |

### A11Y-Options

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-282 | A11Y | P1 | A11Y: Option buttons trong step 1 có descriptive subtitle | Mỗi button có cả title (Vụ việc/Vụ án) và subtitle (Điều 143/147); Screen reader... |

### A11Y-Validation

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-218 | A11Y | P1 | A11Y: Error messages linked tới input bằng aria-describedby | Input có aria-describedby trỏ tới error div id; Screen reader đọc error khi focu... |

### API-DataScope

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-254 | DECISION | P0 | DECISION: Admin override DataScope → convert petition bất kỳ | HTTP 201; Admin không bị chặn bởi DataScope |

### API-PetitionsList

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-267 | GREEN | P1 | GREEN: Petition list filter 'DA_CHUYEN_VU_VIEC' → chỉ hiện đ | Chỉ petitions với status đó; Không lẫn status khác |
| TC-268 | GREEN | P1 | GREEN: Petition list filter 'DA_CHUYEN_VU_AN' → chỉ hiện đún | Chỉ petitions với status DA_CHUYEN_VU_AN |

### API-Security

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-255 | SECURITY | P0 | SECURITY: Path traversal trong petition ID → 404 không leak | HTTP 404; Route không match; Không access /users endpoint |
| TC-256 | SECURITY | P1 | SECURITY: HTTP Method không hợp lệ (GET thay vì POST) → 405 | HTTP 405 Method Not Allowed; Không execute convert logic |
| TC-257 | SECURITY | P1 | SECURITY: PUT thay vì POST → 405 | HTTP 405; Không tạo Case |
| TC-279 | SECURITY | P0 | SECURITY: JWT với 'alg: none' → 401 | HTTP 401; NestJS JWT strategy từ chối alg:none; Không accept unsigned token |
| TC-280 | SECURITY | P1 | SECURITY: JWT với alg RS256 nhưng server dùng HS256 → 401 | HTTP 401; Không process request |
| TC-295 | SECURITY | P1 | SECURITY: Token không có sub claim → 401 | HTTP 401; JWT strategy yêu cầu sub để identify user |

### API-Status

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-251 | STATE | P0 | STATE: Petition.status sau convert-incident không thể revert | HTTP 400 hoặc 422; Status DA_CHUYEN_VU_VIEC không thể revert về TIEP_NHAN qua PA... |
| TC-252 | STATE | P0 | STATE: Petition.status sau convert-case không thể reverted | HTTP 400; Transition không hợp lệ |

### API-convert-case

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-003 | GREEN | P0 | Convert-case happy path đầy đủ → 201, Case tạo, Petition.sta | HTTP 201; Case.caseProvenance=FROM_PETITION; Case.linkedPetitionId=petition.id; ... |
| TC-004 | GREEN | P0 | Convert-case tối thiểu: caseName+crime+jurisdiction+expected | HTTP 201; Case.suspect=null; Case.prosecutionDecision=null; Petition.linkedCaseI... |
| TC-008 | RED | P0 | Convert-case: thiếu caseName → 400 | HTTP 400; message chứa caseName/bắt buộc; Không tạo Case |
| TC-009 | RED | P0 | Convert-case: thiếu crime → 400 | HTTP 400; message chứa crime/Tội danh; Không tạo Case |
| TC-010 | RED | P0 | Convert-case: thiếu jurisdiction → 400 | HTTP 400; message chứa jurisdiction/thẩm quyền; Không tạo Case |
| TC-011 | RED | P0 | Convert-case: thiếu expectedUpdatedAt (BẮT BUỘC) → 400 | HTTP 400; message chứa expectedUpdatedAt; Không tạo Case; Field này required riê... |
| TC-014 | RED | P0 | Cross-convert: đã linked Incident → convert-case → 400 | HTTP 400; message chứa không thể chuyển thành Vụ án; Không tạo Case |
| TC-015 | RED | P0 | Double-convert: đã linked Case → convert-case lần 2 → 400 | HTTP 400; message=Đơn thư này đã được chuyển thành Vụ án trước đó; Không tạo Cas... |
| TC-016 | RED | P0 | Race condition: expectedUpdatedAt lỗi thời → 409 Conflict | HTTP 409; message chứa đã được chỉnh sửa bởi người dùng khác; Không tạo Case |
| TC-017 | RED | P0 | Concurrent 2 request đồng thời: 1 thành công, 1 nhận 409 | Đúng 1 request nhận 201; 1 nhận 409; Chỉ 1 Case trong DB; Petition.linkedCaseId ... |
| TC-020 | RED | P1 | Convert-case: expectedUpdatedAt sai format → 400 | HTTP 400; message chứa định dạng không hợp lệ; Không tạo Case |
| TC-027 | SECURITY | P0 | IDOR: convert-case petition ngoài DataScope → 403 hoặc 404 | HTTP 403 hoặc 404; checkWriteScope chặn; Không tạo Case |
| TC-030 | SECURITY | P0 | JWT giả mạo signature sai → 401 Unauthorized | HTTP 401; Server từ chối token; Không tạo Case |
| TC-036 | BOUNDARY | P1 | caseName max length 500 ký tự → 201 | HTTP 201; Case.name=500 chars |
| TC-037 | BOUNDARY | P1 | caseName 501 ký tự → 400 | HTTP 400; message chứa maxLength/500 |
| TC-038 | BOUNDARY | P1 | crime max length 255 ký tự → 201 | HTTP 201; Case.crime=255 chars |
| TC-039 | BOUNDARY | P1 | crime 256 ký tự → 400 | HTTP 400; message chứa maxLength/255 |
| TC-040 | BOUNDARY | P1 | jurisdiction max length 255 ký tự → 201 | HTTP 201; Case tạo thành công |
| TC-044 | EP | P2 | EP: caseName chứa số hợp lệ | HTTP 201; Case.name lưu đúng với số và dấu gạch ngang |
| TC-045 | EP | P2 | EP: crime partition — tội phạm kinh tế | HTTP 201; Case.crime lưu đúng text dài |
| TC-046 | EP | P2 | EP: jurisdiction partition — thẩm quyền ngoài PC02 | HTTP 201; Case.jurisdiction lưu đúng text dài |
| TC-048 | EP | P1 | EP: suspect null → Case tạo không có nghi phạm | HTTP 201; Case.suspect=null; Không báo lỗi |
| TC-049 | EP | P1 | EP: suspect empty string → null hoặc 400 | HTTP 201; Case.suspect=null (trim empty to null) HOẶC HTTP 400 — kiểm tra actual... |
| TC-052 | EP | P0 | EP: expectedUpdatedAt ISO 8601 UTC → 201 | HTTP 201; Không lỗi timestamp |
| TC-053 | EP | P1 | EP: expectedUpdatedAt ISO 8601 offset +07:00 → 201 | HTTP 201 nếu tương đương UTC; Không lỗi timezone |
| TC-057 | EP | P1 | EP: body null → 400 | HTTP 400; Không tạo Case |
| TC-064 | STATE | P0 | STATE: Petition.status=DA_CHUYEN_VU_AN → convert-case → 400 | HTTP 400; Double-convert guard; Petition.status không đổi |
| TC-068 | STATE | P0 | STATE: Case tạo ra từ convert có caseProvenance=FROM_PETITIO | Case.caseProvenance=FROM_PETITION; Case.linkedPetitionId=petition.id |
| TC-070 | STATE | P0 | STATE: Sau convert-case, Petition.linkedCaseId được set | Petition.linkedCaseId=newCase.id; linkedIncidentId=null |
| TC-073 | DECISION | P0 | DECISION: convert-case có docs → Documents re-link sang Case | HTTP 201; Case có 2 documents; Documents.entityType=CASE, entityId=case.id |
| TC-074 | DECISION | P1 | DECISION: convert-case với tất cả optional fields → tất cả đ | HTTP 201; Case lưu đúng tất cả optional fields; Không field nào bị bỏ |
| TC-078 | DECISION | P1 | DECISION: AuditLog ghi nhận PETITION_CONVERTED_TO_CASE | AuditLog entry: action=PETITION_CONVERTED_TO_CASE; entityId=petition.id |
| TC-079 | DECISION | P0 | DECISION: convert-case atomic — DB failure → rollback cả Pet | HTTP 500; Case không tồn tại trong DB; Petition.linkedCaseId=null; Không dữ liệu... |
| TC-082 | STATE | P1 | STATE: convert-case → Case không inherit teamId (case có sco | HTTP 201; Case tạo thành công; Case.teamId behavior theo business rule của Case |
| TC-084 | DECISION | P0 | DECISION table: Có linkedCaseId + POST convert-case → 400 | HTTP 400; Không tạo thêm Case |
| TC-085 | DECISION | P0 | DECISION table: Có linkedIncidentId + POST convert-case → 40 | HTTP 400; Cross-convert guard; Không tạo Case |
| TC-088 | DECISION | P0 | DECISION table: Không có linked + POST convert-case → 201 | HTTP 201; Case tạo; Petition.linkedCaseId set |
| TC-090 | STATE | P1 | STATE: convert-case response body chứa case object với id | Response chứa case object với id, caseCode, status; Frontend dùng case.id để red... |
| TC-123 | DATA | P0 | DATA: caseName tiếng Việt đầy dấu → UTF-8 round-trip | HTTP 201; Case.name=đúng tiếng Việt; JSON response encode UTF-8 |
| TC-124 | DATA | P1 | DATA: crime chứa số điều luật (Điều 174 BLHS) | HTTP 201; Case.crime lưu đúng cả chữ lẫn số |
| TC-128 | DATA | P1 | DATA: suspect chứa tên người Hán-Việt | HTTP 201; Case.suspect lưu đúng cả chữ Việt lẫn Hán tự |
| TC-129 | DATA | P1 | DATA: jurisdiction chứa địa chỉ đặc biệt với dấu phẩy | HTTP 201; Case.jurisdiction lưu đúng địa chỉ |
| TC-131 | DATA | P1 | DATA: suspect chứa CCCD 12 số | HTTP 201; Không lỗi; Case.suspect lưu đúng |
| TC-133 | DATA | P2 | DATA: caseName chứa năm và số thứ tự | HTTP 201; Case.name lưu đúng format mã số |
| TC-147 | DATA | P2 | DATA: crime chứa dấu ngoặc đơn và gạch ngang | HTTP 201; Case.crime lưu đúng dấu ngoặc |
| TC-148 | DATA | P2 | DATA: suspect chứa tên nước ngoài (ký tự Latin) | HTTP 201; Case.suspect lưu đúng tên Latin |
| TC-149 | DATA | P2 | DATA: jurisdiction chứa số điện thoại | HTTP 201; Case.jurisdiction lưu đúng số điện thoại |
| TC-150 | DATA | P0 | DATA: Multiple fields tiếng Việt cùng lúc → tất cả round-tri | Tất cả fields lưu và GET trả về đúng tiếng Việt có dấu |
| TC-171 | EDGE | P1 | EDGE: Petition có 50+ documents → convert-case document hand | HTTP 201; Tất cả 50 documents re-linked sang Case; Không timeout; Không miss doc... |
| TC-172 | EDGE | P1 | EDGE: expectedUpdatedAt là tương lai → 409 hoặc 400 | HTTP 409 (không match petition.updatedAt) HOẶC HTTP 400; Không tạo Case |
| TC-173 | EDGE | P1 | EDGE: expectedUpdatedAt là quá khứ xa → 409 | HTTP 409; Timestamp không match; Không tạo Case |
| TC-177 | EDGE | P1 | EDGE: convert-case với prosecutionDate là ngày hôm nay | HTTP 201; Case.prosecutionDate=today; Không lỗi date validation |
| TC-178 | EDGE | P1 | EDGE: convert-case với prosecutionDate trong tương lai → OK | HTTP 201; Ngày tương lai được chấp nhận |
| TC-181 | SECURITY | P0 | SECURITY: SQL Injection trong caseName → stored literal | HTTP 201; Case.name=literal string; Bảng không bị xóa |
| TC-182 | SECURITY | P0 | SECURITY: SQL Injection trong crime field → stored literal | HTTP 201; Case.crime=literal; Không leak user data |
| TC-183 | SECURITY | P0 | SECURITY: XSS trong caseName → stored raw, React escapes on  | Case lưu raw; UI render escaped; Script KHÔNG chạy; Cookie không bị steal |
| TC-184 | SECURITY | P0 | SECURITY: XSS trong jurisdiction → React escapes | UI hiển thị escaped HTML; onerror không trigger |
| TC-185 | SECURITY | P1 | SECURITY: Prototype pollution trong request body | HTTP 400 hoặc 201 với field bị ignore; class-validator reject unknown properties |
| TC-186 | SECURITY | P0 | SECURITY: Mass assignment — thêm field lạ (linkedCaseId) tro | HTTP 201; Petition.linkedCaseId=thực sự tạo từ transaction, KHÔNG bị override bở... |
| TC-189 | SECURITY | P0 | SECURITY: Authorization header với ADMIN role giả mạo trong  | HTTP 401; Server không tin payload; Signature mismatch |
| TC-191 | SECURITY | P1 | SECURITY: CSRF — request từ domain khác không có CSRF token | HTTP 403 (nếu stateful CSRF) HOẶC JWT Bearer không bị ảnh hưởng (stateless API) |
| TC-195 | SECURITY | P2 | SECURITY: Integer overflow trong numeric field | HTTP 400 hoặc ignored; Server không crash; Không integer overflow |
| TC-211 | SECURITY | P0 | SECURITY: Admin convert petition của officer khác nhưng cùng | HTTP 201; Admin có quyền; Case tạo thành công |
| TC-213 | SECURITY | P0 | SECURITY: Replay attack với cũ expectedUpdatedAt sau convert | HTTP 409 (petition.linkedCaseId đã có) HOẶC 400; Không tạo thêm Case |
| TC-236 | EDGE | P1 | EDGE: Extra unknown fields trong body → ignored (whitelist D | HTTP 201; unknownField bị ignore; Case tạo bình thường; Không mass assignment |
| TC-237 | EDGE | P1 | EDGE: Convert ngay sau khi petition được edit (updatedAt rất | HTTP 201; Không race condition nếu expectedUpdatedAt match chính xác |
| TC-238 | EDGE | P2 | EDGE: Convert-case prosecutionDate là string ngày trong quá  | HTTP 201; Ngày quá khứ được chấp nhận; Không có future-only validation |
| TC-243 | GREEN | P0 | GREEN: convert-case tạo Case với caseProvenance=FROM_PETITIO | Case.caseProvenance='FROM_PETITION'; Phân biệt với case tạo manual |
| TC-245 | GREEN | P1 | GREEN: convert-case với prosecutionDecision='Quyết định 001/ | HTTP 201; Case.prosecutionDecision='Quyết định 001/2026/QĐ-CSĐT' lưu đúng |
| TC-247 | RED | P1 | RED: jurisdiction là array ["A","B"] → 400 | HTTP 400; @IsString validator từ chối array |
| TC-248 | RED | P1 | RED: caseName là boolean true → 400 | HTTP 400; @IsString từ chối boolean |
| TC-249 | RED | P1 | RED: crime là object {} → 400 | HTTP 400; Không tạo Case |
| TC-272 | GREEN | P1 | GREEN: convert-case trả về 201 với body chứa data wrapper | Body: {data: {case: {...}}} HOẶC theo NestJS response wrapper pattern |
| TC-276 | RED | P0 | RED: convert-case với crime chỉ chứa khoảng trắng → 400 | HTTP 400; trim → empty → Tội danh là bắt buộc |
| TC-277 | RED | P0 | RED: convert-case với jurisdiction chỉ chứa khoảng trắng → 4 | HTTP 400; trim → empty → Thẩm quyền là bắt buộc |
| TC-278 | RED | P1 | RED: convert-case với caseName chỉ newlines → 400 | HTTP 400; trim whitespace → empty → bắt buộc |
| TC-292 | DATA | P0 | DATA: caseName chứa NoSQL operators → stored literal | HTTP 201; Stored as literal string; Prisma không bị NoSQL injection |

### API-convert-incident

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-001 | GREEN | P0 | Convert-incident happy path đầy đủ → 201, Incident tạo, Peti | HTTP 201; Incident.code format VV-YYYY-NNNNN; Petition.linkedIncidentId=incident... |
| TC-002 | GREEN | P0 | Convert-incident tối thiểu: incidentName+incidentType → 201 | HTTP 201; description=null; investigatorId=null; Petition.status=DA_CHUYEN_VU_VI... |
| TC-005 | RED | P0 | Convert-incident: thiếu incidentName → 400 | HTTP 400; message chứa incidentName/bắt buộc; Petition.status không đổi; Không t... |
| TC-006 | RED | P0 | Convert-incident: incidentName rỗng string → 400 | HTTP 400; message=Tên vụ việc là bắt buộc; Petition.status không đổi |
| TC-007 | RED | P0 | Convert-incident: thiếu incidentType → 400 | HTTP 400; message chứa incidentType/bắt buộc; Không tạo Incident |
| TC-012 | RED | P0 | Double-convert: đã linked Incident → convert-incident lần 2  | HTTP 400; message=Đơn thư này đã được chuyển thành Vụ việc trước đó; Không tạo I... |
| TC-013 | RED | P0 | Cross-convert: đã linked Case → convert-incident → 400 | HTTP 400; message chứa không thể chuyển thành Vụ việc; Không tạo Incident |
| TC-018 | GREEN | P1 | Convert-incident không gửi expectedUpdatedAt → OK (optional  | HTTP 201; Incident tạo thành công; petition.update không kiểm tra version lock |
| TC-019 | RED | P1 | Convert-incident: expectedUpdatedAt sai format ISO → 400 | HTTP 400; message chứa ISO 8601; Không tạo Incident |
| TC-021 | RED | P0 | Petition ID không tồn tại → 404 | HTTP 404; message=Đơn thư không tồn tại; Không tạo Incident |
| TC-022 | RED | P0 | Petition soft-deleted → 404 | HTTP 404; Không tạo Incident |
| TC-023 | SECURITY | P0 | Unauthenticated: không có JWT token → 401 | HTTP 401; Petition không thay đổi; Không tạo Incident |
| TC-024 | SECURITY | P0 | JWT token đã expired → 401 | HTTP 401; Không tạo Incident |
| TC-025 | SECURITY | P0 | Thiếu quyền edit:Petition → 403 Forbidden | HTTP 403; PermissionsGuard từ chối; Không tạo Incident |
| TC-026 | SECURITY | P0 | IDOR: convert petition ngoài DataScope của mình → 403 hoặc 4 | HTTP 403 hoặc 404; checkWriteScope chặn; Không tạo Incident |
| TC-028 | SECURITY | P0 | SQL Injection trong incidentName → lưu literal, không execut | HTTP 201; Incident.name=literal string; Bảng incidents không bị xóa; Prisma para... |
| TC-029 | SECURITY | P0 | XSS trong incidentName → stored raw, React escape khi render | Incident.name=raw string; UI hiển thị escaped HTML; Script không thực thi trong ... |
| TC-031 | BOUNDARY | P1 | incidentName max length 500 ký tự → 201 | HTTP 201; Incident.name=500 chars; Không cắt xén |
| TC-032 | BOUNDARY | P1 | incidentName 501 ký tự → 400 exceed max | HTTP 400; message chứa maxLength/500; Không tạo Incident |
| TC-033 | BOUNDARY | P1 | incidentName 1 ký tự (min valid) → 201 | HTTP 201; Incident tạo thành công |
| TC-034 | BOUNDARY | P1 | incidentType max length 100 ký tự → 201 | HTTP 201; Incident tạo thành công |
| TC-035 | BOUNDARY | P1 | incidentType 101 ký tự → 400 exceed max | HTTP 400; message chứa maxLength/100 |
| TC-041 | EP | P1 | EP: incidentName chứa khoảng trắng đầu/cuối → tự trim | HTTP 201; Incident.name='Vụ lừa đảo' (trimmed) |
| TC-042 | EP | P0 | EP: incidentName chỉ khoảng trắng → 400 | HTTP 400; trim → empty → Tên vụ việc là bắt buộc |
| TC-043 | EP | P0 | EP: incidentType chỉ khoảng trắng → 400 | HTTP 400; trim → empty → Loại vụ việc là bắt buộc |
| TC-047 | EP | P2 | EP: description tối đa — textarea dài 2000 ký tự | HTTP 201; Incident.description lưu đủ không mất dữ liệu |
| TC-050 | EP | P1 | EP: assignedToId không hợp lệ UUID → 400 hoặc 404 | HTTP 400 (invalid UUID format) HOẶC HTTP 404 (user not found); Không tạo Inciden... |
| TC-051 | EP | P1 | EP: assignedToId user không tồn tại → 404 | HTTP 404; message chứa User not found; Không tạo Incident |
| TC-054 | EP | P1 | EP: body là array thay vì object → 400 | HTTP 400; Không tạo Incident; NestJS class-validator từ chối array |
| TC-055 | EP | P1 | EP: Content-Type sai (text/plain) → 400 | HTTP 400 hoặc 415; NestJS không parse body |
| TC-056 | EP | P0 | EP: body rỗng {} → 400 (thiếu tất cả required fields) | HTTP 400; message liệt kê incidentName và incidentType là bắt buộc |
| TC-058 | BOUNDARY | P1 | BOUNDARY: petition.id là CUID v2 hợp lệ → OK | HTTP 201; Server chấp nhận CUID format |
| TC-059 | BOUNDARY | P1 | BOUNDARY: petition.id là UUID v4 hợp lệ → OK | HTTP 201; Server chấp nhận UUID format |
| TC-060 | BOUNDARY | P0 | BOUNDARY: petition.id là chuỗi đặc biệt '../../etc/passwd' → | HTTP 404; Router không match path traversal; Không leak file system |
| TC-061 | STATE | P0 | STATE: Petition.status=TIEP_NHAN → convert-incident → DA_CHU | HTTP 201; Petition.status chuyển sang DA_CHUYEN_VU_VIEC; Incident tạo thành công |
| TC-062 | STATE | P0 | STATE: Petition.status=DANG_XU_LY → convert-incident → DA_CH | HTTP 201; Petition.status=DA_CHUYEN_VU_VIEC; Incident tạo |
| TC-063 | STATE | P0 | STATE: Petition.status=DA_CHUYEN_VU_VIEC → convert-incident  | HTTP 400; Double-convert guard; Petition.status không đổi |
| TC-065 | STATE | P0 | STATE: Petition.status=DA_CHUYEN_VU_AN → convert-incident →  | HTTP 400; Cross-convert guard; Không tạo Incident |
| TC-066 | STATE | P1 | STATE: Petition.status=TU_CHOI → convert-incident → behavior | HTTP 400 (not allowed) HOẶC 201 nếu business cho phép; Kiểm tra actual behavior |
| TC-067 | STATE | P0 | STATE: Incident tạo ra từ convert có linkedPetitionId | Incident.linkedPetitionId = petition.id; Incident.petitionProvenance=FROM_PETITI... |
| TC-069 | STATE | P0 | STATE: Sau convert-incident, Petition.linkedIncidentId được  | Petition.linkedIncidentId=newIncident.id; linkedCaseId=null |
| TC-071 | DECISION | P1 | DECISION: convert-incident, không có docs → Incident tạo khô | HTTP 201; Incident.documents=[] (rỗng); Không lỗi |
| TC-072 | DECISION | P0 | DECISION: convert-incident có docs → Documents re-link sang  | HTTP 201; Incident có 3 documents; Documents.entityType=INCIDENT, entityId=incid... |
| TC-075 | DECISION | P1 | DECISION: convert-incident với assignedToId → Incident.assig | HTTP 201; Incident.assignedToId=officer1.id; Officer được phân công |
| TC-076 | DECISION | P1 | DECISION: convert-incident với description → Incident.descri | HTTP 201; Incident.description='Mô tả chi tiết vụ việc' |
| TC-077 | DECISION | P1 | DECISION: AuditLog ghi nhận PETITION_CONVERTED_TO_INCIDENT | AuditLog entry: action=PETITION_CONVERTED_TO_INCIDENT; entityId=petition.id; per... |
| TC-080 | DECISION | P1 | DECISION: convert-incident non-atomic — Incident tạo OK nhưn | Incident tạo trong DB; Petition.linkedIncidentId không được set → orphan Inciden... |
| TC-081 | STATE | P1 | STATE: convert-incident → Incident inherits petition.assigne | Incident.teamId=petition.assignedTeamId (inherited); DataScope vẫn đúng |
| TC-083 | DECISION | P0 | DECISION table: Có linkedIncidentId + POST convert-incident  | HTTP 400; Không tạo thêm Incident |
| TC-086 | DECISION | P0 | DECISION table: Có linkedCaseId + POST convert-incident → 40 | HTTP 400; Cross-convert guard; Không tạo Incident |
| TC-087 | DECISION | P0 | DECISION table: Không có linked + POST convert-incident → 20 | HTTP 201; Incident tạo; Petition.linkedIncidentId set |
| TC-089 | STATE | P1 | STATE: convert trả về response body đầy đủ (incident/case ob | Response chứa incident object với id, code, name, status; Frontend dùng incident... |
| TC-121 | DATA | P0 | DATA: incidentName tiếng Việt có dấu → lưu và hiển thị đúng  | HTTP 201; Incident.name lưu đúng tiếng Việt có dấu; GET incident trả về đúng |
| TC-122 | DATA | P0 | DATA: incidentType tiếng Việt → UTF-8 round-trip | HTTP 201; Incident.type lưu và GET trả về đúng |
| TC-125 | DATA | P1 | DATA: incidentName với ký tự đặc biệt (/, \, &, <, >) → stor | HTTP 201; Incident.name=literal string không encode HTML entities |
| TC-126 | DATA | P1 | DATA: incidentName chứa newline → xử lý đúng | HTTP 201 hoặc 400; Nếu 201: lưu literal; Nếu 400: message rõ ràng |
| TC-127 | DATA | P2 | DATA: incidentName chứa Unicode emoji → stored literal | HTTP 201; Incident.name lưu emoji đúng; DB không bị lỗi encoding |
| TC-130 | DATA | P0 | DATA: description HTML tags → stored literal không execute | HTTP 201; description lưu literal HTML; UI không render tag; Script không execut... |
| TC-132 | DATA | P2 | DATA: incidentName toàn chữ hoa | HTTP 201; Incident.name lưu đúng UPPERCASE |
| TC-134 | DATA | P1 | DATA: request body encoding UTF-8 (không phải Latin-1) | HTTP 201; Server decode đúng UTF-8; Không bị lỗi Mojibake |
| TC-135 | DATA | P1 | DATA: Response JSON encoding UTF-8 chính xác | Header có charset=utf-8; Body JSON đúng UTF-8 không bị encode escaped |
| TC-146 | DATA | P2 | DATA: incidentName chỉ số → hợp lệ | HTTP 201; Incident.name='12345' |
| TC-170 | EDGE | P1 | EDGE: Petition vừa được tạo (D0, không có documents) → conve | HTTP 201; Incident tạo OK dù petition không có documents |
| TC-174 | EDGE | P1 | EDGE: Petition bị xóa trong khi user điền form → 404 khi sub | HTTP 404; UI hiển thị 'Đơn thư không còn tồn tại'; Không crash |
| TC-175 | EDGE | P1 | EDGE: Convert-incident với assignedToId của user đã bị vô hi | HTTP 400 hoặc 404; Không tạo Incident; Cán bộ không hoạt động không được phân cô... |
| TC-176 | EDGE | P2 | EDGE: Hai field cùng tên nhưng case khác nhau → stored as-is | HTTP 201; Incident.name='vụ lừa ĐẢO' không normalize case |
| TC-179 | EDGE | P1 | EDGE: Petition không có assignedTeamId → Incident không có t | HTTP 201; Incident.teamId=null; Không lỗi |
| TC-180 | EDGE | P0 | EDGE: Multiple convert-incident attempts trong vòng 1 giây ( | Đúng 1 Incident tạo; UI disabled sau lần click đầu; Không tạo duplicate |
| TC-187 | SECURITY | P0 | SECURITY: Mass assignment — thêm id vào body convert-inciden | HTTP 201; Incident.id do server generate (CUID), KHÔNG phải id từ body |
| TC-188 | SECURITY | P1 | SECURITY: SSRF qua description field | HTTP 201; Server lưu URL literal, KHÔNG fetch URL; Không SSRF |
| TC-190 | SECURITY | P1 | SECURITY: Brute force nhiều requests (100 req/min) → throttl | Sau ngưỡng: HTTP 429 Too Many Requests; Rate limit header; Throttle đang hoạt độ... |
| TC-192 | SECURITY | P0 | SECURITY: Insecure Direct Object Reference — đọc petition củ | HTTP 403 hoặc 404; DataScope.checkWriteScope chặn; officer2 không thể convert pe... |
| TC-193 | SECURITY | P1 | SECURITY: Tiêm giá trị null vào required field | HTTP 400; Null không bypass @IsNotEmpty(); Không tạo Incident |
| TC-194 | SECURITY | P1 | SECURITY: Tiêm undefined vào required field | HTTP 400; @IsNotEmpty validates missing key |
| TC-212 | SECURITY | P0 | SECURITY: Officer convert petition của chính mình → 201 | HTTP 201; checkWriteScope pass; Incident tạo |
| TC-214 | SECURITY | P1 | SECURITY: Header injection trong request | HTTP 201; Header không ảnh hưởng SQL; Không bị IP spoofing skip auth |
| TC-215 | SECURITY | P1 | SECURITY: Content-Length manipulation — gửi body lớn hơn Con | HTTP 400 hoặc body parse error; Không crash server |
| TC-235 | EDGE | P1 | EDGE: Body JSON malformed → 400 Bad Request | HTTP 400; JSON parse error; Không crash server |
| TC-239 | EDGE | P2 | EDGE: incidentName chứa tab character → stored đúng | HTTP 201; Lưu với tab; DB không error |
| TC-240 | EDGE | P2 | EDGE: assignedToId là ID của chính user đang đăng nhập → OK | HTTP 201; User tự phân công cho vụ việc; Không self-assign prevention |
| TC-241 | GREEN | P1 | GREEN: convert-incident với description dài nhất hợp lệ → 20 | HTTP 201 nếu DB text field không giới hạn; Hoặc 400 nếu có maxLength |
| TC-242 | GREEN | P2 | GREEN: Incident tạo inherits petition.receivedDate vào resol | Incident có timestamp info liên quan đến petition; Không mất dữ liệu thời gian |
| TC-244 | GREEN | P1 | GREEN: convert-incident response có nested petition info | Response có petitionId hoặc petition object; Frontend có đủ data để confirm |
| TC-246 | RED | P1 | RED: incidentType là số 123 (không phải string valid) → 400 | HTTP 400 HOẶC coi như string '123' — kiểm tra actual behavior |
| TC-250 | RED | P2 | RED: description là số → 400 hoặc coerced to string | HTTP 400 (@IsString) HOẶC coerce '99999' — kiểm tra behavior |
| TC-253 | DECISION | P1 | DECISION: convert-incident body với field dư (whitelist test | HTTP 201; Extra fields bị strip bởi NestJS whitelist DTO; Incident không nhận fa... |
| TC-269 | DATA | P1 | DATA: Petition với senderName có dấu phẩy → Incident.benVu l | Incident.benVu='Nguyễn Văn A, B, C' không bị split bởi dấu phẩy |
| TC-271 | GREEN | P1 | GREEN: convert-incident trả về 201 với content-type applicat | Content-Type: application/json; charset=utf-8; Status 201 |
| TC-291 | DATA | P0 | DATA: incidentName chứa SQL keyword → stored literal | HTTP 201; Lưu literal SQL; Prisma parameterized query ngăn injection |
| TC-293 | GREEN | P1 | GREEN: convert-incident ID ngắn hợp lệ (8 ký tự) — kiểm tra  | HTTP 201 hoặc 404 tùy ID; Không 400 vì route regex |
| TC-305 | DATA | P1 | DATA: Description chứa Markdown syntax → stored literal khôn | HTTP 201; Incident.description lưu Markdown literal; UI không render như HTML |

### COMPAT-Browser

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-161 | COMPAT | P1 | COMPAT: Chrome latest — Modal hiển thị đúng | Modal centered đúng; Grid 2 columns hiển thị; CSS grid gap đúng |
| TC-162 | COMPAT | P1 | COMPAT: Firefox latest — Modal và form hoạt động | Modal hoạt động bình thường; Không lỗi render CSS; Form submit OK |
| TC-163 | COMPAT | P2 | COMPAT: Edge latest — Modal hoạt động | Không lỗi; Giống Chrome behavior |
| TC-167 | COMPAT | P2 | COMPAT: Safari macOS — Modal backdrop blur hoạt động | bg-black/50 overlay hiển thị đúng; Không bị trong suốt hoàn toàn |

### COMPAT-Mobile

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-260 | COMPAT | P1 | COMPAT: iOS Safari — form inputs nhập được (not readonly) | Keyboard hiện lên; Input nhận text; Không readonly bug |
| TC-261 | COMPAT | P1 | COMPAT: Android Chrome — modal scroll được khi content dài | Modal có overflow-y scroll; User có thể scroll đến nút submit |

### COMPAT-OS

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-308 | COMPAT | P2 | COMPAT: Windows 11 Edge + Chrome — modal layout đồng nhất | Layout giống nhau; Không có CSS vendor prefix issue |
| TC-309 | COMPAT | P2 | COMPAT: macOS Ventura Safari — backdrop-filter support | Overlay hiển thị; Không transparent hoàn toàn trên Safari |

### COMPAT-PWA

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-313 | COMPAT | P2 | COMPAT: PWA standalone mode — modal hiển thị đúng không bị c | Modal không bị clip bởi system safe-area; inset-0 cover đúng viewport |

### COMPAT-Print

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-283 | COMPAT | P2 | COMPAT: Print preview — modal không in, trang petition in đú | Modal không bị in; Petition form hiển thị đúng trong print preview |

### COMPAT-Responsive

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-164 | COMPAT | P1 | COMPAT: Mobile viewport 375px — Modal responsive | Modal không tràn ra ngoài viewport; mx-4 padding; Các buttons vẫn tap-able; max-... |
| TC-165 | COMPAT | P2 | COMPAT: Tablet viewport 768px — Modal hiển thị đúng | Modal centered; max-w-lg giữ nguyên; 2-column grid không break |

### COMPAT-Touch

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-312 | COMPAT | P1 | COMPAT: Touch device (touch events) — option buttons tap wor | Touch event trigger click; Step 2 form mở; No 300ms delay |

### COMPAT-Viewport

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-310 | COMPAT | P1 | COMPAT: Viewport 1024px (laptop) — modal không quá rộng | Modal max-w-lg (512px) centered; Không stretch full width |
| TC-311 | COMPAT | P2 | COMPAT: Viewport 1920px (4K/FHD) — modal vẫn centered | Modal centered với fixed inset-0; Không trôi sang trái/phải |

### COMPAT-Zoom

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-166 | COMPAT | P2 | COMPAT: Zoom 200% — Modal không bị layout break | Text không overlap; Buttons vẫn visible; Scroll hoạt động nếu content dài |

### E2E-FullFlow

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-302 | INTEGRATION | P0 | INTEGRATION: Toàn bộ flow E2E: Petition → Convert → Incident | Tất cả bước thành công; Data nhất quán từ đầu đến cuối; Không lỗi ở bất kỳ bước ... |
| TC-303 | INTEGRATION | P0 | INTEGRATION: Toàn bộ flow E2E: Petition → Convert → Case → E | Tất cả bước thành công; Case có linkedPetitionId; Data nhất quán |

### E2E-MultiUser

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-304 | INTEGRATION | P1 | INTEGRATION: E2E flow với nhiều user: petition tạo bởi offic | HTTP 201; Admin có quyền convert petition của officer1; Incident.createdById=adm... |

### EDGE-Concurrent

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-270 | EDGE | P1 | EDGE: Đồng thời convert-incident và edit petition — convert  | Cả hai không corrupt data; Một trong hai 409; Không dữ liệu nửa vời |

### EDGE-CorruptData

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-296 | EDGE | P1 | EDGE: convert-incident với petition là object rỗng trong DB  | HTTP 400 hoặc 500; Error message; Không crash hoàn toàn |

### EDGE-Old

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-231 | EDGE | P1 | EDGE: Petition được tạo rất lâu (D365) → vẫn convert được | HTTP 201; Không có time-based expiry cho convert |

### EDGE-SparseData

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-233 | EDGE | P1 | EDGE: Rất nhiều fields null trong petition → convert-case vớ | HTTP 201; Case tạo thành công dù petition sparse |

### EDGE-TeamConfig

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-232 | EDGE | P1 | EDGE: Petition có assignedToId nhưng không có team → convert | HTTP 201; Incident tạo với assignedToId; teamId=null |

### EDGE-Unlink

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-234 | EDGE | P2 | EDGE: Convert incident rồi convert incident lại sau khi unli | HTTP 201 nếu unlink thành công; hoặc 400 nếu không hỗ trợ unlink |

### Integration-AuditLog

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-139 | INTEGRATION | P1 | INTEGRATION: AuditLog có timestamp chính xác (không quá 5 gi | AuditLog.timestamp trong khoảng T1 ±5 giây; Timezone VN correct |

### Integration-Consistency

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-307 | INTEGRATION | P0 | INTEGRATION: convert-incident + immediate GET petition list  | Petition với status=DA_CHUYEN_VU_VIEC xuất hiện; Không có stale cache issue; Rea... |

### Integration-DataScope

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-226 | INTEGRATION | P0 | INTEGRATION: convert + GET incident bởi team khác → 403 | HTTP 403 hoặc 404; DataScope enforce trên incident mới |

### Integration-DocumentNumbers

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-227 | INTEGRATION | P0 | INTEGRATION: Petition stt không thay đổi sau convert (no num | STT='DT-2026-00010' unchanged; Convert không tạo số STT mới cho petition |
| TC-228 | INTEGRATION | P0 | INTEGRATION: Incident nhận code mới VV-YYYY-NNNNN (không dùn | Incident.code khác với Petition.stt; Format VV-2026-NNNNN |

### Integration-Documents

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-136 | INTEGRATION | P0 | INTEGRATION: Documents re-linked sau convert-incident — enti | Document.entityType='INCIDENT'; Document.entityId=newIncident.id; Petition không... |
| TC-137 | INTEGRATION | P1 | INTEGRATION: Sau convert-incident, GET /petitions/{id}/docum | Response=[] (rỗng); Documents đã migrate sang Incident |
| TC-138 | INTEGRATION | P0 | INTEGRATION: Sau convert-case, GET /cases/{id}/documents trả | Documents available tại Case endpoint; entityId=case.id |

### Integration-Export

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-229 | INTEGRATION | P1 | INTEGRATION: convert-case + export document ngay sau → docum | Export thành công; Document context là Case, không phải Petition |

### Integration-FeatureFlag

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-230 | INTEGRATION | P1 | INTEGRATION: Feature flag convert bị tắt → endpoint trả 403 | HTTP 403 hoặc 404; @FeatureFlag guard hoạt động |

### Integration-FieldMapping

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-140 | INTEGRATION | P1 | INTEGRATION: Incident inherits petition.senderName vào benVu | Incident.benVu='Nguyễn Thị B' (mapped from senderName) |

### Integration-List

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-264 | INTEGRATION | P1 | INTEGRATION: convert-case → Case xuất hiện ngay trong /cases | Case mới xuất hiện trong list; Không cần refresh thủ công |
| TC-265 | INTEGRATION | P1 | INTEGRATION: convert-incident → Incident xuất hiện trong /in | Incident mới trong list; caseProvenance/petitionProvenance visible |

### Integration-PWA

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-285 | INTEGRATION | P2 | INTEGRATION: convert-case + PWA push notification (nếu subsc | Push notification sent; Payload có caseId và caseName |

### Integration-Post-Convert

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-224 | INTEGRATION | P1 | INTEGRATION: convert-incident + create assignment ngay sau → | Cả hai 201; Assignment được tạo cho incident mới; Không race condition |
| TC-225 | INTEGRATION | P1 | INTEGRATION: convert-case + update case ngay sau → 200 | PATCH 200; Case được update; Không lỗi version conflict do vừa tạo |

### Integration-SSE

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-284 | INTEGRATION | P1 | INTEGRATION: convert-incident + SSE notification push đến te | Team member nhận SSE event về vụ việc mới; Notification bell hiển thị |

### Performance

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-141 | PERFORMANCE | P1 | INTEGRATION: convert-case response latency < 2000ms | Response trong vòng 2000ms; Atomic $transaction không gây timeout |
| TC-142 | PERFORMANCE | P1 | INTEGRATION: convert-incident response latency < 1500ms | Response trong vòng 1500ms; Non-atomic flow nhanh hơn case |
| TC-143 | PERFORMANCE | P1 | PERFORMANCE: 10 concurrent convert-case requests với 10 peti | Tất cả 10 requests nhận 201; 10 Cases tạo; Không deadlock; Không 500 |
| TC-144 | PERFORMANCE | P0 | PERFORMANCE: 5 concurrent convert-case cùng 1 petition → 1 t | Đúng 1 request nhận 201; 4 requests nhận 409; Chỉ 1 Case trong DB; Optimistic lo... |
| TC-145 | PERFORMANCE | P2 | PERFORMANCE: Large description (10KB) → không làm chậm respo | HTTP 201 trong vòng 2000ms; Không timeout |

### Performance-Load

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-221 | PERFORMANCE | P1 | PERFORMANCE: convert-case với DB load cao (10 concurrent ins | Response ≤ 3000ms kể cả khi load cao; Không timeout 30s |

### Performance-Memory

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-306 | PERFORMANCE | P1 | PERFORMANCE: Memory không leak sau 50 consecutive converts ( | Heap size ổn định; Không tăng liên tục (no memory leak); Server không restart |

### Performance-Query

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-266 | PERFORMANCE | P1 | PERFORMANCE: Incident list sau convert không chậm hơn (N+1 q | Response time tương đương trước convert; Không N+1 query |

### Performance-Throughput

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-294 | PERFORMANCE | P2 | PERFORMANCE: Batch 100 convert-incident đơn lẻ tuần tự trong | 100 Incidents tạo thành công trong vòng 5 phút (3 req/giây); Không memory leak |

### Performance-UI

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-222 | PERFORMANCE | P2 | PERFORMANCE: UI modal mở trong < 100ms (không có animation l | Modal hiển thị < 100ms; Không jank; Transition smooth |
| TC-223 | PERFORMANCE | P1 | PERFORMANCE: form submit → redirect trong < 3 giây | Redirect hoàn tất < 3 giây; User không chờ quá lâu |

### Recovery

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-168 | RECOVERY | P1 | RECOVERY: Submit lỗi 500 → user có thể retry | Error message hiển thị; Button enable lại (không disabled mãi); Submit lần 2 hoạ... |
| TC-169 | RECOVERY | P1 | RECOVERY: Token expired mid-submit → redirect to login | App redirect về /login HOẶC hiển thị 'Phiên đăng nhập hết hạn'; Không crash |

### Recovery-Network

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-262 | RECOVERY | P1 | RECOVERY: Mất kết nối mạng sau khi modal mở → Lỗi hiển thị k | Error message 'Không có kết nối mạng' hoặc generic error; Không crash |

### Recovery-ServerRestart

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-263 | RECOVERY | P1 | RECOVERY: Server restart trong khi user điền form → submit s | JWT còn hạn → HTTP 201 sau restart; JWT hết hạn → 401 → redirect login |

### Regression-Cases

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-203 | REGRESSION | P0 | REGRESSION: Case mới tạo từ convert có status mặc định đúng | Case.status=default (KHOI_TO hoặc business default); Không null |
| TC-205 | REGRESSION | P0 | REGRESSION: Case.caseCode auto-generated sau convert | Case.caseCode tồn tại; Format VA-YYYY-NNNNN hoặc theo convention |

### Regression-Export

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-288 | REGRESSION | P1 | REGRESSION: Export PDF petition không bị break sau convert | Export vẫn thành công; Document có thể tải về |

### Regression-HoSoJourney

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-208 | REGRESSION | P1 | REGRESSION: HoSo journey cập nhật sau convert | Journey step 'Chuyển vụ việc' được ghi; Timeline có event |

### Regression-Incidents

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-202 | REGRESSION | P0 | REGRESSION: Incident mới tạo có status mặc định đúng | Incident.status=TIEP_NHAN (default) HOẶC status mặc định theo business rule |
| TC-204 | REGRESSION | P0 | REGRESSION: Incident.code auto-generated sau convert | Incident.code format VV-YYYY-NNNNN; Không null; Không trùng |

### Regression-KPI

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-207 | REGRESSION | P1 | REGRESSION: KPI stats cập nhật sau convert-incident | Thống kê số đơn chuyển vụ việc tăng lên; KPI reflect conversion |

### Regression-Notifications

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-206 | REGRESSION | P2 | REGRESSION: Notifications triggered sau convert (nếu notific | Team members nhận notification về vụ việc mới; Không notification nếu feature di... |

### Regression-PetitionAssignment

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-199 | REGRESSION | P1 | REGRESSION: Petition assignments không bị xóa sau convert | Assignments vẫn tồn tại; Convert không xóa phân công cán bộ |

### Regression-Petitions

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-196 | REGRESSION | P1 | REGRESSION: Sau convert-incident, GET /petitions không còn h | linkedIncidentId=newIncident.id (không null); Regression: không bị reset về null |
| TC-197 | REGRESSION | P1 | REGRESSION: Convert không ảnh hưởng đến petition STT | Petition.stt='DT-2026-00001' không đổi sau convert |
| TC-198 | REGRESSION | P1 | REGRESSION: Convert không reset petition.receivedDate | Petition.receivedDate không thay đổi |
| TC-200 | REGRESSION | P1 | REGRESSION: List petitions vẫn trả về petition đã convert | Petition vẫn có trong list; Không bị ẩn; status=DA_CHUYEN_VU_VIEC hiển thị đúng |
| TC-201 | REGRESSION | P1 | REGRESSION: Search petitions theo status DA_CHUYEN_VU_VIEC s | Petition vừa convert xuất hiện trong results |

### Regression-Search

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-286 | REGRESSION | P1 | REGRESSION: Convert không ảnh hưởng search index (petition v | Petition vẫn xuất hiện trong search results |

### Regression-Statistics

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-287 | REGRESSION | P1 | REGRESSION: Petition count thống kê vẫn đúng sau convert | Tổng petitions không thay đổi; Count theo status cập nhật đúng |

### Regression-UI-List

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-209 | REGRESSION | P1 | REGRESSION: Petition list badge hiển thị đúng sau convert | Badge status thay đổi từ cũ sang 'Đã chuyển vụ việc' với màu tương ứng |

### UI-ConvertPetitionModal

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-095 | GREEN | P0 | UI: Click 'Chuyển đổi' → Modal hiện với 2 options Vụ việc +  | Modal data-testid='convert-modal' visible; 2 buttons: convert-option-incident, c... |
| TC-096 | GREEN | P0 | UI: Click X trên modal → Modal đóng | Modal biến mất; Trang edit vẫn hiển thị; Không có thay đổi dữ liệu |
| TC-097 | GREEN | P0 | UI: Chọn 'Vụ việc' → Step 2 hiện form với incidentName + inc | Input convert-incident-name visible; input convert-incident-type visible; conver... |
| TC-098 | GREEN | P0 | UI: Chọn 'Vụ án' → Step 2 hiện form caseName + crime + juris | Input convert-case-name, convert-case-crime, convert-case-jurisdiction đều visib... |
| TC-099 | RED | P0 | UI: Submit form vụ việc thiếu tên → Lỗi validation hiện tại  | Text 'Tên vụ việc là bắt buộc' visible; API KHÔNG được gọi; Modal không đóng |
| TC-100 | RED | P0 | UI: Submit form vụ việc thiếu loại → Lỗi validation hiện tại | Text 'Loại vụ việc là bắt buộc' visible; API KHÔNG được gọi |
| TC-101 | GREEN | P0 | UI: Submit form vụ việc hợp lệ → Loading state → redirect /i | Button chuyển 'Đang chuyển...' trong khi loading; Sau đó redirect tới /incidents... |
| TC-102 | RED | P0 | UI: Submit form vụ án thiếu caseName → Lỗi validation | Text 'Tên vụ án là bắt buộc' visible; API KHÔNG được gọi |
| TC-103 | GREEN | P0 | UI: Submit form vụ án hợp lệ → redirect /cases/:id/edit | Redirect tới /cases/{newCaseId}/edit; Không còn ở trang petition |
| TC-104 | GREEN | P1 | UI: Quay lại từ Step 2 → Step 1 hiện lại, form bị reset | Step 1 (2 options) hiện lại; form state bị clear |
| TC-105 | RED | P0 | UI: API lỗi 409 race condition → Error message hiển thị tron | Error message hiển thị trong modal (div bg-red-50); Không navigate; User có thể ... |
| TC-106 | RED | P1 | UI: API lỗi mạng (Network Error) → Error message hiển thị | Error message 'Có lỗi xảy ra khi chuyển đổi' hoặc error.message hiển thị; Modal ... |
| TC-107 | GREEN | P1 | UI: Button disabled trong khi đang submit (isSubmitting) | Button convert-submit bị disabled; Text 'Đang chuyển...'; Không double-submit |
| TC-108 | GREEN | P1 | UI: Press Escape key → Modal đóng (keyboard trap test) | Modal đóng; Tương đương click X button |
| TC-109 | GREEN | P1 | UI: Click outside modal backdrop → Modal đóng | Modal đóng; Trang edit vẫn hiển thị |
| TC-110 | RED | P1 | UI: convert-case petitionUpdatedAt=null → 'Không thể xác địn | Error 'Không thể xác định phiên bản đơn thư'; Submit bị chặn; API không gọi |
| TC-112 | GREEN | P2 | UI: Incident form có textarea description (optional) | Textarea visible; Có thể nhập text; Field không bắt buộc (không có asterisk *red... |
| TC-113 | GREEN | P2 | UI: Case form có input suspect (optional) | Input convert-case-suspect visible; Field không bắt buộc |
| TC-114 | GREEN | P1 | UI: Error list cleared khi chuyển từ step 2 về step 1 | Errors cũ biến mất; Form sạch |
| TC-115 | GREEN | P2 | UI: incidentName input auto-focus khi vào step 2 incident fo | incidentName input được focus tự động; User có thể gõ ngay không cần click |
| TC-116 | GREEN | P2 | UI: Modal title đúng 'Chuyển đổi đơn thư' | h2 text='Chuyển đổi đơn thư' |
| TC-117 | GREEN | P1 | UI: Hủy button trong step 2 → Gọi onClose (đóng modal hoàn t | onClose được gọi; Modal đóng hoàn toàn (không chỉ về step 1) |
| TC-118 | GREEN | P2 | UI: Convert-incident button label 'Chuyển thành Vụ việc' | Button text='Chuyển thành Vụ việc'; Icon ArrowRight visible |
| TC-119 | GREEN | P2 | UI: Convert-case button label 'Khởi tố Vụ án' với màu amber | Button text='Khởi tố Vụ án'; bg-amber-600 (vàng nâu); Icon ArrowRight |
| TC-120 | GREEN | P2 | UI: Step 1 hiển thị mô tả pháp lý (Điều 143/147 BLTTHS) | Option Vụ việc: 'Xác minh điều tra (Điều 143 BLTTHS)'; Option Vụ án: 'Khởi tố vụ... |

### UI-Navigation

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-297 | GREEN | P1 | GREEN: Sau convert, Back button browser trên trang Incident  | Về trang /petitions list hoặc edit form; Modal không tự mở lại; Không infinite r... |
| TC-298 | GREEN | P0 | GREEN: Sau convert-case, URL là /cases/{id}/edit (đúng route | URL = http://localhost:5173/cases/{newCaseId}/edit; ID là CUID hợp lệ |
| TC-299 | GREEN | P0 | GREEN: Sau convert-incident, URL là /incidents/{id}/edit | URL = http://localhost:5173/incidents/{newIncidentId}/edit |
| TC-300 | GREEN | P0 | GREEN: Incident edit page load thành công sau redirect từ co | Incident form load; incidentName hiển thị đúng; Không 404/500 |
| TC-301 | GREEN | P0 | GREEN: Case edit page load thành công sau redirect từ conver | Case form load; Tất cả fields hiển thị đúng; Không 404/500 |

### UI-PetitionFormPage

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-091 | GREEN | P0 | UI: Nút 'Chuyển đổi' hiển thị khi edit mode, chưa convert | Nút data-testid='btn-convert-petition' visible; button không disabled |
| TC-092 | GREEN | P0 | UI: Nút 'Chuyển đổi' ẩn khi đã linked Incident | Nút btn-convert-petition KHÔNG visible hoặc disabled; canConvert=false |
| TC-093 | GREEN | P0 | UI: Nút 'Chuyển đổi' ẩn khi đã linked Case | Nút btn-convert-petition KHÔNG visible hoặc disabled; canConvert=false |
| TC-094 | GREEN | P1 | UI: Nút 'Chuyển đổi' ẩn trên trang create (không phải edit m | Nút btn-convert-petition KHÔNG xuất hiện; isEditMode=false |
| TC-111 | GREEN | P1 | UI: Sau khi modal đóng bởi user, showConvertModal=false (sta | Modal mở lại từ step 1; State được reset hoàn toàn |
| TC-273 | GREEN | P1 | GREEN: Petition edit form vẫn load được sau convert (read-on | Form load được; Các fields vẫn visible (read/edit); Nút convert ẩn; Badge 'Đã ch... |
| TC-274 | GREEN | P1 | GREEN: Link đến Incident hiển thị trên petition form sau con | Link/button 'Xem vụ việc' visible với href=/incidents/{incidentId}/edit |
| TC-275 | GREEN | P1 | GREEN: Link đến Case hiển thị trên petition form sau convert | Link 'Xem vụ án' visible với href=/cases/{caseId}/edit |

### USABILITY

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-210 | USABILITY | P2 | USABILITY: Flow chuyển đổi hoàn tất < 30 giây cho user thành | Flow tổng không quá 30 giây với user thành thạo; Không cần confirm dialog thêm |

### USABILITY-ErrorMsg

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-289 | USABILITY | P1 | USABILITY: Error messages bằng tiếng Việt rõ ràng, không tec | Messages tiếng Việt; Không có 'undefined', 'null', stack trace; User hiểu cần là... |

### USABILITY-UnsavedData

| TC-ID | Loại | P | Tiêu đề | Kết quả mong đợi |
|-------|------|---|---------|-----------------|
| TC-290 | USABILITY | P2 | USABILITY: Confirm khi đóng modal có data đã điền | Confirmation dialog 'Bạn có chắc muốn đóng? Dữ liệu chưa lưu sẽ bị mất' HOẶC khô... |
