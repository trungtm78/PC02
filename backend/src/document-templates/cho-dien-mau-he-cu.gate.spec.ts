import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { khoaTheoTenHeCu, KHOA_HE_CU_NGOAI_PARITY, cotInTheoTruongHeCu } from './khoa-he-cu';
import { KIEU_TRUONG_HE_CU } from './kieu-truong-he-cu.generated';
import { thuMucMauHeCu } from '../../prisma/seed-legacy-templates';

/**
 * Mọi chỗ điền của 11 mẫu hệ cũ phải được KHAI ở đâu đó.
 *
 * ── Vì sao cần cổng này ──
 *
 * Bộ tra giá trị quyết định định dạng theo `KIEU_TRUONG_HE_CU`. Một chỗ điền không có trong
 * bảng ấy thì rơi về luật dự phòng, và luật dự phòng đã sai một lần rồi: bốn trường `ngay_*`
 * bị chuẩn hoá thành ngày trong khi hệ cũ in nguyên văn, làm 4.447 hồ sơ in ra TRỐNG.
 *
 * Hỏng kiểu ấy im lặng — bản in vẫn ra, chỉ là ra sai. Nên cổng này bắt buộc mỗi chỗ điền phải
 * nằm trong một trong bốn nhóm đã khai, kèm lý do. Thêm mẫu mới hay sửa mẫu cũ mà quên phân
 * loại là đỏ ngay, chứ không phải phát hiện qua văn bản đã gửi đi.
 *
 * Cổng chạy được ở CI: nó chỉ đọc tệp `.docx` trong kho, không cần bản sao CSDL hệ cũ.
 */

/**
 * Chỗ điền mà hệ cũ KHÔNG lấy từ bản ghi hồ sơ, nên chúng không có trong `TruongTuyChinh`.
 *
 * `stt`/`ngay`/`thang`/`nam` là bốn trường hệ thống của bản ghi (55.066/55.067 hồ sơ đều có).
 * `nguoi_nhan`/`ten_ngan` thì hệ cũ tra sang bảng `thanh_vien` rồi `setValue` riêng ở cuối
 * `xuatfile.php` — không hồ sơ nào giữ hai khoá ấy (đo 28/08/2026: 0/55.067).
 */
const KHOA_HE_THONG = ['stt', 'ngay', 'thang', 'nam', 'nguoi_nhan', 'ten_ngan'];

/**
 * Chỗ điền mà CHÍNH HỆ CŨ cũng không thay được — bản ghi không hề có khoá ấy.
 *
 * Đo 28/08/2026 trên 55.067 hồ sơ: cả 17 khoá dưới đây đều 0 bản ghi có khoá. PhpWord chỉ thay
 * những khoá được `setValue`, nên hệ cũ in ra NGUYÊN CHỮ `${bi_can}`, `${yeu_cau}`… trên văn
 * bản gửi đi. Bản in thật của hồ sơ 85651 (`docs/uat/in-nhu-he-cu/ban-in-he-cu/`) có đúng dòng
 * `${yeu_cau_bo_sung}` nằm giữa văn bản — chứng cứ tận mắt.
 *
 * Hệ mới để trống thay vì in mã biến. Đây là chỗ hệ mới CỐ Ý khác hệ cũ: in `${bi_can}` lên
 * văn bản chính thức là lỗi của hệ cũ, không phải đặc tả cần chép lại. Ghi ra đây để khác biệt
 * ấy là một quyết định có tên, không phải một chỗ sót.
 *
 * Riêng `' nguon_don'` (thừa một dấu cách đầu) là lỗi đánh máy trong `tra_ho_so_mau.docx`: hệ
 * cũ gọi `setValue('nguon_don')` nên ô có dấu cách không bao giờ được thay.
 *
 * Chín khoá cuối chỉ nằm trong `so_dang_ky_bao_chua.docx` — mẫu MỒ CÔI, không `loai` nào trỏ
 * tới nên hệ cũ chưa từng in nó lần nào.
 */
const KHOA_HE_CU_CUNG_BO_TRONG = [
  ' nguon_don',
  'bi_can',
  'don_vi',
  'lanh_dao_phu_trach',
  'toi_danh',
  'vks_tra',
  'yeu_cau',
  'dia_chi',
  'giay_yeu_cau',
  'hktt',
  'ho_ten',
  'ho_ten_ls',
  'nam_sinh',
  'ten_vu',
  'the_ls',
  'thong_bao_dang_ky',
  'thong_bao_thay_doi',
  'thong_bao_tu_choi',
];

function choDienCuaMau(file: string): string[] {
  const zip = new PizZip(fs.readFileSync(file));
  let xml = '';
  for (const ten of Object.keys(zip.files)) {
    if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(ten)) xml += zip.files[ten].asText();
  }
  const chu = xml.replace(/<[^>]+>/g, '');
  return [...new Set([...chu.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]))];
}

describe('Cổng: mọi chỗ điền của mẫu hệ cũ đều đã được phân loại', () => {
  const dir = thuMucMauHeCu();
  const mau = fs.readdirSync(dir).filter((f) => f.endsWith('.docx'));

  /** Khai đủ ba thực thể: một khoá có thể chỉ tồn tại ở Vụ án mà không ở Đơn thư. */
  const daKhai = new Set<string>([
    ...Object.keys(KIEU_TRUONG_HE_CU),
    ...KHOA_HE_CU_NGOAI_PARITY.map((k) => k.key),
    ...khoaTheoTenHeCu('petition').map((k) => k.key),
    ...khoaTheoTenHeCu('incident').map((k) => k.key),
    ...khoaTheoTenHeCu('case').map((k) => k.key),
    ...KHOA_HE_THONG,
    ...KHOA_HE_CU_CUNG_BO_TRONG,
  ]);

  /** Tập chỗ điền THẬT SỰ có trên 11 mẫu — dùng để không canh những khoá mẫu không dùng. */
  const choDienDaDung = new Set<string>(
    mau.flatMap((ten) => choDienCuaMau(path.join(dir, ten))),
  );

  it('kho có đủ 11 mẫu hệ cũ', () => {
    expect(mau).toHaveLength(11);
  });

  it.each(mau)('%s — không chỗ điền nào chưa phân loại', (ten) => {
    const chuaKhai = choDienCuaMau(path.join(dir, ten)).filter((k) => !daKhai.has(k));
    expect(chuaKhai).toEqual([]);
  });

  /**
   * Danh sách "hệ cũ cũng bỏ trống" chỉ được co lại, không được phình ra một cách im lặng.
   * Nó phình ra nghĩa là có mẫu mới mang chỗ điền chưa ai nối vào dữ liệu — và bản in sẽ ra
   * trống mà không ai biết.
   */
  it('danh sách khoá hệ cũ bỏ trống không phình thêm', () => {
    expect(KHOA_HE_CU_CUNG_BO_TRONG).toHaveLength(18);
  });

  /**
   * KHÔNG chỗ điền nào được tra qua cột đúng/sai.
   *
   * Cột `Boolean` chỉ còn hai giá trị, nên in ra `Có`/`Không` thay cho câu cán bộ đã ghi. Với ô
   * lệch vai (hệ cũ khai chữ) thì bộ tra lấy bản thô trước, nhưng hồ sơ TẠO TRÊN HỆ MỚI không
   * có bản thô — lúc ấy chỉ còn cột, và nếu cột ấy là đúng/sai thì nội dung mất hẳn.
   *
   * Đã xảy ra với `truong_hop_bao_cao_ban_giam_doc`: nó đổ vào hai cột, và ở Vụ việc lẫn Vụ án
   * thì cột đúng/sai đứng trước nên bảng khoá lấy nhầm. Cổng này canh cho cả các trường sau.
   */
  it.each(['petition', 'incident', 'case'] as const)(
    '%s — không chỗ điền nào tra qua cột đúng/sai',
    (thucThe) => {
      const dungSai = [...cotInTheoTruongHeCu(thucThe).entries()]
        .filter(([truong]) => choDienDaDung.has(truong))
        .filter(([, cot]) => cot.type === 'Boolean')
        .map(([truong, cot]) => `${truong} → ${cot.col}`);
      expect(dungSai).toEqual([]);
    },
  );

  /**
   * Bốn trường `ngay_*` mà hệ cũ khai là CHỮ. Cổng ghim chúng lại vì đây là chỗ đã sai một lần:
   * dùng kiểu cột của hệ mới (`DateTime`) để in là chuẩn hoá mất thứ cán bộ gõ.
   */
  it.each([
    'ngay_phieu_chuyen',
    'ngay_tiep_nhan_nguon_tin',
    'ngay_viet_don',
    'ngay_cap_cccd_nguyen_don',
  ])('`%s` phải giữ kiểu chữ của hệ cũ', (truong) => {
    expect(KIEU_TRUONG_HE_CU[truong]).toBe('text');
  });
});
