-- Lựa chọn in chứng từ của từng cán bộ: mẫu đã tích + định dạng xuất.
--
-- Popup In chứng từ bị gỡ khỏi màn hình khi đóng nên KHÔNG nhớ gì giữa các lần mở. Đơn thư có
-- 14 mẫu (đo 28/08/2026), nên cán bộ phải tích lại từ đầu mỗi lần in.
--
-- Thứ tự ưu tiên khi popup mở: lựa chọn CÁ NHÂN ở bảng này thắng; ai chưa từng đặt thì dùng cờ
-- `document_templates.selectedByDefault` admin bật ở màn Quản lý mẫu chứng từ.
--
-- Hàng VẮNG MẶT khác khối RỖNG: vắng mặt = "theo cờ admin", còn `templateIds = '{}'` = "cán bộ
-- cố ý không chọn mẫu nào". Gộp hai cái là mất đường quay về mặc định.
--
-- Bảng SỐNG ĐƯỢC KHI RỖNG: deploy không chạy seed, và popup vẫn chạy bình thường khi chưa ai lưu.
CREATE TABLE "user_export_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "templateIds" TEXT[],
    "mode" TEXT NOT NULL DEFAULT 'separate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_export_preferences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_export_preferences_userId_idx" ON "user_export_preferences"("userId");

CREATE UNIQUE INDEX "user_export_preferences_userId_entityType_key" ON "user_export_preferences"("userId", "entityType");

ALTER TABLE "user_export_preferences" ADD CONSTRAINT "user_export_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
