/**
 * Clip 98 — Báo cáo động: nhập số liệu trên lưới giống file Excel mẫu, xem tổng hợp, xuất Excel.
 *
 * Needs two ids of REAL records (seeded on the local machine, see README):
 *   GUIDE_BC_LUOT_GIAO  assignment id the signed-in user can type into (sheet "Ghi chú", text in column B,
 *                       numbers in column C, SUM in C9)
 *   GUIDE_BC_KY         period id of the same report (for the aggregate screen)
 */
const LUOT_GIAO = process.env.GUIDE_BC_LUOT_GIAO || '';
const KY = process.env.GUIDE_BC_KY || '';

const cell = (page, address) => page.getByTestId(`cell-${address}`);

async function typeInto(page, address, text) {
  await cell(page, address).click();
  await page.keyboard.type(text, { delay: 80 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
}

export default {
  slug: '98-bao-cao-dong-luoi',
  title: 'Báo cáo động: nhập số liệu trên lưới như Excel',
  requiresAuth: true,
  steps: [
    {
      narration:
        'Trong video này, chúng ta nhập số liệu báo cáo ngay trên màn hình web. Màn hình hiển thị đúng như file Excel mẫu của báo cáo, nên quý vị thao tác quen thuộc như khi dùng Excel.',
      async run(page) {
        if (!LUOT_GIAO) throw new Error('GUIDE_BC_LUOT_GIAO is not set');
        await page.goto(`/bao-cao-dong/nhap/${encodeURIComponent(LUOT_GIAO)}`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('grid-editor').waitFor({ timeout: 60000 });
        await page.waitForTimeout(600);
      },
    },
    {
      narration:
        'Các ô quý vị được nhập có nền nhạt và viền rõ. Các ô còn lại là chữ cố định của mẫu và không sửa được. Nút Dạng lưới và Dạng danh sách ở phía trên cho phép đổi cách hiển thị bất cứ lúc nào.',
      async run(page) {
        await cell(page, 'B3').hover();
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Bấm vào một ô rồi gõ nội dung. Nhấn Enter để xác nhận và con trỏ tự xuống ô nhập kế tiếp, giống Excel. Gõ tiếng Việt có dấu bình thường.',
      async run(page) {
        await typeInto(page, 'B3', 'Vụ trộm cắp tài sản');
        await typeInto(page, 'B4', 'Vụ cố ý gây thương tích');
      },
    },
    {
      narration:
        'Tiếp theo là cột số vụ. Gõ số rồi nhấn Enter. Ô tổng, đánh dấu fx, được tính lại ngay theo các số quý vị vừa nhập.',
      async run(page) {
        await typeInto(page, 'C3', '12');
        await typeInto(page, 'C4', '7');
        await typeInto(page, 'C5', '5');
        await page.waitForTimeout(500);
      },
    },
    {
      narration:
        'Muốn sửa một ô đã có nội dung, bấm vào ô và nhấn F2. Nhấn Esc để huỷ thay đổi. Nhấn Delete để xoá ô. Nhấn Control Z để hoàn tác khi lỡ tay, Control Y để làm lại.',
      async run(page) {
        await cell(page, 'C3').click();
        await page.keyboard.press('F2');
        await page.keyboard.type('99', { delay: 120 });
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        await page.keyboard.press('Delete');
        await page.waitForTimeout(500);
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Ô chữ cố định của mẫu không cho phép nhập. Nếu quý vị gõ vào đó, hệ thống chỉ báo ô này không nhập được và không thay đổi nội dung.',
      async run(page) {
        await cell(page, 'A3').click();
        await page.keyboard.type('x', { delay: 100 });
        await page.waitForTimeout(600);
      },
    },
    {
      narration:
        'Hệ thống tự lưu sau vài giây quý vị ngừng gõ. Dòng trạng thái phía trên cho biết đã lưu lúc mấy giờ, nên không sợ mất số liệu.',
      async run(page) {
        await page.waitForFunction(
          () => /Đã lưu/.test(document.querySelector('[data-testid="save-status"]')?.textContent ?? ''),
          null,
          { timeout: 15000 },
        ).catch(() => {});
        await page.getByTestId('save-status').hover().catch(() => {});
      },
    },
    {
      narration:
        'Khi đã nhập xong, bấm nút Nộp. Sau khi nộp, báo cáo bị khoá. Chỉ khi người quản lý trả lại hoặc mở khoá, quý vị mới sửa được tiếp.',
      async run(page) {
        const nop = page.getByTestId('btn-submit');
        await nop.hover();
        await page.waitForTimeout(400);
        // The app asks through a native confirm box ("N ô để trống sẽ tính là 0"); an unhandled box is dismissed,
        // which would cancel the submission, so accept it here.
        page.once('dialog', (dialog) => dialog.accept());
        await nop.click();
        await page.getByTestId('submitted-note').waitFor({ timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(800);
      },
    },
    {
      narration:
        'Người quản lý mở màn hình tổng hợp của kỳ báo cáo. Bảng tổng hợp cũng hiển thị như file Excel mẫu, các ô nhập hiện số liệu tổng của các tổ đã nộp.',
      async run(page) {
        if (!KY) throw new Error('GUIDE_BC_KY is not set');
        await page.goto(`/bao-cao-dong/duyet/tong-hop/${encodeURIComponent(KY)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
      },
    },
    {
      narration:
        'Bấm vào một ô số liệu để xem từng tổ đã đóng góp bao nhiêu vào con số tổng. Ô công thức được tính lại trên số tổng, khớp với kết quả khi xuất file.',
      async run(page) {
        const target = page.getByTestId('cell-C3');
        if (await target.count()) {
          await target.click();
          await page.waitForTimeout(1500);
          await page.keyboard.press('Escape');
        }
      },
    },
    {
      narration:
        'Cuối cùng, quản lý có thể xuất ra file Excel. File xuất chính là file mẫu đã được điền số liệu, gồm sheet tổng và từng sheet của các tổ, để gửi báo cáo lên cấp trên.',
      async run(page) {
        const xuat = page.getByRole('button', { name: /xuất/i }).first();
        if (await xuat.count()) await xuat.hover();
        await page.waitForTimeout(800);
      },
    },
  ],
};
