# ADR-0016 — Mã vật chứng duy nhất bằng khóa hàng, chưa dùng partial unique index

- **Trạng thái**: Được chấp nhận (tạm thời — có điều kiện xem lại, ghi rõ bên dưới)
- **Ngày**: 2026-08-10
- **Liên quan**: [ADR-0011 — Chấp nhận drift partial index](0011-partial-index-drift-is-accepted.md)

## Bối cảnh

`Evidence.code` phải duy nhất trong phạm vi một vụ án: hai vụ khác nhau được
phép đánh trùng số, nhưng trùng trong cùng hồ sơ thì không đối chiếu nổi với
biên bản nhập kho.

Bản đầu của module thi hành quy tắc này bằng *kiểm rồi ghi*: `findFirst` xem đã
có mã chưa, rồi `create`. Hai câu lệnh tách rời ⇒ hai request đồng thời cùng đọc
"chưa có" và cùng ghi. Cùng lỗi ở `update` và `restore`.

Cách chuẩn là ràng buộc ở tầng cơ sở dữ liệu:

```sql
CREATE UNIQUE INDEX evidences_case_code_live
  ON evidences (case_id, code) WHERE deleted_at IS NULL;
```

Không làm được ngay, vì hai lý do độc lập:

1. **Bảng `evidences` đã có dữ liệu chưa từng bị ràng buộc.** `Evidence` được
   ghi từ form tạo vụ án ngay từ đầu, không qua bất kỳ kiểm tra trùng nào, trong
   nền 53k bản ghi legacy. Nếu đang tồn tại một cặp trùng, câu `CREATE UNIQUE
   INDEX` **hỏng ngay**, và `prisma migrate deploy` chạy trước khi đổi symlink
   nên deploy sẽ dừng — an toàn, nhưng đứng.
2. **Dọn trùng là quyết định về hồ sơ, không phải cleanup kỹ thuật.** Muốn tạo
   được index thì phải chọn giữ bản nào và bỏ bản nào. Vật chứng là chứng cứ
   pháp lý; người quyết định phải là bên giữ hồ sơ, không phải PR này.

## Quyết định

Thi hành bất biến ở tầng ứng dụng, nhưng **tuần tự hóa** thay vì kiểm-rồi-ghi:
mọi thao tác ghi vật chứng chạy trong một transaction mở đầu bằng

```sql
SELECT id FROM cases WHERE id = $1 FOR UPDATE
```

Khóa hàng vụ án cha xếp hàng các thao tác ghi vật chứng **của riêng vụ đó**; vụ
án khác không bị ảnh hưởng. Kiểm trùng và ghi nằm cùng một transaction nên không
tách rời được nữa. Áp dụng cho cả `create`, `update` và `restore`
(`withCaseLock` trong `evidences.service.ts`).

**Không** thêm migration, **không** đụng dữ liệu, **không** thêm drift.

## Hệ quả

**Tích cực**

- Đua tranh bị đóng ngay trong PR này, không phải chờ ai quyết chuyện dọn trùng.
- Không có migration nào có thể làm đứng deploy.
- Dữ liệu trùng đang có (nếu có) vẫn nguyên vẹn để đối soát sau.

**Tiêu cực**

- Bất biến chỉ đúng khi mọi đường ghi đều đi qua `withCaseLock`. Một đường ghi
  mới quên khóa sẽ phá vỡ nó mà không có gì ở tầng DB chặn lại. Giảm thiểu: đường
  ghi duy nhất ngoài module này là `cases.service.ts
  createSubEntitiesInTransaction` — nó chạy trong transaction tạo vụ án, khi vụ
  án còn chưa tồn tại với ai khác, nên không có gì để đua.
- Khóa hàng vụ án làm mọi thao tác ghi vật chứng cùng một vụ nối đuôi nhau. Với
  quy mô thực tế (vài chục vật chứng một vụ, nhập tay) đây không phải vấn đề.
- Ràng buộc chỉ còn trong code. Ai sửa DB trực tiếp bằng `psql` vẫn tạo được bản
  trùng.

## Điều kiện chuyển sang index thật

Khi có người sở hữu hồ sơ quyết được cách xử lý bản trùng, làm theo thứ tự:

1. Chạy đối soát: `SELECT case_id, code, COUNT(*) FROM evidences WHERE deleted_at
   IS NULL GROUP BY 1,2 HAVING COUNT(*) > 1;`
2. Nếu trả về rỗng — thêm index luôn, không cần dọn gì.
3. Nếu có kết quả — trình danh sách cho bên giữ hồ sơ quyết, xử lý xong mới thêm
   index.
4. Thêm index vào danh sách drift được chấp nhận ở ADR-0011 (Prisma 7 không có
   cú pháp partial index).
5. Giữ `withCaseLock`: nó biến lỗi P2002 thành 409 có thông điệp tiếng Việt thay
   vì để lộ lỗi ràng buộc thô ra UI.

## Phương án đã cân nhắc và loại

**Thêm index kèm bước tự dọn trùng trong migration** — loại. Migration sẽ ghi đè
dữ liệu nghiệp vụ theo một quy tắc do máy chọn, trên bảng chứng cứ pháp lý.

**Để nguyên kiểm-rồi-ghi và ghi nợ** — loại. Đua tranh này tạo ra hai vật chứng
cùng mã trong một hồ sơ, đúng thứ mà quy tắc sinh ra để chặn.

**Dùng `SERIALIZABLE` cho toàn bộ transaction** — loại. Đắt hơn và đẩy phần xử lý
lỗi tuần tự hóa sang mọi lời gọi, trong khi khóa một hàng đã đủ.
