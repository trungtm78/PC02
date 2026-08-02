# Ma trận MAP field cũ → hệ mới (quyết định field)

> Sinh từ catalog + `field-mapping.seed.ts`. Tổng 132 field ho_so / 54257 hồ sơ.
> MAPPED 80 · RESOLVE 5 · DROP 0 · **UNMAPPED 47**

## ⚠️ UNMAPPED tần suất cao — CẦN QUYẾT (thêm cột / metadata / bỏ)

| Field | Nhãn | Kiểu | Có DL | % | Đề xuất |
|---|---|---|---|---|---|
| `do_vat_tai_lieu_kem_theo` | Đồ vật, tài liệu kèm theo | textarea | 11040 | 20.3% | THÊM CỘT (dùng nhiều) |
| `ngay_quyet_dinh_khoi_to_vu_an` | Ngày ra Quyết định Khởi tố vụ án | text | 84 | 0.2% | metadata |
| `ngay_ra_quyet_dinh_khong_khoi_to` | Ngày ra Quyết định Không khởi tố | text | 42 | 0.1% | metadata |
| `quyet_dinh_khong_khoi_to` | Quyết định Không khởi tố | text | 2 | 0.0% | metadata |
| `khac_phuc_ly_do_tdc` | Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc | textarea | 0 | 0.0% | metadata |
| `nhap_vao_vu_viec_so` | Nhập vào vụ việc hồ sơ khác | text | 0 | 0.0% | metadata |
| `khac_phuc_tdc_vu_an` | Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án | textarea | 0 | 0.0% | metadata |
| `bien_phap_khac_phuc_tdc_vu_an` | Biện pháp, tiến độ khắc phục lý do TĐC vụ án | textarea | 0 | 0.0% | metadata |
| `quyet_dinh_phuc_hoi_vu_an` | Số Quyết định Phục hồi Vụ án | text | 0 | 0.0% | metadata |
| `vat_chung` | Loại, đặc điểm đồ vật, tài liệu, vật chứng | textarea | 0 | 0.0% | metadata |
| `lenh_nhap_kho` | Lệnh nhập, phiếu nhập kho | text | 0 | 0.0% | metadata |
| `so_dang_ky_ho_so` | Số đăng ký hồ sơ nghiệp vụ | text | 0 | 0.0% | metadata |
| `ho_so_luu` | Số hồ sơ lưu | text | 0 | 0.0% | metadata |
| `don_vi_bao_quan_ho_so` | Đơn vị lưu giữ, bảo quản hồ sơ | text | 0 | 0.0% | metadata |
| `ly_do_tam_dinh_chi` | Lý do tạm đình chỉ | multi_select | 0 | 0.0% | metadata |
| `Noi_luu_tru_bao_quan_ke_bien_phong_toa` | Nơi lưu trữ, bảo quản, kê biên, phong tỏa | text | 0 | 0.0% | metadata |
| `ngay_dang_ky_ho_so` | Ngày đăng ký hồ sơ nghiệp vụ | text | 0 | 0.0% | metadata |
| `ngay_nop_luu_ho_so` | Ngày nộp lưu hồ sơ | text | 0 | 0.0% | metadata |
| `ly_do_ra_quyet_dinh_khong_khoi_to_vu_an` | Lý do ra Quyết định không khởi tố vụ án | multi_select | 0 | 0.0% | metadata |
| `ngay_phuc_hoi_dieu_tra_vu_an` | Ngày Quyết định phục hồi điều tra vụ án | text | 0 | 0.0% | metadata |
| `ly_do_tam_dinh_chi_vu_an` | Lý do tạm đình chỉ vụ án | multi_select | 0 | 0.0% | metadata |
| `ngay_quyet_dinh_dieu_tra_lai` | Ngày Quyết định điều tra lại | text | 0 | 0.0% | metadata |
| `ngay_quyet_dinh_dinh_chi_vu_an` | Ngày Quyết định đình chỉ vụ án | text | 0 | 0.0% | metadata |
| `xac_nhan_ghi_am_ghi_hinh` | Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình | checkbox | 0 | 0.0% | metadata |
| `tong_so_bien_ban_ghi_loi_khai` | Tổng số biên bản ghi lời khai | number | 0 | 0.0% | metadata |
| `so_bien_ban_ghi_loi_khai_co_ghi_am_ghi_hinh` | Số lượng biên bản ghi lời khai có ghi âm ghi hình | number | 0 | 0.0% | metadata |
| `so_bi_can_co_ghi_am_ghi_hinh` | Số lượng bị can có ghi âm ghi hình | number | 0 | 0.0% | metadata |
| `tong_so_bien_ban_hoi_cung_bi_can` | Tổng số biên bản hỏi cung bị can | number | 0 | 0.0% | metadata |
| `tong_so_bien_ban_hoi_cung_co_ghi_am_ghi_hinh` | Tổng số biên bản hỏi cung có ghi âm ghi hình | number | 0 | 0.0% | metadata |
| `xac_nhan_vks_yeu_cau_ghi_am_ghi_hinh` | Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình | checkbox | 0 | 0.0% | metadata |
| `so_luong_bi_can_vks_yeu_cau_ghi_am_ghi_hinh` | Số lượng bị can VKS yêu cầu ghi âm ghi hình | number | 0 | 0.0% | metadata |
| `xac_nhan_vu_an_da_duoc_xet_xu` | Xác nhận vụ án đã được xét xử | checkbox | 0 | 0.0% | metadata |
| `ngay_ban_an_co_hieu_luc` | Ngày tháng năm bản án của toà án có hiệu lực | text | 0 | 0.0% | metadata |
| `vu_an_co_su_dung_ket_quả_ghi_am_ghi_hinh_trong_xet_xu` | Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử | checkbox | 0 | 0.0% | metadata |
| `vu_an_khong_gagh_nhung_toa_an_yeu_cau_cung_cap_gagh` | Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình | checkbox | 0 | 0.0% | metadata |
| `co_bao_nhieu_bang_nhom` | Xác nhận có băng nhóm | checkbox | 0 | 0.0% | metadata |
| `bat_duoc_bao_nhieu_bang_nhom` | Bắt được bao nhiêu băng nhóm | number | 0 | 0.0% | metadata |
| `so_luong_thuoc_no_thu_hoi` | Số lượng thuốc nổ thu hồi | number | 0 | 0.0% | metadata |
| `xac_nhan_vu_viec_vphc` | Xác nhận vụ việc có vi phạm hành chính | checkbox | 0 | 0.0% | metadata |
| `so_doi_tuong_vi_pham_hanh_chinh` | Số đối tượng vi phạm hành chính | number | 0 | 0.0% | metadata |

## Toàn bộ field (sắp theo tần suất)

| Field | Nhãn | % | Loại | Đích |
|---|---|---|---|---|
| `tom_tat_noi_dung` | Tóm tắt nội dung | 99.9% | MAPPED | petition.summary · incident.name |
| `phan_loai_nguon_tin_ban_dau` | Phân loại ban đầu | 99.8% | RESOLVE | → thực thể đích (PHAN_LOAI_TO_ENTITY) + caseProvenance/petitionType (crosswalk) |
| `don_vi_giai_quyet` | Đơn vị giải quyết | 99.1% | RESOLVE | → assignedTeamId (LegacyUnitAlias classification) |
| `nguon_don` | Nguồn đơn/Đơn vị giao | 97.3% | MAPPED | petition.nguonDon · incident.chuyenTuDonVi |
| `ten_ca_nhan_co_quan_to_chuc_cung_cap` | Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại | 94.5% | MAPPED | petition.senderName · incident.benVu |
| `nhan_xet` | Nhận xét | 92.5% | MAPPED | petition.nhanThay |
| `ngay_tiep_nhan_nguon_tin` | Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin) | 90.6% | MAPPED | petition.ngayTiepNhanNguonTin |
| `dia-chi-bi-hai` | Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại | 87.1% | MAPPED | petition.senderAddress · incident.diaChiNguoiToGiac |
| `loai_thong_tin` | Loại thông tin | 85.3% | MAPPED | petition.loaiThongTin |
| `ngay_viet_don` | Ngày viết đơn | 84.6% | MAPPED | petition.petitionDate |
| `ghi_chu_trung_don` | Ghi chú trùng đơn | 66.8% | MAPPED | petition.raSoatTrung |
| `truong_hop_bao_cao_ban_giam_doc` | Trường hợp báo cáo Ban Giám đốc | 64.4% | MAPPED | petition.baoCaoBanGiamDoc |
| `so_tien_bi_thiet_hai` | Số tiền bị thiệt hại (triệu Việt nam Đồng) | 58.2% | MAPPED | caseStatistic.soTienBiThietHai |
| `so_luong_bi_hai` | Số lượng người bị hại | 58.2% | MAPPED | caseStatistic.soLuongBiHai |
| `phuong_thuc_thu_doan` | Phương thức thủ đoạn | 58.2% | MAPPED | petition.phuongThucThuDoan |
| `ngay_giao_don_vi_giai_quyet` | Ngày giao đơn vị giải quyết | 48.3% | MAPPED | petition.ngayGiaoDonViGiaiQuyet |
| `toi-danh-ban-dau` | Tội danh cũ trước đây | 40.3% | MAPPED | petition.toiDanhBanDau · case.crime |
| `ngay_thong_ke` | Ngày tổng hợp thống kê | 32.9% | MAPPED | caseStatistic.ngayThongKe |
| `ngay_thang_nam_het_thoi_hieu_vu_viec` | Ngày tháng năm hết thời hiệu truy cứu TNHS | 32.8% | MAPPED | incident.ngayHetThoiHieuVV |
| `ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an` | Ngày hết thời hiệu truy cứu TNHS vụ án | 32.8% | MAPPED | case.ngayHetThoiHieu |
| `thoi_han_thuc_hien_uy_thac_dieu_tra` | Thời hạn thực hiện Uỷ thác điều tra | 32.1% | MAPPED | petition.thoiHanUTDT |
| `ngay_xay_ra` | Ngày tội phạm xảy ra | 32.0% | MAPPED | petition.ngayXayRa |
| `ngay_tiep_nhan_tin` | Ngày tiếp nhận tin khi đơn vị nhận được | 32.0% | MAPPED | caseStatistic.ngayTiepNhanTin |
| `ngay_nguoi_pham_toi_dau_thu` | Ngày người phạm tội đầu thú, tự thú | 31.1% | MAPPED | caseStatistic.ngayDauThu |
| `ngay_pham_toi_qua_tang` | Ngày người phạm tội bị bắt quả tang | 31.1% | MAPPED | caseStatistic.ngayPhamToiQuaTang |
| `ngay_nguoi_pham_toi_bi_bat_khan_cap` | Ngày Người phạm tội bị giữ trong các trường hợp khẩn cấp | 31.1% | MAPPED | caseStatistic.ngayBatKhanCap |
| `ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi` | Ngày CQCSĐT trực tiếp phát hiện có dấu hiệu tội phạm | 31.1% | MAPPED | caseStatistic.ngayPhatHienDauHieu |
| `ngay_thoi_diem_phan_cong_giai_quyet_to_giac` | Ngày Thời điểm phân công giải quyết tố giác, tin báo | 31.1% | MAPPED | caseStatistic.ngayPhanCongGiaiQuyetToGiac |
| `toi_danh_chinh_blhs2015` | Tội danh chính - BLHS 2015 (nhận định ban đầu) | 30.4% | RESOLVE | crimeChinhId ← resolveCrime(ToiDanh.legacyValue), validate FK tồn tại |
| `ket_qua_xu_ly_giai_quyet_khac` | Kết quả xử lý, giải quyết khác | 25.4% | MAPPED | petition.ketQuaXuLyKhac |
| `so_phieu_chuyen` | Số phiếu chuyển/ Công văn/ Ủy thác điều tra | 21.7% | MAPPED | petition.soPhieuChuyen |
| `do_vat_tai_lieu_kem_theo` | Đồ vật, tài liệu kèm theo | 20.3% | UNMAPPED | UNMAPPED |
| `ngay_phieu_chuyen` | Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra | 20.3% | MAPPED | petition.ngayPhieuChuyen |
| `so_dien_thoai_nguyen_don` | Số điện thoại nguyên đơn | 14.8% | MAPPED | petition.senderPhone · incident.sdtNguoiToGiac |
| `nghi_van_doi_tuong` | Nghi vấn đối tượng hoặc bị can | 14.0% | MAPPED | petition.suspectedPerson · incident.doiTuongCaNhan |
| `sinh_nam_nguoi_to_giac` | Sinh năm | 13.4% | MAPPED | petition.senderBirthYear |
| `so_cccd_nguyen_don` | Số căn cước công dân | 6.3% | MAPPED | petition.senderIdNumber · incident.cmndNguoiToGiac |
| `lanh_dao_to_tung` | Lãnh đạo phụ trách tố tụng | 6.1% | MAPPED | petition.lanhDaoToTung |
| `dieu_tra_vien` | Điều tra viên thụ lý | 4.7% | MAPPED | petition.dieuTraVien |
| `noi_cap_cccd_nguyen_don` | Nơi cấp CCCD | 4.5% | MAPPED | petition.senderIdIssuePlace |
| `ngay_cap_cccd_nguyen_don` | Ngày cấp CCCD | 4.3% | MAPPED | petition.senderIdIssueDate |
| `noi_xay_ra` | Nơi xảy ra tội phạm | 3.3% | MAPPED | petition.noiXayRa · incident.diaChiXayRa |
| `ngay_ra_quyet_dinh_phan_cong_tin_bao` | Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm | 2.5% | MAPPED | incident.ngayQDPhanCongNguonTin |
| `ghi_chu_khac` | Ghi chú khác | 1.6% | MAPPED | case.ghiChuKhac |
| `phan_loai_toi_pham_cong_nghe_cao` | Bấm chọn nễu xác định đây là tội phạm công nghệ cao | 1.1% | MAPPED | petition.laCongNgheCao |
| `quyet_dinh_phan_cong_giai_quyet_nguon_tin` | Quyết định phân công giải quyết nguồn tin tội phạm | 0.8% | MAPPED | incident.soQDPhanCongNguonTin |
| `quyet_dinh_khoi_to_vu_an` | Số Quyết định Khởi tố vụ án | 0.3% | MAPPED | case.soQuyetDinhKhoiTo |
| `ngay_phuc_hoi_nguon_tin_toi_pham` | Ngày Phục hồi nguồn tin tội phạm | 0.2% | MAPPED | incident.ngayPhucHoiVV |
| `ngay_quyet_dinh_khoi_to_vu_an` | Ngày ra Quyết định Khởi tố vụ án | 0.2% | UNMAPPED | UNMAPPED |
| `ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin` | Ngày ra Quyết định Tạm đình chỉ nguồn tin | 0.1% | MAPPED | incident.ngayTamDinhChiVV |
| `quyet_dinh_tam_dinh_chi_nguon_tin` | Quyết định Tạm đình chỉ nguồn tin | 0.1% | MAPPED | incident.soQuyetDinhTamDinhChiVV |
| `can_cu_tam_dinh_chi_nguon_tin` | Căn cứ Tạm đình chỉ nguồn tin | 0.1% | MAPPED | incident.canCuTamDinhChi |
| `phuc_hoi_nguon_tin_toi_pham` | Số Phục hồi nguồn tin tội phạm | 0.1% | MAPPED | incident.soQuyetDinhPhucHoiVV |
| `toi_danh_chinh` | Tội danh chính khi khởi tố | 0.1% | RESOLVE | crimeChinhId ← resolveCrime |
| `ngay_ra_quyet_dinh_khong_khoi_to` | Ngày ra Quyết định Không khởi tố | 0.1% | UNMAPPED | UNMAPPED |
| `phan_loai_dan_su` | Phân loại dân sự | 0.0% | MAPPED | incident.phanLoaiDanSuText |
| `loai_toi_pham` | Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án) | 0.0% | MAPPED | petition.loaiToiPham |
| `quyet_dinh_khong_khoi_to` | Quyết định Không khởi tố | 0.0% | UNMAPPED | UNMAPPED |
| `quyet_dinh_tam_dinh_chi_vu_an` | Số Quyết định Tạm đình chỉ vụ án | 0.0% | MAPPED | case.soQuyetDinhTamDinhChi |
| `can_cu_ra_quyet_dinh_khong_khoi_to` | Căn cứ để ra Quyết định Không khởi tố | 0.0% | MAPPED | incident.canCuKhongKhoiTo |
| `ngay_tam_dinh_chi_vu_an` | Ngày Quyết định tạm đình chỉ vụ án | 0.0% | MAPPED | case.ngayTamDinhChi |
| `khac_phuc_ly_do_tdc` | Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc | 0.0% | UNMAPPED | UNMAPPED |
| `tien_do_khac_phuc_tdc` | Tiến độ khắc phục TĐC vụ việc | 0.0% | MAPPED | incident.tienDoKhacPhucTDC |
| `vu_viec_chuyen_don_vi_khac` | Chuyển vụ việc cho đơn vị khác | 0.0% | MAPPED | incident.chuyenDenDonVi |
| `nhap_vao_vu_viec_so` | Nhập vào vụ việc hồ sơ khác | 0.0% | UNMAPPED | UNMAPPED |
| `quyet_dinh_nhap_vu_an` | Số Quyết định nhập vụ án | 0.0% | MAPPED | case.soQDNhapVuAn |
| `quyet_dinh_tach_vu_an` | Số Quyết định tách vụ án | 0.0% | MAPPED | case.soQDTachVuAn |
| `khac_phuc_tdc_vu_an` | Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án | 0.0% | UNMAPPED | UNMAPPED |
| `bien_phap_khac_phuc_tdc_vu_an` | Biện pháp, tiến độ khắc phục lý do TĐC vụ án | 0.0% | UNMAPPED | UNMAPPED |
| `quyet_dinh_phuc_hoi_vu_an` | Số Quyết định Phục hồi Vụ án | 0.0% | UNMAPPED | UNMAPPED |
| `ket_luan_dieu_tra_vu_an` | Số KLĐT đề nghị truy tố | 0.0% | MAPPED | case.soKLDT |
| `quyet_dinh_dieu_tra_lai` | Số Quyết định điều tra lại | 0.0% | MAPPED | case.soQDDieuTraLai |
| `dinh_chi_vu_an` | Số Quyết định đình chỉ vụ án | 0.0% | MAPPED | case.soQDDinhChiVuAn |
| `can_cu_phuc_hoi_dieu_tra_vu_an` | Căn cứ ra quyết định Phục hồi điều tra vụ án | 0.0% | MAPPED | case.canCuPhucHoiVuAn |
| `chuyen_vu_an_cho_co_quan_khac` | Đã chuyển vụ án cho CQĐT khác | 0.0% | MAPPED | case.chuyenVuAnChoCQK |
| `ghi_chu_nhap_ho_so` | Ghi chú nhập vào hồ sơ nào | 0.0% | MAPPED | case.ghiChuNhapHoSo |
| `vat_chung` | Loại, đặc điểm đồ vật, tài liệu, vật chứng | 0.0% | UNMAPPED | UNMAPPED |
| `lenh_nhap_kho` | Lệnh nhập, phiếu nhập kho | 0.0% | UNMAPPED | UNMAPPED |
| `so_dang_ky_ho_so` | Số đăng ký hồ sơ nghiệp vụ | 0.0% | UNMAPPED | UNMAPPED |
| `ho_so_luu` | Số hồ sơ lưu | 0.0% | UNMAPPED | UNMAPPED |
| `don_vi_bao_quan_ho_so` | Đơn vị lưu giữ, bảo quản hồ sơ | 0.0% | UNMAPPED | UNMAPPED |
| `toi_danh_khac` | Tội danh phụ khi khởi tố | 0.0% | RESOLVE | toiDanhKhacIds[] ← resolveCrime nhiều |
| `ly_do_tam_dinh_chi` | Lý do tạm đình chỉ | 0.0% | UNMAPPED | UNMAPPED |
| `Noi_luu_tru_bao_quan_ke_bien_phong_toa` | Nơi lưu trữ, bảo quản, kê biên, phong tỏa | 0.0% | UNMAPPED | UNMAPPED |
| `ngay_dang_ky_ho_so` | Ngày đăng ký hồ sơ nghiệp vụ | 0.0% | UNMAPPED | UNMAPPED |
| `ngay_nop_luu_ho_so` | Ngày nộp lưu hồ sơ | 0.0% | UNMAPPED | UNMAPPED |
| `ly_do_ra_quyet_dinh_khong_khoi_to_vu_an` | Lý do ra Quyết định không khởi tố vụ án | 0.0% | UNMAPPED | UNMAPPED |
| `ngay_nhap_vu_an` | Ngày tháng năm nhập vụ án | 0.0% | MAPPED | case.ngayNhapVuAn |
| `ngay_tach_ho_so` | Ngày Quyết định tách hồ sơ | 0.0% | MAPPED | case.ngayTachVuAn |
| `ngay_phuc_hoi_dieu_tra_vu_an` | Ngày Quyết định phục hồi điều tra vụ án | 0.0% | UNMAPPED | UNMAPPED |
| `ngay_ket_luan_dieu_tra` | Ngày Kết luận điều tra vụ án | 0.0% | MAPPED | case.ngayKLDT |
| `can_cu_tam_dinh_chi_vu_an` | Căn cứ tạm đình chỉ vụ án | 0.0% | MAPPED | case.canCuTamDinhChiVuAn |
| `ly_do_tam_dinh_chi_vu_an` | Lý do tạm đình chỉ vụ án | 0.0% | UNMAPPED | UNMAPPED |
| `ngay_quyet_dinh_dieu_tra_lai` | Ngày Quyết định điều tra lại | 0.0% | UNMAPPED | UNMAPPED |
| `ngay_quyet_dinh_dinh_chi_vu_an` | Ngày Quyết định đình chỉ vụ án | 0.0% | UNMAPPED | UNMAPPED |
| `quyet_dinh_tach_hanh_vi` | Số Quyết định tách hành vi | 0.0% | MAPPED | case.soQDTachHanhVi |
| `ngay-quyet-dinh-tach-hanh-vi` | Ngày Quyết định tách hành vi | 0.0% | MAPPED | case.ngayTachHanhVi |
| `xac_nhan_ghi_am_ghi_hinh` | Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `tong_so_bien_ban_ghi_loi_khai` | Tổng số biên bản ghi lời khai | 0.0% | UNMAPPED | UNMAPPED |
| `so_bien_ban_ghi_loi_khai_co_ghi_am_ghi_hinh` | Số lượng biên bản ghi lời khai có ghi âm ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `so_bi_can_co_ghi_am_ghi_hinh` | Số lượng bị can có ghi âm ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `tong_so_bien_ban_hoi_cung_bi_can` | Tổng số biên bản hỏi cung bị can | 0.0% | UNMAPPED | UNMAPPED |
| `tong_so_bien_ban_hoi_cung_co_ghi_am_ghi_hinh` | Tổng số biên bản hỏi cung có ghi âm ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `xac_nhan_vks_yeu_cau_ghi_am_ghi_hinh` | Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `so_luong_bi_can_vks_yeu_cau_ghi_am_ghi_hinh` | Số lượng bị can VKS yêu cầu ghi âm ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `xac_nhan_vu_an_da_duoc_xet_xu` | Xác nhận vụ án đã được xét xử | 0.0% | UNMAPPED | UNMAPPED |
| `so_ban_an_co_hieu_luc` | Số bản án của toàn án có hiệu lực | 0.0% | MAPPED | case.soBanAnCoHieuLuc |
| `ngay_ban_an_co_hieu_luc` | Ngày tháng năm bản án của toà án có hiệu lực | 0.0% | UNMAPPED | UNMAPPED |
| `vu_an_co_su_dung_ket_quả_ghi_am_ghi_hinh_trong_xet_xu` | Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử | 0.0% | UNMAPPED | UNMAPPED |
| `vu_an_khong_gagh_nhung_toa_an_yeu_cau_cung_cap_gagh` | Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `so_doi_tuong` | Số đối tượng phạm tội | 0.0% | MAPPED | caseStatistic.soDoiTuong |
| `so_doi_tuong_da_bat` | Số đối tượng bắt được | 0.0% | MAPPED | caseStatistic.soDoiTuongDaBat |
| `so_doi_tuong_bi_bat_trong_vu_an_khac` | Số đối tượng bị bắt trong vụ án khác | 0.0% | MAPPED | caseStatistic.soDoiTuongBiBatVuAnKhac |
| `dieu_tra_mo_rong` | Điều tra mở rộng | 0.0% | MAPPED | caseStatistic.dieuTraMoRong |
| `su_dung_vu_khi_nong` | Sử dụng vụ khí nóng | 0.0% | MAPPED | caseStatistic.suDungVuKhiNong |
| `so_luong_nguoi_chet` | Số người chết | 0.0% | MAPPED | caseStatistic.soLuongNguoiChet |
| `so_nguoi_bi_thuong` | Số người bị thương | 0.0% | MAPPED | caseStatistic.soNguoiBiThuong |
| `co_bao_nhieu_bang_nhom` | Xác nhận có băng nhóm | 0.0% | UNMAPPED | UNMAPPED |
| `bat_duoc_bao_nhieu_bang_nhom` | Bắt được bao nhiêu băng nhóm | 0.0% | UNMAPPED | UNMAPPED |
| `so_tien_thu_hoi` | Số tiền thu hồi được (triệu Việt Nam Đồng) | 0.0% | MAPPED | caseStatistic.soTienThuHoi |
| `so_luong_sung_thu_hoi` | Số lượng súng thu hồi | 0.0% | MAPPED | caseStatistic.soSungThuHoi |
| `so_luong_thuoc_no_thu_hoi` | Số lượng thuốc nổ thu hồi | 0.0% | UNMAPPED | UNMAPPED |
| `xac_nhan_vu_viec_vphc` | Xác nhận vụ việc có vi phạm hành chính | 0.0% | UNMAPPED | UNMAPPED |
| `so_doi_tuong_vi_pham_hanh_chinh` | Số đối tượng vi phạm hành chính | 0.0% | UNMAPPED | UNMAPPED |
| `so_doi_tuong_suu_tra_hiem_nghi` | Số đối tượng sưu tra/hiềm nghi | 0.0% | UNMAPPED | UNMAPPED |
| `so_luong_nguoi_bi_phat_tien` | Số người bị phạt tiền | 0.0% | UNMAPPED | UNMAPPED |
| `noi_xay_ra_phuong_xa` | Nơi xảy ra (cấp phường/xã) | 0.0% | MAPPED | petition.noiXayRaPhuongXa |
| `xac_dinh_vu_viec_tam_dung_giai_quyet` | Xác định vụ việc này là vụ việc tạm dừng giải quyết (trước năm 2015) | 0.0% | UNMAPPED | UNMAPPED |
| `tong_so_tien_phat_hanh_chinh` | Tổng số tiền phạt hành chính (triệu Việt Nam Đồng) | 0.0% | UNMAPPED | UNMAPPED |
| `xac_nhan_neu_la_vu_an_ghi_am_ghi_hinh` | Xác nhận nếu là Vụ án có sử dụng Ghi âm, Ghi hình | 0.0% | UNMAPPED | UNMAPPED |
| `ghi_am_ghi_hinh_da_duoc_xet_xu` | Xác nhận Trong đó: Số vụ án tiến hành Ghi âm, Ghi hình đã được xét xử | 0.0% | UNMAPPED | UNMAPPED |
| `dieu_tra_vien_phuong_xa` | Điều tra viên là trưởng - phó Công an phường thụ lý | 0.0% | UNMAPPED | UNMAPPED |
