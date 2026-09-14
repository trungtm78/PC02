import * as fs from 'fs';
import * as path from 'path';
import type { TruongPrisma } from './sinh-tim-kiem';

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
