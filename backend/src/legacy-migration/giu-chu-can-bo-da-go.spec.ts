import { giuChuCanBoDaGo } from './legacy-migration.service';

/**
 * Chạy lại di trú KHÔNG được đè lên chữ cán bộ đã gõ.
 *
 * Nhánh cập nhật ghi đè toàn bộ cột đã ánh xạ. Với phần lớn cột thì đó là chủ đích — chạy lại
 * để sửa một lần nạp sai. Nhưng ô nội dung là ô cán bộ sửa nhiều nhất, và sửa xong mà chạy lại
 * di trú thì chữ biến mất, không dấu vết, không ai biết để phục hồi.
 */
describe('giuChuCanBoDaGo — chạy lại di trú không nuốt chữ đã sửa', () => {
  it('ô đích đã có chữ thì bỏ khoá ấy khỏi lần ghi', () => {
    const data: Record<string, unknown> = { detailContent: 'bản cũ', senderName: 'A' };
    giuChuCanBoDaGo(data, { detailContent: 'cán bộ đã sửa' });
    expect(data).toEqual({ senderName: 'A' });
  });

  it('ô đích đang trống thì vẫn điền bình thường', () => {
    const data: Record<string, unknown> = { detailContent: 'bản cũ' };
    giuChuCanBoDaGo(data, { detailContent: null });
    expect(data.detailContent).toBe('bản cũ');
  });

  it('chuỗi toàn khoảng trắng không tính là đã có chữ', () => {
    const data: Record<string, unknown> = { detailContent: 'bản cũ' };
    giuChuCanBoDaGo(data, { detailContent: '   ' });
    expect(data.detailContent).toBe('bản cũ');
  });

  it('giữ cả `summary`, không chỉ `detailContent`', () => {
    const data: Record<string, unknown> = { summary: 'bản cũ' };
    giuChuCanBoDaGo(data, { summary: 'cán bộ đã sửa' });
    expect('summary' in data).toBe(false);
  });

  /**
   * Ô NGÀY cũng phải chắn, không chỉ ô chữ. `receiveDate` là ô form Vụ án ĐÒI, nên nó là ô
   * cán bộ chắc chắn có động vào — và chạy lại di trú thì ngày ấy bị thay bằng ngày suy từ
   * bản thô hệ cũ. Bản đầu của hàm này chỉ nhận `typeof === 'string'` nên ô ngày lọt hết.
   */
  it('ô ngày đã có giá trị thì bỏ khoá ấy khỏi lần ghi', () => {
    const data: Record<string, unknown> = { receiveDate: new Date('2019-03-20') };
    giuChuCanBoDaGo(data, { receiveDate: new Date('2020-01-01') });
    expect('receiveDate' in data).toBe(false);
  });

  it('ô ngày đang trống thì vẫn điền bình thường', () => {
    const data: Record<string, unknown> = { receiveDate: new Date('2019-03-20') };
    giuChuCanBoDaGo(data, { receiveDate: null });
    expect(data.receiveDate).toEqual(new Date('2019-03-20'));
  });

  /** Ngày hỏng không tính là "đã có" — nếu không thì một mốc rác khoá luôn đường sửa. */
  it('ngày hỏng không tính là đã có giá trị', () => {
    const data: Record<string, unknown> = { receiveDate: new Date('2019-03-20') };
    giuChuCanBoDaGo(data, { receiveDate: new Date('khong-phai-ngay') });
    expect(data.receiveDate).toEqual(new Date('2019-03-20'));
  });

  /**
   * Chỉ chắn cho ô vừa được nối dây. Nhánh cập nhật vẫn đè ~50 cột khác theo đúng kiểu này —
   * nợ đã khai, sửa trọn vẹn là việc của một đợt riêng. Ca kiểm này chốt phạm vi ấy để không
   * ai tưởng nhầm rằng chạy lại di trú đã an toàn với mọi cột.
   */
  it('KHÔNG chắn cho cột khác — phạm vi hẹp là cố ý', () => {
    const data: Record<string, unknown> = { senderName: 'bản cũ' };
    giuChuCanBoDaGo(data, { senderName: 'cán bộ đã sửa' });
    expect(data.senderName).toBe('bản cũ');
  });
});
