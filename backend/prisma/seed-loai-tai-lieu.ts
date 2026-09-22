/**
 * Seed HẸP: chỉ danh mục `DOCUMENT_TYPE`.
 *
 * Chạy mỗi lần deploy. Bộ seed danh mục đầy đủ (`seed-directory-types.ts`) KHÔNG chạy khi
 * deploy và không nên chạy — nó còn nhánh đặt `isActive=false` cho các mục DISTRICT cũ, tức
 * ghi đè dữ liệu prod nằm ngoài phạm vi.
 *
 * Nhưng thiếu một mã `DOCUMENT_TYPE` thì khu tải tệp chuyên đề mở ra RỖNG và ô chọn loại không
 * có lựa chọn nào: hỏng im lặng, không lỗi nào hiện ra, và cán bộ kết luận "chức năng hỏng".
 * Đúng lớp khe hở giữa bộ nạp và bộ đọc.
 *
 * Idempotent: `upsert` theo ràng buộc duy nhất (type, code). Chạy lại bao nhiêu lần cũng được.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { LOAI_TAI_LIEU } from './seed-directory-types';

export async function seedLoaiTaiLieu(prismaClient: PrismaClient): Promise<void> {
  let them = 0;
  for (const muc of LOAI_TAI_LIEU) {
    const truoc = await prismaClient.directory.findUnique({
      where: { type_code: { type: muc.type, code: muc.code } },
      select: { id: true },
    });
    await prismaClient.directory.upsert({
      where: { type_code: { type: muc.type, code: muc.code } },
      update: { name: muc.name, order: muc.order, isActive: true },
      create: { type: muc.type, code: muc.code, name: muc.name, order: muc.order, isActive: true },
      /*
        CHỈ đọc về `id`.

        Không khai `select` thì Prisma đọc về MỌI cột vô hướng của model — kể cả cột bóng tìm
        kiếm mà một cơ sở dữ liệu chưa chạy migration còn thiếu, và cả lượt seed đổ vì một cột
        nó không hề ghi. Bộ seed danh mục đầy đủ mắc đúng chuyện này (nó đọc `result.createdAt`).
        Seed phải chạy được cả khi lược đồ đi trước hay đi sau nó một nhịp.
      */
      select: { id: true },
    });
    if (!truoc) them++;
  }
  console.log(
    `[seed-loai-tai-lieu] ${LOAI_TAI_LIEU.length} mã DOCUMENT_TYPE, thêm mới ${them}.`,
  );
}

if (require.main === module) {
  const adapter = new PrismaPg({
    connectionString:
      process.env['DATABASE_URL'] ??
      'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const client = new PrismaClient({ adapter });
  seedLoaiTaiLieu(client)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => void client.$disconnect());
}
