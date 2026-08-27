import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: mọi khoá form gửi lên đều phải được DTO của máy chủ khai.
 *
 * `ValidationPipe` bật `forbidNonWhitelisted`. Một khoá KHÔNG khai trong DTO không bị bỏ qua
 * lặng lẽ mà đá CẢ lời gọi bằng 400 — tức không tạo được bản ghi nào, kể cả bản ghi không đụng
 * gì tới khoá ấy.
 *
 * Lớp lỗi này đã xảy ra BA LẦN: `metadata` và `sttCu` của Đơn thư (`sttCu` chỉ lộ khi bấm thử
 * trên máy thật — CI xanh hoàn toàn), rồi ba cột mới của Vụ việc (codex bắt). Hai lần đầu
 * không ca kiểm nào bắt được vì không ca nào đối chiếu thân lời gọi của giao diện với DTO của
 * máy chủ; lần thứ ba lọt vì cổng này CHỈ phủ Đơn thư.
 *
 * Nên nó chạy theo BẢNG: thêm một thực thể vào bảng là thực thể ấy được gác, và thực thể nào
 * dựng hàm dựng payload riêng mà quên thêm vào đây sẽ hiện ra ở ca kiểm cuối.
 *
 * Đọc cả hai tệp dưới dạng văn bản: giao diện và máy chủ là hai dự án TypeScript riêng, nhập
 * khẩu chéo sẽ kéo theo cả React lẫn Vite vào bộ ca kiểm máy chủ.
 */
const GOC = path.resolve(__dirname, '../..', '..');

interface ThucThe {
  ten: string;
  dto: string;
  payload: string;
  /** Khoá KHÔNG thuộc DTO tạo mới mà vẫn hợp lệ, khai tường minh kèm chỗ ở. */
  ngoaiLe: Readonly<Record<string, string>>;
  /** Một khoá chắc chắn có trong DTO — canh cho biểu thức đọc DTO không rơi về rỗng. */
  khoaMoc: string;
  /**
   * Mốc bắt đầu của đối tượng payload trong mã nguồn.
   *
   * Không đoán bằng `return {` đầu tiên: Vụ án có một hàm phụ dựng đối tượng con (bị can) và
   * `return {` của nó đứng trước, nên đoán sẽ đọc nhầm 11 khoá của bị can rồi kết luận sai.
   */
  neo: string;
}

const BANG: ThucThe[] = [
  {
    ten: 'Đơn thư',
    dto: 'backend/src/petitions/dto/create-petition.dto.ts',
    payload: 'frontend/src/pages/petitions/PetitionFormPage/buildPetitionPayload.ts',
    ngoaiLe: { expectedUpdatedAt: 'UpdatePetitionDto — khoá chống ghi đè đồng thời' },
    khoaMoc: 'senderName',
    neo: 'return {',
  },
  {
    ten: 'Vụ việc',
    dto: 'backend/src/incidents/dto/create-incident.dto.ts',
    payload: 'frontend/src/pages/incidents/buildIncidentPayload.ts',
    ngoaiLe: {
      expectedUpdatedAt: 'UpdateIncidentDto — khoá chống ghi đè đồng thời',
      lyDoTamDinhChi: 'UpdateIncidentDto — tên ô trên form, service đổi sang cột lyDoTamDinhChiText',
    },
    khoaMoc: 'name',
    neo: 'return {',
  },
  {
    ten: 'Vụ án',
    dto: 'backend/src/cases/dto/create-case.dto.ts',
    payload: 'frontend/src/pages/cases/CaseFormPage/buildCreateCasePayload.ts',
    ngoaiLe: {
      expectedUpdatedAt: 'UpdateCaseDto — khoá chống ghi đè đồng thời',
    },
    khoaMoc: 'name',
    neo: 'const payload: CreateCasePayload = {',
  },
];

/** Khoá khai trong một tệp DTO (bỏ qua dòng trang trí đứng riêng). */
function khoaCuaDto(duong: string): Set<string> {
  const src = fs.readFileSync(duong, 'utf8');
  return new Set(
    Array.from(src.matchAll(/^\s*(?:@[\w.]+\([^\n]*\)\s*)*(\w+)\??[?]?:/gm)).map((m) => m[1]),
  );
}

/**
 * Khoá gán trong đối tượng payload của hàm dựng, tính từ mốc khai trong bảng.
 *
 * Cắt theo ĐỘ SÂU NGOẶC chứ không đọc tới hết tệp: đọc quá cuối đối tượng thì nhặt luôn khoá
 * của những đối tượng đứng sau và cổng báo thiếu những khoá chưa bao giờ được gửi.
 */
function khoaGuiLen(duong: string, neo: string): string[] {
  const src = fs.readFileSync(duong, 'utf8');
  const i = src.indexOf(neo);
  if (i < 0) return [];
  const dau = src.indexOf('{', i);
  let sau = 0;
  let cuoi = src.length;
  for (let j = dau; j < src.length; j++) {
    if (src[j] === '{') sau++;
    else if (src[j] === '}') {
      sau--;
      if (sau === 0) {
        cuoi = j;
        break;
      }
    }
  }
  const trongObject = Array.from(src.slice(dau, cuoi).matchAll(/^\s{4}(\w+):/gm)).map(
    (m) => m[1],
  );
  // Vụ án gán phần lớn khoá SAU khi dựng đối tượng (`payload.X = ...`). Bỏ nhóm này thì cổng
  // chỉ gác 11 khoá đầu và 111 khoá còn lại đi thẳng ra máy chủ không ai kiểm.
  const ganSau = Array.from(src.matchAll(/^\s*payload\.(\w+)\s*=/gm)).map((m) => m[1]);
  return Array.from(new Set([...trongObject, ...ganSau]));
}

describe.each(BANG)('GATE $ten — mọi khoá form gửi lên đều được DTO nhận', (tt) => {
  const duongDto = path.join(GOC, tt.dto);
  const duongPayload = path.join(GOC, tt.payload);
  const coDu = fs.existsSync(duongDto) && fs.existsSync(duongPayload);

  it('đọc được cả hai tệp', () => {
    expect(coDu).toBe(true);
  });

  it('đọc được danh sách khoá, không rơi về rỗng khi biểu thức hỏng', () => {
    if (!coDu) return;
    const khoaDto = khoaCuaDto(duongDto);
    expect(khoaDto.size).toBeGreaterThan(40);
    expect(khoaDto.has(tt.khoaMoc)).toBe(true);
    expect(khoaGuiLen(duongPayload, tt.neo).length).toBeGreaterThan(20);
  });

  it('không khoá nào bị forbidNonWhitelisted đá', () => {
    if (!coDu) return;
    const khoaDto = khoaCuaDto(duongDto);
    const thieu = khoaGuiLen(duongPayload, tt.neo).filter(
      (k) => !khoaDto.has(k) && !(k in tt.ngoaiLe),
    );
    expect(thieu).toEqual([]);
  });
});

/**
 * Thực thể nào có hàm dựng payload riêng thì phải nằm trong bảng trên.
 *
 * Đây là chỗ lần thứ ba lọt: cổng có thật, chạy đều, và không phủ Vụ việc.
 */
describe('Bảng thực thể phải phủ hết hàm dựng payload đang có', () => {
  it('không hàm dựng payload nào đứng ngoài bảng', () => {
    const thuMuc = path.join(GOC, 'frontend/src/pages');
    const tim = (d: string): string[] =>
      fs.existsSync(d)
        ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
            const p = path.join(d, e.name);
            if (e.isDirectory()) return e.name === '__tests__' ? [] : tim(p);
            return /^build\w*Payload\.ts$/.test(e.name) ? [p] : [];
          })
        : [];
    const daPhu = new Set(BANG.map((t) => path.join(GOC, t.payload)));
    const ngoaiBang = tim(thuMuc).filter((p) => !daPhu.has(p));
    expect(ngoaiBang.map((p) => path.relative(GOC, p))).toEqual([]);
  });
});
