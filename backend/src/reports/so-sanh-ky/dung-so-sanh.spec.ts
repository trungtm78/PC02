import { dungSoSanh } from './dung-so-sanh';
import { kyThang, kyNam } from './ky-bao-cao';

/** Bộ đếm giả: trả số cố định, và ghi lại nó được hỏi khoảng nào. */
function boDemGia(tra: Record<string, number>) {
  const daHoi: Array<[Date, Date]> = [];
  const dem = async (tu: Date, den: Date) => {
    daHoi.push([tu, den]);
    return tra;
  };
  return { dem, daHoi };
}

const NGAY = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('dungSoSanh — chọn đúng kỳ nền', () => {
  it('mặc định hỏi CÙNG KỲ NĂM TRƯỚC, không phải tháng trước', async () => {
    const { dem, daHoi } = boDemGia({ donThu: 100 });
    // Mốc sau khi tháng 8/2026 đã đóng → kỳ trọn.
    await dungSoSanh(kyThang(2026, 8), dem, { donThu: 120 }, undefined, new Date(2026, 8, 15));
    expect(daHoi).toHaveLength(1);
    expect([NGAY(daHoi[0][0]), NGAY(daHoi[0][1])]).toEqual(['2025-08-01', '2025-08-31']);
  });

  it('chọn KY_LIEN_TRUOC thì hỏi tháng 7 cùng năm', async () => {
    const { dem, daHoi } = boDemGia({ donThu: 100 });
    await dungSoSanh(
      kyThang(2026, 8),
      dem,
      { donThu: 120 },
      'KY_LIEN_TRUOC',
      new Date(2026, 8, 15),
    );
    expect([NGAY(daHoi[0][0]), NGAY(daHoi[0][1])]).toEqual(['2026-07-01', '2026-07-31']);
  });

  it('chọn KHONG thì KHÔNG hỏi máy chủ lần nào, và mọi kết quả đều rỗng chứ không phải 0', async () => {
    const { dem, daHoi } = boDemGia({ donThu: 100 });
    const kq = await dungSoSanh(kyThang(2026, 8), dem, { donThu: 120 }, 'KHONG');
    expect(daHoi).toHaveLength(0);
    expect(kq.nen).toBeNull();
    expect(kq.chiTieu.donThu.tyLe).toBeNull();
    expect(kq.chiTieu.donThu.chenhLech).toBeNull();
    expect(kq.chiTieu.donThu.hienTai).toBe(120);
  });
});

describe('dungSoSanh — kỳ chưa trọn', () => {
  it('đang ngày 10/8 thì nền BỊ CẮT còn 10 ngày đầu tháng 8 năm trước', async () => {
    const { dem, daHoi } = boDemGia({ donThu: 40 });
    const kq = await dungSoSanh(
      kyThang(2026, 8),
      dem,
      { donThu: 45 },
      undefined,
      new Date(2026, 7, 10, 14),
    );
    expect([NGAY(daHoi[0][0]), NGAY(daHoi[0][1])]).toEqual(['2025-08-01', '2025-08-10']);
    expect(kq.kyChuaTron).toBe(true);
    expect(kq.soNgayDaTroi).toBe(10);
    expect(kq.nen!.nhan).toBe('tháng 8/2025 (10 ngày đầu)');
  });

  /**
   * Đây là ca chứng minh phép cắt có giá trị thật, không phải trang trí: KHÔNG cắt thì tháng
   * nào cũng "giảm" chỉ vì kỳ này mới chạy được một phần ba.
   */
  it('không cắt thì kết luận ngược dấu — cắt rồi mới đọc đúng', async () => {
    // Tháng 8 năm ngoái: 10 ngày đầu có 40, cả tháng có 130.
    const dem = async (tu: Date, den: Date) => ({ donThu: NGAY(den) === '2025-08-10' ? 40 : 130 });
    const catDung = await dungSoSanh(
      kyThang(2026, 8),
      dem,
      { donThu: 45 },
      undefined,
      new Date(2026, 7, 10, 14),
    );
    // Cắt đúng: 45 so với 40 → TĂNG.
    expect(catDung.chiTieu.donThu.chieu).toBe('TANG');
    // Nếu đem so với cả tháng (130) thì ra GIẢM 65% — kết luận sai, và sai theo hướng nghe êm tai.
    const neuKhongCat = 45 - 130;
    expect(neuKhongCat).toBeLessThan(0);
  });

  it('kỳ đã đóng thì nền không bị cắt', async () => {
    const { dem, daHoi } = boDemGia({ donThu: 100 });
    const kq = await dungSoSanh(
      kyThang(2026, 7),
      dem,
      { donThu: 120 },
      undefined,
      new Date(2026, 7, 10),
    );
    expect(kq.kyChuaTron).toBe(false);
    expect(kq.soNgayDaTroi).toBeNull();
    expect([NGAY(daHoi[0][0]), NGAY(daHoi[0][1])]).toEqual(['2025-07-01', '2025-07-31']);
    expect(kq.nen!.nhan).toBe('tháng 7/2025');
  });
});

describe('dungSoSanh — chiều tốt/xấu đi theo chỉ tiêu', () => {
  it('cùng một dấu trừ, hai nghĩa trái nhau', async () => {
    const dem = async () => ({ quaHan: 50, daGiaiQuyet: 50 });
    const kq = await dungSoSanh(
      kyNam(2026),
      dem,
      { quaHan: 30, daGiaiQuyet: 30 },
      undefined,
      new Date(2027, 0, 5),
    );
    expect(kq.chiTieu.quaHan.tot).toBe(true); // quá hạn giảm → tốt
    expect(kq.chiTieu.daGiaiQuyet.tot).toBe(false); // đã giải quyết giảm → xấu
  });

  it('chỉ tiêu trung tính không bị gán tốt/xấu', async () => {
    const dem = async () => ({ donThu: 50 });
    const kq = await dungSoSanh(
      kyNam(2026),
      dem,
      { donThu: 90 },
      undefined,
      new Date(2027, 0, 5),
    );
    expect(kq.chiTieu.donThu.chieu).toBe('TANG');
    expect(kq.chiTieu.donThu.tot).toBeNull();
  });
});

describe('dungSoSanh — chỉ tiêu thiếu ở kỳ nền', () => {
  it('nền không có khoá ấy thì coi là 0, không đổ vỡ', async () => {
    const dem = async () => ({});
    const kq = await dungSoSanh(kyNam(2026), dem, { donThu: 7 }, undefined, new Date(2027, 0, 5));
    expect(kq.chiTieu.donThu.nen).toBe(0);
    expect(kq.chiTieu.donThu.lyDoKhongCoTyLe).toBe('NEN_BANG_KHONG');
  });
});

describe('dungSoSanh — kỳ nằm ở TƯƠNG LAI', () => {
  /**
   * Codex bắt. API cho phép hỏi tháng 12 khi mới tháng 8. Kỳ ấy chưa trôi ngày nào, nhưng phép
   * cắt cũ đặt `den = tu` — và bộ lọc Prisma dùng `gte`/`lte` nên vẫn ĐẾM ĐƯỢC bản ghi ở đúng
   * thời khắc 00:00:00.000 ngày đầu kỳ nền. Kết quả: một kỳ chưa bắt đầu vẫn có nền khác 0 và
   * vẫn ra chênh lệch — một con số hoàn toàn vô nghĩa, trình bày y như số thật.
   *
   * Câu trả lời đúng không phải "cắt cho nhỏ lại" mà là "KHÔNG CÓ NỀN": chưa có ngày nào trôi
   * thì không có gì để so.
   */
  it('kỳ chưa bắt đầu thì KHÔNG hỏi kỳ nền, và không đưa ra chênh lệch nào', async () => {
    const { dem, daHoi } = boDemGia({ donThu: 999 });
    const kq = await dungSoSanh(
      kyThang(2026, 12),
      dem,
      { donThu: 0 },
      undefined,
      new Date(2026, 7, 15),
    );
    expect(daHoi).toHaveLength(0);
    expect(kq.nen).toBeNull();
    expect(kq.chiTieu.donThu.chenhLech).toBeNull();
    expect(kq.chiTieu.donThu.lyDoKhongCoTyLe).toBe('KHONG_CO_NEN');
  });

  it('ngày ĐẦU TIÊN của kỳ thì đã có nền — ranh giới không lệch một ngày', async () => {
    const { dem, daHoi } = boDemGia({ donThu: 5 });
    const kq = await dungSoSanh(
      kyThang(2026, 8),
      dem,
      { donThu: 2 },
      undefined,
      new Date(2026, 7, 1, 0, 30),
    );
    expect(daHoi).toHaveLength(1);
    expect(kq.soNgayDaTroi).toBe(1);
    expect(kq.nen).not.toBeNull();
  });
});
