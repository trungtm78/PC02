import { classifyUnitValue, groupRawValues, extractHinhSuArea } from './unit-alias';
import { teamMatchKey } from './org-mapper';

// Tập tổ giả lập đúng như sau khi sinh cây Tổ/Nhóm từ dữ liệu cũ.
const TEAMS = new Set(
  ['Đội 3', 'Đội 4', 'Đội 5', 'Đội 6', 'Tổ Truy Nã', 'Cơ sở 1', 'PC02', 'Bình Thạnh', 'Công an Phường Bàn Cờ'].map(teamMatchKey),
);

describe('classifyUnitValue — tách 3 thứ đang lẫn trong một cột', () => {
  it('tổ nội bộ → TEAM, kể cả biến thể "BCH Đội 4"', () => {
    expect(classifyUnitValue('Đội 4', TEAMS).kind).toBe('TEAM');
    expect(classifyUnitValue('BCH Đội 4', TEAMS).kind).toBe('TEAM');
    expect(classifyUnitValue('  đội 4 ', TEAMS).kind).toBe('TEAM');
  });

  it('cùng trỏ về một tổ dù viết khác nhau', () => {
    const a = classifyUnitValue('Đội 4', TEAMS);
    const b = classifyUnitValue('BCH Đội 4', TEAMS);
    expect(a.teamKey).toBe(b.teamKey);
  });

  it('kết quả xử lý → RESULT, KHÔNG bị nhận nhầm là đơn vị', () => {
    expect(classifyUnitValue('Trả đơn, hướng dẫn khởi kiện tại TAND', TEAMS).kind).toBe('RESULT');
    expect(classifyUnitValue('Trả đơn, đề nghị bổ sung tài liệu, chứng cứ', TEAMS).kind).toBe('RESULT');
    expect(classifyUnitValue('Hướng dẫn công dân khởi kiện', TEAMS).kind).toBe('RESULT');
  });

  it('kết quả có kèm tên cơ quan vẫn là RESULT — bản chất không phải nơi thụ lý', () => {
    expect(classifyUnitValue('Trả đơn, chuyển Công an TP Hồ Chí Minh', TEAMS).kind).toBe('RESULT');
  });

  it('cơ quan ngoài → EXTERNAL_ORG', () => {
    expect(classifyUnitValue('Phòng PC01 Công an TP Hồ Chí Minh', TEAMS).kind).toBe('EXTERNAL_ORG');
    expect(classifyUnitValue('PC03 Công an TP. Hồ Chí Minh', TEAMS).kind).toBe('EXTERNAL_ORG');
    expect(classifyUnitValue('Viện kiểm sát nhân dân TP', TEAMS).kind).toBe('EXTERNAL_ORG');
  });

  it('Đội 7/8/9 chưa có trong Tổ/Nhóm → UNKNOWN kèm lý do rõ, KHÔNG tự tạo tổ', () => {
    const r = classifyUnitValue('Đội 8', TEAMS);
    expect(r.kind).toBe('UNKNOWN');
    expect(r.reason).toMatch(/Đội|chưa có/);
    expect(classifyUnitValue('BCH Đội 8', TEAMS).kind).toBe('UNKNOWN');
  });

  it('rỗng → UNKNOWN, không ném lỗi', () => {
    expect(classifyUnitValue('', TEAMS).kind).toBe('UNKNOWN');
    expect(classifyUnitValue('   ', TEAMS).kind).toBe('UNKNOWN');
  });

  it('mọi kết quả đều kèm lý do để người duyệt hiểu vì sao', () => {
    for (const v of ['Đội 4', 'Trả đơn', 'PC01', 'xyz', '']) {
      expect(classifyUnitValue(v, TEAMS).reason.length).toBeGreaterThan(0);
    }
  });
});

describe('extractHinhSuArea — tổ hình sự theo địa bàn', () => {
  const T = new Set(['Thủ Đức', 'Quận 12', 'Bình Tân', 'Cơ sở 1'].map(teamMatchKey));

  it('bỏ được tiền tố BCH — lỗi thật khiến hàng trăm hồ sơ trượt', () => {
    expect(classifyUnitValue('BCH Tổ hình sự khu vực 2 (TP. Thủ Đức cũ)', T).kind).toBe('TEAM');
  });

  it('bỏ tiền tố TP. khi không có ngoặc', () => {
    expect(classifyUnitValue('Tổ hình sự TP. Thủ Đức', T).kind).toBe('TEAM');
  });

  it('lấy địa bàn trong ngoặc, bỏ chữ "cũ"', () => {
    expect(classifyUnitValue('Tổ hình sự khu vực 9 (quận Bình Tân cũ)', T).kind).toBe('TEAM');
    expect(classifyUnitValue('Tổ Hình sự khu vực VII (Quận 12 cũ)', T).kind).toBe('TEAM');
  });

  it('không có ngoặc thì lấy phần sau cụm "tổ hình sự"', () => {
    expect(classifyUnitValue('Tổ Hình sự Quận 12', T).kind).toBe('TEAM');
  });

  it('bỏ tiền tố PC02: "PC02 Cơ sở 1 (Bình Dương)" → Cơ sở 1', () => {
    expect(classifyUnitValue('PC02 Cơ sở 1 (Bình Dương)', T).kind).toBe('TEAM');
  });

  it('dữ liệu dạng Unicode tổ hợp (NFD) vẫn cắt được chữ "cũ"', () => {
    // Chuỗi thật trong dump ở dạng NFD: "cũ" = c + u + dấu ngã rời (U+0303).
    const nfd = 'Tổ hình sự khu vực 2 (TP. Thủ Đức cũ)'.normalize('NFD');
    expect(nfd).not.toBe('Tổ hình sự khu vực 2 (TP. Thủ Đức cũ)'); // xác nhận đúng là NFD
    expect(extractHinhSuArea(nfd)?.normalize('NFC')).toBe('Thủ Đức');
    expect(classifyUnitValue(nfd, T).kind).toBe('TEAM');
  });

  it('KHÔNG nhận nhầm doanh nghiệp có chữ "khu vực 2"', () => {
    expect(classifyUnitValue('Công ty Dịch vụ MobiFone Khu vực 2 (TP Hồ Chí Minh)', T).kind).not.toBe('TEAM');
  });

  it('địa bàn không có tổ tương ứng → không nhận bừa', () => {
    expect(classifyUnitValue('Tổ hình sự Quận 99', T).kind).not.toBe('TEAM');
  });
});

describe('groupRawValues — gom cách viết trùng nhau', () => {
  it('cộng dồn số hồ sơ của các biến thể chỉ khác hoa thường/khoảng trắng', () => {
    const g = groupRawValues([
      { value: 'Đội 8', count: 12857 },
      { value: 'đội  8', count: 100 },
      { value: 'ĐỘI 8 ', count: 13 },
    ]);
    expect(g.size).toBe(1);
    expect([...g.values()][0].count).toBe(12970);
  });

  it('giữ lại một bản gốc để người duyệt nhận ra', () => {
    const g = groupRawValues([{ value: 'Công an quận Bình Thạnh', count: 273 }]);
    expect([...g.values()][0].sample).toBe('Công an quận Bình Thạnh');
  });

  it('bỏ giá trị rỗng và null', () => {
    expect(groupRawValues([{ value: null, count: 5 }, { value: '  ', count: 3 }]).size).toBe(0);
  });

  it('hai đơn vị khác nhau KHÔNG bị gom', () => {
    const g = groupRawValues([{ value: 'Đội 7', count: 1 }, { value: 'Đội 8', count: 1 }]);
    expect(g.size).toBe(2);
  });
});
