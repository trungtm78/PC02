# Đối soát di trú legacy pc02hcm.com (Mongo live `pc02` → hệ mới)

> Sinh từ `mongo-export.ts` + query live (read-only). Dữ liệu thô để NGOÀI git.

## 1. Export live (số doc thật trên server cũ)

| Collection | Doc | Ghi chú |
|---|---|---|
| ho_so_doi_1 | 54.257 | Hồ sơ án chính (đội 1), chỉ 4 đã xoá |
| ho_so | 4 | Schema mới 2026 (mẫu) |
| **bi_can** | **0** | ⚠️ **RỖNG ngay trên LIVE** — không có bị can có cấu trúc |
| LogNghiepVuBiCan | 0 | rỗng |
| TruongTuyChinh | 176 | Định nghĩa field động (nguồn nhãn/kiểu/enum) |
| NgonNgu | 746 | Nhãn + giá trị enum |
| ToiDanh | 322 | Danh mục tội danh |
| NghiepVu / NghiepVuBiCan | 57 / 12 | Máy trạng thái |
| chi_nhanh / thanh_vien | 208 / 238 | Đơn vị / cán bộ |
| TamDinhChi_vu_viec_21 | 118 | (15, 9 rỗng) |

## 2. Phân rã `ho_so_doi_1` theo `phan_loai_nguon_tin_ban_dau` (chưa xoá)

| Phân loại | Số | → Thực thể mới |
|---|---|---|
| don-cong-van-ban-dau | 45.819 | Petition (đơn thư) |
| vu-viec-ban-dau + vu-viec-nguon-tin | 3.484 + 986 | Incident (vụ việc) |
| uy-thac-dieu-tra | 1.634 | Case (ủy thác) |
| vu-an-ban-dau | 1.235 | Case (vụ án) |
| huong-dan | 539 | GuidanceRecord |
| luat-su | 247 | Lawyer |
| trao-doi-chuyen-an | 76 | Exchange |
| kien-nghi-vks | 33 | Proposal |
| tra-ho-so-ban-dau | 4 | Case (defer) |

## 3. So nguồn ↔ DB mới hiện tại (local)

| Thực thể | Nguồn live | DB mới (di trú) | Độ phủ |
|---|---|---|---|
| petitions | ~45.819 | 45.459 | ~99,2% |
| cases | ~3.660 (vụ án+ủy thác+tra hồ sơ+phường xã) | 3.283 | ~90% |
| incidents | ~4.470 | 4.713 | đủ |

**Kết luận coverage:** ~53k/54k ≈ **98,5% bản ghi ĐÃ di trú**. Vấn đề KHÔNG phải thiếu bản ghi.

## 4. Hai đính chính quan trọng (đo được, không suy đoán)

1. **`bi_can` RỖNG cả trên LIVE** + `ho_so_doi_1` không có mảng đối tượng nhúng. Dữ liệu nghi can/bị hại CHỈ nằm ở trường tự do `nghi_van_doi_tuong` (vd `"Lương Huỳnh Vũ (SN: 1988)"`) + `dia-chi-bi-hai`/`so_luong_bi_hai`. → Không có nguồn bị can có cấu trúc; bóc từ text là cách DUY NHẤT (cách hiện tại đúng).
2. **Coverage bản ghi tốt** → "không chính xác" là **lỗi FIELD-LEVEL** (mapping hardcode ~90 key + đoán enum + lệch nhãn), KHÔNG phải mất bản ghi.

## 5. Hệ quả cho kế hoạch

- **Giá trị chính** = re-map field **data-driven** từ `TruongTuyChinh`(176) + `NgonNgu`(746): đúng nhãn/kiểu/enum cho từng field của `ho_so`.
- **Truy nguyên** (soHoSoCu/legacyId) — giữ nguyên yêu cầu.
- **Bỏ** bước "bi_can → Subject" (nguồn rỗng); giữ bóc text `nghi_van_doi_tuong` (cải tiến ở PR-1 nếu cần).
- Re-migrate có thể là **UPDATE field theo legacySourceId** thay vì wipe toàn bộ (coverage đã tốt) — quyết ở PR-3/4.
