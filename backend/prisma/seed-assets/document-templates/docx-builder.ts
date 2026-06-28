/**
 * Builder .docx cho bộ mẫu chứng từ chuẩn (VU_AN/VU_VIEC) — sinh bằng lib `docx`.
 * Bố cục bám biểu mẫu tố tụng hình sự: quốc hiệu/tiêu ngữ (phải) + cơ quan ban hành (trái) trong
 * 1 bảng KHÔNG viền, số văn bản, địa danh-ngày, tên văn bản, căn cứ, nội dung, nơi nhận, chữ ký.
 * Placeholder {ten} viết NGUYÊN trong 1 TextRun để docxtemplater parse được (không bị tách run).
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';

const FONT = 'Times New Roman';
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const CELL_NO_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
} as const;

export interface DocLine {
  text: string;
  bold?: boolean;
  italics?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  size?: number; // half-points? no — docx size là half-point; ta truyền point*2 bên dưới
  spacingAfter?: number;
  underline?: boolean;
}

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function para(line: DocLine): Paragraph {
  return new Paragraph({
    alignment: ALIGN[line.align ?? 'left'],
    spacing: { after: line.spacingAfter ?? 80 },
    children: [
      new TextRun({
        text: line.text,
        bold: line.bold,
        italics: line.italics,
        underline: line.underline ? {} : undefined,
        font: FONT,
        size: (line.size ?? 13) * 2, // point → half-point
      }),
    ],
  });
}

/** Bảng đầu trang KHÔNG viền: trái = cơ quan, phải = quốc hiệu/tiêu ngữ. */
function headerTable(leftLines: DocLine[], rightLines: DocLine[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: CELL_NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELL_NO_BORDERS, children: leftLines.map(para) }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELL_NO_BORDERS, children: rightLines.map(para) }),
        ],
      }),
    ],
  });
}

export interface TemplateBody {
  /** Cơ quan ban hành (trái) — thường có {donVi}/{donViGiaiQuyet}. */
  coQuan: string;
  /** Tên văn bản (giữa, in hoa đậm), vd "QUYẾT ĐỊNH". */
  tieuDe: string;
  /** Trích yếu dưới tên văn bản (giữa, in nghiêng/đậm), vd "Khởi tố vụ án hình sự". */
  trichYeu?: string;
  /** Các dòng nội dung (căn cứ, điều khoản…). */
  noiDung: DocLine[];
}

/** Sinh buffer .docx cho 1 mẫu. */
export async function buildTemplateDocx(body: TemplateBody): Promise<Buffer> {
  const right: DocLine[] = [
    { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', align: 'center', bold: true, size: 12 },
    { text: 'Độc lập - Tự do - Hạnh phúc', align: 'center', bold: true, size: 13 },
    { text: '_______________________', align: 'center', spacingAfter: 120 },
    { text: '{diaDanh}, ngày ...... tháng ...... năm ............', align: 'center', italics: true, spacingAfter: 0 },
  ];
  const left: DocLine[] = [
    { text: body.coQuan, align: 'center', bold: true, size: 12 },
    { text: 'CƠ QUAN CẢNH SÁT ĐIỀU TRA', align: 'center', bold: true, size: 12 },
    { text: '_____________', align: 'center', spacingAfter: 120 },
    { text: 'Số:           /............', align: 'center', spacingAfter: 0 },
  ];

  const children: (Paragraph | Table)[] = [
    headerTable(left, right),
    para({ text: '', spacingAfter: 120 }),
    para({ text: body.tieuDe, align: 'center', bold: true, size: 15, spacingAfter: body.trichYeu ? 40 : 160 }),
  ];
  if (body.trichYeu) {
    children.push(para({ text: body.trichYeu, align: 'center', bold: true, italics: true, size: 13, spacingAfter: 160 }));
  }
  for (const l of body.noiDung) children.push(para(l));

  // Khối chữ ký (bên phải)
  children.push(para({ text: '', spacingAfter: 120 }));
  children.push(para({ text: 'THỦ TRƯỞNG/PHÓ THỦ TRƯỞNG', align: 'right', bold: true, size: 13, spacingAfter: 0 }));
  children.push(para({ text: 'CƠ QUAN CẢNH SÁT ĐIỀU TRA', align: 'right', bold: true, size: 13, spacingAfter: 0 }));
  children.push(para({ text: '(Ký, ghi rõ họ tên, đóng dấu)', align: 'right', italics: true, size: 12, spacingAfter: 0 }));

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc) as unknown as Promise<Buffer>;
}
