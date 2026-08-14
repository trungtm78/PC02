/**
 * Walk the system the way a case matures, and photograph every stop.
 *
 * The order is not a tour of the menu; it is the life of one file. A citizen's
 * petition arrives, is accepted and assigned, becomes a source of crime
 * information, is verified, and — if the verification supports it — becomes a
 * criminal case with people, documents and evidence attached. Reports come
 * last, because until the steps above have run there is nothing to report.
 *
 * Teaching the menu instead produces a manual where "Báo cáo tháng" is
 * explained before the reader has ever created a record to be counted in it.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Recorder, fill, choose, pickCrime } from './lib/recorder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.GUIDE_BASE_URL || 'http://localhost:5173';
const OUT_ROOT = process.env.GUIDE_OUT || path.resolve(__dirname, '../../docs/huong-dan-su-dung');
const IMG_DIR = path.join(OUT_ROOT, 'anh');
const USER = process.env.GUIDE_USER || 'admin';
const PASS = process.env.GUIDE_PASS || 'Huongdan@2026';

/** Stamp shared by every record this run creates, so a rerun is traceable. */
const RUN = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const DATA = {
  sender: {
    name: 'Trần Thị Bích Ngọc',
    birthYear: '1982',
    address: 'Số 128 đường Nguyễn Trãi, phường Bến Thành',
    phone: '0903221847',
    email: 'ngoc.tran.demo@pc02.local',
    idNumber: '079182004417',
  },
  suspect: { name: 'Lê Quang Huy', address: 'Số 45 đường Cách Mạng Tháng Tám, phường 11' },
  content:
    'Ngày 12/07 tôi có chuyển 185.000.000 đồng vào tài khoản do một người tự xưng là nhân viên ' +
    'sàn thương mại điện tử cung cấp, sau khi người này thông báo tôi trúng thưởng và yêu cầu ' +
    'nộp phí nhận giải. Sau khi chuyển tiền, toàn bộ liên lạc bị cắt đứt. Tôi làm đơn này đề ' +
    'nghị cơ quan điều tra xác minh, làm rõ và thu hồi tài sản bị chiếm đoạt.',
  crime: 'Lừa đảo chiếm đoạt tài sản',
  incidentName: 'Xác minh tin báo chiếm đoạt tài sản qua mạng tại phường Bến Thành',
  caseTitle: 'Vụ án lừa đảo chiếm đoạt tài sản qua mạng — phường Bến Thành',
  place: 'Số 128 đường Nguyễn Trãi, phường Bến Thành',
  method:
    'Đối tượng dùng số điện thoại rác, mạo danh nhân viên sàn thương mại điện tử, dẫn dụ bị hại ' +
    'chuyển tiền vào tài khoản trung gian rồi cắt liên lạc.',
};

const log = (m) => console.log(m);

async function login(page, rec) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await rec.step({
    id: '01-dang-nhap',
    chapter: 'Bắt đầu',
    title: 'Đăng nhập hệ thống',
    why:
      'Mọi thao tác sau đây đều được ghi lại kèm tên người thực hiện. Không có tài khoản dùng ' +
      'chung: nhật ký hoạt động chỉ có giá trị khi mỗi dòng chỉ đúng một người.',
    how:
      'Ô đầu nhận số hiệu cán bộ, số điện thoại, email hoặc tên đăng nhập — dùng cái nào cũng được. ' +
      'Nếu tài khoản đã bật xác thực hai lớp, sau bước này sẽ có màn nhập mã.',
  });

  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await page.click('button:has-text("Đăng nhập")');
  await page.waitForURL('**/dashboard', { timeout: 40000 });
  await page.waitForTimeout(2500);
}


/**
 * Two more petitions before the tour starts, so the list screens show a list
 * rather than a single row. Typed into the same form by the same account —
 * there is no back door here either; they simply are not photographed.
 */
async function seedBackground(page) {
  const extras = [
    {
      name: 'Nguyễn Văn Thành', address: 'Số 7 đường Lý Thường Kiệt, phường 6', phone: '0912445780',
      content: 'Trình báo về việc bị chiếm đoạt xe máy khi cho người quen mượn và không trả lại.',
      crime: 'Lạm dụng tín nhiệm chiếm đoạt tài sản',
    },
    {
      name: 'Phạm Thị Hồng Vân', address: 'Số 210 đường Điện Biên Phủ, phường 15', phone: '0987112306',
      content: 'Tố giác nhóm đối tượng cho vay với lãi suất cao, đe dọa khi đòi nợ.',
      crime: 'Cho vay lãi nặng trong giao dịch dân sự',
    },
  ];
  for (const e of extras) {
    await page.goto(`${BASE}/petitions/new`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="field-senderName"]', { timeout: 20000 });
    await fill(page, 'field-receivedDate', daysAgo(6));
    await fill(page, 'field-senderName', e.name);
    await fill(page, 'field-senderAddress', e.address);
    await fill(page, 'field-senderPhone', e.phone);
    await fill(page, 'field-detailContent', e.content);
    await choose(page, 'field-petitionType', 'Tố cáo');
    await pickCrime(page, e.crime);
    await page.locator('[data-testid="btn-save-main"]').first().click();
    await page.waitForURL((u) => !u.toString().endsWith('/petitions/new'), { timeout: 30000 });
    await page.waitForTimeout(1200);
  }
}

async function main() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const httpErrors = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      httpErrors.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`);
    }
  });

  const rec = new Recorder(page, { imgDir: IMG_DIR, log });

  log('\n── Chương 1: bắt đầu ─────────────────────────────');
  await login(page, rec);

  await rec.step({
    id: '02-tong-quan',
    chapter: 'Bắt đầu',
    title: 'Màn hình Tổng quan',
    why:
      'Đây là nơi trả lời câu hỏi đầu ca trực: hôm nay có gì mới, có gì sắp hết hạn. Các con số ' +
      'trên thẻ đều đếm theo phạm vi dữ liệu của chính người đang đăng nhập, không phải toàn hệ thống.',
    how:
      'Thanh bên trái gom màn hình theo nhóm nghiệp vụ. Mục nào tổ chức chưa bật, hoặc tài khoản ' +
      'không có quyền, sẽ không hiện — nên hai người khác quyền sẽ thấy hai thanh bên khác nhau.',
  });

  log('  · tạo dữ liệu nền (2 đơn, không chụp ảnh)');
  await seedBackground(page);

  log('\n── Chương 2: đơn thư — nơi dữ liệu sinh ra ────────');
  await rec.step({
    id: '03-don-thu-form-trong',
    chapter: 'Đơn thư',
    title: 'Mở phiếu tiếp nhận đơn thư',
    why:
      'Phần lớn hồ sơ trong hệ thống bắt đầu từ đây. Tiếp nhận đúng ngay từ đầu quan trọng vì ' +
      'thời hạn giải quyết được tính từ ngày tiếp nhận, và hệ thống tự tính chứ không chờ nhập tay.',
    how: 'Vào Nghiệp vụ chính → Đơn thư → Tiếp nhận đơn mới. Ô có dấu * là bắt buộc.',
  }, async (p) => {
    await p.goto(`${BASE}/petitions/new`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="field-senderName"]', { timeout: 20000 });
  });

  await rec.step({
    id: '04-don-thu-da-dien',
    chapter: 'Đơn thư',
    title: 'Điền thông tin người gửi và nội dung',
    why:
      'Họ tên và địa chỉ người gửi là bắt buộc vì đơn nào cũng phát sinh nghĩa vụ trả lời bằng ' +
      'văn bản cho chính người đó. Đơn nặc danh có ô riêng — tích vào thì hệ thống bỏ qua các ô này.',
    how:
      'Nội dung nên ghi đúng lời trình bày của công dân, không tóm tắt lại theo cách hiểu của ' +
      'người nhập — đây là căn cứ để phân loại và xác định thẩm quyền về sau.',
    fullPage: true,
  }, async (p, r) => {
    await fill(p, 'field-receivedDate', today);
    await fill(p, 'field-senderName', DATA.sender.name);
    await fill(p, 'field-senderBirthYear', DATA.sender.birthYear);
    await fill(p, 'field-senderAddress', DATA.sender.address);
    await fill(p, 'field-senderPhone', DATA.sender.phone);
    await fill(p, 'field-senderEmail', DATA.sender.email);
    await fill(p, 'field-senderIdNumber', DATA.sender.idNumber);
    await fill(p, 'field-petitionDate', daysAgo(3));
    await fill(p, 'field-noiXayRa', DATA.place);
    await fill(p, 'field-ngayXayRa', daysAgo(28));
    await fill(p, 'field-phuongThucThuDoan', DATA.method);
    await fill(p, 'field-suspectedPerson', DATA.suspect.name);
    await fill(p, 'field-suspectedAddress', DATA.suspect.address);

    const petitionType = await choose(p, 'field-petitionType', 'Tố cáo');
    r.fact('Loại đơn thư', petitionType);
    await fill(p, 'field-detailContent', DATA.content);
    const crime = await pickCrime(p, DATA.crime);
    r.fact('Tội danh chính', crime);

    return { data: `Người gửi: ${DATA.sender.name} · ĐT ${DATA.sender.phone} · Tội danh: ${crime}` };
  });

  await rec.step({
    id: '05-don-thu-da-luu',
    chapter: 'Đơn thư',
    title: 'Lưu đơn — hệ thống cấp số tiếp nhận',
    why:
      'Số tiếp nhận (DT-năm-số thứ tự) do hệ thống cấp, không nhập tay, nên không có hai đơn ' +
      'trùng số và không có khoảng trống trong sổ. Thời hạn giải quyết cũng được tính ngay tại đây.',
    how: 'Bấm Lưu. Nếu còn ô bắt buộc chưa điền, hệ thống sẽ chỉ thẳng vào ô đó thay vì báo lỗi chung.',
    fullPage: true,
  }, async (p, r) => {
    await p.locator('[data-testid="btn-save-main"]').first().click();
    // The guide is only worth anything if the record really exists, so this
    // waits for the app to leave the blank form rather than assuming it did.
    await p.waitForURL((u) => !u.toString().endsWith('/petitions/new'), { timeout: 30000 });
    await p.waitForTimeout(2500);
    const stt = await p.locator('text=/DT-\d{4}-\d+/').first().innerText().catch(() => null);
    if (stt) r.fact('Số tiếp nhận hệ thống cấp', stt.trim());
    r.fact('URL sau khi lưu', p.url().replace(BASE, ''));
    return { data: stt ? `Số tiếp nhận: ${stt.trim()}` : undefined };
  });

  await rec.step({
    id: '06-danh-sach-don-thu',
    chapter: 'Đơn thư',
    title: 'Đơn vừa nhập đã nằm trong sổ',
    why:
      'Danh sách này là sổ tiếp nhận. Dòng nào quá hạn được tô khác màu — không phải để trang trí ' +
      'mà để trưởng đơn vị nhìn một lượt là thấy việc đang trễ.',
    how:
      'Các thẻ số phía trên vừa là thống kê vừa là bộ lọc: bấm vào thẻ sẽ lọc danh sách theo đúng ' +
      'trạng thái đó. Ô tìm kiếm tìm theo số tiếp nhận, tên người gửi và nội dung.',
  }, async (p) => {
    await p.goto(`${BASE}/petitions`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });

  log('\n── Chương 3: vụ việc — xác minh nguồn tin ─────────');
  await rec.step({
    id: '07-vu-viec-form',
    chapter: 'Vụ việc',
    title: 'Lập vụ việc để xác minh nguồn tin',
    why:
      'Đơn thư có dấu hiệu tội phạm thì chuyển thành vụ việc — tức nguồn tin về tội phạm theo ' +
      'Điều 144 Bộ luật Tố tụng hình sự. Từ lúc này thời hạn xác minh chạy theo Điều 147, và hệ ' +
      'thống theo dõi mốc đó thay cho sổ tay.',
    how: 'Vào Nghiệp vụ chính → Vụ việc → Thêm vụ việc mới.',
    fullPage: true,
  }, async (p, r) => {
    await p.goto(`${BASE}/vu-viec/new`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="field-name"]', { timeout: 20000 });
    await fill(p, 'field-name', DATA.incidentName);
    return { data: `Tên vụ việc: ${DATA.incidentName}` };
  });

  await rec.step({
    id: '07b-vu-viec-da-luu',
    chapter: 'Vụ việc',
    title: 'Lưu vụ việc — hệ thống cấp mã và tính thời hạn',
    why:
      'Mã vụ việc do hệ thống cấp theo cùng cơ chế với số đơn thư. Thời hạn xác minh được tính ' +
      'ngay lúc lưu, theo bộ quy tắc thời hạn đang có hiệu lực — nên đổi quy tắc về sau không làm ' +
      'thay đổi hồ sơ đã lập.',
    how: 'Bấm Lưu vụ việc. Các thông tin còn thiếu có thể bổ sung dần trong quá trình xác minh.',
    fullPage: true,
  }, async (p, r) => {
    await p.locator('[data-testid="btn-save"]').first().click();
    await p.waitForURL((u) => !u.toString().endsWith('/vu-viec/new'), { timeout: 30000 });
    await p.waitForTimeout(2500);
    r.fact('URL sau khi lưu vụ việc', p.url().replace(BASE, ''));
  });

  await rec.step({
    id: '08-danh-sach-vu-viec',
    chapter: 'Vụ việc',
    title: 'Bốn giai đoạn xác minh',
    why:
      'Vụ việc đi qua bốn giai đoạn theo Thông tư 28/2020 của Bộ Công an: Tiếp nhận, Xác minh, ' +
      'Kết quả, Tạm đình chỉ. Bốn thẻ đầu trang chính là bốn giai đoạn đó, nên nhìn là biết hồ sơ ' +
      'đang đọng ở khâu nào.',
    how: 'Bấm một thẻ để chỉ xem hồ sơ ở giai đoạn đó.',
  }, async (p) => {
    await p.goto(`${BASE}/vu-viec`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });

  log('\n── Chương 4: vụ án ───────────────────────────────');
  await rec.step({
    id: '09-vu-an-form',
    chapter: 'Vụ án',
    title: 'Khởi tố — lập hồ sơ vụ án',
    why:
      'Khi xác minh đủ căn cứ, vụ việc trở thành vụ án. Hệ thống giữ liên kết ngược về vụ việc và ' +
      'về đơn thư gốc, nên từ hồ sơ vụ án luôn tra ngược được tới lá đơn đầu tiên của công dân.',
    how: 'Vào Nghiệp vụ chính → Quản lý vụ án → Khởi tố vụ án mới.',
    fullPage: true,
  }, async (p, r) => {
    await p.goto(`${BASE}/cases/new`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="input-case-title"]', { timeout: 20000 });
    // The whole point of the ordering: this case is opened FROM the incident
    // created a moment ago, so the finished file can be traced back through the
    // incident to the citizen's original petition.
    await p.locator('[data-testid="select-case-provenance"]').selectOption('FROM_INCIDENT');
    await p.waitForTimeout(1500);
    const row = p.locator('[data-testid^="incident-picker-row-"]').first();
    await row.waitFor({ state: 'visible', timeout: 15000 });
    const picked = (await row.innerText()).trim().replace(/\s+/g, ' ').slice(0, 70);
    await row.click();
    await p.waitForTimeout(800);
    r.fact('Vụ việc gốc', picked);

    await fill(p, 'input-case-title', DATA.caseTitle);
    await fill(p, 'input-receive-date', today);
    // "Điều tra viên chính" comes pre-filled with the signed-in officer; the
    // form is usable as-is, so leave it rather than clearing and re-picking.
    return { data: `Tiêu đề: ${DATA.caseTitle} · khởi tố từ: ${picked}` };
  });

  await rec.step({
    id: '09b-vu-an-da-luu',
    chapter: 'Vụ án',
    title: 'Lưu hồ sơ vụ án',
    why:
      '"Lưu tạm" giữ bản nháp cho hồ sơ chưa đủ thông tin; "Lưu hồ sơ" mới đưa vụ án vào sổ và ' +
      'bắt đầu chạy thời hạn điều tra. Hai nút này khác nhau về hệ quả pháp lý, không phải về giao diện.',
    how: 'Điều tra viên chính là bắt buộc — hồ sơ không có người chịu trách nhiệm thì không vào sổ được.',
    fullPage: true,
  }, async (p, r) => {
    await p.locator('[data-testid="btn-save"]').first().click();
    await p.locator('text=Xác nhận lưu vụ án').first().waitFor({ state: 'visible', timeout: 15000 });
    const code = await p.locator('text=/VA-\d{4}-\d+/').first().innerText().catch(() => null);
    if (code) r.fact('Mã hồ sơ hệ thống cấp', code.trim());
    return { data: code ? `Mã hồ sơ: ${code.trim()}` : undefined };
  });

  await rec.step({
    id: '09c-vu-an-xac-nhan',
    chapter: 'Vụ án',
    title: 'Hồ sơ đã vào sổ',
    why:
      'Bước xác nhận không phải thủ tục thừa: nó cho xem trước mã hồ sơ và những gì sắp ghi vào ' +
      'cơ sở dữ liệu, trước khi ghi. Khởi tố nhầm rồi sửa là việc phải giải trình, nên hệ thống ' +
      'hỏi lại một lần.',
    how: 'Bấm Xác nhận lưu. Bấm Quay lại sửa nếu còn chỗ cần chỉnh.',
  }, async (p, r) => {
    await p.locator('button:has-text("Xác nhận lưu")').first().click();
    await p.waitForURL((u) => !u.toString().endsWith('/cases/new'), { timeout: 30000 });
    await p.waitForTimeout(3000);
    r.fact('URL sau khi lưu vụ án', p.url().replace(BASE, ''));
  });

  await rec.step({
    id: '10-danh-sach-vu-an',
    chapter: 'Vụ án',
    title: 'Sổ vụ án',
    why:
      'Mỗi dòng là một hồ sơ đang chạy thời hạn. Cột thời hạn và màu cảnh báo là công cụ chính để ' +
      'phân việc trong tuần.',
    how: 'Bấm vào một dòng để mở hồ sơ. Nút ba chấm cuối dòng gom các thao tác nhanh: phân công, đổi trạng thái, xóa.',
  }, async (p) => {
    await p.goto(`${BASE}/cases`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });

  log('\n── Chương 5: người và tài liệu ───────────────────');
  await rec.step({
    id: '11-doi-tuong',
    chapter: 'Người và tài liệu',
    title: 'Đối tượng liên quan',
    why:
      'Nghi phạm, bị hại và nhân chứng được quản lý tách theo vai, vì quyền xem và nghĩa vụ bảo mật ' +
      'với ba nhóm này không giống nhau.',
    how: 'Vào Nghiệp vụ chính → Đối tượng liên quan, rồi chọn nhóm cần xem.',
  }, async (p) => {
    await p.goto(`${BASE}/people/suspects`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });

  await rec.step({
    id: '12-tai-lieu',
    chapter: 'Người và tài liệu',
    title: 'Tài liệu hồ sơ',
    why:
      'File tải lên được kiểm tra theo magic byte — tức đọc mấy byte đầu của file thật, không tin ' +
      'phần đuôi tên file. Đổi tên virus.exe thành bienban.pdf vẫn bị chặn.',
    how: 'Hệ thống nhận PDF, Word, Excel, ảnh, MP4 và MP3, tối đa 10MB mỗi file.',
  }, async (p) => {
    await p.goto(`${BASE}/documents`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });

  log('\n── Chương 6: báo cáo ─────────────────────────────');
  await rec.step({
    id: '13-bao-cao-thang',
    chapter: 'Báo cáo',
    title: 'Báo cáo tháng',
    why:
      'Số liệu ở đây lấy thẳng từ hồ sơ đã nhập ở các bước trên — không có bảng nhập số liệu riêng. ' +
      'Muốn báo cáo đúng thì phải nhập hồ sơ đúng; không có đường tắt.',
    how: 'Vào Báo cáo & Thống kê → Báo cáo tháng, chọn kỳ rồi xuất file.',
  }, async (p) => {
    await p.goto(`${BASE}/reports/monthly`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
  });

  await rec.step({
    id: '14-nhat-ky',
    chapter: 'Báo cáo',
    title: 'Nhật ký hoạt động',
    why:
      'Ai sửa gì, lúc nào, từ máy nào. Đây là căn cứ khi cần đối chiếu trách nhiệm, nên nhật ký ' +
      'không sửa và không xóa được kể cả với tài khoản quản trị.',
    how: 'Vào Báo cáo & Thống kê → Nhật ký hoạt động; lọc theo người thực hiện hoặc theo loại hồ sơ.',
  }, async (p) => {
    await p.goto(`${BASE}/activity-log`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });

  log('\n── Chương 7: quản trị ────────────────────────────');
  await rec.step({
    id: '15-nguoi-dung',
    chapter: 'Quản trị',
    title: 'Người dùng và phân quyền',
    why:
      'Quyền gắn vào vai trò, không gắn vào từng người. Sửa một vai là đổi quyền của mọi người mang ' +
      'vai đó — nhanh, nhưng cũng vì thế mà mỗi lần lưu đều được ghi nhật ký kèm phần chênh lệch.',
    how: 'Vào Quản trị → Người dùng. Thẻ Vai trò & Phân quyền là ma trận quyền theo từng vai.',
  }, async (p) => {
    await p.goto(`${BASE}/nguoi-dung`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
  });

  await rec.step({
    id: '16-tinh-nang',
    chapter: 'Quản trị',
    title: 'Bật/tắt tính năng',
    why:
      'Phân hệ nào đơn vị chưa dùng thì tắt, thay vì để menu thừa gây nhầm. Tắt một phân hệ sẽ ẩn ' +
      'menu và chặn luôn đường API của nó — không phải chỉ giấu nút đi.',
    how: 'Vào Quản trị → Bật/tắt tính năng. Sáu phân hệ lõi không tắt được, để tránh tự khóa mình ra ngoài.',
  }, async (p) => {
    await p.goto(`${BASE}/admin/tinh-nang`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  });

  await browser.close();

  const manifest = {
    generatedAt: new Date().toISOString(),
    runId: RUN,
    baseURL: BASE,
    account: USER,
    steps: rec.steps,
    facts: rec.facts,
    failures: rec.failures,
    httpErrors: [...new Set(httpErrors)],
  };
  fs.writeFileSync(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  log(`\n${rec.steps.length} bước · ${rec.failures.length} lỗi · ${manifest.httpErrors.length} lỗi HTTP`);
  if (rec.failures.length) log('Lỗi: ' + rec.failures.map((f) => f.id).join(', '));
  if (manifest.httpErrors.length) log('HTTP: ' + manifest.httpErrors.slice(0, 10).join(' | '));
}

await main();
