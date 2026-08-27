# Ma trận FIELD-PARITY (field cũ × thực thể → cột hệ mới)

> Sinh từ data thật: 54449 hồ sơ đã di trú. Mỗi ô = (field có data ở thực thể đó) → trạng thái cột.
> **METADATA_ONLY** + **NEEDS_COLUMN** = phải THÊM CỘT typed (chỉ thị: mọi field có data → cột).

## ⚠️ CẦN THÊM CỘT (field có data, chưa có cột typed riêng ở thực thể đó)

| Field | Nhãn | Thực thể | Số HS | Trạng thái | Kiểu đề xuất |
|---|---|---|---|---|---|
| `lich_su` |  | **petition** | 2244 | NEEDS_COLUMN | String? |
| `lich_su` |  | **incident** | 15 | NEEDS_COLUMN | String? |
| `lich_su` |  | **case** | 100 | METADATA_ONLY | String? |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | **petition** | 126 | NEEDS_COLUMN | DateTime? |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | **incident** | 1 | NEEDS_COLUMN | DateTime? |
| `ngay_thang_nam_het_thoi_hieu_vu_viec` | Ngày tháng năm hết thời hiệu truy cứu TNHS | **petition** | 104 | NEEDS_COLUMN | DateTime? |
| `ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an` | Ngày hết thời hiệu truy cứu TNHS vụ án | **petition** | 104 | NEEDS_COLUMN | DateTime? |
| `ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an` | Ngày hết thời hiệu truy cứu TNHS vụ án | **incident** | 1 | NEEDS_COLUMN | DateTime? |
| `ngay_ra_quyet_dinh_khoi_to` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `het_thoi_hieu_tnhs` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `het_thoi_hieu_tnhs` |  | **case** | 1 | METADATA_ONLY | String? |
| `ngay_het_han_vu_an` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `ngay_het_han_vu_an` |  | **case** | 1 | METADATA_ONLY | String? |
| `thoi_gian_het_thoi_hieu_truy_cuu_tnhs` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `thoi_gian_het_thoi_hieu_truy_cuu_tnhs` |  | **case** | 1 | METADATA_ONLY | String? |
| `ngay_ra_quyet_dinh_khong_khoi_to` | Ngày ra Quyết định Không khởi tố | **petition** | 27 | NEEDS_COLUMN | String? |
| `phan_loai_dan_su` | Phân loại dân sự | **petition** | 6 | NEEDS_COLUMN | String? |
| `loai_toi_pham` | Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án) | **case** | 4 | NEEDS_COLUMN | String? |
| `quyet_dinh_khong_khoi_to` | Quyết định Không khởi tố | **petition** | 2 | NEEDS_COLUMN | String? |
| `can_cu_ra_quyet_dinh_khong_khoi_to` | Căn cứ để ra Quyết định Không khởi tố | **petition** | 1 | NEEDS_COLUMN | String? |
| `ngay_tam_dinh_chi_vu_an` | Ngày Quyết định tạm đình chỉ vụ án | **petition** | 1 | NEEDS_COLUMN | String? |
| `quyet_dinh_tam_dinh_chi_vu_an` | Số Quyết định Tạm đình chỉ vụ án | **petition** | 1 | NEEDS_COLUMN | String? |

Tổng ô cần thêm cột: **22** (theo thực thể: petition 14, incident 3, case 5).

## 🔧 CẦN FIX BUILDER (cột đã có, builder chưa đọc)

| Field | Nhãn | Thực thể | Số HS | Cột đích |
|---|---|---|---|---|

Tổng ô cần fix builder: **0**.

## Toàn bộ field (sắp theo tổng số hồ sơ có data)

| Field | Nhãn | Tổng | Petition | Incident | Case |
|---|---|---|---|---|---|
| `id` |  | 54449 | DROP · 46494 | DROP · 4596 | DROP · 3359 |
| `_id` |  | 54449 | DROP · 46494 | DROP · 4596 | DROP · 3359 |
| `stt` |  | 54449 | DROP · 46494 | DROP · 4596 | DROP · 3359 |
| `_add_time` |  | 54449 | DROP · 46494 | DROP · 4596 | DROP · 3359 |
| `don_vi_id` |  | 54449 | DROP · 46494 | DROP · 4596 | DROP · 3359 |
| `nguoi_them` |  | 54449 | DROP · 46494 | DROP · 4596 | DROP · 3359 |
| `_update_time` |  | 54449 | DROP · 46494 | DROP · 4596 | DROP · 3359 |
| `ngay_de_xuat` |  | 54449 | OK (ngayDeXuat) · 46494 | OK (ngayDeXuat) · 4596 | OK (ngayDeXuat) · 3359 |
| `nam` |  | 54429 | DROP · 46494 | DROP · 4596 | DROP · 3339 |
| `thang` |  | 54429 | DROP · 46494 | DROP · 4596 | DROP · 3339 |
| `ngay` |  | 54426 | DROP · 46492 | DROP · 4596 | DROP · 3338 |
| `tom_tat_noi_dung` | Tóm tắt nội dung | 54399 | OK (summary) · 46492 | OK (name) · 4595 | OK (moTaChiTiet) · 3312 |
| `phan_loai_nguon_tin_ban_dau` | Phân loại ban đầu | 54347 | RESOLVE (phanLoaiNguonTin) · 46445 | RESOLVE (phanLoaiNguonTinBanDau) · 4568 | RESOLVE (phanLoaiNguonTinBanDau) · 3334 |
| `loai` |  | 54296 | DROP · 46372 | DROP · 4576 | DROP · 3348 |
| `don_vi_giai_quyet` | Đơn vị giải quyết | 53962 | RESOLVE (donViGiaiQuyet) · 46476 | RESOLVE (donViGiaiQuyet) · 4200 | RESOLVE (donViGiaiQuyet) · 3286 |
| `nguon_don` | Nguồn đơn/Đơn vị giao | 52956 | OK (nguonDon) · 46467 | OK (chuyenTuDonVi) · 3451 | OK (nguonDon) · 3038 |
| `ten_ca_nhan_co_quan_to_chuc_cung_cap` | Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại | 51463 | OK (senderName) · 46452 | OK (benVu) · 4265 | OK (tenCungCap) · 746 |
| `nhan_xet` | Nhận xét | 50956 | OK (nhanThay) · 46279 | OK (nhanXet) · 3401 | OK (nhanXet) · 1276 |
| `ngay_tiep_nhan_nguon_tin` | Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin) | 49345 | OK (ngayTiepNhanNguonTin) · 44386 | OK (ngayTiepNhanNguonTin) · 3035 | OK (ngayTiepNhan) · 1924 |
| `dia-chi-bi-hai` | Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại | 48039 | OK (senderAddress) · 46046 | OK (diaChiNguoiToGiac) · 707 | OK (diaChiCungCap) · 1286 |
| `loai_thong_tin` | Loại thông tin | 47021 | OK (loaiThongTin) · 46408 | OK (loaiThongTin) · 194 | OK (loaiThongTin) · 419 |
| `ngay_viet_don` | Ngày viết đơn | 46698 | OK (petitionDate) · 46042 | OK (ngayVietDon) · 303 | OK (ngayVietDon) · 353 |
| `ghi_chu_trung_don` | Ghi chú trùng đơn | 37036 | OK (raSoatTrung) · 36593 | OK (ghiChuTrungDon) · 94 | OK (ghiChuTrungDon) · 349 |
| `stt_cu` |  | 36269 | DROP · 31459 | DROP · 3323 | DROP · 1487 |
| `truong_hop_bao_cao_ban_giam_doc` | Trường hợp báo cáo Ban Giám đốc | 35700 | OK (baoCaoBanGiamDocText) · 35257 | OK (baoCaoBanGiamDocText) · 93 | OK (baoCaoBanGiamDocText) · 350 |
| `so_tien_bi_thiet_hai` | Số tiền bị thiệt hại (triệu Việt nam Đồng) | 31566 | OK (soTienBiThietHai) · 31460 | — | OK (soTienBiThietHai) · 106 |
| `so_luong_bi_hai` | Số lượng người bị hại | 31565 | OK (soLuongBiHai) · 31459 | — | OK (soLuongBiHai) · 106 |
| `phuong_thuc_thu_doan` | Phương thức thủ đoạn | 31565 | OK (phuongThucThuDoan) · 31459 | — | OK (phuongThucThuDoan) · 106 |
| `ngay_giao_don_vi_giai_quyet` | Ngày giao đơn vị giải quyết | 26209 | OK (ngayGiaoDonViGiaiQuyet) · 25350 | OK (ngayGiaoDonViGiaiQuyet) · 666 | OK (ngayGiaoDonViGiaiQuyet) · 193 |
| `toi-danh-ban-dau` | Tội danh cũ trước đây | 21278 | OK (toiDanhBanDau) · 15185 | OK (toiDanhBanDau) · 3446 | OK (toiDanhBanDau) · 2647 |
| `tinh_trang` |  | 18176 | RESOLVE (tinhTrang) · 15035 | RESOLVE (tinhTrangHoSo) · 1269 | RESOLVE (tinhTrang) · 1872 |
| `toi_danh_chinh_blhs2015` | Tội danh chính - BLHS 2015 (nhận định ban đầu) | 17314 | RESOLVE · 14507 | RESOLVE · 1114 | RESOLVE · 1693 |
| `ket_qua_xu_ly_giai_quyet_khac` | Kết quả xử lý, giải quyết khác | 13906 | OK (ketQuaXuLyKhac) · 11142 | OK (ketQuaXuLy) · 2542 | OK (ketQuaXuLyKhac) · 222 |
| `so_phieu_chuyen` | Số phiếu chuyển/ Công văn/ Ủy thác điều tra | 12110 | OK (soPhieuChuyen) · 10279 | OK (soPhieuChuyen) · 80 | OK (soPhieuChuyen) · 1751 |
| `do_vat_tai_lieu_kem_theo` | Đồ vật, tài liệu kèm theo | 11788 | OK (attachmentsNote) · 11468 | OK (doVatTaiLieuKemTheo) · 50 | OK (doVatTaiLieuKemTheo) · 270 |
| `ngay_phieu_chuyen` | Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra | 11234 | OK (ngayPhieuChuyen) · 9415 | OK (ngayPhieuChuyen) · 83 | OK (ngayPhieuChuyen) · 1736 |
| `phan_loai_toi_pham_theo_linh_vuc` |  | 8989 | OK (phanLoaiToiPhamLinhVuc) · 7489 | OK (phanLoaiToiPhamLinhVuc) · 369 | OK (phanLoaiToiPhamLinhVuc) · 1131 |
| `so_dien_thoai_nguyen_don` | Số điện thoại nguyên đơn | 8923 | OK (senderPhone) · 7548 | OK (sdtNguoiToGiac) · 778 | OK (sdtCungCap) · 597 |
| `sinh_nam_nguoi_to_giac` | Sinh năm | 7484 | OK (senderBirthYear) · 6180 | OK (sinhNamNguoiToGiac) · 855 | OK (sinhNamCungCap) · 449 |
| `nghi_van_doi_tuong` | Nghi vấn đối tượng hoặc bị can | 6996 | OK (suspectedPerson) · 655 | OK (doiTuongCaNhan) · 4193 | OK (nghiVanDoiTuong) · 2148 |
| `phan_loai_ho_so_doi_1` |  | 6183 | OK (phanLoaiHoSoNoiBo) · 4690 | OK (phanLoaiHoSoNoiBo) · 181 | OK (phanLoaiHoSoNoiBo) · 1312 |
| `so_cccd_nguyen_don` | Số căn cước công dân | 3631 | OK (senderIdNumber) · 3277 | OK (cmndNguoiToGiac) · 76 | OK (cccdCungCap) · 278 |
| `lanh_dao_to_tung` | Lãnh đạo phụ trách tố tụng | 3285 | — | OK (lanhDaoToTung) · 2641 | OK (lanhDaoToTung) · 644 |
| `noi_cap_cccd_nguyen_don` | Nơi cấp CCCD | 2583 | OK (senderIdIssuePlace) · 2323 | OK (noiCapCccd) · 38 | OK (noiCapCccd) · 222 |
| `dieu_tra_vien` | Điều tra viên thụ lý | 2578 | OK (dieuTraVien) · 307 | OK (dieuTraVien) · 1816 | OK (dieuTraVien) · 455 |
| `ngay_cap_cccd_nguyen_don` | Ngày cấp CCCD | 2443 | OK (senderIdIssueDate) · 2178 | OK (ngayCapCccd) · 39 | OK (ngayCapCccd) · 226 |
| `lich_su` |  | 2359 | NEEDS_COLUMN · 2244 | NEEDS_COLUMN · 15 | METADATA_ONLY (metadata.lichSuChuyenDonVi) · 100 |
| `noi_xay_ra` | Nơi xảy ra tội phạm | 1820 | OK (noiXayRa) · 141 | OK (diaChiXayRa) · 9 | OK (noiXayRa) · 1670 |
| `ngay_ra_quyet_dinh_phan_cong_tin_bao` | Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm | 1389 | OK (ngayQDPhanCongNguonTin) · 412 | OK (ngayQDPhanCongNguonTin) · 911 | OK (ngayQDPhanCongNguonTin) · 66 |
| `thoi_han_thuc_hien_uy_thac_dieu_tra` | Thời hạn thực hiện Uỷ thác điều tra | 1195 | OK (thoiHanUTDT) · 4 | — | OK (thoiHanUyThac) · 1191 |
| `ghi_chu_khac` | Ghi chú khác | 872 | OK (ghiChuKhac) · 704 | OK (ghiChuKhac) · 114 | OK (ghiChuKhac) · 54 |
| `yeu_cau_bo_sung` |  | 871 | OK (yeuCauBoSung) · 3 | OK (yeuCauBoSung) · 699 | OK (yeuCauBoSung) · 169 |
| `phan_loai_toi_pham_cong_nghe_cao` | Bấm chọn nễu xác định đây là tội phạm công nghệ cao | 596 | OK (laCongNgheCao) · 527 | OK (laCongNgheCaoVV) · 23 | OK (laCongNgheCao) · 46 |
| `de_xuat` |  | 521 | OK (deXuat) · 92 | OK (deXuat) · 373 | OK (deXuat) · 56 |
| `quyet_dinh_phan_cong_giai_quyet_nguon_tin` | Quyết định phân công giải quyết nguồn tin tội phạm | 492 | OK (soQDPhanCongNguonTin) · 411 | OK (soQDPhanCongNguonTin) · 17 | OK (soQDPhanCongNguonTin) · 64 |
| `quyet_dinh_khoi_to_vu_an` | Số Quyết định Khởi tố vụ án | 169 | — | — | OK (soQuyetDinhKhoiTo) · 169 |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | 153 | NEEDS_COLUMN · 126 | NEEDS_COLUMN · 1 | OK (ngayThongKe) · 26 |
| `ngay_thang_nam_het_thoi_hieu_vu_viec` | Ngày tháng năm hết thời hiệu truy cứu TNHS | 132 | NEEDS_COLUMN · 104 | OK (ngayHetThoiHieuVV) · 3 | OK (ngayHetThoiHieuVuViec) · 25 |
| `ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an` | Ngày hết thời hiệu truy cứu TNHS vụ án | 130 | NEEDS_COLUMN · 104 | NEEDS_COLUMN · 1 | OK (ngayHetThoiHieu) · 25 |
| `ngay_ra_quyet_dinh_khoi_to` |  | 110 | NEEDS_COLUMN · 28 | — | OK (ngayKhoiTo) · 82 |
| `ngay_quyet_dinh_khoi_to_vu_an` | Ngày ra Quyết định Khởi tố vụ án | 88 | — | — | OK (ngayKhoiTo) · 88 |
| `ngay_phuc_hoi_nguon_tin_toi_pham` | Ngày Phục hồi nguồn tin tội phạm | 81 | OK (ngayPhucHoiNguonTin) · 71 | — | OK (ngayPhucHoiNguonTin) · 10 |
| `ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin` | Ngày ra Quyết định Tạm đình chỉ nguồn tin | 71 | OK (ngayQDTamDinhChiNguonTin) · 62 | — | OK (ngayQDTamDinhChiNguonTin) · 9 |
| `quyet_dinh_tam_dinh_chi_nguon_tin` | Quyết định Tạm đình chỉ nguồn tin | 67 | OK (soQDTamDinhChiNguonTin) · 58 | — | OK (soQDTamDinhChiNguonTin) · 9 |
| `can_cu_tam_dinh_chi_nguon_tin` | Căn cứ Tạm đình chỉ nguồn tin | 63 | OK (canCuTamDinhChiNguonTin) · 54 | — | OK (canCuTamDinhChiNguonTin) · 9 |
| `phuc_hoi_nguon_tin_toi_pham` | Số Phục hồi nguồn tin tội phạm | 57 | OK (soPhucHoiNguonTin) · 48 | — | OK (soPhucHoiNguonTin) · 9 |
| `toi_danh_chinh` | Tội danh chính khi khởi tố | 53 | — | — | RESOLVE · 53 |
| `het_thoi_hieu_tnhs` |  | 29 | NEEDS_COLUMN · 28 | — | METADATA_ONLY (metadata.hetThoiHieuTnhs) · 1 |
| `ngay_het_han_vu_an` |  | 29 | NEEDS_COLUMN · 28 | — | METADATA_ONLY (metadata.ngayHetHanVuAn) · 1 |
| `thoi_gian_het_thoi_hieu_truy_cuu_tnhs` |  | 29 | NEEDS_COLUMN · 28 | — | METADATA_ONLY (metadata.thoiGianHetThoiHieuTnhs) · 1 |
| `ngay_ra_quyet_dinh_khong_khoi_to` | Ngày ra Quyết định Không khởi tố | 28 | NEEDS_COLUMN · 27 | — | OK (ngayQDKhongKhoiTo) · 1 |
| `phan_loai_dan_su` | Phân loại dân sự | 6 | NEEDS_COLUMN · 6 | — | — |
| `da_xoa` |  | 5 | DROP · 5 | — | — |
| `da_nhan` |  | 4 | DROP · 4 | — | — |
| `loai_toi_pham` | Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án) | 4 | — | — | NEEDS_COLUMN · 4 |
| `dieu_tra_vien_phuong_xa` | Điều tra viên là trưởng - phó Công an phường thụ lý | 4 | — | OK (dieuTraVienPhuongXa) · 4 | — |
| `quyet_dinh_khong_khoi_to` | Quyết định Không khởi tố | 2 | NEEDS_COLUMN · 2 | — | — |
| `can_cu_ra_quyet_dinh_khong_khoi_to` | Căn cứ để ra Quyết định Không khởi tố | 1 | NEEDS_COLUMN · 1 | — | — |
| `ngay_tam_dinh_chi_vu_an` | Ngày Quyết định tạm đình chỉ vụ án | 1 | NEEDS_COLUMN · 1 | — | — |
| `quyet_dinh_tam_dinh_chi_vu_an` | Số Quyết định Tạm đình chỉ vụ án | 1 | NEEDS_COLUMN · 1 | — | — |
