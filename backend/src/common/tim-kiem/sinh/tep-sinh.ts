import * as fs from 'fs';
import * as path from 'path';
import type { KhaiThucThe, TruongPrisma } from './sinh-tim-kiem';

/**
 * Chỗ nằm của các tệp bộ sinh tìm kiếm — MỘT nơi cho CLI ghi và cổng đọc, để hai bên không trỏ
 * hai đường khác nhau (cổng xanh vì đọc nhầm tệp là lỗi đã gặp trong dự án).
 *
 * Chạy từ MÃ NGUỒN (ts-node / jest), không từ `dist`.
 */
export const GOC_BACKEND = path.resolve(__dirname, '..', '..', '..', '..');
export const THU_MUC_MIGRATION = path.join(GOC_BACKEND, 'prisma', 'migrations');
export const TEP_SCHEMA = path.join(GOC_BACKEND, 'prisma', 'schema.prisma');
export const TEP_FRONTEND = path.resolve(
  GOC_BACKEND,
  '..',
  'frontend',
  'src',
  'shared',
  'tim-kiem',
  'generated.ts',
);

/** SQL vận hành khẩn — chạy tay trên CSDL lúc sự cố, nên nằm cạnh tài liệu vận hành. */
const THU_MUC_VAN_HANH = path.resolve(GOC_BACKEND, '..', 'docs', 'van-hanh');
export const TEP_SQL_TAT = path.join(
  THU_MUC_VAN_HANH,
  'tat-trigger-tim-kiem.sql',
);
export const TEP_SQL_BAT_LAI = path.join(
  THU_MUC_VAN_HANH,
  'bat-lai-trigger-tim-kiem.sql',
);

/** Thư mục migration tìm kiếm có dạng `<14 chữ số>_tim_kiem_<tên>`. */
const MAU_MIGRATION_TIM_KIEM = /^\d{14}_tim_kiem_[a-z0-9_]+$/;

/**
 * Migration tìm kiếm MỚI NHẤT — nơi đầu ra bộ sinh phải nằm nguyên văn. Migration cũ hơn đã áp
 * lên prod thì không được sửa; khai đổi thì tạo migration mới (`--moi <tên>`).
 */
export function thuMucMigrationTimKiemMoiNhat(
  danhSach: readonly string[] = fs.readdirSync(THU_MUC_MIGRATION),
): string | undefined {
  return [...danhSach]
    .filter((t) => MAU_MIGRATION_TIM_KIEM.test(t))
    .sort()
    .at(-1);
}

/** Thân `model <Ten> { … }` trong schema.prisma, hoặc `undefined` khi không có model ấy. */
function thanModel(schema: string, model: string): string | undefined {
  const m = new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(
    schema,
  );
  return m?.[1];
}

export interface CotDbLech {
  model: string;
  field: string;
  /** Tên cột khai dùng trong SQL thô (`cotDb` hoặc tên trường). */
  khai: string;
  /** Tên cột theo schema (`@map` hoặc tên trường); `null` khi model không có trường ấy. */
  schema: string | null;
}

/**
 * Trường khai mà tên cột SQL lệch schema.prisma: quên `cotDb` cho trường có `@map`, khai `cotDb`
 * thừa, hoặc gõ sai tên trường. Trigger sinh từ tên lệch sẽ làm migration dừng giữa deploy.
 */
export function cotDbLech(
  schema: string,
  khais: readonly KhaiThucThe[],
): CotDbLech[] {
  const ra: CotDbLech[] = [];
  for (const khai of khais) {
    const than = thanModel(schema, khai.model) ?? '';
    const cotSchema = (field: string): string | null => {
      const dong = new RegExp(`^\\s*${field}\\s+\\S+[^\\n]*$`, 'm').exec(than);
      if (!dong) return null;
      return /@map\("([^"]+)"\)/.exec(dong[0])?.[1] ?? field;
    };
    const kiem = (field: string, khaiCot: string) => {
      const s = cotSchema(field);
      if (s !== khaiCot) {
        ra.push({ model: khai.model, field, khai: khaiCot, schema: s });
      }
    };
    for (const t of khai.truong) {
      if (!t.cot) continue;
      if (t.cotGhep) {
        // `cot` là tên cột bóng, không có thật — kiểm từng cột nguồn ghép.
        for (const g of t.cotGhep) kiem(g, g);
        continue;
      }
      if (t.kieu === 'ngay' || t.kieu === 'chon') {
        // Chỉ đi qua Prisma bằng tên trường, không vào SQL thô: `@map` không liên quan — chỉ cần
        // trường tồn tại (gõ sai tên thì Prisma ném 500 lúc lọc).
        if (cotSchema(t.cot) === null) {
          ra.push({ model: khai.model, field: t.cot, khai: t.cot, schema: null });
        }
        continue;
      }
      kiem(t.cot, t.cotDb ?? t.cot);
    }
    for (const c of khai.cotThemVaoTatCa ?? []) kiem(c, c);
    for (const c of khai.cotBongPhu ?? []) kiem(c, c);
  }
  return ra;
}

/** Field bộ sinh cần mà schema.prisma chưa khai đúng `<field> String? @map("<cot>")`. */
export function truongPrismaThieu(
  schema: string,
  canCo: readonly TruongPrisma[],
): TruongPrisma[] {
  return canCo.filter((t) => {
    const than = thanModel(schema, t.model);
    if (!than) return true;
    const dong = new RegExp(
      `^\\s*${t.field}\\s+String\\?\\s+@map\\("${t.cot}"\\)`,
      'm',
    );
    return !dong.test(than);
  });
}
