import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PetitionsService } from './petitions.service';
import { boDauTimKiem } from '../common/tim-kiem/bo-dau';
import type { DataScope } from '../auth/services/unit-scope.service';

/**
 * Gợi ý tên người gửi kèm Tóm tắt nội dung — KIỂM TRÊN CƠ SỞ DỮ LIỆU THẬT.
 *
 * Spec đơn vị (`goi-y-don-theo-ten.spec.ts`) chỉ khẳng định HÌNH DẠNG truy vấn gửi cho Prisma. Nó không chứng minh
 * được hai điều quan trọng nhất, mà Codex đã chỉ ra:
 *  1. `groupBy` với `orderBy: _count` + `take` thật sự CHẠY được trên PostgreSQL (nếu Prisma từ chối ở lúc chạy
 *     thì production trả lỗi 500 mà mọi ca kiểm giả đều xanh);
 *  2. phạm vi dữ liệu thật sự CÔ LẬP: cùng một cái tên nằm ở hai tổ, hồ sơ xoá mềm, đơn chưa gán tổ, cán bộ phường.
 *
 * Chỉ chạy khi có `PETITION_SUGGEST_DATABASE_URL` trỏ vào CSDL THỬ (127.0.0.1, tên đúng `pc02_goiy_scope_test`);
 * không có thì bị bỏ qua. Dựng: tạo CSDL rỗng, `DATABASE_URL=... npx prisma db push --accept-data-loss`.
 */
const diaChi = process.env.PETITION_SUGGEST_DATABASE_URL;
const chay = diaChi ? describe : describe.skip;

chay('goiYDonTheoTen trên PostgreSQL thật', () => {
  let db: PrismaClient;
  let svc: PetitionsService;
  const tien = `gy-${randomUUID().slice(0, 8)}`;
  let toA = '';
  let toB = '';

  const pvTo = (teamId: string, over: Partial<DataScope> = {}): DataScope => ({
    teamIds: [teamId],
    userIds: [],
    writableTeamIds: [teamId],
    writableUserIds: [],
    ...over,
  });

  async function taoDon(
    stt: string,
    ten: string,
    ngay: string,
    noiDung: string,
    teamId: string | null,
    over: Record<string, unknown> = {},
  ) {
    return db.petition.create({
      data: {
        stt: `${tien}-${stt}`,
        receivedDate: new Date(`${ngay}T00:00:00Z`),
        senderName: ten,
        // Ở môi trường thật cột bóng do trigger điền; CSDL thử dựng từ schema nên điền tay.
        senderNameBd: ` ${boDauTimKiem(ten)}`,
        detailContent: noiDung,
        assignedTeamId: teamId,
        ...over,
      } as never,
    });
  }

  beforeAll(async () => {
    const url = new URL(diaChi!);
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/pc02_goiy_scope_test') {
      throw new Error('Từ chối: PETITION_SUGGEST_DATABASE_URL phải trỏ 127.0.0.1/pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: diaChi! }) });
    svc = new PetitionsService(
      db as never,
      ...(Array(8).fill({}) as [never, never, never, never, never, never, never, never]),
    );
    toA = (await db.team.create({ data: { code: `${tien}-A`, name: `${tien}-A` } })).id;
    toB = (await db.team.create({ data: { code: `${tien}-B`, name: `${tien}-B` } })).id;

    // "Trần Thị A": 3 đơn ở tổ A (ngày khác nhau), 2 ở tổ B, 1 chưa gán tổ, 1 đã xoá mềm ở tổ A.
    await taoDon('a1', 'Trần Thị A', '2026-01-10', 'NOI DUNG TO-A cu nhat', toA);
    await taoDon('a2', 'Trần Thị A', '2026-02-10', 'NOI DUNG TO-A giua', toA);
    await taoDon('a3', 'Trần Thị A', '2026-03-10', 'NOI DUNG TO-A moi nhat', toA);
    await taoDon('b1', 'Trần Thị A', '2026-04-10', 'NOI DUNG TO-B mot', toB);
    await taoDon('b2', 'Trần Thị A', '2026-05-10', 'NOI DUNG TO-B hai', toB);
    await taoDon('u1', 'Trần Thị A', '2026-06-10', 'NOI DUNG CHUA-GAN', null);
    await taoDon('x1', 'Trần Thị A', '2026-07-10', 'NOI DUNG DA-XOA', toA, { deletedAt: new Date() });
    // Tên khác.
    await taoDon('c1', 'Trần Văn C', '2026-02-01', 'NOI DUNG C o to-A', toA);
    await taoDon('d1', 'Lê Văn D', '2026-02-02', 'NOI DUNG D chi o to-B', toB);
    await taoDon('d2', 'Lê Văn D', '2026-02-03', 'NOI DUNG D hai o to-B', toB);
    // Tên chứa ký tự đại diện.
    await taoDon('p1', '100% Công ty', '2026-02-04', 'NOI DUNG phan tram', toA);
  }, 60000);

  afterAll(async () => {
    await db?.petition.deleteMany({ where: { stt: { startsWith: `${tien}-` } } });
    await db?.team.deleteMany({ where: { code: { startsWith: tien } } });
    await db?.$disconnect();
  });

  it('CHẠY được trên PostgreSQL: groupBy + orderBy _count + take không bị Prisma từ chối', async () => {
    await expect(svc.goiYDonTheoTen('tran', null)).resolves.toBeInstanceOf(Array);
  });

  it('quản trị (không phạm vi): tên xếp theo TẦN SUẤT, tối đa 3 đơn mỗi tên, mới nhất trước, không có đơn xoá mềm', async () => {
    const ra = await svc.goiYDonTheoTen('tran', null);
    const theoTen = new Map<string, typeof ra>();
    for (const h of ra) theoTen.set(h.ten, [...(theoTen.get(h.ten) ?? []), h]);
    // Trần Thị A có 6 đơn chưa xoá (3 + 2 + 1) nên đứng đầu; Trần Văn C có 1.
    expect([...theoTen.keys()].slice(0, 2)).toEqual(['Trần Thị A', 'Trần Văn C']);
    const a = theoTen.get('Trần Thị A')!;
    expect(a).toHaveLength(3);
    expect(a.every((h) => h.soDonCungTen === 6)).toBe(true);
    // Mới nhất trước: đơn xoá mềm (07/2026) KHÔNG xuất hiện nên đầu là đơn chưa gán tổ (06/2026).
    expect(a.map((h) => h.tomTat)).toEqual(['NOI DUNG CHUA-GAN', 'NOI DUNG TO-B hai', 'NOI DUNG TO-B mot']);
    expect(ra.some((h) => h.tomTat?.includes('DA-XOA'))).toBe(false);
  });

  it('tổ A: KHÔNG thấy nội dung tổ B; số đơn cùng tên chỉ đếm phần đọc được; đơn chưa gán tổ vẫn thấy', async () => {
    const ra = await svc.goiYDonTheoTen('tran', pvTo(toA));
    const noiDung = ra.map((h) => h.tomTat ?? '').join(' | ');
    expect(noiDung).not.toContain('TO-B');
    expect(noiDung).toContain('CHUA-GAN');
    const a = ra.filter((h) => h.ten === 'Trần Thị A');
    // 3 đơn tổ A + 1 chưa gán = 4 (không cộng 2 đơn tổ B, không cộng đơn đã xoá).
    expect(a.every((h) => h.soDonCungTen === 4)).toBe(true);
  });

  it('tổ A: tên chỉ có ở tổ B ("Lê Văn D") KHÔNG lộ sự tồn tại', async () => {
    expect(await svc.goiYDonTheoTen('le van', pvTo(toA))).toEqual([]);
    const cuaB = await svc.goiYDonTheoTen('le van', pvTo(toB));
    expect(cuaB.map((h) => h.ten)).toEqual(['Lê Văn D', 'Lê Văn D']);
  });

  it('tổ B: không thấy nội dung tổ A', async () => {
    const ra = await svc.goiYDonTheoTen('tran', pvTo(toB));
    const noiDung = ra.map((h) => h.tomTat ?? '').join(' | ');
    expect(noiDung).not.toContain('TO-A');
    expect(noiDung).toContain('TO-B');
    expect(ra.some((h) => h.ten === 'Trần Văn C')).toBe(false);
  });

  it('cán bộ phường: CHỈ thấy đơn của tổ phường, không thấy đơn chưa gán tổ (intake)', async () => {
    const ra = await svc.goiYDonTheoTen('tran', pvTo(toA, { isWardOfficer: true, wardTeamId: toA }));
    const noiDung = ra.map((h) => h.tomTat ?? '').join(' | ');
    expect(noiDung).toContain('TO-A');
    expect(noiDung).not.toContain('CHUA-GAN');
    expect(noiDung).not.toContain('TO-B');
  });

  it('phạm vi RỖNG (không quyền): không thấy gì', async () => {
    const trong: DataScope = { teamIds: [], userIds: [], writableTeamIds: [], writableUserIds: [] };
    expect(await svc.goiYDonTheoTen('tran', trong)).toEqual([]);
  });

  it('gõ `%` không khớp mọi dòng; tên có chữ "100%" tìm được bằng chính ký tự đó', async () => {
    expect(await svc.goiYDonTheoTen('%%', null)).toEqual([]);
    const ra = await svc.goiYDonTheoTen('100%', pvTo(toA));
    expect(ra.map((h) => h.ten)).toEqual(['100% Công ty']);
  });

  it('dưới hai ký tự hoặc quá 100 ký tự: rỗng', async () => {
    expect(await svc.goiYDonTheoTen('t', null)).toEqual([]);
    expect(await svc.goiYDonTheoTen('a'.repeat(101), null)).toEqual([]);
  });
});
