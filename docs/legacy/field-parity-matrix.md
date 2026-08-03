# Ma trận FIELD-PARITY (field cũ × thực thể → cột hệ mới)

> Sinh từ data thật: 53173 hồ sơ đã di trú. Mỗi ô = (field có data ở thực thể đó) → trạng thái cột.
> **METADATA_ONLY** + **NEEDS_COLUMN** = phải THÊM CỘT typed (chỉ thị: mọi field có data → cột).

## ⚠️ CẦN THÊM CỘT (field có data, chưa có cột typed riêng ở thực thể đó)

| Field | Nhãn | Thực thể | Số HS | Trạng thái | Kiểu đề xuất |
|---|---|---|---|---|---|
| `ngay_de_xuat` |  | **case** | 3283 | NEEDS_COLUMN | String? |
| `tom_tat_noi_dung` | Tóm tắt nội dung | **case** | 3236 | METADATA_ONLY | String? |
| `nguon_don` | Nguồn đơn/Đơn vị giao | **case** | 2962 | METADATA_ONLY | String? |
| `ten_ca_nhan_co_quan_to_chuc_cung_cap` | Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại | **case** | 728 | METADATA_ONLY | String? |
| `nhan_xet` | Nhận xét | **incident** | 3397 | NEEDS_COLUMN | String? |
| `nhan_xet` | Nhận xét | **case** | 1268 | METADATA_ONLY | String? |
| `ngay_tiep_nhan_nguon_tin` | Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin) | **incident** | 3031 | NEEDS_COLUMN | String? |
| `dia-chi-bi-hai` | Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại | **case** | 1268 | METADATA_ONLY | String? |
| `loai_thong_tin` | Loại thông tin | **incident** | 190 | NEEDS_COLUMN | String? |
| `ngay_viet_don` | Ngày viết đơn | **incident** | 299 | NEEDS_COLUMN | String? |
| `ngay_viet_don` | Ngày viết đơn | **case** | 339 | NEEDS_COLUMN | String? |
| `ghi_chu_trung_don` | Ghi chú trùng đơn | **incident** | 90 | NEEDS_COLUMN | String? |
| `ghi_chu_trung_don` | Ghi chú trùng đơn | **case** | 342 | NEEDS_COLUMN | String? |
| `truong_hop_bao_cao_ban_giam_doc` | Trường hợp báo cáo Ban Giám đốc | **incident** | 89 | NEEDS_COLUMN | String? |
| `truong_hop_bao_cao_ban_giam_doc` | Trường hợp báo cáo Ban Giám đốc | **case** | 343 | NEEDS_COLUMN | String? |
| `so_tien_bi_thiet_hai` | Số tiền bị thiệt hại (triệu Việt nam Đồng) | **petition** | 31461 | NEEDS_COLUMN | Int? |
| `so_tien_bi_thiet_hai` | Số tiền bị thiệt hại (triệu Việt nam Đồng) | **case** | 105 | METADATA_ONLY | Int? |
| `so_luong_bi_hai` | Số lượng người bị hại | **petition** | 31460 | NEEDS_COLUMN | Int? |
| `so_luong_bi_hai` | Số lượng người bị hại | **case** | 105 | METADATA_ONLY | Int? |
| `phuong_thuc_thu_doan` | Phương thức thủ đoạn | **case** | 105 | METADATA_ONLY | String? |
| `ngay_giao_don_vi_giai_quyet` | Ngày giao đơn vị giải quyết | **incident** | 666 | NEEDS_COLUMN | String? |
| `ngay_giao_don_vi_giai_quyet` | Ngày giao đơn vị giải quyết | **case** | 192 | NEEDS_COLUMN | String? |
| `toi-danh-ban-dau` | Tội danh cũ trước đây | **incident** | 3446 | NEEDS_COLUMN | String? |
| `ket_qua_xu_ly_giai_quyet_khac` | Kết quả xử lý, giải quyết khác | **case** | 217 | METADATA_ONLY | String? |
| `so_phieu_chuyen` | Số phiếu chuyển/ Công văn/ Ủy thác điều tra | **incident** | 78 | NEEDS_COLUMN | String? |
| `so_phieu_chuyen` | Số phiếu chuyển/ Công văn/ Ủy thác điều tra | **case** | 1693 | METADATA_ONLY | String? |
| `ngay_phieu_chuyen` | Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra | **incident** | 81 | NEEDS_COLUMN | String? |
| `ngay_phieu_chuyen` | Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra | **case** | 1677 | NEEDS_COLUMN | String? |
| `do_vat_tai_lieu_kem_theo` | Đồ vật, tài liệu kèm theo | **incident** | 47 | NEEDS_COLUMN | String? |
| `do_vat_tai_lieu_kem_theo` | Đồ vật, tài liệu kèm theo | **case** | 253 | NEEDS_COLUMN | String? |
| `phan_loai_toi_pham_theo_linh_vuc` |  | **petition** | 7489 | NEEDS_COLUMN | String? |
| `phan_loai_toi_pham_theo_linh_vuc` |  | **incident** | 369 | NEEDS_COLUMN | String? |
| `phan_loai_toi_pham_theo_linh_vuc` |  | **case** | 1131 | METADATA_ONLY | String? |
| `so_dien_thoai_nguyen_don` | Số điện thoại nguyên đơn | **case** | 521 | METADATA_ONLY | String? |
| `sinh_nam_nguoi_to_giac` | Sinh năm | **case** | 432 | METADATA_ONLY | String? |
| `nghi_van_doi_tuong` | Nghi vấn đối tượng hoặc bị can | **case** | 2107 | METADATA_ONLY | String? |
| `phan_loai_ho_so_doi_1` |  | **petition** | 4305 | NEEDS_COLUMN | String? |
| `phan_loai_ho_so_doi_1` |  | **incident** | 177 | NEEDS_COLUMN | String? |
| `phan_loai_ho_so_doi_1` |  | **case** | 1248 | METADATA_ONLY | String? |
| `lanh_dao_to_tung` | Lãnh đạo phụ trách tố tụng | **incident** | 2641 | NEEDS_COLUMN | String? |
| `lanh_dao_to_tung` | Lãnh đạo phụ trách tố tụng | **case** | 644 | NEEDS_COLUMN | String? |
| `so_cccd_nguyen_don` | Số căn cước công dân | **case** | 262 | METADATA_ONLY | String? |
| `dieu_tra_vien` | Điều tra viên thụ lý | **incident** | 1816 | NEEDS_COLUMN | String? |
| `dieu_tra_vien` | Điều tra viên thụ lý | **case** | 450 | METADATA_ONLY | String? |
| `noi_cap_cccd_nguyen_don` | Nơi cấp CCCD | **incident** | 38 | NEEDS_COLUMN | String? |
| `noi_cap_cccd_nguyen_don` | Nơi cấp CCCD | **case** | 209 | METADATA_ONLY | String? |
| `lich_su` |  | **petition** | 2244 | NEEDS_COLUMN | String? |
| `lich_su` |  | **incident** | 15 | NEEDS_COLUMN | String? |
| `lich_su` |  | **case** | 100 | METADATA_ONLY | String? |
| `ngay_cap_cccd_nguyen_don` | Ngày cấp CCCD | **incident** | 39 | NEEDS_COLUMN | String? |
| `ngay_cap_cccd_nguyen_don` | Ngày cấp CCCD | **case** | 211 | METADATA_ONLY | String? |
| `noi_xay_ra` | Nơi xảy ra tội phạm | **case** | 1612 | METADATA_ONLY | String? |
| `ngay_ra_quyet_dinh_phan_cong_tin_bao` | Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm | **petition** | 363 | NEEDS_COLUMN | String? |
| `ngay_ra_quyet_dinh_phan_cong_tin_bao` | Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm | **case** | 66 | NEEDS_COLUMN | String? |
| `thoi_han_thuc_hien_uy_thac_dieu_tra` | Thời hạn thực hiện Uỷ thác điều tra | **case** | 1134 | NEEDS_COLUMN | DateTime? |
| `yeu_cau_bo_sung` |  | **petition** | 3 | NEEDS_COLUMN | String? |
| `yeu_cau_bo_sung` |  | **incident** | 699 | NEEDS_COLUMN | String? |
| `yeu_cau_bo_sung` |  | **case** | 169 | METADATA_ONLY | String? |
| `ghi_chu_khac` | Ghi chú khác | **petition** | 671 | NEEDS_COLUMN | String? |
| `ghi_chu_khac` | Ghi chú khác | **incident** | 114 | NEEDS_COLUMN | String? |
| `phan_loai_toi_pham_cong_nghe_cao` | Bấm chọn nễu xác định đây là tội phạm công nghệ cao | **incident** | 22 | NEEDS_COLUMN | Boolean? |
| `phan_loai_toi_pham_cong_nghe_cao` | Bấm chọn nễu xác định đây là tội phạm công nghệ cao | **case** | 45 | NEEDS_COLUMN | Boolean? |
| `de_xuat` |  | **petition** | 92 | NEEDS_COLUMN | String? |
| `de_xuat` |  | **incident** | 373 | NEEDS_COLUMN | String? |
| `de_xuat` |  | **case** | 56 | METADATA_ONLY | String? |
| `quyet_dinh_phan_cong_giai_quyet_nguon_tin` | Quyết định phân công giải quyết nguồn tin tội phạm | **petition** | 362 | NEEDS_COLUMN | String? |
| `quyet_dinh_phan_cong_giai_quyet_nguon_tin` | Quyết định phân công giải quyết nguồn tin tội phạm | **case** | 64 | NEEDS_COLUMN | String? |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | **petition** | 126 | NEEDS_COLUMN | DateTime? |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | **incident** | 1 | NEEDS_COLUMN | DateTime? |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | **case** | 26 | METADATA_ONLY | DateTime? |
| `ngay_thang_nam_het_thoi_hieu_vu_viec` | Ngày tháng năm hết thời hiệu truy cứu TNHS | **petition** | 104 | NEEDS_COLUMN | DateTime? |
| `ngay_thang_nam_het_thoi_hieu_vu_viec` | Ngày tháng năm hết thời hiệu truy cứu TNHS | **case** | 25 | NEEDS_COLUMN | DateTime? |
| `ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an` | Ngày hết thời hiệu truy cứu TNHS vụ án | **petition** | 104 | NEEDS_COLUMN | DateTime? |
| `ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an` | Ngày hết thời hiệu truy cứu TNHS vụ án | **incident** | 1 | NEEDS_COLUMN | DateTime? |
| `ngay_ra_quyet_dinh_khoi_to` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `ngay_phuc_hoi_nguon_tin_toi_pham` | Ngày Phục hồi nguồn tin tội phạm | **petition** | 71 | NEEDS_COLUMN | String? |
| `ngay_phuc_hoi_nguon_tin_toi_pham` | Ngày Phục hồi nguồn tin tội phạm | **case** | 10 | NEEDS_COLUMN | String? |
| `ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin` | Ngày ra Quyết định Tạm đình chỉ nguồn tin | **petition** | 61 | NEEDS_COLUMN | String? |
| `ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin` | Ngày ra Quyết định Tạm đình chỉ nguồn tin | **case** | 9 | NEEDS_COLUMN | String? |
| `quyet_dinh_tam_dinh_chi_nguon_tin` | Quyết định Tạm đình chỉ nguồn tin | **petition** | 57 | NEEDS_COLUMN | String? |
| `quyet_dinh_tam_dinh_chi_nguon_tin` | Quyết định Tạm đình chỉ nguồn tin | **case** | 9 | NEEDS_COLUMN | String? |
| `can_cu_tam_dinh_chi_nguon_tin` | Căn cứ Tạm đình chỉ nguồn tin | **petition** | 54 | NEEDS_COLUMN | String? |
| `can_cu_tam_dinh_chi_nguon_tin` | Căn cứ Tạm đình chỉ nguồn tin | **case** | 9 | NEEDS_COLUMN | String? |
| `phuc_hoi_nguon_tin_toi_pham` | Số Phục hồi nguồn tin tội phạm | **petition** | 48 | NEEDS_COLUMN | String? |
| `phuc_hoi_nguon_tin_toi_pham` | Số Phục hồi nguồn tin tội phạm | **case** | 9 | NEEDS_COLUMN | String? |
| `het_thoi_hieu_tnhs` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `het_thoi_hieu_tnhs` |  | **case** | 1 | METADATA_ONLY | String? |
| `ngay_het_han_vu_an` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `ngay_het_han_vu_an` |  | **case** | 1 | METADATA_ONLY | String? |
| `thoi_gian_het_thoi_hieu_truy_cuu_tnhs` |  | **petition** | 28 | NEEDS_COLUMN | String? |
| `thoi_gian_het_thoi_hieu_truy_cuu_tnhs` |  | **case** | 1 | METADATA_ONLY | String? |
| `ngay_ra_quyet_dinh_khong_khoi_to` | Ngày ra Quyết định Không khởi tố | **petition** | 27 | NEEDS_COLUMN | String? |
| `ngay_ra_quyet_dinh_khong_khoi_to` | Ngày ra Quyết định Không khởi tố | **case** | 1 | METADATA_ONLY | String? |
| `phan_loai_dan_su` | Phân loại dân sự | **petition** | 6 | NEEDS_COLUMN | String? |
| `loai_toi_pham` | Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án) | **case** | 4 | NEEDS_COLUMN | String? |
| `dieu_tra_vien_phuong_xa` | Điều tra viên là trưởng - phó Công an phường thụ lý | **incident** | 4 | NEEDS_COLUMN | String? |
| `quyet_dinh_khong_khoi_to` | Quyết định Không khởi tố | **petition** | 2 | NEEDS_COLUMN | String? |
| `can_cu_ra_quyet_dinh_khong_khoi_to` | Căn cứ để ra Quyết định Không khởi tố | **petition** | 1 | NEEDS_COLUMN | String? |
| `ngay_tam_dinh_chi_vu_an` | Ngày Quyết định tạm đình chỉ vụ án | **petition** | 1 | NEEDS_COLUMN | String? |
| `quyet_dinh_tam_dinh_chi_vu_an` | Số Quyết định Tạm đình chỉ vụ án | **petition** | 1 | NEEDS_COLUMN | String? |

Tổng ô cần thêm cột: **100** (theo thực thể: petition 28, incident 25, case 47).

## 🔧 CẦN FIX BUILDER (cột đã có, builder chưa đọc)

| Field | Nhãn | Thực thể | Số HS | Cột đích |
|---|---|---|---|---|
| `dieu_tra_vien` | Điều tra viên thụ lý | petition | 284 | dieuTraVien |

Tổng ô cần fix builder: **1**.

## Toàn bộ field (sắp theo tổng số hồ sơ có data)

| Field | Nhãn | Tổng | Petition | Incident | Case |
|---|---|---|---|---|---|
| `id` |  | 53173 | DROP · 45298 | DROP · 4592 | DROP · 3283 |
| `_id` |  | 53173 | DROP · 45298 | DROP · 4592 | DROP · 3283 |
| `stt` |  | 53173 | DROP · 45298 | DROP · 4592 | DROP · 3283 |
| `_add_time` |  | 53173 | DROP · 45298 | DROP · 4592 | DROP · 3283 |
| `don_vi_id` |  | 53173 | DROP · 45298 | DROP · 4592 | DROP · 3283 |
| `nguoi_them` |  | 53173 | DROP · 45298 | DROP · 4592 | DROP · 3283 |
| `_update_time` |  | 53173 | DROP · 45298 | DROP · 4592 | DROP · 3283 |
| `ngay_de_xuat` |  | 53173 | OK (receivedDate) · 45298 | OK (ngayDeXuat) · 4592 | NEEDS_COLUMN · 3283 |
| `nam` |  | 53153 | DROP · 45298 | DROP · 4592 | DROP · 3263 |
| `thang` |  | 53153 | DROP · 45298 | DROP · 4592 | DROP · 3263 |
| `ngay` |  | 53150 | DROP · 45296 | DROP · 4592 | DROP · 3262 |
| `tom_tat_noi_dung` | Tóm tắt nội dung | 53123 | OK (summary) · 45296 | OK (name) · 4591 | METADATA_ONLY (metadata.description) · 3236 |
| `phan_loai_nguon_tin_ban_dau` | Phân loại ban đầu | 53077 | RESOLVE · 45255 | RESOLVE · 4564 | RESOLVE · 3258 |
| `loai` |  | 53034 | DROP · 45187 | DROP · 4573 | DROP · 3274 |
| `don_vi_giai_quyet` | Đơn vị giải quyết | 52686 | RESOLVE · 45280 | RESOLVE · 4196 | RESOLVE · 3210 |
| `nguon_don` | Nguồn đơn/Đơn vị giao | 51681 | OK (nguonDon) · 45272 | OK (chuyenTuDonVi) · 3447 | METADATA_ONLY (metadata.nguonDon) · 2962 |
| `ten_ca_nhan_co_quan_to_chuc_cung_cap` | Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại | 50249 | OK (senderName) · 45259 | OK (benVu) · 4262 | METADATA_ONLY (metadata.tenCungCap) · 728 |
| `nhan_xet` | Nhận xét | 49758 | OK (nhanThay) · 45093 | NEEDS_COLUMN · 3397 | METADATA_ONLY (metadata.nhanXet) · 1268 |
| `ngay_tiep_nhan_nguon_tin` | Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin) | 48081 | OK (ngayTiepNhanNguonTin) · 43202 | NEEDS_COLUMN · 3031 | OK (ngayTiepNhan) · 1848 |
| `dia-chi-bi-hai` | Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại | 46832 | OK (senderAddress) · 44860 | OK (diaChiNguoiToGiac) · 704 | METADATA_ONLY (metadata.biHai) · 1268 |
| `loai_thong_tin` | Loại thông tin | 45811 | OK (loaiThongTin) · 45220 | NEEDS_COLUMN · 190 | OK (loaiThongTin) · 401 |
| `ngay_viet_don` | Ngày viết đơn | 45501 | OK (petitionDate) · 44863 | NEEDS_COLUMN · 299 | NEEDS_COLUMN · 339 |
| `stt_cu` |  | 36269 | DROP · 31460 | DROP · 3323 | DROP · 1486 |
| `ghi_chu_trung_don` | Ghi chú trùng đơn | 35849 | OK (raSoatTrung) · 35417 | NEEDS_COLUMN · 90 | NEEDS_COLUMN · 342 |
| `truong_hop_bao_cao_ban_giam_doc` | Trường hợp báo cáo Ban Giám đốc | 34518 | OK (baoCaoBanGiamDoc) · 34086 | NEEDS_COLUMN · 89 | NEEDS_COLUMN · 343 |
| `so_tien_bi_thiet_hai` | Số tiền bị thiệt hại (triệu Việt nam Đồng) | 31566 | NEEDS_COLUMN · 31461 | — | METADATA_ONLY (metadata.damageAmount) · 105 |
| `so_luong_bi_hai` | Số lượng người bị hại | 31565 | NEEDS_COLUMN · 31460 | — | METADATA_ONLY (metadata.soLuongBiHai) · 105 |
| `phuong_thuc_thu_doan` | Phương thức thủ đoạn | 31565 | OK (phuongThucThuDoan) · 31460 | — | METADATA_ONLY (metadata.phuongThucThuDoan) · 105 |
| `ngay_giao_don_vi_giai_quyet` | Ngày giao đơn vị giải quyết | 26208 | OK (ngayGiaoDonViGiaiQuyet) · 25350 | NEEDS_COLUMN · 666 | NEEDS_COLUMN · 192 |
| `toi-danh-ban-dau` | Tội danh cũ trước đây | 21218 | OK (toiDanhBanDau) · 15183 | NEEDS_COLUMN · 3446 | OK (crime) · 2589 |
| `tinh_trang` |  | 16900 | RESOLVE · 13838 | RESOLVE · 1265 | RESOLVE · 1797 |
| `toi_danh_chinh_blhs2015` | Tội danh chính - BLHS 2015 (nhận định ban đầu) | 16032 | RESOLVE · 13305 | RESOLVE · 1110 | RESOLVE · 1617 |
| `ket_qua_xu_ly_giai_quyet_khac` | Kết quả xử lý, giải quyết khác | 13770 | OK (ketQuaXuLyKhac) · 11012 | OK (ketQuaXuLy) · 2541 | METADATA_ONLY (metadata.ketQuaXuLyKhac) · 217 |
| `so_phieu_chuyen` | Số phiếu chuyển/ Công văn/ Ủy thác điều tra | 11568 | OK (soPhieuChuyen) · 9797 | NEEDS_COLUMN · 78 | METADATA_ONLY (metadata.soPhieuChuyen) · 1693 |
| `ngay_phieu_chuyen` | Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra | 10694 | OK (ngayPhieuChuyen) · 8936 | NEEDS_COLUMN · 81 | NEEDS_COLUMN · 1677 |
| `do_vat_tai_lieu_kem_theo` | Đồ vật, tài liệu kèm theo | 10659 | OK (attachmentsNote) · 10359 | NEEDS_COLUMN · 47 | NEEDS_COLUMN · 253 |
| `phan_loai_toi_pham_theo_linh_vuc` |  | 8989 | NEEDS_COLUMN · 7489 | NEEDS_COLUMN · 369 | METADATA_ONLY (metadata.phanLoaiToiPhamLinhVuc) · 1131 |
| `so_dien_thoai_nguyen_don` | Số điện thoại nguyên đơn | 7594 | OK (senderPhone) · 6299 | OK (sdtNguoiToGiac) · 774 | METADATA_ONLY (metadata.sdtCungCap) · 521 |
| `sinh_nam_nguoi_to_giac` | Sinh năm | 7130 | OK (senderBirthYear) · 5844 | OK (sinhNamNguoiToGiac) · 854 | METADATA_ONLY (metadata.sinhNamCungCap) · 432 |
| `nghi_van_doi_tuong` | Nghi vấn đối tượng hoặc bị can | 6951 | OK (suspectedPerson) · 651 | OK (doiTuongCaNhan) · 4193 | METADATA_ONLY (metadata.nghiVanDoiTuong) · 2107 |
| `phan_loai_ho_so_doi_1` |  | 5730 | NEEDS_COLUMN · 4305 | NEEDS_COLUMN · 177 | METADATA_ONLY (metadata.phanLoaiHoSoNoiBo) · 1248 |
| `lanh_dao_to_tung` | Lãnh đạo phụ trách tố tụng | 3285 | — | NEEDS_COLUMN · 2641 | NEEDS_COLUMN · 644 |
| `so_cccd_nguyen_don` | Số căn cước công dân | 3281 | OK (senderIdNumber) · 2944 | OK (cmndNguoiToGiac) · 75 | METADATA_ONLY (metadata.cccdCungCap) · 262 |
| `dieu_tra_vien` | Điều tra viên thụ lý | 2550 | FIX_BUILDER (dieuTraVien) · 284 | NEEDS_COLUMN · 1816 | METADATA_ONLY (metadata.dieuTraVienText) · 450 |
| `noi_cap_cccd_nguyen_don` | Nơi cấp CCCD | 2392 | OK (senderIdIssuePlace) · 2145 | NEEDS_COLUMN · 38 | METADATA_ONLY (metadata.noiCapCccd) · 209 |
| `lich_su` |  | 2359 | NEEDS_COLUMN · 2244 | NEEDS_COLUMN · 15 | METADATA_ONLY (metadata.lichSuChuyenDonVi) · 100 |
| `ngay_cap_cccd_nguyen_don` | Ngày cấp CCCD | 2244 | OK (senderIdIssueDate) · 1994 | NEEDS_COLUMN · 39 | METADATA_ONLY (metadata.ngayCapCccd) · 211 |
| `noi_xay_ra` | Nơi xảy ra tội phạm | 1759 | OK (noiXayRa) · 138 | OK (diaChiXayRa) · 9 | METADATA_ONLY (metadata.noiXayRa) · 1612 |
| `ngay_ra_quyet_dinh_phan_cong_tin_bao` | Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm | 1340 | NEEDS_COLUMN · 363 | OK (ngayQDPhanCongNguonTin) · 911 | NEEDS_COLUMN · 66 |
| `thoi_han_thuc_hien_uy_thac_dieu_tra` | Thời hạn thực hiện Uỷ thác điều tra | 1135 | OK (thoiHanUTDT) · 1 | — | NEEDS_COLUMN · 1134 |
| `yeu_cau_bo_sung` |  | 871 | NEEDS_COLUMN · 3 | NEEDS_COLUMN · 699 | METADATA_ONLY (metadata.yeuCauBoSung) · 169 |
| `ghi_chu_khac` | Ghi chú khác | 838 | NEEDS_COLUMN · 671 | NEEDS_COLUMN · 114 | OK (ghiChuKhac) · 53 |
| `phan_loai_toi_pham_cong_nghe_cao` | Bấm chọn nễu xác định đây là tội phạm công nghệ cao | 574 | OK (laCongNgheCao) · 507 | NEEDS_COLUMN · 22 | NEEDS_COLUMN · 45 |
| `de_xuat` |  | 521 | NEEDS_COLUMN · 92 | NEEDS_COLUMN · 373 | METADATA_ONLY (metadata.deXuatXuLy) · 56 |
| `quyet_dinh_phan_cong_giai_quyet_nguon_tin` | Quyết định phân công giải quyết nguồn tin tội phạm | 443 | NEEDS_COLUMN · 362 | OK (soQDPhanCongNguonTin) · 17 | NEEDS_COLUMN · 64 |
| `quyet_dinh_khoi_to_vu_an` | Số Quyết định Khởi tố vụ án | 164 | — | — | OK (soQuyetDinhKhoiTo) · 164 |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | 153 | NEEDS_COLUMN · 126 | NEEDS_COLUMN · 1 | METADATA_ONLY (metadata.ngayThongKe) · 26 |
| `ngay_thang_nam_het_thoi_hieu_vu_viec` | Ngày tháng năm hết thời hiệu truy cứu TNHS | 132 | NEEDS_COLUMN · 104 | OK (ngayHetThoiHieuVV) · 3 | NEEDS_COLUMN · 25 |
| `ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an` | Ngày hết thời hiệu truy cứu TNHS vụ án | 130 | NEEDS_COLUMN · 104 | NEEDS_COLUMN · 1 | OK (ngayHetThoiHieu) · 25 |
| `ngay_ra_quyet_dinh_khoi_to` |  | 110 | NEEDS_COLUMN · 28 | — | OK (ngayKhoiTo) · 82 |
| `ngay_quyet_dinh_khoi_to_vu_an` | Ngày ra Quyết định Khởi tố vụ án | 83 | — | — | OK (ngayKhoiTo) · 83 |
| `ngay_phuc_hoi_nguon_tin_toi_pham` | Ngày Phục hồi nguồn tin tội phạm | 81 | NEEDS_COLUMN · 71 | — | NEEDS_COLUMN · 10 |
| `ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin` | Ngày ra Quyết định Tạm đình chỉ nguồn tin | 70 | NEEDS_COLUMN · 61 | — | NEEDS_COLUMN · 9 |
| `quyet_dinh_tam_dinh_chi_nguon_tin` | Quyết định Tạm đình chỉ nguồn tin | 66 | NEEDS_COLUMN · 57 | — | NEEDS_COLUMN · 9 |
| `can_cu_tam_dinh_chi_nguon_tin` | Căn cứ Tạm đình chỉ nguồn tin | 63 | NEEDS_COLUMN · 54 | — | NEEDS_COLUMN · 9 |
| `phuc_hoi_nguon_tin_toi_pham` | Số Phục hồi nguồn tin tội phạm | 57 | NEEDS_COLUMN · 48 | — | NEEDS_COLUMN · 9 |
| `toi_danh_chinh` | Tội danh chính khi khởi tố | 48 | — | — | RESOLVE · 48 |
| `het_thoi_hieu_tnhs` |  | 29 | NEEDS_COLUMN · 28 | — | METADATA_ONLY (metadata.hetThoiHieuTnhs) · 1 |
| `ngay_het_han_vu_an` |  | 29 | NEEDS_COLUMN · 28 | — | METADATA_ONLY (metadata.ngayHetHanVuAn) · 1 |
| `thoi_gian_het_thoi_hieu_truy_cuu_tnhs` |  | 29 | NEEDS_COLUMN · 28 | — | METADATA_ONLY (metadata.thoiGianHetThoiHieuTnhs) · 1 |
| `ngay_ra_quyet_dinh_khong_khoi_to` | Ngày ra Quyết định Không khởi tố | 28 | NEEDS_COLUMN · 27 | — | METADATA_ONLY (metadata.ngayKhongKhoiTo) · 1 |
| `phan_loai_dan_su` | Phân loại dân sự | 6 | NEEDS_COLUMN · 6 | — | — |
| `da_xoa` |  | 4 | DROP · 4 | — | — |
| `da_nhan` |  | 4 | DROP · 4 | — | — |
| `loai_toi_pham` | Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án) | 4 | — | — | NEEDS_COLUMN · 4 |
| `dieu_tra_vien_phuong_xa` | Điều tra viên là trưởng - phó Công an phường thụ lý | 4 | — | NEEDS_COLUMN · 4 | — |
| `quyet_dinh_khong_khoi_to` | Quyết định Không khởi tố | 2 | NEEDS_COLUMN · 2 | — | — |
| `can_cu_ra_quyet_dinh_khong_khoi_to` | Căn cứ để ra Quyết định Không khởi tố | 1 | NEEDS_COLUMN · 1 | — | — |
| `ngay_tam_dinh_chi_vu_an` | Ngày Quyết định tạm đình chỉ vụ án | 1 | NEEDS_COLUMN · 1 | — | — |
| `quyet_dinh_tam_dinh_chi_vu_an` | Số Quyết định Tạm đình chỉ vụ án | 1 | NEEDS_COLUMN · 1 | — | — |
