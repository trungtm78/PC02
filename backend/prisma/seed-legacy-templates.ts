/**
 * Nạp 11 mẫu in của hệ cũ vào hệ template động — để hệ mới in được mọi hồ sơ như hệ cũ.
 *
 * Hệ cũ (`_PC02/Modules/doi_1/act/xuatfile.php`) làm rất gọn: tra `loai` ra một file mẫu, rồi
 * đổ TOÀN BỘ trường của hồ sơ vào placeholder. Không lọc, không đòi trường nào — trường trống
 * thì in ra chỗ trống. Nên bấm vào hồ sơ nào cũng ra file.
 *
 * Hệ mới trước 28/08/2026 chỉ có mẫu quyết định tố tụng, đòi những trường mà CẢ HAI hệ đều
 * chưa từng có (`so_ket_luan_dieu_tra` 0 bản ghi, `nguoi_quyet_dinh` 0, `don_vi_xu_ly` 0) —
 * nên Vụ việc và Vụ án in được 0/5 mẫu.
 *
 * Giữ NGUYÊN file .docx gốc: hệ mới đã hỗ trợ ánh xạ placeholder tự do và cặp delimiter tuỳ
 * chọn, nên không phải sửa file — vừa khỏi hỏng định dạng, vừa dễ đối chiếu với bản in hệ cũ.
 *
 * Idempotent create-if-absent như các bộ seed mẫu khác; `SEED_TEMPLATES_FORCE_FILE=1` để đẩy
 * lại bytes khi mẫu gốc đổi.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { detectDocxVariables } from '../src/document-templates/docx-variables.util';
import { normalizeDocxTags } from '../src/document-templates/docx-normalize.util';
import { isAutoPlaceholder } from '../src/document-templates/entity-placeholders';

export interface MauHeCu {
  /** Tên file .docx gốc của hệ cũ. */
  file: string;
  /** Mã mẫu ở hệ mới — dùng `HE_CU_` để không đụng mã của bộ mẫu tố tụng. */
  code: string;
  name: string;
  entityType: 'DON_THU' | 'VU_VIEC' | 'VU_AN';
  category: string;
}

/**
 * Ánh xạ mẫu → thực thể, suy từ bảng `$template_mapping` trong mã in của hệ cũ.
 *
 * Hệ cũ có 10 `loai` hồ sơ còn hệ mới gom về ba màn, nên vài loại về chung một thực thể:
 * hướng dẫn / trao đổi chuyển án / trả hồ sơ đều là hồ sơ ĐƠN THƯ đã phân loại, và luật sư
 * dùng chung mẫu đăng ký bào chữa đúng như hệ cũ khai.
 */
export const MAU_HE_CU: MauHeCu[] = [
  { file: 'don_thu_mau.docx', code: 'HE_CU_DON_THU', name: 'Hồ sơ đơn thư (mẫu hệ cũ)', entityType: 'DON_THU', category: 'Khác' },
  { file: 'bien_nhan_don_thu_mau.docx', code: 'HE_CU_BIEN_NHAN', name: 'Biên nhận đơn thư (mẫu hệ cũ)', entityType: 'DON_THU', category: 'Biên bản' },
  { file: 'huong_dan_mau.docx', code: 'HE_CU_HUONG_DAN', name: 'Hồ sơ hướng dẫn (mẫu hệ cũ)', entityType: 'DON_THU', category: 'Thông báo' },
  { file: 'trao_doi_chuyen_an_mau.docx', code: 'HE_CU_TRAO_DOI', name: 'Trao đổi chuyển án (mẫu hệ cũ)', entityType: 'DON_THU', category: 'Khác' },
  { file: 'tra_ho_so_mau.docx', code: 'HE_CU_TRA_HO_SO', name: 'Trả hồ sơ (mẫu hệ cũ)', entityType: 'DON_THU', category: 'Khác' },
  { file: 'dang_ky_bao_chua_mau.docx', code: 'HE_CU_DANG_KY_BAO_CHUA', name: 'Đăng ký bào chữa (mẫu hệ cũ)', entityType: 'DON_THU', category: 'Giấy chứng nhận' },
  { file: 'so_dang_ky_bao_chua.docx', code: 'HE_CU_SO_DANG_KY_BAO_CHUA', name: 'Sổ đăng ký bào chữa (mẫu hệ cũ)', entityType: 'DON_THU', category: 'Khác' },
  { file: 'vu_viec_mau.docx', code: 'HE_CU_VU_VIEC', name: 'Hồ sơ vụ việc (mẫu hệ cũ)', entityType: 'VU_VIEC', category: 'Khác' },
  { file: 'vu_an_mau.docx', code: 'HE_CU_VU_AN', name: 'Hồ sơ vụ án (mẫu hệ cũ)', entityType: 'VU_AN', category: 'Khác' },
  { file: 'an_tra_bo_sung_mau.docx', code: 'HE_CU_AN_TRA_BO_SUNG', name: 'Án trả bổ sung (mẫu hệ cũ)', entityType: 'VU_AN', category: 'Khác' },
  { file: 'uy_thac_dieu_tra_mau.docx', code: 'HE_CU_UY_THAC', name: 'Uỷ thác điều tra (mẫu hệ cũ)', entityType: 'VU_AN', category: 'Khác' },
];

export function thuMucMauHeCu(): string {
  return path.resolve(__dirname, 'seed-assets', 'legacy-docx');
}

export interface BienMau {
  name: string;
  label: string;
  source: 'auto' | 'manual';
  field?: string;
  required: boolean;
}

/**
 * Biến của một mẫu hệ cũ.
 *
 * `required: false` cho TẤT CẢ — đây là điểm khác then chốt so với bộ mẫu tố tụng. Mẫu hệ cũ
 * vốn in cả khi trường trống; đặt một biến bắt buộc là mẫu bị chặn in, đúng chuyện đang xảy ra.
 */
export function bienCuaMauHeCu(buffer: Buffer, entityType: string): BienMau[] {
  // Chuẩn hoá TRƯỚC khi dò: Word cắt placeholder qua nhiều run có định dạng khác nhau, và cả
  // 11 mẫu hệ cũ đều vỡ kiểu ấy — dò thẳng ra tên rác lẫn nguyên thẻ XML.
  return detectDocxVariables(normalizeDocxTags(buffer)).map((name) => ({
    name,
    label: name,
    source: isAutoPlaceholder(entityType, name) ? ('auto' as const) : ('manual' as const),
    ...(isAutoPlaceholder(entityType, name) ? { field: name } : {}),
    required: false,
  }));
}

export async function seedLegacyTemplates(
  prisma: PrismaClient,
): Promise<{ created: number; skipped: number; updated: number }> {
  let created = 0;
  let skipped = 0;
  let updated = 0;
  const forceFile = process.env['SEED_TEMPLATES_FORCE_FILE'] === '1';

  const admin = await (prisma as any).user.findFirst({
    where: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } },
    select: { id: true },
  });
  if (!admin) {
    console.warn('⚠ Không tìm thấy ADMIN — bỏ qua seed mẫu hệ cũ (non-fatal).');
    return { created, skipped, updated };
  }

  const dir = thuMucMauHeCu();
  for (const m of MAU_HE_CU) {
    const file = path.join(dir, m.file);
    if (!fs.existsSync(file)) {
      console.warn(`⚠ Thiếu file ${file} — bỏ qua ${m.code}.`);
      continue;
    }
    // Lưu bản ĐÃ CHUẨN HOÁ: engine render đọc thẳng `fileBytes`, giữ bản gốc thì placeholder
    // vỡ vẫn vỡ và văn bản in ra còn nguyên chữ `{ten_bien}`.
    const buffer = normalizeDocxTags(fs.readFileSync(file));
    const variables = bienCuaMauHeCu(buffer, m.entityType);
    const fileSha = createHash('sha256').update(buffer).digest('hex');

    const existing = await (prisma as any).documentTemplate.findFirst({
      where: { entityType: m.entityType, code: m.code, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      if (!forceFile) {
        skipped++;
        continue;
      }
      await (prisma as any).documentTemplate.update({
        where: { id: existing.id },
        data: { fileBytes: buffer, fileSha, fileName: m.file, variables: variables as never },
      });
      updated++;
      continue;
    }

    await (prisma as any).documentTemplate.create({
      data: {
        code: m.code,
        name: m.name,
        entityType: m.entityType,
        category: m.category,
        fileBytes: buffer,
        fileSha,
        fileName: m.file,
        variables: variables as never,
        format: 'DOCX',
        needsNumber: false,
        status: 'active',
        sortOrder: 100,
        createdById: admin.id,
      },
    });
    created++;
  }
  console.log(`[mau-he-cu] tạo ${created} · bỏ qua ${skipped} · cập nhật ${updated}`);
  return { created, skipped, updated };
}
