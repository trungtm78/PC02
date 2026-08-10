# ADR-0017 — `canDispatch` cho quyền đọc toàn hệ thống, không cho quyền ghi

- **Trạng thái**: Được chấp nhận
- **Ngày**: 2026-08-10
- **Ảnh hưởng**: thay đổi hành vi phân quyền của **cả 12 resource** dùng `scope-filter.util.ts`

## Bối cảnh

`DataScope.canDispatch` được định nghĩa ngay tại chỗ khai báo
(`unit-scope.service.ts`) là:

> Supplementary: read all + assign/reassign any record

Nhưng cả ba hàm kiểm tra trong `scope-filter.util.ts` —
`assertParentInScope`, `assertPetitionParentInScope`, `assertCreatorInScope` —
đều mở đầu bằng

```ts
if (scope.canDispatch) return;
```

**bất kể** tham số `operation` là `'read'` hay `'write'`.

Hệ quả: mọi người điều phối tạo / sửa / xóa / khôi phục được bản ghi con của
**bất kỳ** vụ án, vụ việc, đơn thư nào trong hệ thống — vượt xa những gì cờ này
được mô tả là cấp. Không có gì phát hiện được vì không có gì từ chối họ bao giờ,
và **không một test nào** trong 3.000 test đụng tới trường hợp này.

Điểm quan trọng để quyết được: **việc phân công không phụ thuộc vào lối tắt
này.** `PATCH /:id/assign` và ba endpoint `bulk-assign` đều có `DispatchGuard`
riêng, và `assignCase()` thậm chí không nhận tham số scope. Nghĩa là siết chỗ
này không đụng gì tới nghiệp vụ phân công.

## Quyết định

Lối tắt `canDispatch` chỉ áp dụng cho `operation === 'read'`:

```ts
function dispatcherMayBypass(scope: DataScope, operation: 'read' | 'write') {
  return scope.canDispatch === true && operation === 'read';
}
```

Quyền ghi rơi xuống kiểm tra tổ/chủ sở hữu bình thường, tức người điều phối ghi
được trong `writableTeamIds` của chính họ như mọi người khác.

Hai bộ lọc đọc (`buildScopeFilter`, `buildPetitionScopeFilter`) **giữ nguyên**
— chúng chỉ phục vụ đường đọc, đúng phần mà cờ này được phép cấp.

## Hệ quả

**Tích cực**

- Hiện thực khớp lại với định nghĩa đã viết ra. Thứ mà tài liệu nói là "đọc +
  phân công" nay đúng là "đọc + phân công".
- Bịt một lỗ thật: người điều phối không còn xóa được vật chứng, bị can, kết
  luận điều tra... của tổ khác.
- Có test cho cả hai chiều ở cả ba hàm — trước đây không có gì kiểm.

**Tiêu cực — cần nói rõ với người vận hành**

- **Đây là thay đổi hành vi có thể ảnh hưởng người dùng thật.** Nếu ai đó đang
  quen dùng tài khoản có `canDispatch` để sửa hồ sơ của tổ khác, thao tác đó nay
  trả 403. Đứng từ góc bảo mật thì đó là sửa lỗi; đứng từ góc người đang làm
  việc thì đó là mất quyền.
- Cách xử lý đúng khi gặp: cấp WRITE grant cho tổ tương ứng (`writableTeamIds`),
  chứ không phải bật lại lối tắt. Cơ chế phân quyền theo tổ đã có sẵn cho đúng
  việc này.
- Nếu về sau thực sự cần một vai trò ghi-toàn-hệ-thống, hãy thêm cờ riêng
  (`canWriteAll`) và khai báo rõ, đừng chất thêm ý nghĩa lên `canDispatch`.

## Phương án đã cân nhắc và loại

**Giữ nguyên, chỉ ghi vào tài liệu** — loại. Khoảng cách giữa mô tả và hiện thực
chính là lỗ hổng; viết lại mô tả để khớp với lỗ hổng là hợp thức hóa nó.

**Đặt sau một cờ môi trường để bật/tắt** — loại. Một công tắc cho hai ngữ nghĩa
phân quyền nghĩa là không bao giờ biết chắc production đang chạy cái nào.

**Chỉ siết ở các resource mới** — loại. Quy tắc phân quyền không nhất quán giữa
các resource còn khó suy luận hơn cả quy tắc rộng quá tay.
