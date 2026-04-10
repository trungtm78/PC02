# Huong dan su dung - Quan ly vu an

## 3.1 Danh sach vu an

### Mo ta
Trang Danh sach vu an hien thi tat ca cac vu an trong he thong voi cac tinh nang tim kiem, loc va xem chi tiet.

### Truy cap
1. Dang nhap vao he thong.
2. Tu sidebar, chon **NGHIEP VU CHINH** → **Quan ly vu an** → **Danh sach vu an**
3. Hoac truy cap URL: `/cases`

### Cac tinh nang chinh

| Tinh nang | Mo ta |
|-----------|-------|
| Tim kiem | Nhap tu khoa de loc theo tieu đe, ma ho so |
| Loc trang thai | Su dung bo loc de xem theo tung trang thai |
| Them vu an moi | Nhan nut "Them vu an moi" de tao ho so |
| Xem chi tiet | Click icon con mat de xem chi tiet (Read-only) |
| Chinh sua | Click icon cay but de thay đoi thong tin |

---

## 3.2 Them moi / Chinh sua ho so

### Mo ta
Trang nay cho phep tao moi hoac cap nhat thong tin vu an voi 10 tabs phan loai.

### Truy cap
- Them moi: Nut **"Them vu an moi"** hoac `/add-new-record`
- Chinh sua: Icon **Edit** tai Danh sach vu an.

### Cac tab trong form (Khong dau)
1. Thong tin: Ma ho so, tieu đe, loai ho so, ngay tiep nhan.
2. Vu viec: Thong tin chi tiet ve vu viec lien quan.
3. Vu an: Cac thong tin khoi to vu an.
4. DTBS: Doi tuong, Bi can, Bi hai, Luat su.
5. Vu viec TDC: To giac, tin bao toi pham.
6. Vu an TDC: Vu an tuong ung.
7. Vat chung: Quan ly tang vat.
8. HS nghiep vu: Tai lieu nghiep vu.
9. TK 48 truong: Mau thong ke rut gon.
10. Ghi am, ghi hinh: Tai lieu đa phuong tien.

---

## 3.3 Xem chi tiet ho so
- Route: `/cases/:id`
- Mo ta: Cho phep nguoi dung xem toan bo du lieu cua ho so duoi dang 10 tabs. Trong che đo nay, tat ca cac field đeu khong the thay đoi (Read-only).

---

## Xu ly loi
- Thieu truong bat buoc: Kiem tra field đo o Tab 1.
- Loi validation: Nhap đung đinh dang yêu cau.
