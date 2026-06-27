import { BadRequestException, Injectable } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import {
  DocxTemplateLoaderService,
  DocumentType,
} from '../document-templates/docx-loader.service';

/**
 * Maps the 6 application-level document types to the 4 numbering series seeded
 * in PR1 T4 (see backend/prisma/seed-document-numbers.ts). PHIEU_CHUYEN and
 * THONG_BAO are shared counters per the original samples shared by anh:
 *   - Both "Phiếu chuyển nguồn tin" + "Phiếu chuyển đơn" use 5931/PC-PC02-Đ1
 *   - Both "Thông báo chuyển" + "Thông báo trả lại" use 5932/TB-PC02-Đ1
 */
export const DOC_TYPE_TO_SERIES = {
  PHIEU_DE_XUAT: 'PHIEU_DE_XUAT',
  PHIEU_CHUYEN_NGUON_TIN: 'PHIEU_CHUYEN',
  PHIEU_CHUYEN_DON: 'PHIEU_CHUYEN',
  THONG_BAO_CHUYEN: 'THONG_BAO',
  THONG_BAO_HUONG_DAN: 'HUONG_DAN',
  THONG_BAO_TRA_LAI: 'THONG_BAO',
  BIEN_NHAN: 'BIEN_NHAN',
} as const satisfies Record<DocumentType, string>;

/**
 * Fail-closed required-field validation per docType. Throws BadRequestException
 * naming the missing field so the frontend can scroll to it (PR3 acceptance).
 *
 * Bare-minimum (every docType): senderName, receivedDate, content (detailContent OR summary).
 * Per-docType additions:
 *   PHIEU_DE_XUAT          → nhanThay + deXuat (officer assessment is the whole point)
 *   PHIEU_CHUYEN_NGUON_TIN → lyDoChuyen + canCuPhapLy (Mẫu 03 TT 128/2025/TT-BCA)
 *   PHIEU_CHUYEN_DON       → lyDoChuyen
 *   THONG_BAO_CHUYEN       → assignedTeam exists (so the recipient is named)
 *   THONG_BAO_HUONG_DAN    → huongDanKhoiKien
 *   THONG_BAO_TRA_LAI      → lyDoTraDon
 */
export function validateFieldsForDocType(
  docType: DocumentType,
  petition: Record<string, unknown>,
): void {
  const missing: string[] = [];

  if (!petition.senderName || String(petition.senderName).trim() === '') {
    missing.push('senderName');
  }
  if (!petition.detailContent && !petition.summary) {
    missing.push('detailContent/summary (noiDung)');
  }

  switch (docType) {
    case 'PHIEU_DE_XUAT':
      if (!petition.nhanThay) missing.push('nhanThay');
      if (!petition.deXuat) missing.push('deXuat');
      break;
    case 'PHIEU_CHUYEN_NGUON_TIN':
      if (!petition.lyDoChuyen) missing.push('lyDoChuyen');
      if (!petition.canCuPhapLy) missing.push('canCuPhapLy');
      break;
    case 'PHIEU_CHUYEN_DON':
      if (!petition.lyDoChuyen) missing.push('lyDoChuyen');
      break;
    case 'THONG_BAO_CHUYEN':
      // Recipient team named in the body — fail closed if assignedTeam not set.
      break;
    case 'THONG_BAO_HUONG_DAN':
      if (!petition.huongDanKhoiKien) missing.push('huongDanKhoiKien');
      break;
    case 'THONG_BAO_TRA_LAI':
      if (!petition.lyDoTraDon) missing.push('lyDoTraDon');
      break;
    case 'BIEN_NHAN':
      // Biên nhận chỉ cần senderName + content — luôn có khi đơn đã tạo.
      break;
  }

  if (missing.length > 0) {
    throw new BadRequestException(
      `Không thể xuất ${docType}: thiếu các trường bắt buộc — ${missing.join(', ')}`,
    );
  }
}

/**
 * Renders a docx template with the given placeholder map. Pure function — no
 * I/O beyond the cached Buffer from DocxTemplateLoader. Atomic transaction in
 * PetitionsService wraps this call alongside commitWithTx + DocumentRenderLog
 * insert, so a render throw rolls back number allocation (T-RENDER-FAIL test
 * planned in plan PR2 §T9).
 *
 * docxtemplater configured with:
 *   - paragraphLoop: true       → allows {#items}…{/items} loops without empty <w:p>
 *   - linebreaks: true          → preserves \n in user-supplied multi-paragraph fields
 *   - nullGetter: () => ''      → missing placeholders render as empty (no [undefined])
 *   - inspectModule (no-op here, reserved for run-split preprocessing in a follow-up)
 */
@Injectable()
export class DocumentExportService {
  constructor(private readonly loader: DocxTemplateLoaderService) {}

  renderDocxTemplate(
    docType: DocumentType,
    placeholders: Record<string, string | undefined>,
  ): Buffer {
    const templateBuf = this.loader.get(docType);
    const zip = new PizZip(templateBuf);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    doc.render(placeholders);
    return doc.getZip().generate({ type: 'nodebuffer' });
  }
}
