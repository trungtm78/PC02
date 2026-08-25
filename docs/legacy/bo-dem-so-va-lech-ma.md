# Bộ đếm số hồ sơ: vì sao lệch, và cách dò trước khi thành sự cố

## Chuyện đã xảy ra — 25/08/2026

Ngày đầu vận hành thử, cán bộ bấm **Lưu đơn thư** và nhận `Internal server error`. **Không
ai tạo được đơn thư mới** cho tới khi sửa xong.

## Cơ chế: bộ đếm KHÔNG phải nguồn sự thật duy nhất

Bộ sinh số cấp `bộ đếm + 1`. Nhưng cột mã (`petitions.stt`, `cases.caseCode`,
`incidents.code`) là `@unique`, và **ba loại công cụ ghi thẳng vào nó, đi vòng qua bộ đếm**:

- công cụ di trú dữ liệu hệ cũ,
- công cụ cấp mã hàng loạt (`backfill-*-code.ts`),
- seed.

Mỗi lần như vậy bộ đếm bị bỏ lại phía sau. Đủ xa thì số cấp kế tiếp rơi trúng mã đã có →
vi phạm ràng buộc duy nhất → 500. **Người dùng không thấy "trùng số", họ thấy "lỗi hệ
thống"** — nên triệu chứng không chỉ về nguyên nhân.

## Vì sao lưới an toàn có sẵn lại không cứu được

Lưới chống lệch đã tồn tại từ v0.66.2, chú thích ghi rõ nó phòng đúng tình huống này. Nó
không hoạt động vì mẫu tìm là `%-2026-%` — viết cho định dạng mã **cũ** `DT-2026-00001`. Từ
khi mã đổi sang `năm-stt` (`2026-9895`), mẫu ấy không khớp gì nữa.

Đo trên dữ liệu thật ngày 25/08:

| Loại | Truy vấn cũ | Truy vấn đã sửa |
|---|---|---|
| Đơn thư | **0** — mù hoàn toàn | 11142 |
| Vụ án | 81 | 9871 |
| Vụ việc | 181 | 9705 |

**Bài học đắt nhất không phải mẫu SQL sai.** Là chuyện các ca kiểm của lưới ấy **vẫn xanh
suốt thời gian nó chết**: chúng giả lập `$queryRaw` rồi khẳng định giá trị trả về được dùng
đúng. Chúng chứng minh **đường ống**, không chứng minh **câu truy vấn tìm được gì**. Một
lưới an toàn có ca kiểm xanh mà không bảo vệ được gì thì nguy hiểm hơn không có lưới, vì
không ai nghĩ tới việc kiểm nó.

## Cách dò lệch — chạy SAU MỌI lượt di trú hoặc cấp mã hàng loạt

```bash
cd /home/pc02/current/backend
set -a && . .env && set +a
npx ts-node -T src/legacy-migration/cli/repair-document-counters.ts          # chỉ đọc
npx ts-node -T src/legacy-migration/cli/repair-document-counters.ts --apply  # sửa
```

- Đối chiếu **từng** `(loại hồ sơ, kỳ)` giữa bộ đếm và mã lớn nhất đang dùng thật.
- Nhận **cả hai** định dạng mã (`2026-123` và `DT-2026-00123`).
- **Chỉ nâng, không bao giờ hạ** — hạ bộ đếm là cấp lại số đã dùng, đúng cái lỗi này.
- Chạy lại được, kết quả như nhau. Sao lưu trước khi `--apply`.

Kết quả mong đợi khi lành: `>>> KHÔNG CÓ BỘ ĐẾM NÀO TỤT LẠI`.

## Ba lớp bảo vệ hiện có

1. **Lúc cấp số** — `dbMaxTrongKy()` dò mã lớn nhất thật trong kỳ và nhảy qua; dùng chung
   cho cả `commit()` lẫn `commitWithTx()`. *(Trước 25/08, `commit()` không có lưới nào và
   hai đường là hai bản sao rời nhau — đó là cách lỗi sống sót.)*
2. **Lúc cấp mã hàng loạt** — `backfill-petition-code.ts` tự nâng bộ đếm sau khi gán.
3. **Định kỳ** — `repair-document-counters.ts` chế độ chỉ đọc.

## Lưu ý

Hồ sơ **xoá mềm vẫn giữ mã**, và ràng buộc duy nhất vẫn áp lên chúng. Nên lưới dò lệch
**phải đếm cả hồ sơ đã xoá mềm** — nó đang làm đúng (không lọc `deletedAt`). Đừng "tối ưu"
bằng cách thêm bộ lọc ấy vào.
