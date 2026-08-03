/**
 * gen-legacy-labels.ts — Sinh map NHÃN field hệ cũ (ten_truong → ten_hien_thi) cho FE,
 * từ catalog TruongTuyChinh. Dùng cho panel "Dữ liệu gốc hệ cũ" hiển thị ĐẦY ĐỦ, đúng nhãn.
 *
 * Output: frontend/src/shared/legacy/legacyFieldLabels.generated.ts
 * Dùng: npx ts-node cli/gen-legacy-labels.ts
 */
import * as fs from 'fs';
import * as path from 'path';

interface CatField {
  tenTruong: string;
  tenHienThi: string;
}

function main(): void {
  const docs = path.resolve(__dirname, '../../../../docs/legacy');
  const catalog = JSON.parse(fs.readFileSync(path.join(docs, 'field-catalog.generated.json'), 'utf8'));
  const map: Record<string, string> = {};
  for (const group of ['ho_so', 'bi_can', 'dieu_tra_bo_sung'] as const) {
    for (const f of (catalog.fields?.[group] ?? []) as CatField[]) {
      if (f.tenTruong && f.tenHienThi && !map[f.tenTruong]) map[f.tenTruong] = f.tenHienThi;
    }
  }
  // Bổ sung nhãn thủ công cho vài key ngoài TruongTuyChinh (bảng TĐC + hệ thống thường gặp).
  const extra: Record<string, string> = {
    stt: 'Số thứ tự thụ lý (hệ cũ)',
    stt_cu: 'Số thứ tự hồ sơ cũ',
    nam: 'Năm', thang: 'Tháng', ngay: 'Ngày',
    ngay_de_xuat: 'Ngày đề xuất',
    ngay_tiep_nhan_an_dtbs: 'Ngày tiếp nhận án điều tra bổ sung',
    ngay_ra_quyet_dinh_khoi_to: 'Ngày ra quyết định khởi tố',
    lich_su: 'Lịch sử chuyển đơn vị',
    tinh_trang_ho_so: 'Tình trạng hồ sơ',
    // Cụm tạm đình chỉ (bảng TamDinhChi_vu_viec)
    tam_dinh_chi_so: 'Số quyết định tạm đình chỉ',
    tam_dinh_chi_time: 'Ngày tạm đình chỉ',
    tam_dinh_chi_co_quan: 'Cơ quan tạm đình chỉ',
    ly_do: 'Lý do', dtv: 'Điều tra viên', ksv: 'Kiểm sát viên',
    noi_dung: 'Nội dung', ghi_chu: 'Ghi chú', dieu: 'Điều luật',
    tiep_nhan_so: 'Tiếp nhận số', tiep_nhan_ngay: 'Tiếp nhận ngày',
    tiep_nhan_thang: 'Tiếp nhận tháng', tiep_nhan_nam: 'Tiếp nhận năm',
    kho_khan_vuong: 'Khó khăn vướng mắc',
  };
  for (const [k, v] of Object.entries(extra)) if (!map[k]) map[k] = v;

  const sorted = Object.keys(map).sort();
  const body = sorted.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`).join('\n');
  const out = `// AUTO-GENERATED bởi backend cli/gen-legacy-labels.ts — KHÔNG sửa tay.\n// Nhãn field hệ cũ pc02hcm.com (từ catalog TruongTuyChinh) cho panel "Dữ liệu gốc hệ cũ".\nexport const LEGACY_FIELD_LABELS: Record<string, string> = {\n${body}\n};\n`;
  const dir = path.resolve(__dirname, '../../../../frontend/src/shared/legacy');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'legacyFieldLabels.generated.ts'), out);
  console.log(`[gen-legacy-labels] ${sorted.length} nhãn → frontend/src/shared/legacy/legacyFieldLabels.generated.ts`);
}

main();
