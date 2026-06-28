/**
 * v0.47 PR2 T6 — one-off script that emits 6 docxtemplater-compatible templates
 * to backend/templates/docx/. Each template is intentionally minimal — just enough
 * structure for the renderer to verify placeholders resolve correctly. Real legal
 * formatting can be edited in Word later by the records officer (templateSha
 * audit lock catches any drift).
 *
 * Output filenames mirror the documentType enum used in PetitionsService:
 *   PHIEU_DE_XUAT.docx, PHIEU_CHUYEN_NGUON_TIN.docx, PHIEU_CHUYEN_DON.docx,
 *   THONG_BAO_CHUYEN.docx, THONG_BAO_HUONG_DAN.docx, THONG_BAO_TRA_LAI.docx
 *
 * Run: cd backend && node_modules/.bin/ts-node --transpile-only scripts/generate-docx-templates.ts
 *
 * Commits the resulting .docx files as binary assets. nest-cli.json copies them
 * to dist/templates/docx/ on build (PR2 T6 second half).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  PageOrientation,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

interface TemplateSpec {
  filename: string;
  title: string;
  loaiVanBan: string; // shown in header line
  recipientLabel: string;
  body: string[]; // each string becomes a paragraph (with {placeholders} for docxtemplater)
  signatureBlocks: Array<{ left: string; right: string }>; // bottom signatories
}

const PHIEU_DE_XUAT: TemplateSpec = {
  filename: 'PHIEU_DE_XUAT.docx',
  title: 'PHIẾU ĐỀ XUẤT',
  loaiVanBan: '{soVanBan}/ĐX-PC02-{teamCode}',
  recipientLabel: 'Kính gửi: BCH Phòng PC02 và BCH {tenDoi}',
  body: [
    'Phòng Cảnh sát hình sự (PC02) nhận được đơn của Ông/Bà {ghiTen}, sinh năm {namSinh}, địa chỉ {diaChi}, do {nguonDon} chuyển đến ngày {ngayNhan}.',
    'Loại đơn: {loaiDon}. Ngày ghi trên đơn: {ngayDon}.',
    'Nội dung tóm tắt: {noiDung}',
    'Đồ vật, tài liệu kèm theo: {dinhKem}',
    'Kết quả rà soát đơn/vụ trùng: {raSoatTrung}',
    'Thuộc trường hợp báo cáo Ban Giám đốc: {baoCaoBGD}',
    'Nhận thấy: {nhanThay}',
    'Đề xuất xử lý: {deXuat}',
  ],
  signatureBlocks: [
    { left: 'CÁN BỘ ĐỀ XUẤT', right: 'PHÊ DUYỆT' },
    { left: '{tenCanBoDeXuat}', right: '{tenPhoDoiTruong}' },
  ],
};

const PHIEU_CHUYEN_NGUON_TIN: TemplateSpec = {
  filename: 'PHIEU_CHUYEN_NGUON_TIN.docx',
  title: 'PHIẾU CHUYỂN NGUỒN TIN VỀ TỘI PHẠM',
  loaiVanBan: '{soVanBan}/PC-PC02-{teamCode}',
  recipientLabel: 'Kính gửi: {tenDoi}',
  body: [
    'Phòng Cảnh sát hình sự nhận được nguồn tin về tội phạm do Ông/Bà {ghiTen}, địa chỉ {diaChi} cung cấp ngày {ngayNhan}.',
    'Nội dung nguồn tin: {noiDung}',
    'Căn cứ {canCuPhapLy} của Bộ luật Tố tụng hình sự năm 2015,',
    'Phòng Cảnh sát hình sự chuyển nguồn tin trên đến {tenDoi} để giải quyết theo thẩm quyền.',
    'Lý do chuyển: {lyDoChuyen}',
    'Tài liệu kèm theo: {dinhKem}',
  ],
  signatureBlocks: [
    { left: 'Nơi nhận:\n- Như trên;\n- VKSND TP HCM;\n- PC01 CATP HCM;\n- Lưu: PC02-{teamCode}.', right: 'KT. TRƯỞNG PHÒNG\nPHÓ TRƯỞNG PHÒNG\n\n{tenTruongPhong}' },
  ],
};

const PHIEU_CHUYEN_DON: TemplateSpec = {
  filename: 'PHIEU_CHUYEN_DON.docx',
  title: 'PHIẾU CHUYỂN ĐƠN',
  loaiVanBan: '{soVanBan}/PC-PC02-{teamCode}',
  recipientLabel: 'Kính gửi: {tenDoi}',
  body: [
    'Phòng Cảnh sát hình sự nhận được đơn của Ông/Bà {ghiTen}, địa chỉ {diaChi} ngày {ngayNhan}.',
    'Loại đơn: {loaiDon}. Nội dung: {noiDung}',
    'Phòng Cảnh sát hình sự chuyển đơn trên đến {tenDoi} để xem xét, giải quyết theo thẩm quyền.',
    'Lý do chuyển: {lyDoChuyen}',
    'Tài liệu kèm theo: {dinhKem}',
  ],
  signatureBlocks: [
    { left: 'Nơi nhận:\n- Như trên;\n- Đ/c Trưởng phòng (thay báo cáo);\n- Lưu: PC02-{teamCode}.', right: 'CÁN BỘ ĐỀ XUẤT\n\n{tenCanBoDeXuat}' },
  ],
};

const THONG_BAO_CHUYEN: TemplateSpec = {
  filename: 'THONG_BAO_CHUYEN.docx',
  title: 'THÔNG BÁO',
  loaiVanBan: '{soVanBan}/TB-PC02-{teamCode}',
  recipientLabel: 'Kính gửi: Ông/Bà {ghiTen}',
  body: [
    'Địa chỉ: {diaChi}',
    'Ngày {ngayNhan}, Phòng Cảnh sát hình sự đã tiếp nhận đơn của Ông/Bà về việc {noiDung}.',
    'Sau khi nghiên cứu nội dung, Phòng Cảnh sát hình sự xét thấy nội dung đơn thuộc thẩm quyền giải quyết của {tenDoi}.',
    'Phòng Cảnh sát hình sự đã chuyển đơn của Ông/Bà đến {tenDoi} để xem xét, giải quyết theo thẩm quyền.',
    'Đề nghị Ông/Bà liên hệ trực tiếp {tenDoi} để biết kết quả xử lý.',
  ],
  signatureBlocks: [
    { left: 'Nơi nhận:\n- Như trên;\n- Lưu: PC02-{teamCode}.', right: 'KT. TRƯỞNG PHÒNG\nPHÓ TRƯỞNG PHÒNG\n\n{tenTruongPhong}' },
  ],
};

const THONG_BAO_HUONG_DAN: TemplateSpec = {
  filename: 'THONG_BAO_HUONG_DAN.docx',
  title: 'THÔNG BÁO HƯỚNG DẪN',
  loaiVanBan: '{soVanBan}/HD-PC02-{teamCode}',
  recipientLabel: 'Kính gửi: Ông/Bà {ghiTen}',
  body: [
    'Địa chỉ: {diaChi}',
    'Ngày {ngayNhan}, Phòng Cảnh sát hình sự đã tiếp nhận đơn của Ông/Bà về việc {noiDung}.',
    'Sau khi nghiên cứu nội dung, Phòng Cảnh sát hình sự xét thấy vụ việc thuộc thẩm quyền giải quyết của Tòa án nhân dân theo quy định của Bộ luật Tố tụng dân sự.',
    'Phòng Cảnh sát hình sự hướng dẫn Ông/Bà: {huongDanKhoiKien}',
    'Lưu ý: Đây là văn bản hướng dẫn — chỉ hướng dẫn 1 lần. Đề nghị Ông/Bà nghiên cứu kỹ và liên hệ Tòa án nhân dân có thẩm quyền để được xem xét, giải quyết.',
  ],
  signatureBlocks: [
    { left: 'Nơi nhận:\n- Như trên;\n- Lưu: PC02-{teamCode}.', right: 'KT. TRƯỞNG PHÒNG\nPHÓ TRƯỞNG PHÒNG\n\n{tenTruongPhong}' },
  ],
};

const THONG_BAO_TRA_LAI: TemplateSpec = {
  filename: 'THONG_BAO_TRA_LAI.docx',
  title: 'THÔNG BÁO TRẢ LẠI ĐƠN',
  loaiVanBan: '{soVanBan}/TB-PC02-{teamCode}',
  recipientLabel: 'Kính gửi: Ông/Bà {ghiTen}',
  body: [
    'Địa chỉ: {diaChi}',
    'Ngày {ngayNhan}, Phòng Cảnh sát hình sự đã tiếp nhận đơn của Ông/Bà về việc {noiDung}.',
    'Sau khi nghiên cứu nội dung, Phòng Cảnh sát hình sự xét thấy đơn của Ông/Bà chưa đủ điều kiện thụ lý vì lý do sau: {lyDoTraDon}',
    'Phòng Cảnh sát hình sự trả lại đơn cùng tài liệu kèm theo cho Ông/Bà.',
    'Đề nghị Ông/Bà bổ sung, hoàn thiện theo nội dung trên và gửi lại nếu vẫn muốn được giải quyết.',
  ],
  signatureBlocks: [
    { left: 'Nơi nhận:\n- Như trên;\n- Lưu: PC02-{teamCode}.', right: 'CÁN BỘ ĐỀ XUẤT\n\n{tenCanBoDeXuat}' },
  ],
};

const BIEN_NHAN: TemplateSpec = {
  filename: 'BIEN_NHAN.docx',
  title: 'BIÊN NHẬN',
  loaiVanBan: '{soVanBan}/BN-PC02-{teamCode}',
  recipientLabel: 'Họ tên người nộp: {ghiTen}',
  body: [
    'Ngày {ngayNhan}, Phòng Cảnh sát hình sự đã tiếp nhận đơn/tài liệu của Ông/Bà {ghiTen}, địa chỉ {diaChi}.',
    'Nội dung đơn/tài liệu: {noiDung}',
    'Hồ sơ đính kèm: {dinhKem}',
    'Cán bộ tiếp nhận: {tenCanBoDeXuat}',
    'Phòng Cảnh sát hình sự xác nhận đã nhận đủ hồ sơ trên. Thời hạn giải quyết theo quy định pháp luật.',
    'Địa điểm: {diaDiem}, ngày {ngayPhatHanh}',
  ],
  signatureBlocks: [
    { left: 'NGƯỜI NỘP ĐƠN\n\n{ghiTen}', right: 'CÁN BỘ TIẾP NHẬN\n\n{tenCanBoDeXuat}' },
  ],
};

const ALL_TEMPLATES: TemplateSpec[] = [
  PHIEU_DE_XUAT,
  PHIEU_CHUYEN_NGUON_TIN,
  PHIEU_CHUYEN_DON,
  THONG_BAO_CHUYEN,
  THONG_BAO_HUONG_DAN,
  THONG_BAO_TRA_LAI,
  BIEN_NHAN,
];

function bold(text: string): TextRun {
  return new TextRun({ text, bold: true });
}

function buildDocument(spec: TemplateSpec): Document {
  const paragraphs: Paragraph[] = [];

  // Header — public service letterhead.
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [bold('CÔNG AN THÀNH PHỐ HỒ CHÍ MINH')],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [bold('PHÒNG CẢNH SÁT HÌNH SỰ')],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [bold('{tenDoiPhongBan}')],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [bold('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [bold('Độc lập - Tự do - Hạnh phúc')],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [bold(`Số: ${spec.loaiVanBan}`)],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun('{diaDiem}, ngày {ngayPhatHanh}')],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [bold(spec.title)],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [bold(spec.recipientLabel)] }),
    new Paragraph({ children: [] }),
  );

  // Body — caller-supplied paragraphs with {placeholders}.
  for (const line of spec.body) {
    paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
    paragraphs.push(new Paragraph({ children: [] }));
  }

  // Signature blocks.
  for (const block of spec.signatureBlocks) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun(block.left),
          new TextRun({ text: '\t\t\t\t\t' }),
          new TextRun(block.right),
        ],
      }),
      new Paragraph({ children: [] }),
    );
  }

  return new Document({
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.PORTRAIT } },
        },
        children: paragraphs,
      },
    ],
  });
}

async function main() {
  // PR4: 7 .docx mẫu đơn thư là SEED ASSET (prisma/seed-assets/petition-docx), không còn
  // bundle vào dist qua nest-cli (engine tĩnh đã gỡ). Regenerate ghi thẳng vào seed asset.
  const outDir = path.resolve(__dirname, '..', 'prisma', 'seed-assets', 'petition-docx');
  fs.mkdirSync(outDir, { recursive: true });

  for (const spec of ALL_TEMPLATES) {
    const doc = buildDocument(spec);
    const buf = await Packer.toBuffer(doc);
    const outPath = path.join(outDir, spec.filename);
    fs.writeFileSync(outPath, buf);
    console.log(`  ✔ Wrote ${spec.filename} (${buf.length} bytes)`);
  }

  console.log(`\nDone. ${ALL_TEMPLATES.length} templates in ${outDir}`);
}

main().catch((e) => {
  console.error('generate-docx-templates failed:', e);
  process.exit(1);
});
