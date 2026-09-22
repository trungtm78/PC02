import { describe, it, expect, vi } from 'vitest';
import {
  CHEP_NOI_DUNG,
  CHEP_O_HE_CU,
  DAT_LAI_MOC_HO_SO,
  chepSangDonMoi,
} from '../PetitionFormPage/chepSangDonMoi';
import { INITIAL_PETITION_FORM } from '../PetitionFormPage/types';
import type { PetitionFormData } from '../PetitionFormPage/types';
import { today } from '@/lib/dates';
import { PETITION_LEGACY_LAYOUT } from '@/features/petitions/legacy-form-binding';

/**
 * Anh chốt 22/09/2026: "Chép nội dung, đặt lại mốc hồ sơ".
 *
 * Chép đơn bằng danh sách LOẠI TRỪ là bẫy đã đo được trong mã: đặt lại `receivedDate` KHÔNG kéo
 * theo `ngayDeXuat` (`petition-data.builder.ts:112` rơi về `receivedDate` chỉ khi ô rỗng) và
 * KHÔNG kéo theo `deadline` (`petitions.service.ts:695` dùng thẳng giá trị gửi lên, bỏ qua phép
 * tính lại). Chép xong là có một đơn "mới" mang hạn xử lý của đơn cũ — quá hạn từ lúc sinh ra.
 *
 * Nên phân loại theo danh sách CHO PHÉP, và mọi ô của form phải thuộc đúng một nhóm. Thêm ô mới
 * về sau mà quên phân loại thì cổng này ĐỎ — đó là mục đích của nó. Không có cổng này thì mỗi
 * lần thêm ô là một lần chép nhầm mà không ai thấy.
 */
/**
 * BẢNG PHÂN LOẠI MONG ĐỢI — viết Ở ĐÂY, không đọc từ mã.
 *
 * Bản đầu của cổng này dùng `it.each(CHEP_NOI_DUNG)` và `it.each(DAT_LAI_MOC_HO_SO)`, tức lấy
 * tham số từ chính danh sách của mã. Dời một ô từ nhóm này sang nhóm kia thì MỆNH ĐỀ DỜI THEO,
 * và cổng vẫn xanh: nó chứng minh "mã nhất quán với chính nó", không chứng minh "mã phân loại
 * đúng". Lượt soát mô hình ngoài 22/09/2026 dựng đúng đột biến ấy (`soPhieuChuyen` và
 * `soQDPhanCongNguonTin` chuyển sang nhóm chép) và cả 80 mệnh đề vẫn xanh.
 *
 * Nên bảng dưới đây là ĐẶC TẢ do ca kiểm giữ. Đổi luật phân loại thì phải sửa Ở ĐÂY trước, và
 * lúc ấy người sửa buộc phải nhìn thẳng vào câu hỏi "ô này là nội dung hay là việc xử lý?".
 *
 * Luật: nội dung lá đơn và con người trong đơn thì CHÉP; mọi thứ nói về việc xử lý chính lá
 * đơn ấy thì ĐẶT LẠI.
 */
const CHEP_MONG_DOI: readonly string[] = [
  'senderName', 'senderBirthYear', 'senderAddress', 'senderPhone', 'senderEmail',
  'senderIdNumber', 'senderIdIssueDate', 'senderIdIssuePlace', 'senderIsAnonymous',
  'suspectedPerson', 'suspectedAddress',
  'summary', 'detailContent', 'notes', 'ghiChuKhac',
  'priority', 'loaiThongTin', 'nguonDon', 'phanLoaiNguonTin', 'phanLoaiToiPhamLinhVuc',
  'toiDanhBanDau', 'crimeChinhId', 'loaiToiPham', 'phuongThucThuDoan', 'laCongNgheCao',
  'noiXayRa', 'noiXayRaPhuongXa', 'ngayXayRa',
  'soTienBiThietHai', 'soLuongBiHai',
];

describe('CỔNG: bảng phân loại của mã khớp ĐẶC TẢ do ca kiểm giữ', () => {
  it('nhóm CHÉP đúng bằng bảng mong đợi — không thừa, không thiếu', () => {
    expect([...CHEP_NOI_DUNG].sort()).toEqual([...CHEP_MONG_DOI].sort());
  });

  it('nhóm ĐẶT LẠI đúng bằng phần còn lại của form', () => {
    const conLai = (Object.keys(INITIAL_PETITION_FORM) as string[])
      .filter((k) => !CHEP_MONG_DOI.includes(k))
      .sort();
    expect([...DAT_LAI_MOC_HO_SO].sort()).toEqual(conLai);
  });

  it('bảng mong đợi chỉ chứa ô CÓ THẬT trên form', () => {
    expect(CHEP_MONG_DOI.filter((k) => !(k in INITIAL_PETITION_FORM))).toEqual([]);
  });
});

describe('CỔNG: chép đơn phân loại TRỌN ô, không sót ô nào', () => {
  const moiO = Object.keys(INITIAL_PETITION_FORM) as (keyof PetitionFormData)[];

  it('mọi ô của form thuộc ĐÚNG MỘT nhóm — không sót, không trùng', () => {
    const chep = new Set<string>(CHEP_NOI_DUNG);
    const datLai = new Set<string>(DAT_LAI_MOC_HO_SO);

    const soT = moiO.filter((k) => !chep.has(k) && !datLai.has(k));
    expect(soT, `ô chưa phân loại — quyết định chép hay đặt lại rồi khai vào chepSangDonMoi.ts`).toEqual([]);

    const trung = moiO.filter((k) => chep.has(k) && datLai.has(k));
    expect(trung, 'ô nằm cả hai nhóm — luật mâu thuẫn').toEqual([]);

    const la = [...chep, ...datLai].filter((k) => !(k in INITIAL_PETITION_FORM));
    expect(la, 'khai một ô không còn tồn tại trên form').toEqual([]);
  });

  it('nhóm nào cũng phải có ô — cổng rỗng chẳng khẳng định được gì', () => {
    expect(CHEP_NOI_DUNG.length).toBeGreaterThan(10);
    expect(DAT_LAI_MOC_HO_SO.length).toBeGreaterThan(10);
  });
});

/**
 * Hồ sơ nguồn: MỌI ô mang một giá trị KHÁC giá trị của đơn mới.
 *
 * Bản đầu chỉ điền ~20 ô và để phần còn lại ở giá trị khởi tạo. Lượt soát mô hình ngoài
 * 22/09/2026 chứng minh cổng khi ấy rỗng ở phần lớn diện tích: sửa mã cho `soPhieuChuyen` và
 * `soQDPhanCongNguonTin` ĐƯỢC CHÉP sang, cả 77 mệnh đề vẫn xanh — vì ô nguồn và ô đặt-lại
 * trùng nhau nên "chép" và "đặt lại" không phân biệt được.
 *
 * Nên dựng nguồn theo KIỂU của từng ô, phủ trọn: chuỗi thành một chuỗi lạ, boolean thì đảo.
 */
function nguonKhacHoanToan(): PetitionFormData {
  const n = { ...INITIAL_PETITION_FORM };
  for (const k of Object.keys(n) as (keyof PetitionFormData)[]) {
    const v = n[k];
    if (k === 'legacyExtra') continue;
    if (typeof v === 'boolean') Object.assign(n, { [k]: !v });
    else Object.assign(n, { [k]: `CU-${String(k)}` });
  }
  n.legacyExtra = Object.fromEntries(
    O_HE_CU_CUA_DON_THU().map((k) => [k, `CU-${k}`]),
  );
  return n;
}

/** Mọi ô hệ cũ rơi vào `legacyExtra`, suy từ bố cục — không chép tay 137 tên. */
function O_HE_CU_CUA_DON_THU(): string[] {
  const ra = new Set<string>();
  for (const muc of Object.values(PETITION_LEGACY_LAYOUT))
    for (const o of muc)
      if (o.field.startsWith('legacyExtra.')) ra.add(o.field.slice('legacyExtra.'.length));
  return [...ra];
}

describe('CỔNG: chép đơn giữ nội dung, đặt lại mốc hồ sơ', () => {
  const NGUON = nguonKhacHoanToan();
  /*
    ẢNH CHỤP nguồn TRƯỚC khi gọi, và ĐÓNG BĂNG nguồn.

    Bản trước so `MOI[k]` với `NGUON[k]` đọc SAU lời gọi. Hàm chép mà tiện tay xoá một ô của
    nguồn thì cả hai cùng rỗng và mọi kỳ vọng "đi theo nguồn đã hỏng" — lượt soát mô hình ngoài
    22/09/2026 dựng đúng đột biến ấy (`nguon.senderName = ''` ngay trước vòng chép) và cổng vẫn
    xanh. Ảnh chụp là mốc CỐ ĐỊNH, còn đóng băng làm phép sửa nguồn ném ngay ở chế độ nghiêm.
  */
  const NGUON_GOC: PetitionFormData = structuredClone(NGUON);
  Object.freeze(NGUON);
  Object.freeze(NGUON.legacyExtra);
  const MOI = chepSangDonMoi(NGUON);

  it.each(CHEP_NOI_DUNG)('ô nội dung "%s" được chép nguyên', (k) => {
    expect(MOI[k]).toEqual(NGUON_GOC[k]);
  });

  it.each(DAT_LAI_MOC_HO_SO)('ô mốc hồ sơ "%s" trở về giá trị của đơn mới', (k) => {
    expect(MOI[k]).toEqual(INITIAL_PETITION_FORM[k]);
  });

  it('mốc thời gian của đơn mới là HÔM NAY, không phải ngày của đơn cũ', () => {
    expect(MOI.receivedDate).toBe(today());
    expect(MOI.ngayDeXuat, 'ngayDeXuat giữ ngày cũ là bộ lọc theo kỳ chỉ sai một chỗ').toBe(today());
    expect(MOI.ngayTiepNhanNguonTin).toBe(today());
  });

  /**
   * `INITIAL_PETITION_FORM` là hằng MÔ-ĐUN: `today()` trong nó chạy một lần lúc nạp tệp. Cán bộ
   * để tab qua đêm rồi chép đơn thì đơn mới mang ngày hôm qua, và `useFormDefaults` không cứu
   * được vì nó chỉ điền khi ô còn rỗng.
   */
  it('để tab qua đêm: ngày vẫn là HÔM NAY lúc bấm, không phải lúc mở trang', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2027-03-04T09:00:00+07:00'));
      const sau = chepSangDonMoi(nguonKhacHoanToan());
      expect(sau.receivedDate).toBe('2027-03-04');
      expect(sau.ngayDeXuat).toBe('2027-03-04');
      expect(sau.ngayTiepNhanNguonTin).toBe('2027-03-04');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hạn xử lý để TRỐNG để máy chủ tính lại — chép hạn cũ là đơn mới đã quá hạn', () => {
    expect(MOI.deadline).toBe('');
    expect(MOI.thoiHanUTDT).toBe('');
  });

  it('mã hồ sơ KHÔNG chép — số tiếp nhận do máy cấp', () => {
    expect(MOI.stt).toBe('');
    expect(MOI.sttCu).toBe('');
  });

  it('quyết định XỬ LÝ của đơn cũ không theo sang đơn mới', () => {
    expect(MOI.ketQuaXuLyKhac).toBe('');
    expect(MOI.raSoatTrung).toBe(INITIAL_PETITION_FORM.raSoatTrung);
    expect(MOI.baoCaoBanGiamDocText).toBe(INITIAL_PETITION_FORM.baoCaoBanGiamDocText);
    expect(MOI.donViGiaiQuyet).toBe('');
    expect(MOI.assignedToId).toBe('');
  });

  /**
   * 137 ô hệ cũ của `legacyExtra` — không ô nào là nội dung lá đơn, toàn quyết định và thống kê
   * của việc xử lý một hồ sơ cụ thể ("Quyết định Không khởi tố", "Nhập vào vụ việc hồ sơ khác",
   * "Số hồ sơ lưu"). Chép cả thùng chứa là kéo theo 137 quyết định không ai đọc.
   */
  it('ô hệ cũ: chỉ những khoá ĐÃ KHAI mới được chép, phần còn lại biến mất', () => {
    const coSan = O_HE_CU_CUA_DON_THU();
    // Đo 22/09/2026: 137 lần xuất hiện trên 10 tab, 88 tên khoá khác nhau.
    expect(coSan.length, 'bố cục không sinh ô hệ cũ nào — bộ dò hỏng').toBeGreaterThan(80);
    expect(Object.keys(MOI.legacyExtra).sort()).toEqual([...CHEP_O_HE_CU].sort());
    for (const k of CHEP_O_HE_CU) expect(MOI.legacyExtra[k]).toBe(NGUON_GOC.legacyExtra[k]);
  });

  it('khai chép ô hệ cũ KHÔNG được có tên lạ', () => {
    const coSan = new Set(O_HE_CU_CUA_DON_THU());
    expect(CHEP_O_HE_CU.filter((k) => !coSan.has(k))).toEqual([]);
  });

  it('ô hệ cũ là một đối tượng MỚI, không dùng chung tham chiếu', () => {
    expect(
      MOI.legacyExtra,
      'dùng chung tham chiếu thì sửa đơn mới là sửa cả đơn cũ trên màn',
    ).not.toBe(NGUON.legacyExtra);
  });

  it('không làm thay đổi hồ sơ nguồn — so TRỌN, không so vài ô', () => {
    expect(
      NGUON,
      'hàm chép sửa vào hồ sơ nguồn: đơn đang mở trên màn bị đổi theo',
    ).toEqual(NGUON_GOC);
  });
});
