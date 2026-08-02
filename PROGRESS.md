STATUS: ALL_MILESTONES_DONE

# PROGRESS — Di trú lại data hệ cũ pc02hcm.com (data-driven)
Cập nhật: 2026-08-02 | Nhánh: feat/legacy-remigration-datadriven | PR: 1/5 xong

## Bối cảnh
Migration cũ dùng mapping HARDCODE ~90 key → sai FIELD (không mất bản ghi: coverage 98,5%).
Làm lại data-driven từ TruongTuyChinh(176)+NgonNgu(746), đối chiếu source PHP.
Quyền PROD: test local xong → tự áp prod, KHÔNG hỏi lại (prod chưa vận hành). pg_dump trước.

## Đã hoàn thành
- [x] PR-0 export live Mongo (EJSON ngoài git) + đối soát — commit. 7 test.
  - bi_can=0 CẢ LIVE (nghi can chỉ ở text); coverage 98,5%; vấn đề = field-level.
- [x] PR-1 catalog 132 field + ma trận map (MAPPED 80/RESOLVE 5/UNMAPPED 47) — commit. 12 test.
  - `docs/legacy/{field-catalog.generated,field-mapping}.{md,json}`. field-mapping.json = config builder.
- [x] PR-2 schema truy nguyên — commit. tsc sạch. migration 20260803000000_legacy_traceability.
  - +soHoSoCu/legacyId/legacyCollection (cases/petitions/incidents) + Subject/InvestigationSupplement khóa gốc + index.

- [x] PR-3a+b TRUY NGUYÊN end-to-end (vụ án) — commit. Full BE 2850 test xanh, BE+FE tsc sạch.
  - traceFields → builders; backfill-trace điền 53.455 bản ghi (cases 3283+petitions 45459+incidents 4713);
    CaseDetailPage hiện "Mã hồ sơ gốc"; cases search theo soHoSoCu/caseCode. YÊU CẦU CỐT LÕI CỦA ANH: XONG.

- [x] PR-3c parity Petition/Incident (search soHoSoCu + IncidentDetail display) — commit. 192 test.
- [x] ÁP PROD (PR #206 merged, deploy #206 success) + BACKFILL PROD idempotent:
  cases 3283 + petitions 45298 + incidents 4592 có soHoSoCu (petitions 161 nguồn không có stt).
  Verify prod: detail trả soHoSoCu (VA-2026-09891→20); SEARCH theo STT chạy (search=20 → 3 vụ). Health OK.
  (search=8358 ra 0 chỉ do DataScope admin test, không phải bug — DB+code khớp.)

## HOÀN TẤT
Traceability hệ cũ end-to-end, LOCAL + PROD, 3 module. Yêu cầu cốt lõi của anh (lưu số truy nguyên) XONG.

## PR-4 (full re-map field) — DEFER theo khuyến nghị
Data coverage 98,5% + 80 field builder hiện map đúng → re-migrate 53k rủi ro cao, lợi ích thấp.
Đề xuất: chỉ VÁ field cụ thể anh chỉ ra sai (dùng docs/legacy/field-mapping.md để soi), KHÔNG re-migrate toàn bộ.
Công cụ sẵn sàng nếu cần: cli/mongo-export.ts, build-field-catalog.ts, build-field-mapping.ts, field-mapping.json.

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do |
| 2026-08-02 | Mapping = bảng DATA (field-mapping.json) builder đọc, KHÔNG imperative | data-driven, dễ review/sửa |
| 2026-08-02 | Bỏ bi_can→Subject | bi_can rỗng cả live; nghi can chỉ ở text nghi_van_doi_tuong |
| 2026-08-02 | Dump EJSON ngoài git (gitignore) | tránh lộ PII; repo chỉ giữ catalog/report metadata |

## Trạng thái test
Full suite: chưa chạy lại toàn bộ (mới thêm 12 test unit, đều PASS) | tsc: sạch

## Nợ kỹ thuật / rủi ro
- Ma trận map 132 field cần đối chiếu PHP + review — làm ở PR-1.b.
- Epoch +14h: xác minh lại từ dữ liệu ở PR-3.
