-- The number of the request slip ("Phiếu yêu cầu") follows the standard of the system's other slips (Phiếu đề xuất,
-- Phiếu chuyển, Thông báo, Hướng dẫn): four digits, `0003/PYC-PC02-Đ1`. It was seeded without zero padding
-- (`3/PYC-PC02-Đ1`). The counter is kept: the next slip takes the next number, written with four digits. Slips already
-- issued keep the number they were issued with. Idempotent; a padding an administrator has set otherwise is left alone.
UPDATE "document_number_templates"
SET "counterConfig" = jsonb_set("counterConfig"::jsonb, '{padding}', '4'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "documentType" = 'PHIEU_YEU_CAU' AND ("counterConfig"::jsonb ->> 'padding') = '1';
