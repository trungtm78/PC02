import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDirectoryDto } from './dto/create-directory.dto';
import { QueryDirectoryDto } from './dto/query-directory.dto';
import { khoaDonVi } from '../common/utils/chuan-hoa-ten.util';

type PartialCreateDto = Partial<CreateDirectoryDto> & {
  type?: string;
  code?: string;
  name?: string;
};

/**
 * Loại danh mục cán bộ được tự tạo trên ô tìm.
 *
 * Cố ý HẸP. Endpoint tạo nhanh dùng quyền `write:Petition` (cán bộ có sẵn) chứ không phải
 * `write:Directory` (chỉ ADMIN); mở rộng danh sách này là gián tiếp cho cán bộ sửa mọi danh
 * mục, kể cả danh mục pháp lý.
 */
export const LOAI_TAO_NHANH_DUOC = ['DON_VI'];

/**
 * Kết quả tạo nhanh. `daCoSan` là phần quan trọng: giao diện phải nói rõ "đơn vị này đã có, đã
 * chọn giúp bạn" chứ không im lặng chọn một dòng người dùng không chủ ý tạo — im lặng thì cán
 * bộ tưởng vừa tạo mới, và lần sau lại gõ thêm một biến thể nữa.
 */
export interface KetQuaTaoNhanh {
  id: string;
  type: string;
  code: string;
  name: string;
  isActive: boolean;
  daCoSan?: true;
}

/** Tiền tố mã sinh tự động theo loại. Mã phải khớp `^[A-Z0-9_-]+$` và ≤10 ký tự. */
const TIEN_TO_MA: Record<string, string> = { DON_VI: 'DV' };

/**
 * Mã kế tiếp = mã LỚN NHẤT đang có + 1, không phải số lượng dòng + 1.
 *
 * Đếm dòng sai theo hai cách: hai người tạo cùng lúc ra cùng một mã, và sau khi xoá một dòng
 * thì mã kế tiếp đụng mã đã tồn tại. Cả hai đều ném lỗi ở ràng buộc `@@unique([type, code])`
 * ngay giữa thao tác của cán bộ.
 */
function sinhMaTiepTheo(daCo: string[], tienTo: string): string {
  const mau = new RegExp(`^${tienTo}(\\d+)$`);
  const lonNhat = daCo.reduce((max, c) => {
    const m = mau.exec(c);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `${tienTo}${String(lonNhat + 1).padStart(4, '0')}`;
}

@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryDirectoryDto) {
    const { type, search, parentId, isActive, limit = 50, offset = 0 } = query;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;
    if (parentId !== undefined) {
      where.parentId = parentId === 'null' ? null : parentId;
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.directory.findMany({
        where,
        orderBy: [{ order: 'asc' }, { code: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.directory.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const dir = await this.prisma.directory.findUnique({ where: { id } });
    if (!dir) throw new NotFoundException(`Directory #${id} không tồn tại`);
    return dir;
  }

  async findTypes() {
    const types = await this.prisma.directory.findMany({
      select: { type: true },
      distinct: ['type'],
      orderBy: { type: 'asc' },
    });
    return types.map((t) => t.type);
  }

  async getTypeStats(): Promise<{ type: string; count: number }[]> {
    const counts = await this.prisma.directory.groupBy({
      by: ['type'],
      _count: { id: true },
      orderBy: { type: 'asc' },
    });
    return counts.map((c) => ({ type: c.type, count: c._count.id }));
  }

  async create(dto: CreateDirectoryDto) {
    // EC-02: Unique code within type
    const existing = await this.prisma.directory.findUnique({
      where: { type_code: { type: dto.type, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(
        `Mã "${dto.code}" đã tồn tại trong loại danh mục "${dto.type}"`,
      );
    }

    // Validate parentId if provided — allow cross-type (e.g. PROVINCE → WARD)
    if (dto.parentId) {
      const parent = await this.prisma.directory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent)
        throw new NotFoundException(
          `Danh mục cha #${dto.parentId} không tồn tại`,
        );
      // Note: same-type constraint removed — cross-type hierarchies are valid
      // (e.g. PROVINCE as parent of WARD entries)
    }

    return this.prisma.directory.create({
      data: {
        type: dto.type,
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        parentId: dto.parentId ?? null,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        metadata: (dto.metadata ?? undefined) as object | undefined,
      },
    });
  }

  /**
   * Tạo nhanh một mục danh mục ngay trên ô tìm của form — cửa HẸP.
   *
   * `POST /directories` đòi `write:Directory`, mà đo 09/09/2026 thì CHỈ ADMIN có (OFFICER: 0).
   * Cán bộ bấm "Tạo mới" sẽ nhận 403 — đúng lớp lỗi "không lưu được đơn thư" trước đây. Cửa này
   * mở cho `write:Petition` nên phải tự giới hạn: chỉ loại trong `LOAI_TAO_NHANH_DUOC`, cưỡng
   * chế ở ĐÂY chứ không chỉ ở DTO (DTO chỉ chặn đường đi qua controller).
   *
   * Chặn trùng bằng cùng bộ luật đã gộp dữ liệu cũ: gõ "BCH Công an phường Bàn Cờ" khi đã có
   * "Công an Phường Bàn Cờ" thì trả về mục cũ, không sinh bản sao. Không có bước này thì tính
   * năng dựng để chống trùng lại tự sinh trùng.
   */
  async taoNhanh(dto: { type: string; name: string }): Promise<KetQuaTaoNhanh> {
    if (!LOAI_TAO_NHANH_DUOC.includes(dto.type)) {
      throw new BadRequestException(
        `Không tạo nhanh được loại danh mục "${dto.type}". Chỉ cho phép: ${LOAI_TAO_NHANH_DUOC.join(', ')}.`,
      );
    }
    const ten = (dto.name ?? '').trim();
    if (!ten) throw new BadRequestException('Tên đơn vị không được để trống');

    const dangCo = await this.prisma.directory.findMany({
      where: { type: dto.type },
      select: { id: true, type: true, code: true, name: true, isActive: true },
    });

    const khoa = khoaDonVi(ten);
    const trung = dangCo.find((d) => khoaDonVi(d.name) === khoa);
    // Trả về mục đã có kèm dấu, để giao diện nói rõ "đơn vị này đã có" thay vì im lặng chọn một
    // dòng người dùng không chủ ý tạo.
    if (trung) return { ...trung, daCoSan: true as const };

    return this.prisma.directory.create({
      data: {
        type: dto.type,
        code: sinhMaTiepTheo(dangCo.map((d) => d.code), TIEN_TO_MA[dto.type]),
        name: ten,
        // Xếp sau các mục đã có: mục tự tạo chưa được duyệt, không nên nổi lên đầu ô tìm.
        order: 9000,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: PartialCreateDto) {
    const dir = await this.prisma.directory.findUnique({ where: { id } });
    if (!dir) throw new NotFoundException(`Directory #${id} không tồn tại`);

    // EC-02: check code uniqueness on change
    if (dto.code && dto.code !== dir.code) {
      const type = dto.type ?? dir.type;
      const dup = await this.prisma.directory.findUnique({
        where: { type_code: { type, code: dto.code } },
      });
      if (dup)
        throw new ConflictException(
          `Mã "${dto.code}" đã tồn tại trong loại "${type}"`,
        );
    }

    // EC-03: Prevent circular hierarchy
    if (dto.parentId && dto.parentId !== dir.parentId) {
      await this.checkCircularHierarchy(id, dto.parentId);
    }

    return this.prisma.directory.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as object }),
      },
    });
  }

  async remove(id: string) {
    const dir = await this.prisma.directory.findUnique({ where: { id } });
    if (!dir) throw new NotFoundException(`Directory #${id} không tồn tại`);

    // EC-01: Block delete if has children
    const childCount = await this.prisma.directory.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Không thể xóa danh mục có ${childCount} danh mục con. Vui lòng xóa danh mục con trước.`,
      );
    }

    await this.prisma.directory.delete({ where: { id } });
    return { message: 'Đã xóa danh mục thành công' };
  }

  /** Prevent infinite loop by checking if newParentId is a descendant of id */
  private async checkCircularHierarchy(
    id: string,
    newParentId: string,
  ): Promise<void> {
    const descendants = await this.getDescendantIds(id);
    if (descendants.includes(newParentId) || newParentId === id) {
      throw new BadRequestException(
        'Không thể gán danh mục cha tạo thành vòng lặp phân cấp',
      );
    }
  }

  private async getDescendantIds(id: string): Promise<string[]> {
    const children = await this.prisma.directory.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    const nested = await Promise.all(
      childIds.map((cid) => this.getDescendantIds(cid)),
    );
    return [...childIds, ...nested.flat()];
  }

  // Seed sample data for dev
  async seedSampleData() {
    const samples = [
      // Tội danh
      { type: 'CRIME', code: 'TH001', name: 'Trộm cắp tài sản', order: 1 },
      { type: 'CRIME', code: 'TH002', name: 'Cướp giật tài sản', order: 2 },
      {
        type: 'CRIME',
        code: 'TH003',
        name: 'Lừa đảo chiếm đoạt tài sản',
        order: 3,
      },
      { type: 'CRIME', code: 'TH004', name: 'Cố ý gây thương tích', order: 4 },
      // Đơn vị
      { type: 'ORG', code: 'CAHN', name: 'Công an TP.HCM', order: 1 },
      {
        type: 'ORG',
        code: 'PC02',
        name: 'Phòng PC02',
        order: 2,
        parentId: undefined,
      },
      // Địa bàn
      { type: 'LOCATION', code: 'Q1', name: 'Quận 1', order: 1 },
      { type: 'LOCATION', code: 'Q3', name: 'Quận 3', order: 2 },
      // Trạng thái
      { type: 'STATUS', code: 'DA_TIEP_NHAN', name: 'Đã tiếp nhận', order: 1 },
      {
        type: 'STATUS',
        code: 'DANG_DIEU_TRA',
        name: 'Đang điều tra',
        order: 2,
      },
      { type: 'STATUS', code: 'DA_KHOI_TO', name: 'Đã khởi tố', order: 3 },
      { type: 'STATUS', code: 'DA_KET_THUC', name: 'Đã kết thúc', order: 4 },
    ];

    for (const item of samples) {
      await this.prisma.directory.upsert({
        where: { type_code: { type: item.type, code: item.code } },
        update: {},
        create: {
          type: item.type,
          code: item.code,
          name: item.name,
          order: item.order,
        },
      });
    }

    return { message: `Đã seed ${samples.length} bản ghi danh mục mẫu` };
  }
}
