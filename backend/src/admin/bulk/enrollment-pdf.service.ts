import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Enrollment handover PDF (v0.25.0.0).
 *
 * 1 PDF per user. A6 portrait (in 4 trên A4). Vietnamese diacritics qua font
 * Be Vietnam Pro embed (Design subagent finding: pdfkit Helvetica default
 * không support → "Trần" hiện "?n").
 *
 * Per autoplan Eng E5: pdfkit sync blocks event loop. Accept stall trong
 * single-VM low-concurrency. Worker thread migrate sau nếu issue.
 */
@Injectable()
export class EnrollmentPdfService {
  private fontPath: string | null = null;

  constructor() {
    // Resolve font path — ship qua tarball trong deploy.yml backend/assets/
    const candidates = [
      path.resolve(__dirname, '../../../assets/fonts/BeVietnamPro-Regular.ttf'),
      path.resolve(__dirname, '../../assets/fonts/BeVietnamPro-Regular.ttf'),
      path.resolve(process.cwd(), 'backend/assets/fonts/BeVietnamPro-Regular.ttf'),
      path.resolve(process.cwd(), 'assets/fonts/BeVietnamPro-Regular.ttf'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.fontPath = p;
        break;
      }
    }
  }

  async generateHandoverPdf(params: {
    fullName: string;
    workId?: string | null;
    phone?: string | null;
    departmentName?: string | null;
    enrollmentUrl: string;
    expiresAt: Date;
  }): Promise<Buffer> {
    const { fullName, workId, phone, departmentName, enrollmentUrl, expiresAt } = params;

    const doc = new PDFDocument({ size: 'A6', margin: 16, layout: 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const donePromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Font setup — fallback to Helvetica if asset missing (diacritics broken)
    if (this.fontPath) {
      doc.registerFont('BeVN', this.fontPath);
      doc.font('BeVN');
    }

    // Header
    doc.fontSize(10).fillColor('#003973').text('PC02 — CÔNG AN TP HCM', { align: 'center' });
    doc.fontSize(8).fillColor('#666').text('Hệ thống quản lý vụ án', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .strokeColor('#003973')
      .lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.5);

    // User info
    doc.fontSize(11).fillColor('#000').text(fullName, { align: 'left' });
    doc.fontSize(8).fillColor('#444');
    if (workId) doc.text(`Số hiệu: ${workId}`);
    if (phone) doc.text(`SĐT: ${phone}`);
    if (departmentName) doc.text(`Đơn vị: ${departmentName}`);
    doc.moveDown(0.5);

    // QR code
    const qrPng = await QRCode.toBuffer(enrollmentUrl, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 200,
      margin: 1,
    });
    const qrWidth = 140;
    const qrX = (doc.page.width - qrWidth) / 2;
    doc.image(qrPng, qrX, doc.y, { width: qrWidth });
    doc.y += qrWidth + 8;

    // URL text fallback
    doc.fontSize(6).fillColor('#666').text(enrollmentUrl, doc.page.margins.left, doc.y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: 'center',
      lineGap: 0,
    });
    doc.moveDown(0.5);

    // Expiry warning
    const expFormatted = expiresAt.toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    doc.fontSize(7).fillColor('#dc2626').text(`Link hết hạn: ${expFormatted} (72h từ lúc tạo)`, {
      align: 'center',
    });

    doc.moveDown(0.3);
    doc.fontSize(6).fillColor('#999').text('Quét QR hoặc mở link → tự đặt mật khẩu lần đầu', {
      align: 'center',
    });

    doc.end();
    return donePromise;
  }
}
