import { KHAI_TIM_KIEM_DON_THU } from '../khai/don-thu.khai';
import { sinhCauNapCotBong, sinhCauNapHoTen } from './sinh-tim-kiem';

/**
 * Câu SQL nạp cột bóng cho dữ liệu CŨ — chạy theo lô sau deploy thay vì trong migration (đo
 * 15/09/2026: UPDATE 47.169 đơn thư trong migration khoá bảng ~50 giây).
 *
 * Sinh từ CÙNG tệp khai với trigger: một biểu thức ở hai nơi viết tay là hai nơi trôi khỏi nhau,
 * và cột bóng nạp bằng công thức khác trigger thì dòng cũ tìm ra kết quả khác dòng mới.
 *
 * Đi theo CON TRỎ id chứ không "lấy 1.000 dòng lệch đầu tiên": chạy thật trên bản sao 47.169 đơn
 * thư, cách sau mất ~15 s mỗi lô vì lô thứ k phải đi qua lại k×1.000 dòng đã sửa (tổng bình
 * phương). Con trỏ đi qua mỗi dòng đúng một lần.
 */
describe('sinhCauNapCotBong', () => {
  const { dem, layLo, nap, chuaNap, lechMau } = sinhCauNapCotBong(
    KHAI_TIM_KIEM_DON_THU,
  );
  const lech = `"sender_name_bd" IS DISTINCT FROM ' ' || f_bo_dau("senderName")`;

  it('biểu thức cột bóng giống hệt trigger, nhưng trên cột của dòng (không NEW.)', () => {
    expect(nap).toContain(`"sender_name_bd" = ' ' || f_bo_dau("senderName")`);
    expect(nap).toContain(
      `"tim_kiem_bd" = ' ' || f_bo_dau(concat_ws(' ', "stt", "sttCu", "nguonDon", "senderName", "detailContent", "donViGiaiQuyet", "ketQuaXuLyKhac", "suspectedPerson", "soHoSoCu"))`,
    );
    expect(nap).not.toContain('NEW.');
  });

  it('đếm dòng lệch trên cả bảng (chạy thử + kiểm sau khi nạp)', () => {
    expect(dem).toMatch(
      /^SELECT count\(\*\)::int AS n FROM "petitions" WHERE /,
    );
    expect(dem).toContain(lech);
  });

  /**
   * Kiểm lúc deploy: câu `dem` tính lại f_bo_dau trên MỌI dòng — đo prod 19/09/2026 mất 1 phút 47 giây
   * cho 15 bảng. Deploy chỉ cần biết "còn dòng CHƯA TỪNG nạp không": cột bóng NULL.
   * Biểu thức cột bóng không bao giờ NULL (f_bo_dau(NULL) = '' → dòng đã nạp mang ít nhất ' '), nên cột
   * bóng NULL đúng nghĩa "chưa từng nạp" — CÙNG tập mà `dem` đếm, không cần tính lại f_bo_dau.
   */
  it('chưa nạp: cột bóng NULL ở BẤT KỲ cột nào, không tính f_bo_dau, dừng ở dòng đầu tìm thấy', () => {
    expect(chuaNap).toMatch(
      /^SELECT EXISTS \(SELECT 1 FROM "petitions" WHERE .* LIMIT 1\) AS co$/,
    );
    expect(chuaNap).toContain('"sender_name_bd" IS NULL OR ');
    expect(chuaNap).toContain('"tim_kiem_bd" IS NULL LIMIT 1');
    expect(chuaNap).not.toContain('f_bo_dau');
    expect(chuaNap).not.toContain('IS DISTINCT FROM');
  });

  /**
   * Rà độc lập 19/09/2026: đổi biểu thức cột bóng ĐÃ CÓ mà không thêm cột → dòng cũ khác NULL nhưng sai;
   * `chuaNap` không thấy. Mẫu 200 dòng CŨ NHẤT (id cuid tăng theo thời gian — dòng không ai sửa sau
   * migration) so ĐỦ biểu thức như `dem`: rẻ mà lộ đúng lớp hỏng ấy.
   */
  it('lệch mẫu: so đủ biểu thức trên 200 dòng cũ nhất, dừng ở dòng đầu lệch', () => {
    const dieuKien = dem.slice(dem.indexOf(' WHERE ') + ' WHERE '.length);
    expect(lechMau).toBe(
      `SELECT EXISTS (SELECT 1 FROM (SELECT * FROM "petitions" ORDER BY id LIMIT 200) m WHERE ${dieuKien} LIMIT 1) AS co`,
    );
    expect(lechMau).toContain(lech);
  });

  it('lấy lô theo con trỏ id: id > $1, sắp theo id, giới hạn $2', () => {
    expect(layLo).toBe(
      'SELECT id FROM "petitions" WHERE id > $1 ORDER BY id LIMIT $2',
    );
  });

  /** Chỉ ghi dòng LỆCH trong lô → chạy lại ra 0 ghi, không đụng dòng đã đúng. */
  it('nạp đúng các id của lô VÀ chỉ dòng lệch', () => {
    expect(nap).toMatch(/^UPDATE "petitions" SET /);
    expect(nap).toContain(' WHERE id = ANY($1::text[]) AND (');
    expect(nap.slice(nap.indexOf(' AND ('))).toContain(lech);
    expect(nap.endsWith(')')).toBe(true);
  });

  /**
   * Không SET cột nguồn: `UPDATE OF "stt"` sẽ kích trigger sttSort và trigger tìm kiếm tính lại
   * mọi cột — ghi thừa trên cả bảng. Không đụng `updatedAt`: danh sách "sửa gần đây" không ngập.
   */
  it('chỉ SET cột bóng — không SET cột nguồn, không đụng updatedAt', () => {
    const phanSet = nap.slice(nap.indexOf(' SET ') + 5, nap.indexOf(' WHERE '));
    const cotBiSet = [...phanSet.matchAll(/"([a-z_]+)" = /g)].map((m) => m[1]);
    expect(cotBiSet).toEqual([
      'nguon_don_bd',
      'sender_name_bd',
      'detail_content_bd',
      'don_vi_giai_quyet_bd',
      'ket_qua_xu_ly_khac_bd',
      'suspected_person_bd',
      'tim_kiem_bd',
    ]);
    expect(nap).not.toMatch(/updatedAt/);
  });
});

describe('sinhCauNapHoTen', () => {
  it('nạp ho_ten_bd của users bằng CÙNG biểu thức trigger, theo con trỏ id', () => {
    const { dem, layLo, nap } = sinhCauNapHoTen();
    expect(nap).toContain(
      `UPDATE "users" SET "ho_ten_bd" = ' ' || f_bo_dau(concat_ws(' ', "lastName", "firstName", "username"))`,
    );
    expect(dem).toContain(`"ho_ten_bd" IS DISTINCT FROM`);
    expect(layLo).toBe(
      'SELECT id FROM "users" WHERE id > $1 ORDER BY id LIMIT $2',
    );
    expect(nap).toContain('WHERE id = ANY($1::text[]) AND (');
  });
});
