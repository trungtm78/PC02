/**
 * tao-tai-khoan-can-bo.ts — tạo tài khoản cho một cán bộ hệ cũ chưa có ở hệ mới.
 *
 * VÌ SAO CẦN: lượt nhập dữ liệu chỉ dùng bảng `thanh_vien` làm bảng TRA CỨU để gán người
 * tạo/điều tra viên — nó KHÔNG tạo tài khoản đăng nhập. Cán bộ mới thêm ở hệ cũ vì thế có
 * mặt trong dữ liệu nhưng không đăng nhập được hệ mới. Rà 25/08/2026 tìm ra một trường hợp:
 * `trongtuan` (Dương Trọng Tuấn), đăng nhập hệ cũ ngày 24/08.
 *
 * KHÔNG hardcode mật khẩu trong repo — truyền qua biến môi trường `MAT_KHAU`.
 * MẶC ĐỊNH CHỈ ĐỌC; `--apply` mới ghi. Chạy lại an toàn (bỏ qua nếu username đã có).
 *
 * Dùng: set -a && source .env && set +a
 *       MAT_KHAU='...' ts-node tao-tai-khoan-can-bo.ts \
 *         --username trongtuan --ho-dem 'Dương Trọng' --ten 'Tuấn' \
 *         --to 'PC02' --vai-tro OFFICER [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const username = arg('--username');
  const hoDem = arg('--ho-dem') ?? '';
  const ten = arg('--ten') ?? '';
  const tenTo = arg('--to');
  const tenVaiTro = arg('--vai-tro') ?? 'OFFICER';
  const matKhau = process.env['MAT_KHAU'];

  if (!username || !tenTo || !matKhau) {
    console.error('LỖI: cần --username, --to và biến môi trường MAT_KHAU.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });

  console.log(`\n=== Tạo tài khoản cán bộ — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`);

  try {
    const daCo = await prisma.user.findFirst({ where: { username } });
    if (daCo) {
      console.log(`Tài khoản "${username}" ĐÃ TỒN TẠI — không làm gì.`);
      return;
    }

    const to = await prisma.team.findFirst({ where: { name: tenTo } });
    if (!to) {
      console.error(`LỖI: không thấy tổ "${tenTo}". Không đoán tổ khác — dừng lại.`);
      process.exit(1);
    }
    const vaiTro = await prisma.role.findFirst({ where: { name: tenVaiTro } });
    if (!vaiTro) {
      console.error(`LỖI: không thấy vai trò "${tenVaiTro}".`);
      process.exit(1);
    }

    console.log(`Tên đăng nhập : ${username}`);
    console.log(`Họ và tên     : ${hoDem} ${ten}`.trimEnd());
    console.log(`Tổ            : ${to.name}`);
    console.log(`Vai trò       : ${vaiTro.name}`);
    console.log(`Đổi mật khẩu lần đầu: BẮT BUỘC`);

    if (!apply) {
      console.log('\n(CHỈ ĐỌC — chưa ghi gì. Thêm --apply để thực thi.)');
      return;
    }

    const nguoiDung = await prisma.user.create({
      data: {
        username,
        firstName: ten,
        lastName: hoDem,
        passwordHash: await bcrypt.hash(matKhau, 12),
        roleId: vaiTro.id,
        isActive: true,
        // Bắt buộc đổi ngay lần đăng nhập đầu — mật khẩu khởi tạo chỉ để mở cửa một lần.
        mustChangePassword: true,
        // Lược đồ để `twoFaSetupRequired` mặc định TRUE, nhưng toàn bộ tài khoản cán bộ
        // đang chạy đều là FALSE — cờ ấy từng chặn 238/256 tài khoản không đăng nhập được
        // và đã được gỡ. Tạo tài khoản mới mà quên tắt là tái tạo đúng tình trạng đó: máy
        // chủ trả `twoFaSetupToken` và người dùng đứng im ở màn đăng nhập. Đã bị chính lỗi
        // này ngày 25/08 và chỉ lộ ra khi thử đăng nhập THẬT, không phải khi tạo xong.
        twoFaSetupRequired: false,
      },
    });

    // KHÔNG có tổ thì phạm vi dữ liệu thu về "chỉ hồ sơ do chính mình nhập" và cán bộ mở
    // lên thấy màn hình trống. Gán tổ là phần bắt buộc của việc tạo tài khoản, không phải
    // bước phụ làm sau.
    await prisma.userTeam.create({ data: { userId: nguoiDung.id, teamId: to.id } });

    console.log(`\n>>> ĐÃ TẠO. id = ${nguoiDung.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
