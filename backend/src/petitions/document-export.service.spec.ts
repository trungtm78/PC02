import { DocxTemplateLoaderService } from '../document-templates/docx-loader.service';
import {
  DocumentExportService,
  DOC_TYPE_TO_SERIES,
  validateFieldsForDocType,
} from './document-export.service';

describe('DocumentExportService — pure helpers', () => {
  describe('DOC_TYPE_TO_SERIES mapping', () => {
    it('maps all 6 docTypes to a numbering series', () => {
      expect(DOC_TYPE_TO_SERIES.PHIEU_DE_XUAT).toBe('PHIEU_DE_XUAT');
      expect(DOC_TYPE_TO_SERIES.PHIEU_CHUYEN_NGUON_TIN).toBe('PHIEU_CHUYEN');
      expect(DOC_TYPE_TO_SERIES.PHIEU_CHUYEN_DON).toBe('PHIEU_CHUYEN');
      expect(DOC_TYPE_TO_SERIES.THONG_BAO_CHUYEN).toBe('THONG_BAO');
      expect(DOC_TYPE_TO_SERIES.THONG_BAO_HUONG_DAN).toBe('HUONG_DAN');
      expect(DOC_TYPE_TO_SERIES.THONG_BAO_TRA_LAI).toBe('THONG_BAO');
    });

    it('PHIEU_CHUYEN_NGUON_TIN + PHIEU_CHUYEN_DON share the PC counter', () => {
      expect(DOC_TYPE_TO_SERIES.PHIEU_CHUYEN_NGUON_TIN).toBe(
        DOC_TYPE_TO_SERIES.PHIEU_CHUYEN_DON,
      );
    });

    it('THONG_BAO_CHUYEN + THONG_BAO_TRA_LAI share the TB counter', () => {
      expect(DOC_TYPE_TO_SERIES.THONG_BAO_CHUYEN).toBe(
        DOC_TYPE_TO_SERIES.THONG_BAO_TRA_LAI,
      );
    });
  });

  describe('validateFieldsForDocType — fail-closed validation', () => {
    const basePetition = {
      senderName: 'Nguyễn Văn A',
      receivedDate: new Date('2026-05-29T00:00:00Z'),
      petitionType: 'TO_CAO',
      summary: 'Đơn tố cáo hành vi cố ý gây thương tích',
    };

    it('PHIEU_DE_XUAT requires nhanThay + deXuat', () => {
      expect(() =>
        validateFieldsForDocType('PHIEU_DE_XUAT', { ...basePetition }),
      ).toThrow(/nhanThay|deXuat/);
    });

    it('PHIEU_DE_XUAT passes when nhanThay + deXuat populated', () => {
      expect(() =>
        validateFieldsForDocType('PHIEU_DE_XUAT', {
          ...basePetition,
          nhanThay: 'Đơn có dấu hiệu tội phạm',
          deXuat: 'Đề xuất chuyển PC01',
        }),
      ).not.toThrow();
    });

    it('PHIEU_CHUYEN_NGUON_TIN requires lyDoChuyen + canCuPhapLy', () => {
      expect(() =>
        validateFieldsForDocType('PHIEU_CHUYEN_NGUON_TIN', { ...basePetition }),
      ).toThrow(/lyDoChuyen|canCuPhapLy/);
    });

    it('THONG_BAO_HUONG_DAN requires huongDanKhoiKien', () => {
      expect(() =>
        validateFieldsForDocType('THONG_BAO_HUONG_DAN', { ...basePetition }),
      ).toThrow(/huongDanKhoiKien/);
    });

    it('THONG_BAO_TRA_LAI requires lyDoTraDon', () => {
      expect(() =>
        validateFieldsForDocType('THONG_BAO_TRA_LAI', { ...basePetition }),
      ).toThrow(/lyDoTraDon/);
    });

    it('all 6 docTypes require senderName (base)', () => {
      const docTypes = [
        'PHIEU_DE_XUAT',
        'PHIEU_CHUYEN_NGUON_TIN',
        'PHIEU_CHUYEN_DON',
        'THONG_BAO_CHUYEN',
        'THONG_BAO_HUONG_DAN',
        'THONG_BAO_TRA_LAI',
      ] as const;
      for (const dt of docTypes) {
        expect(() =>
          validateFieldsForDocType(dt as any, {
            ...basePetition,
            senderName: '',
          }),
        ).toThrow(/senderName/);
      }
    });

    it('all 6 docTypes require some content — detailContent OR summary', () => {
      // Neither populated → throw
      expect(() =>
        validateFieldsForDocType('THONG_BAO_CHUYEN', {
          ...basePetition,
          detailContent: null,
          summary: null,
        }),
      ).toThrow(/detailContent|summary|noiDung/);

      // detailContent only → ok
      expect(() =>
        validateFieldsForDocType('THONG_BAO_CHUYEN', {
          ...basePetition,
          detailContent: 'Nội dung chi tiết',
          summary: null,
        }),
      ).not.toThrow();

      // summary only → ok
      expect(() =>
        validateFieldsForDocType('THONG_BAO_CHUYEN', {
          ...basePetition,
          detailContent: null,
          summary: 'Tóm tắt',
        }),
      ).not.toThrow();
    });
  });

  describe('renderDocxTemplate — integration with DocxTemplateLoader', () => {
    let loader: DocxTemplateLoaderService;
    let service: DocumentExportService;

    beforeAll(async () => {
      loader = new DocxTemplateLoaderService();
      await loader.onModuleInit();
      service = new DocumentExportService(loader);
    });

    it('renders PHIEU_DE_XUAT and the output is a non-empty Buffer larger than the template', () => {
      const buf = service.renderDocxTemplate('PHIEU_DE_XUAT', {
        soVanBan: '0001/ĐX-PC02-Đ1',
        teamCode: 'Đ1',
        tenDoi: 'Đội 1',
        tenDoiPhongBan: 'ĐỘI THAM MƯU TỔNG HỢP',
        diaDiem: 'Thành phố Hồ Chí Minh',
        ngayPhatHanh: 'ngày 29 tháng 05 năm 2026',
        ngayNhan: 'ngày 29 tháng 05 năm 2026',
        ngayDon: 'ngày 28 tháng 05 năm 2026',
        loaiDon: 'Tố cáo',
        ghiTen: 'Nguyễn Văn A',
        namSinh: '1980',
        diaChi: 'Quận 1, TP.HCM',
        nguonDon: 'Trực ban Phòng',
        noiDung: 'Nội dung tóm tắt vụ việc',
        dinhKem: '01 bản photocopy CCCD',
        raSoatTrung: 'Không',
        baoCaoBGD: 'Không',
        nhanThay: 'Đơn có dấu hiệu tội phạm',
        deXuat: 'Đề xuất xác minh',
        tenCanBoDeXuat: 'Đại úy Nguyễn Văn B',
        tenPhoDoiTruong: 'Trung tá Hoàng Công Việt',
        tenTruongPhong: 'Thượng tá Nguyễn Trung Hoà',
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2000);
    });

    it('rendered docx contains the substituted senderName as plain text in word/document.xml', () => {
      const buf = service.renderDocxTemplate('PHIEU_DE_XUAT', {
        soVanBan: 'X',
        teamCode: 'Đ1',
        tenDoi: 'X',
        tenDoiPhongBan: 'X',
        diaDiem: 'X',
        ngayPhatHanh: 'X',
        ngayNhan: 'X',
        ngayDon: 'X',
        loaiDon: 'X',
        ghiTen: 'NGUYEN_VAN_MARKER',
        namSinh: 'X',
        diaChi: 'X',
        nguonDon: 'X',
        noiDung: 'X',
        dinhKem: 'X',
        raSoatTrung: 'X',
        baoCaoBGD: 'X',
        nhanThay: 'X',
        deXuat: 'X',
        tenCanBoDeXuat: 'X',
        tenPhoDoiTruong: 'X',
        tenTruongPhong: 'X',
      });
      // docx is a zip; the marker should appear when we read the underlying XML.
      const PizZip = require('pizzip');
      const zip = new PizZip(buf);
      const xml = zip.files['word/document.xml'].asText();
      expect(xml).toContain('NGUYEN_VAN_MARKER');
    });

    it('missing placeholder renders as empty string (no [undefined] artifacts)', () => {
      // Strip one required placeholder from the input.
      const buf = service.renderDocxTemplate('PHIEU_DE_XUAT', {
        soVanBan: 'X',
        teamCode: 'Đ1',
        tenDoi: 'X',
        tenDoiPhongBan: 'X',
        diaDiem: 'X',
        ngayPhatHanh: 'X',
        ngayNhan: 'X',
        ngayDon: 'X',
        loaiDon: 'X',
        ghiTen: 'X',
        namSinh: 'X',
        diaChi: 'X',
        nguonDon: 'X',
        noiDung: 'X',
        dinhKem: 'X',
        raSoatTrung: 'X',
        baoCaoBGD: 'X',
        nhanThay: 'X',
        deXuat: 'X',
        tenCanBoDeXuat: 'X',
        tenPhoDoiTruong: 'X',
        // tenTruongPhong intentionally omitted
      } as any);
      const PizZip = require('pizzip');
      const zip = new PizZip(buf);
      const xml = zip.files['word/document.xml'].asText();
      expect(xml).not.toContain('undefined');
      expect(xml).not.toContain('{tenTruongPhong}');
    });
  });

  describe('escapeDocxtemplaterTokens — user-input injection defense', () => {
    let loader: DocxTemplateLoaderService;
    let service: DocumentExportService;

    beforeAll(async () => {
      loader = new DocxTemplateLoaderService();
      await loader.onModuleInit();
      service = new DocumentExportService(loader);
    });

    it('user-supplied senderName containing {deXuat} renders as literal, not interpolated', () => {
      const buf = service.renderDocxTemplate('PHIEU_DE_XUAT', {
        soVanBan: 'X',
        teamCode: 'Đ1',
        tenDoi: 'X',
        tenDoiPhongBan: 'X',
        diaDiem: 'X',
        ngayPhatHanh: 'X',
        ngayNhan: 'X',
        ngayDon: 'X',
        loaiDon: 'X',
        ghiTen: '{deXuat}-SHOULD-BE-LITERAL',
        namSinh: 'X',
        diaChi: 'X',
        nguonDon: 'X',
        noiDung: 'X',
        dinhKem: 'X',
        raSoatTrung: 'X',
        baoCaoBGD: 'X',
        nhanThay: 'X',
        deXuat: 'SECRET-INTERPOLATED',
        tenCanBoDeXuat: 'X',
        tenPhoDoiTruong: 'X',
        tenTruongPhong: 'X',
      });
      const PizZip = require('pizzip');
      const zip = new PizZip(buf);
      const xml = zip.files['word/document.xml'].asText();
      // The literal {deXuat} marker should survive; the secret should appear exactly
      // once (in the deXuat slot), not twice (which would prove injection succeeded).
      const secretMatches = xml.match(/SECRET-INTERPOLATED/g) ?? [];
      expect(secretMatches.length).toBe(1);
      expect(xml).toContain('SHOULD-BE-LITERAL');
    });
  });
});
