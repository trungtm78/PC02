# Vụ việc — release 0.73.0.0

Release tăng cường module đang chạy tại https://new.pc02hcm.com/, dựa trên commit production `1b09ff08d6772ef2edce54d79f50509755c2ef11`. Người dùng đã GO deploy sau khi sửa lỗi. Không đưa toàn bộ diff của workspace cũ lên production.

## Hành vi

- Hai màn tiếp nhận/phân loại và quản lý dùng lại Incident, form, phân quyền và API hiện hữu.
- Giao tạo lượt chờ nhận; nhận là thao tác riêng, giữ ID/STT/trạng thái pháp lý/ngày đề xuất/hạn. Pending chặn ghi nghiệp vụ, kể cả API kết quả và bulk.
- Khởi tố cần số/ngày quyết định, tạo Case có nguồn và hai liên kết, cùng transaction với lịch sử/audit. Hỗ trợ kết quả trực tiếp sau phục hồi theo quyết định nghiệp vụ đã duyệt.
- Bộ lọc lịch sử chỉ dựa trên sự kiện có thật; list/thẻ số/export giữ cùng điều kiện và scope. Hiển thị giới hạn dữ liệu lịch sử cũ.
- Giữ idempotency header, API kết quả, khóa merge và nguồn chuyển ban đầu của bản production. Chặn bulk ghi/xóa sau khi hồ sơ đã đổi tổ/trạng thái hoặc được thêm tài liệu.
- Sửa ownership của ô đề xuất Case; không thêm migration tìm kiếm UTDT vì tính năng đó đã có trên production.

## Kiểm chứng trước release

| Gate | Bằng chứng |
|---|---|
| Full backend | 6.267 PASS, 0 FAIL; 16 DB opt-in chạy riêng 16/16 PASS |
| Full frontend | 4.021 PASS, 0 FAIL |
| Kiểm tra bổ sung | Predicate 4/4; modal chuyển đơn vị 9/9, gồm 1 case mới |
| HTTP | 10/10 nhóm; amendment 7/7; intake retry/cross-mode guard PASS |
| Browser | Form 10 tab/edit/reload/upload retry/clone 3/3; khởi tố/Word/history 3/3; amendment 5/5 |
| Rollback flag | OFF chặn tạo/giao mới, cho xử lý lượt đang chờ; identity/ngày/hạn giữ nguyên |
| Patch coverage | 1.254/1.380 dòng executable-span = 90,87%, không thiếu file; full + targeted maps cùng source |
| Review độc lập | PR-01 closed; CODE/SCOPED EVIDENCE PASS; oracle 6/6 |
| Build/types/lint | Backend/frontend build và type check PASS; lint toàn bộ scope backend 25/frontend 19 file PASS |
| Migration | Schema-only của production + 126 checksum cũ; chỉ thêm migration handoff thứ 127; sentinel identity/proposal/version giữ nguyên, legacy stage/link NULL |

Các lần UAT dùng PostgreSQL và JWT riêng tại loopback, dữ liệu giả; không tạo hồ sơ thử trên production. Các fixture lặp đã được tách content/identity để bộ rà soát trùng của production hoạt động đúng; assertions quyền/dữ liệu không bị bỏ.

## Triển khai và phục hồi

1. PR/CI qua pipeline GitHub hiện hữu; deploy script backup DB trước migration và chuyển release.
2. Kiểm tra health công khai trả `0.73.0.0` và đúng merge SHA; kiểm tra systemd/current symlink, migration và assets.
3. Migration mặc định `INCIDENT_INTAKE_HANDOFF=FALSE`. Sau health/asset verification, bật riêng flag này theo GO deploy đã có. Không đổi role/quyền/dữ liệu pháp lý.
4. Khi cần tắt rollout, tắt flag; lượt đang chờ vẫn nhận/hủy được. Code rollback hiện hữu: `ssh pc02vm 'bash /home/pc02/bin/rollback.sh'`; schema additive giữ lại, không DROP dữ liệu.

Không áp dụng backfill/link/history legacy ở release này vì bộ managed/log và manifest chưa đủ để nối an toàn. Đây là chứng nhận phần Incident và các thay đổi liên quan trong release, không phải nghiệm thu toàn bộ parity bốn thực thể. Con số 132 trong ledger gốc là 132 dòng màn hình/chức năng, không phải 132 field.
