import { BadRequestException } from '@nestjs/common';
import PizZip from 'pizzip';
import { DocumentTemplatesService } from './document-templates.service';

/**
 * Mẫu mang biến CŨ không còn dò thấy trong tệp thì vẫn phải sửa được.
 *
 * ── Vì sao ──
 *
 * Ngày 29/08/2026, anh báo "bấm Sửa mẫu chứng từ rồi lưu thì không được". Bấm thử trên MÁY
 * THẬT, máy chủ trả 400:
 *
 *   Biến "909E8E84-426E-40DD-AFC4-6F175D3DCCD1" không có trong file mẫu
 *
 * Biến ấy là một GUID của Word (dấu vết `{…}` trong phần nội bộ của tệp .docx). Mẫu
 * `PHIEU_DE_XUAT` dùng cặp dấu `{` `}`, nên hồi tải lên bộ dò đã bắt nhầm nó thành biến và
 * CẤT VÀO CSDL. Về sau bộ dò được siết lại, GUID không còn được coi là biến nữa.
 *
 * Hệ quả không ai lường: bản ghi ấy **vĩnh viễn không lưu được**. Giao diện luôn gửi cả danh
 * sách biến, máy chủ dò lại tệp rồi từ chối vì có một tên không khớp — nên đổi tên mẫu, đổi
 * thứ tự, hay chỉ tích một ô, đều 400 như nhau. Người dùng thấy đúng một điều: "sửa không được".
 *
 * ── Luật đặt ra ──
 *
 * Phép kiểm vẫn đúng ý định: KHÔNG cho khai một placeholder không có trong tệp. Nhưng nó chỉ
 * nên chặn thứ admin đang THÊM VÀO. Tên đã nằm sẵn trong bản ghi thì trước đây hệ thống đã
 * nhận; chặn bây giờ không sửa được gì mà làm hỏng mọi thao tác khác.
 *
 * Một biến không có trong tệp vốn vô hại khi in — chẳng có chỗ nào để thay. Cái hại duy nhất
 * nó gây ra là thế bí này.
 *
 * Đổi tệp thì KHÁC: lúc ấy admin chủ động thay nguồn, mọi giả định cũ mất hiệu lực, giữ
 * nguyên phép kiểm chặt.
 */
describe('Biến cũ không còn dò thấy thì không được chặn việc lưu', () => {
  const GUID = '909E8E84-426E-40DD-AFC4-6F175D3DCCD1';

  function docx(noiDung: string): Buffer {
    const zip = new PizZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>${noiDung}</w:t></w:r></w:p></w:body></w:document>`,
    );
    return zip.generate({ type: 'nodebuffer' }) as Buffer;
  }

  function dung(bienDaLuu: { name: string; label: string; source: 'auto' | 'manual' }[]) {
    const ban = {
      id: 't1',
      code: 'PHIEU_DE_XUAT',
      entityType: 'DON_THU',
      delimStart: '{',
      delimEnd: '}',
      // Tệp CHỈ chứa `{tenDoi}` — GUID không có trong đó, đúng như trên máy thật.
      fileBytes: docx('{tenDoi}'),
      variables: bienDaLuu,
      status: 'active',
    };
    const prisma: any = {
      documentTemplate: {
        findFirst: jest.fn().mockResolvedValue(ban),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data })),
      },
    };
    return { prisma, svc: new DocumentTemplatesService(prisma) };
  }

  const BIEN_CU = [
    { name: GUID, label: GUID, source: 'manual' as const },
    { name: 'tenDoi', label: 'tenDoi', source: 'manual' as const },
  ];

  it('lưu được mẫu mang biến cũ, chỉ đổi một ô thiết lập', async () => {
    const { prisma, svc } = dung(BIEN_CU);
    await expect(
      svc.update('t1', { selectedByDefault: true, variables: BIEN_CU } as never),
    ).resolves.toBeDefined();
    expect(prisma.documentTemplate.update).toHaveBeenCalled();
  });

  /** Biến cũ phải được GIỮ nguyên, không lặng lẽ biến mất — người dùng chỉ tích một ô. */
  it('giữ nguyên biến cũ chứ không lặng lẽ bỏ đi', async () => {
    const { prisma, svc } = dung(BIEN_CU);
    await svc.update('t1', { selectedByDefault: true, variables: BIEN_CU } as never);
    const luu = prisma.documentTemplate.update.mock.calls[0][0].data.variables;
    expect(luu.map((v: any) => v.name)).toContain(GUID);
  });

  /**
   * Phần răng của phép kiểm phải còn: admin THÊM một placeholder không có trong tệp thì vẫn
   * chặn. Không có mệnh đề này thì bản vá thành ra gỡ hẳn phép kiểm.
   */
  it('vẫn chặn khi admin THÊM biến mới không có trong tệp', async () => {
    const { svc } = dung(BIEN_CU);
    await expect(
      svc.update('t1', {
        variables: [...BIEN_CU, { name: 'bienBiaRa', label: 'bienBiaRa', source: 'manual' }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('vẫn chặn biến trùng tên', async () => {
    const { svc } = dung(BIEN_CU);
    await expect(
      svc.update('t1', { variables: [...BIEN_CU, BIEN_CU[1]] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * Giao diện LUÔN gửi kèm cặp dấu, kể cả khi không đổi — payload thật trên máy thật:
   *
   *   {"name":"Phiếu đề xuất", …, "delimStart":"{","delimEnd":"}","variables":[…]}
   *
   * Nên "có gửi cặp dấu" KHÔNG có nghĩa là "đã đổi cặp dấu". Coi hai thứ ấy là một thì phép
   * miễn không bao giờ có hiệu lực, và bản vá thành vô dụng đúng ở ca nó sinh ra để chữa —
   * bản nháp đầu của chính commit này đã mắc y như vậy, và ca kiểm cũ xanh vì nó tự dựng DTO
   * không có cặp dấu, tức dựng một tình huống giao diện không bao giờ tạo ra.
   */
  it('gửi kèm ĐÚNG cặp dấu đang dùng thì vẫn miễn, vẫn lưu được', async () => {
    const { prisma, svc } = dung(BIEN_CU);
    await expect(
      svc.update('t1', {
        selectedByDefault: true,
        delimStart: '{',
        delimEnd: '}',
        variables: BIEN_CU,
      } as never),
    ).resolves.toBeDefined();
    expect(prisma.documentTemplate.update).toHaveBeenCalled();
  });

  /**
   * ĐỔI CẶP DẤU là đổi cách đọc chính tệp ấy — mọi kết quả dò cũ mất hiệu lực y như khi thay
   * tệp. Miễn tiếp lúc này là để lọt một khai báo không còn tồn tại dưới cú pháp mới.
   */
  it('đổi cặp dấu thì KHÔNG miễn nữa, biến cũ bị chặn lại', async () => {
    const { svc } = dung(BIEN_CU);
    await expect(
      svc.update('t1', { delimStart: '[[', delimEnd: ']]', variables: BIEN_CU } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * Đổi MỘT nửa cũng là đổi. Ca kiểm trên đổi cả hai dấu nên nửa nào hỏng vẫn có nửa kia bắt —
   * gieo lỗi vào riêng vế đầu vẫn xanh. Hai ca dưới ghim từng vế một.
   */
  it.each([
    ['chỉ đổi dấu mở', { delimStart: '[[', delimEnd: '}' }],
    ['chỉ đổi dấu đóng', { delimStart: '{', delimEnd: ']]' }],
  ])('%s cũng hết miễn', async (_ten, dau) => {
    const { svc } = dung(BIEN_CU);
    await expect(svc.update('t1', { ...dau, variables: BIEN_CU } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  /** Mẫu chưa từng có biến cũ thì không được nới gì thêm. */
  it('mẫu sạch vẫn chặn biến lạ như trước', async () => {
    const { svc } = dung([{ name: 'tenDoi', label: 'tenDoi', source: 'manual' }]);
    await expect(
      svc.update('t1', { variables: [{ name: 'la', label: 'la', source: 'manual' }] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
