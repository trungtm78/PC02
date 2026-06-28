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
/** 1 trường còn thiếu để in 1 mẫu — đủ thông tin cho FE hiện nhãn + ô nhập (text/textarea). */
export interface ExportMissingField {
  field: string;
  label: string;
  type: 'text' | 'textarea';
  /** true = cột đơn giản trên đơn → FE PUT lưu vào đơn (đơn thư: tất cả savable). */
  savable: boolean;
}

/** Nhãn VN + kiểu input cho các trường validate khi xuất. `noiDung` map vào cột `detailContent`. */
export const PETITION_EXPORT_FIELD_META: Record<string, { label: string; type: 'text' | 'textarea' }> = {
  senderName: { label: 'Tên người gửi', type: 'text' },
  detailContent: { label: 'Nội dung đơn thư', type: 'textarea' },
  nhanThay: { label: 'Nhận thấy', type: 'textarea' },
  deXuat: { label: 'Đề xuất', type: 'textarea' },
  lyDoChuyen: { label: 'Lý do chuyển', type: 'textarea' },
  canCuPhapLy: { label: 'Căn cứ pháp lý', type: 'textarea' },
  huongDanKhoiKien: { label: 'Hướng dẫn khởi kiện', type: 'textarea' },
  lyDoTraDon: { label: 'Lý do trả đơn', type: 'textarea' },
};

/**
 * Hàm THUẦN: trả danh sách trường còn thiếu để in `docType` (KHÔNG throw). Dùng chung cho
 * `validateFieldsForDocType` (throw khi xuất) + endpoint export-readiness (FE hiện trước).
 * Quy tắc giữ nguyên (xem JSDoc trên).
 */
export function getMissingFieldsForDocType(
  docType: DocumentType,
  petition: Record<string, unknown>,
): ExportMissingField[] {
  const out: ExportMissingField[] = [];
  const add = (field: string) => {
    const meta = PETITION_EXPORT_FIELD_META[field];
    out.push({ field, label: meta?.label ?? field, type: meta?.type ?? 'text', savable: true });
  };
  const empty = (v: unknown) => !v || String(v).trim() === '';

  if (empty(petition.senderName)) add('senderName');
  if (empty(petition.detailContent) && empty(petition.summary)) add('detailContent'); // noiDung → điền detailContent

  switch (docType) {
    case 'PHIEU_DE_XUAT':
      if (empty(petition.nhanThay)) add('nhanThay');
      if (empty(petition.deXuat)) add('deXuat');
      break;
    case 'PHIEU_CHUYEN_NGUON_TIN':
      if (empty(petition.lyDoChuyen)) add('lyDoChuyen');
      if (empty(petition.canCuPhapLy)) add('canCuPhapLy');
      break;
    case 'PHIEU_CHUYEN_DON':
      if (empty(petition.lyDoChuyen)) add('lyDoChuyen');
      break;
    case 'THONG_BAO_HUONG_DAN':
      if (empty(petition.huongDanKhoiKien)) add('huongDanKhoiKien');
      break;
    case 'THONG_BAO_TRA_LAI':
      if (empty(petition.lyDoTraDon)) add('lyDoTraDon');
      break;
    case 'THONG_BAO_CHUYEN':
    case 'BIEN_NHAN':
      break;
  }
  return out;
}

export function validateFieldsForDocType(
  docType: DocumentType,
  petition: Record<string, unknown>,
): void {
  const missing = getMissingFieldsForDocType(docType, petition);
  if (missing.length > 0) {
    throw new BadRequestException(
      `Không thể xuất ${docType}: thiếu các trường bắt buộc — ${missing.map((m) => m.field).join(', ')}`,
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
