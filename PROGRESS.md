STATUS: IN_PROGRESS

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

## Đang làm dở
Task: PR-3c parity truy nguyên cho Petition/Incident (display+search) — TÙY CHỌN
  + PR-4 full re-map field data-driven (đọc field-mapping.json) — GIÁ TRỊ THẤP hơn (data hiện 98,5% coverage,
    80 field đã map đúng ở builder hiện tại); cân nhắc vì rủi ro re-migrate 53k.
BƯỚC TIẾP THEO (nếu tiếp):
  1. Thêm soHoSoCu vào petitions/incidents list search + detail display (parity với cases).
  2. PR-4 (nếu cần độ chính xác cao hơn): builder đọc field-mapping.json thay hardcode + re-migrate.
  3. Áp PROD (anh cấp quyền): pg_dump + migration additive + backfill-trace (idempotent) khi merge nhánh.
File liên quan: backend/src/petitions/petitions.service.ts, frontend petition/incident detail, docs/legacy/field-mapping.json

## Hàng đợi task kế tiếp
1. PR-1.b ma trận map field (field-mapping.json)
2. PR-2 schema: legacyId+legacyCollection+soHoSoCu; Subject/InvestigationSupplement truy nguyên; cột field cốt lõi
3. PR-3 import data-driven (đọc field-mapping.json) + bóc nghi can text + crosswalk enum
4. PR-4 re-migrate sạch local (wipe đầy đủ) + retire lớp field-map cũ
5. PR-5 đối soát + UAT + áp PROD (backup, wipe, import)

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
